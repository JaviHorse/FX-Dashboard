import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = new Date();

  const latest = await prisma.exchangeRate.findFirst({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: today },
    },
    orderBy: { date: "desc" },
    select: { date: true, pair: true, source: true, rate: true },
  });

  if (!latest) throw new Error("No exchange rates found for USD/PHP from BSP.");

  // Pull recent data for 24h change + 7D range
  const last8 = await prisma.exchangeRate.findMany({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: today },
    },
    orderBy: { date: "desc" },
    take: 8, // latest + ~7 prior points
    select: { date: true, rate: true },
  });

  const last7 = await prisma.exchangeRate.findMany({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: today },
    },
    orderBy: { date: "desc" },
    take: 7,
    select: { rate: true },
  });

  const latestRate = Number(latest.rate);
  const prevRate = last8.length >= 2 ? Number(last8[1].rate) : null;

  const change24h = prevRate !== null ? latestRate - prevRate : null;
  const pct24h =
    prevRate !== null && prevRate !== 0 ? (change24h! / prevRate) * 100 : null;

  const rates7 = last7.map((r) => Number(r.rate));
  const rangeLow7 = rates7.length ? Math.min(...rates7) : null;
  const rangeHigh7 = rates7.length ? Math.max(...rates7) : null;

  const fmtPHP = (v: number) =>
    v.toLocaleString("en-PH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-PH", { year: "numeric", month: "numeric", day: "numeric" });

  const changeColor =
    change24h === null ? "text-slate-200" : change24h >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <main className="min-h-screen bg-[#070B18] text-white">
      {/* Header bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B18]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="text-sm font-semibold">₱</span>
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">Peso Pilot</div>
              <div className="text-xs text-white/60">USD/PHP Market Analytics</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* theme button placeholder (keeps your “nice top-right button” look) */}
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
              aria-label="Theme"
              title="Theme"
            >
              🌙
            </button>

            <Link
              href="/peso-pilot"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-400"
            >
              Open Dashboard <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-10 shadow-[0_0_80px_rgba(99,102,241,0.10)]">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold ring-1 ring-white/10">
              Institutional FX Insights
            </span>
            <span className="text-sm text-white/60">Live signals from BSP rates</span>
          </div>

          <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.05]">
            Trade the Peso with <br /> risk-first clarity.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70">
            Peso Pilot reframes USD/PHP from a price series into a risk distribution.
It identifies volatility regimes, quantifies downside risk and drawdowns, and produces a volatility-scaled 30-day outlook. Scenario and sensitivity analysis translate FX moves directly into exposure-level P/L impact.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/peso-pilot"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold hover:bg-indigo-400"
            >
              Start Analysis <span aria-hidden>→</span>
            </Link>

            <a
              href="#kpis"
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
            >
              View Live KPIs
            </a>
          </div>
        </div>

        {/* KPI Cards */}
        <div id="kpis" className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold text-white/60">LIVE RATE (USD/PHP)</div>
            <div className="mt-3 text-3xl font-extrabold">₱{fmtPHP(latestRate)}</div>
            <div className="mt-2 text-xs text-white/60">{fmtDate(latest.date)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold text-white/60">24H CHANGE</div>
            <div className={`mt-3 text-3xl font-extrabold ${changeColor}`}>
              {change24h === null ? "—" : `${change24h >= 0 ? "+" : ""}${fmtPHP(change24h)}`}
            </div>
            <div className="mt-2 text-xs text-white/60">
              {pct24h === null ? "" : `${pct24h >= 0 ? "+" : ""}${pct24h.toFixed(2)}%`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold text-white/60">RANGE LOW (LAST 7D)</div>
            <div className="mt-3 text-3xl font-extrabold">
              {rangeLow7 === null ? "—" : `₱${fmtPHP(rangeLow7)}`}
            </div>
            <div className="mt-2 text-xs text-white/60">Period minimum</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold text-white/60">RANGE HIGH (LAST 7D)</div>
            <div className="mt-3 text-3xl font-extrabold">
              {rangeHigh7 === null ? "—" : `₱${fmtPHP(rangeHigh7)}`}
            </div>
            <div className="mt-2 text-xs text-white/60">Period maximum</div>
          </div>
        </div>
      </section>

      <div className="h-14" />
    </main>
  );
}
