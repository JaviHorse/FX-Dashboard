// app/api/cron/import-bsp/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // important for Prisma on Vercel

const prisma = new PrismaClient();

// ✅ FIX: do NOT name this "URL" (it shadows the global URL constructor)
const BSP_URL = "https://www.bsp.gov.ph/statistics/external/day99_data.aspx";
const PAIR = "USD/PHP";

function parseMonthYear(label: string): { month: number; year: number } | null {
  const m = label
    .trim()
    .match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
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

function trimNonEmpty(arr: string[]): string[] {
  return arr.map((s) => s.trim()).filter((s) => s !== "");
}

function trimKeepBlanks(arr: string[]): string[] {
  return arr.map((s) => s.trim()); // IMPORTANT: keep blanks to preserve alignment
}

export async function GET(req: Request) {
  try {
    // (Optional but recommended) Protect endpoint with a secret
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const got = new URL(req.url).searchParams.get("secret");
      if (got !== secret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[cron] Fetching BSP exchange rate data...");

    const res = await axios.get(BSP_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      },
      timeout: 30_000,
    });

    const $ = cheerio.load(res.data);

    const table = $("table").first();
    const rows = table.find("tr");
    if (!rows.length) throw new Error("No rows found.");

    // Use "now" (with buffer) instead of "end of today UTC" to avoid timezone skips
    const nowMs = Date.now();
    const futureBufferMs = 36 * 60 * 60 * 1000; // 36h buffer

    // 1) Find header row
    let headerIndex = -1;
    let headerCells: string[] = [];

    rows.each((i, row) => {
      const raw = $(row)
        .find("th,td")
        .map((_, el) => $(el).text())
        .get() as string[];

      const cells = trimNonEmpty(raw);

      const hasDate = cells.some((c) => /^Date$/i.test(c));
      const hasMonth = cells.some((c) => parseMonthYear(c) !== null);

      if (hasDate && hasMonth && headerIndex === -1) {
        headerIndex = i;
        headerCells = cells;
      }
    });

    if (headerIndex === -1) throw new Error("Header row not found.");

    const datePos = headerCells.findIndex((c) => /^Date$/i.test(c));
    if (datePos === -1) throw new Error("Header row found but 'Date' not present.");

    const monthHeaders = headerCells.slice(datePos + 1);
    const months = monthHeaders
      .map(parseMonthYear)
      .filter(Boolean) as { month: number; year: number }[];

    if (months.length === 0) throw new Error("No months parsed from header.");

    let upserts = 0;

    // 2) Parse data rows (keep blanks!)
    for (let r = headerIndex + 1; r < rows.length; r++) {
      const raw = rows
        .eq(r)
        .find("th,td")
        .map((_, el) => $(el).text())
        .get() as string[];

      const cells = trimKeepBlanks(raw);
      if (!cells.length) continue;

      const day = parseInt(cells[0], 10);
      if (!Number.isFinite(day)) continue;

      const rates = cells.slice(1);
      if (rates.length === 0) continue;

      // Align months to number of rate columns
      const monthsForRow = months.slice(-rates.length);
      if (monthsForRow.length !== rates.length) continue;

      for (let i = 0; i < rates.length; i++) {
        const rateText = rates[i]?.replace(/,/g, "").trim();
        if (!rateText) continue;

        const rate = parseFloat(rateText);
        if (!Number.isFinite(rate)) continue;

        const { year, month } = monthsForRow[i];
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // noon UTC stable

        // Skip true future placeholders
        if (date.getTime() > nowMs + futureBufferMs) continue;

        await prisma.exchangeRate.upsert({
          where: { pair_date: { pair: PAIR, date } },
          update: { rate },
          create: { pair: PAIR, date, rate, source: "BSP" },
        });

        upserts++;
      }
    }

    console.log(`[cron] ✅ Imported successfully. Upserts: ${upserts}`);

    return NextResponse.json({ ok: true, upserts });
  } catch (e: any) {
    console.error("[cron] ❌ Import failed:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Import failed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
