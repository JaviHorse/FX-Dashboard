import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getUtcEndOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 59, 59, 999
    )
  );
}

export async function GET() {
  const cutoffUtc = getUtcEndOfToday();

  const latest = await prisma.exchangeRate.findFirst({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: cutoffUtc },
    },
    orderBy: { date: "desc" },
    select: { date: true, pair: true, source: true, rate: true },
  });

  if (!latest) {
    return NextResponse.json(
      { error: "No exchange rates found for USD/PHP from BSP." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    date: latest.date.toISOString(),
    pair: latest.pair,
    source: latest.source,
    rate: latest.rate.toString(),
  });
}
