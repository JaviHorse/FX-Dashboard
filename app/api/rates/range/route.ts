import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseISODateOnly(s: string) {
  // Expect YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (!Number.isFinite(d.getTime())) return null;

  return d;
}

function toISODateOnlyUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startStr = url.searchParams.get("start");
    const endStr = url.searchParams.get("end");

    // Optional (defaults preserved)
    const pair = url.searchParams.get("pair") ?? "USD/PHP";
    const source = url.searchParams.get("source") ?? "BSP";

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: "Missing required params: start, end (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const startDate = parseISODateOnly(startStr);
    const endDateRaw = parseISODateOnly(endStr);

    if (!startDate || !endDateRaw) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const endDateInclusive = new Date(endDateRaw);
    endDateInclusive.setUTCHours(23, 59, 59, 999);
    const now = new Date();
    const endClamped =
      endDateInclusive.getTime() > now.getTime() ? now : endDateInclusive;

    if (startDate.getTime() > endClamped.getTime()) {
      return NextResponse.json(
        { error: "start must be <= end" },
        { status: 400 }
      );
    }

    const rows = await prisma.exchangeRate.findMany({
      where: {
        pair,
        source,
        date: {
          gte: startDate,
          lte: endClamped,
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, rate: true },
    });

    const data = rows.map((r) => ({
      date: r.date.toISOString(),
      dateYMD: toISODateOnlyUTC(r.date),
      rate: r.rate.toString(),
    }));

    return NextResponse.json({
      pair,
      source,
      start: startStr,
      end: endStr,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("GET /api/rates/range error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
