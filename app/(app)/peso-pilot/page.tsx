import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/app/ui/DashboardClient";

export const dynamic = "force-dynamic";

// ✅ FIX: use end-of-day UTC so "today's" 12:00 UTC row is included
function getUtcEndOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

export default async function PesoPilotPage() {
  const cutoffUtc = getUtcEndOfToday();

  const latest = await prisma.exchangeRate.findFirst({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: cutoffUtc },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      pair: true,
      source: true,
      rate: true,
    },
  });

  if (!latest) {
    throw new Error("No exchange rates found for USD/PHP from BSP.");
  }

  return (
    <main className="min-h-screen bg-[#070B18] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DashboardClient
          latest={{
            date: latest.date.toISOString(),
            pair: latest.pair,
            source: latest.source,
            rate: latest.rate.toString(),
          }}
        />
      </div>
    </main>
  );
}
