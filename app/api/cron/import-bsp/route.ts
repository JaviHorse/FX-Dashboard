// app/api/cron/import-bsp/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const prisma = new PrismaClient();

const BSP_URL = "https://www.bsp.gov.ph/statistics/external/day99_data.aspx";
const PAIR = "USD/PHP";

function parseMonthYear(label: string): { month: number; year: number } | null {
  const m = label.trim().match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!m) return null;

  const monthMap: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  const key = m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase();
  const month = monthMap[key];
  const year = 2000 + parseInt(m[2], 10);
  if (!month || Number.isNaN(year)) return null;

  return { month, year };
}

function trimAll(arr: string[]): string[] {
  return arr.map((s) => (s ?? "").trim());
}

function cleanCells(arr: string[]): string[] {
  return arr.map((s) => (s ?? "").trim()).filter((s) => s !== "");
}

function getManilaTodayEndUtc(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(y, m - 1, d, 15, 59, 59, 999));
}

async function fetchBspHtmlWithRetry() {
  const url = `${BSP_URL}?t=${Date.now()}`;

  let lastErr: any;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await axios.get(url, {
        timeout: 20000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
    } catch (e) {
      lastErr = e;
      const waitMs = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

export async function GET(req: Request) {
  try {
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    if (!isVercelCron) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const beforeLatest = await prisma.exchangeRate.findFirst({
      where: { pair: PAIR },
      orderBy: { date: "desc" },
      select: { date: true, rate: true },
    });

    const res = await fetchBspHtmlWithRetry();
    const $ = cheerio.load(res.data);

    const table = $("table").first();
    const rows = table.find("tr").toArray();
    if (!rows.length) throw new Error("No rows found.");

    const cutoffUtc = getManilaTodayEndUtc();
    let headerRowIndex = -1;
    let headerRawTrimmed: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const raw = $(row)
        .find("th,td")
        .map((_, el) => $(el).text())
        .get() as string[];

      const rawTrimmed = trimAll(raw);
      const cleaned = cleanCells(rawTrimmed);

      const hasDate = cleaned.some((c) => /^Date$/i.test(c));
      const hasMonth = cleaned.some((c) => parseMonthYear(c) !== null);

      if (hasDate && hasMonth) {
        headerRowIndex = i;
        headerRawTrimmed = rawTrimmed;
        break;
      }
    }

    if (headerRowIndex === -1) throw new Error("Header row not found.");

    const datePos = headerRawTrimmed.findIndex((c) => /^Date$/i.test(c));
    if (datePos === -1) throw new Error("Header row found but 'Date' not present in raw cells.");

    const monthHeaderCellsRaw = headerRawTrimmed.slice(datePos + 1);
    const monthsByIndex = monthHeaderCellsRaw.map((cell) => parseMonthYear(cell));
    const monthCount = monthsByIndex.filter(Boolean).length;

    if (monthCount === 0) throw new Error("No months parsed from header.");

    let upserts = 0;

    const debugDays = new Set([6, 7]);
    const debug: any[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] as any;

      const raw = $(row)
        .find("th,td")
        .map((_, el) => $(el).text())
        .get() as string[];

      const rawCells = trimAll(raw);
      if (!rawCells.length) continue;

      const dayText = rawCells[datePos] ?? "";
      const day = parseInt(dayText, 10);
      if (Number.isNaN(day)) continue;

      const rates = rawCells.slice(datePos + 1, datePos + 1 + monthsByIndex.length);
      if (!rates.length) continue;

      if (debugDays.has(day)) {
        debug.push({
          day,
          rawCells,
          rates,
          monthsByIndexLength: monthsByIndex.length,
        });
      }

      for (let i = 0; i < rates.length && i < monthsByIndex.length; i++) {
        const ym = monthsByIndex[i];
        if (!ym) continue;

        const rateText = (rates[i] ?? "").replace(/,/g, "").trim();
        if (!rateText) continue;

        const rate = parseFloat(rateText);
        if (Number.isNaN(rate)) continue;

        const date = new Date(Date.UTC(ym.year, ym.month - 1, day, 12, 0, 0));
        if (date.getTime() > cutoffUtc.getTime()) continue;

        await prisma.exchangeRate.upsert({
          where: { pair_date: { pair: PAIR, date } },
          update: { rate, source: "BSP" },
          create: { pair: PAIR, date, rate, source: "BSP" },
        });

        upserts++;
      }
    }

    const afterLatest = await prisma.exchangeRate.findFirst({
      where: { pair: PAIR },
      orderBy: { date: "desc" },
      select: { date: true, rate: true },
    });

    return NextResponse.json({
      ok: true,
      upserts,
      latestInDb: afterLatest?.date?.toISOString() ?? null,
      latestRate: afterLatest?.rate ?? null,
      beforeLatestInDb: beforeLatest?.date?.toISOString() ?? null,
      beforeLatestRate: beforeLatest?.rate ?? null,
      headerRowIndex,
      datePos,
      parsedMonths: monthCount,
      cutoffUtc: cutoffUtc.toISOString(),
      debug,
    });
  } catch (e: any) {
    console.error("import-bsp cron failed:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
