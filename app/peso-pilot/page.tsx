import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/app/ui/DashboardClient";

export const dynamic = "force-dynamic";

export default async function PesoPilotPage() {
  const today = new Date();

  const latest = await prisma.exchangeRate.findFirst({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: today },
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
      {/* Nice header bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B18]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="text-sm font-semibold">₱</span>
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">Peso Pilot</div>
              <div className="text-xs text-white/60">Dashboard • USD/PHP</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
            >
              ← Home
            </Link>

            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
              aria-label="Theme"
              title="Theme"
            >
              🌙
            </button>
          </div>
        </div>
      </header>

      {/* Your existing dashboard UI */}
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
