import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ExchangeRateRow = {
  date: Date;
  rate: any;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nParam = url.searchParams.get("n");

    const n = nParam ? Number(nParam) : 30;
    if (!Number.isFinite(n) || n <= 0 || n > 3660) {
      return NextResponse.json(
        { error: "Invalid 'n'. Use a positive number (max 3660)." },
        { status: 400 }
      );
    }

    const today = new Date();

    const rows = await prisma.exchangeRate.findMany({
      where: {
        pair: "USD/PHP",
        source: "BSP",
        date: { lte: today }, // prevent future dates
      },
      orderBy: { date: "desc" },
      take: n,
      select: {
        date: true,
        rate: true,
      },
    });

    // Return in ascending order (nice for chart)
    const data = (rows as ExchangeRateRow[])
      .reverse()
      .map((r: ExchangeRateRow) => ({
        date: r.date.toISOString(),
        rate: r.rate.toString(),
      }));

    return NextResponse.json({
      pair: "USD/PHP",
      source: "BSP",
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("GET /api/rates/last error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
