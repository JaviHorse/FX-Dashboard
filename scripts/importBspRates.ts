// scripts/importBspRates.ts
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// IMPORTANT: don't name this "URL" because it breaks `new URL(...)` elsewhere in TS
const BSP_URL = "https://www.bsp.gov.ph/statistics/external/day99_data.aspx";
const PAIR = "USD/PHP";

function parseMonthYear(label: string): { month: number; year: number } | null {
  const m = label.trim().match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!m) return null;

  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
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

// remove empty/whitespace-only cells (ONLY use this for header finding / day parsing)
function cleanCells(arr: string[]): string[] {
  return arr.map((s) => (s ?? "").trim()).filter((s) => s !== "");
}

function getManilaTodayEndUtc(): Date {
  // End of "today" in Asia/Manila, converted to UTC.
  // Manila is UTC+8, so 23:59:59 Manila == 15:59:59 UTC (same Manila date).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  // 23:59:59.999 Manila -> 15:59:59.999 UTC
  return new Date(Date.UTC(y, m - 1, d, 15, 59, 59, 999));
}

async function importRates() {
  console.log("Fetching BSP exchange rate data...");

  const res = await axios.get(BSP_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    },
  });

  const $ = cheerio.load(res.data);

  // The BSP page has a single main table; first is usually correct
  const table = $("table").first();
  const rows = table.find("tr");
  if (!rows.length) throw new Error("No rows found.");

  const cutoffUtc = getManilaTodayEndUtc();

  // 1) Find header row and extract month headers (cleaned)
  let headerIndex = -1;
  let headerCellsClean: string[] = [];
  let headerCellsRawTrimmed: string[] = [];

  rows.each((i, row) => {
    const raw = $(row)
      .find("th,td")
      .map((_, el) => $(el).text())
      .get() as string[];

    const rawTrimmed = trimAll(raw);
    const cleaned = cleanCells(rawTrimmed);

    const hasDate = cleaned.some((c) => /^Date$/i.test(c));
    const hasMonth = cleaned.some((c) => parseMonthYear(c) !== null);

    if (hasDate && hasMonth && headerIndex === -1) {
      headerIndex = i;
      headerCellsClean = cleaned;
      headerCellsRawTrimmed = rawTrimmed;
    }
  });

  if (headerIndex === -1) throw new Error("Header row not found.");

  // Find where "Date" actually is in the RAW header cells (not cleaned),
  // because we need that exact index for data row alignment.
  const datePos = headerCellsRawTrimmed.findIndex((c) => /^Date$/i.test(c));
  if (datePos === -1) {
    // fallback: try cleaned header
    const datePosClean = headerCellsClean.findIndex((c) => /^Date$/i.test(c));
    throw new Error(
      `Header row found but 'Date' not present in raw header cells. Clean datePos=${datePosClean}`
    );
  }

  // Month headers are everything after "Date" in RAW cells (trimmed but blanks kept)
  const monthHeaderCellsRaw = headerCellsRawTrimmed.slice(datePos + 1);

  // Keep index alignment: monthsByIndex[i] corresponds to monthHeaderCellsRaw[i]
  const monthsByIndex = monthHeaderCellsRaw.map((cell) => parseMonthYear(cell));

  const monthCount = monthsByIndex.filter(Boolean).length;
  console.log("✅ Header row index:", headerIndex);
  console.log("✅ Date column index (datePos):", datePos);
  console.log("✅ Parsed month headers:", monthCount, "of", monthsByIndex.length);

  if (monthCount === 0) throw new Error("No months parsed from header.");

  let upserts = 0;

  // Optional debug: confirm Day 6/7 mapping
  const debugDays = new Set([6, 7]);

  // 2) Parse each data row
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const raw = rows
      .eq(r)
      .find("th,td")
      .map((_, el) => $(el).text())
      .get() as string[];

    // IMPORTANT: keep blanks to preserve alignment
    const rawCells = trimAll(raw);

    if (!rawCells.length) continue;

    // Day number should be at datePos (same position as header "Date")
    const dayText = rawCells[datePos] ?? "";
    const day = parseInt(dayText, 10);
    if (Number.isNaN(day)) continue;

    // Rates start immediately after the date column, and must align with monthsByIndex
    const rates = rawCells.slice(datePos + 1, datePos + 1 + monthsByIndex.length);

    if (!rates.length) continue;

    if (debugDays.has(day)) {
      console.log(`\n🧪 DEBUG DAY ${day}`);
      console.log("rawCells:", rawCells);
      console.log("rates (aligned):", rates);
      console.log("monthsByIndex len:", monthsByIndex.length);
    }

    for (let i = 0; i < rates.length && i < monthsByIndex.length; i++) {
      const ym = monthsByIndex[i];
      if (!ym) continue;

      const rateText = (rates[i] ?? "").replace(/,/g, "").trim();
      if (!rateText) continue;

      const rate = parseFloat(rateText);
      if (Number.isNaN(rate)) continue;

      const date = new Date(Date.UTC(ym.year, ym.month - 1, day, 12, 0, 0));

      // skip future placeholders beyond Manila "today"
      if (date.getTime() > cutoffUtc.getTime()) continue;

      await prisma.exchangeRate.upsert({
        where: { pair_date: { pair: PAIR, date } },
        update: { rate, source: "BSP" },
        create: { pair: PAIR, date, rate, source: "BSP" },
      });

      upserts++;

      if (debugDays.has(day)) {
        console.log(`✅ UPSERT: ${PAIR} ${date.toISOString()} = ${rate}`);
      }
    }
  }

  console.log(`✅ Imported successfully. Upserts: ${upserts}`);
  await prisma.$disconnect();
}

importRates().catch(async (e) => {
  console.error("❌ Import failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
