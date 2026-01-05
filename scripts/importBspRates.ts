// scripts/importBspRates.ts
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const URL = "https://www.bsp.gov.ph/statistics/external/day99_data.aspx";
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

  const month =
    monthMap[
      m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase()
    ];
  const year = 2000 + parseInt(m[2], 10);
  if (!month || Number.isNaN(year)) return null;

  return { month, year };
}

function cleanCells(arr: string[]): string[] {
  // remove empty/whitespace-only cells
  return arr.map((s) => s.trim()).filter((s) => s !== "");
}

async function importRates() {
  console.log("Fetching BSP exchange rate data...");

  const res = await axios.get(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    },
  });
  const $ = cheerio.load(res.data);

  const table = $("table").first();
  const rows = table.find("tr");
  if (!rows.length) throw new Error("No rows found.");

  // ✅ PATCH: define a UTC cutoff (end of "today" UTC) to skip future placeholders
  const now = new Date();
  const todayEndUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );

  // 1) Find header row and extract month headers (cleaned)
  let headerIndex = -1;
  let headerCells: string[] = [];

  rows.each((i, row) => {
    const raw = $(row)
      .find("th,td")
      .map((_, el) => $(el).text())
      .get() as string[];
    const cells = cleanCells(raw);

    const hasDate = cells.some((c) => /^Date$/i.test(c));
    const hasMonth = cells.some((c) => parseMonthYear(c) !== null);

    if (hasDate && hasMonth && headerIndex === -1) {
      headerIndex = i;
      headerCells = cells;
    }
  });

  if (headerIndex === -1) throw new Error("Header row not found.");

  // headerCells should look like: ["Date","Dec-24","Jan-25",...]
  // If it starts with "Date", good. If not, try to locate it.
  const datePos = headerCells.findIndex((c) => /^Date$/i.test(c));
  if (datePos === -1)
    throw new Error("Header row found but 'Date' not present after cleaning.");

  // Months are everything AFTER "Date"
  const monthHeaders = headerCells.slice(datePos + 1);
  const months = monthHeaders
    .map(parseMonthYear)
    .filter(Boolean) as { month: number; year: number }[];

  console.log("✅ Header row index:", headerIndex);
  console.log("✅ Clean header cells:", headerCells);
  console.log("✅ Month count:", months.length);

  if (months.length === 0) throw new Error("No months parsed from header.");

  let upserts = 0;

  // 2) Parse each data row by cleaning cells too
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const raw = rows
      .eq(r)
      .find("th,td")
      .map((_, el) => $(el).text())
      .get() as string[];
    const cells = cleanCells(raw);

    if (!cells.length) continue;

    // First cell should be day number (1..31)
    const day = parseInt(cells[0], 10);
    if (Number.isNaN(day)) continue;

    // Remaining cells are rates; some rows might have fewer rate columns -> align to last N months
    const rates = cells.slice(1);
    if (rates.length === 0) continue;

    const monthsForRow = months.slice(-rates.length);
    if (monthsForRow.length !== rates.length) continue;

    for (let i = 0; i < rates.length; i++) {
      const rateText = rates[i].replace(/,/g, "").trim();
      if (!rateText) continue;

      const rate = parseFloat(rateText);
      if (Number.isNaN(rate)) continue;

      const { year, month } = monthsForRow[i];
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

      // ✅ PATCH: skip future-dated placeholders (prevents Jan 5–31 "fake" rows)
      if (date.getTime() > todayEndUtc.getTime()) {
        continue;
      }

      await prisma.exchangeRate.upsert({
        where: { pair_date: { pair: PAIR, date } },
        update: { rate },
        create: { pair: PAIR, date, rate, source: "BSP" },
      });

      upserts++;
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
