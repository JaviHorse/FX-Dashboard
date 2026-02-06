import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET() {
  try {
    const latest = await prisma.exchangeRate.findFirst({
      where: { pair: "USD/PHP" },
      orderBy: { date: "desc" },
      select: { date: true, rate: true, updatedAt: true },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await prisma.exchangeRate.count({
      where: {
        pair: "USD/PHP",
        date: { gte: sevenDaysAgo },
      },
    });

    const now = new Date();
    const latestDate = latest?.date ? new Date(latest.date) : null;
    const daysOld =
      latestDate ? Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return NextResponse.json({
      ok: true,
      latestImport: latest
        ? { date: latest.date.toISOString(), rate: latest.rate, importedAt: latest.updatedAt.toISOString(), daysOld }
        : null,
      last7DaysCount: recentCount,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
