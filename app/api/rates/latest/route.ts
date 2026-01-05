import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date();

    const latest = await prisma.exchangeRate.findFirst({
      where: {
        pair: "USD/PHP",
        source: "BSP",
        date: { lte: today }, // ✅ prevent future dates
      },
      orderBy: { date: "desc" },
      select: { date: true, pair: true, rate: true, source: true },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "No exchange rates found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      date: latest.date.toISOString(),
      pair: latest.pair,
      source: latest.source,
      rate: latest.rate.toString(),
    });
  } catch (err) {
    console.error("GET /api/rates/latest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
