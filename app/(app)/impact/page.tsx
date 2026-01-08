import { prisma } from "@/lib/prisma";
import ImpactMode from "@/app/ui/ImpactMode";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImpactPage() {
  const today = new Date();

  // Latest
  const latest = await prisma.exchangeRate.findFirst({
    where: { pair: "USD/PHP", source: "BSP", date: { lte: today } },
    orderBy: { date: "desc" },
    select: { rate: true, date: true },
  });

  if (!latest) throw new Error("No exchange rates found for USD/PHP from BSP.");

  const latestRate = Number(latest.rate);

  // Previous (2nd latest) for day-over-day delta, purely for UI
  const prev = await prisma.exchangeRate.findMany({
    where: { pair: "USD/PHP", source: "BSP", date: { lte: today } },
    orderBy: { date: "desc" },
    take: 2,
    select: { rate: true, date: true },
  });

  const prevRate = prev.length >= 2 ? Number(prev[1].rate) : null;
  const delta = prevRate != null ? latestRate - prevRate : null;
  const deltaPct = prevRate != null && prevRate !== 0 ? (delta! / prevRate) * 100 : null;

  // Movement-based styling for the KPI card (color/glow changes as data changes)
  const absPct = deltaPct != null ? Math.abs(deltaPct) : 0;

  const movement =
    deltaPct == null
      ? "neutral"
      : deltaPct > 0
      ? "up"
      : deltaPct < 0
      ? "down"
      : "neutral";

  const intensity =
    deltaPct == null ? "none" : absPct >= 0.5 ? "high" : absPct >= 0.25 ? "med" : "low";

  const kpiStyles =
    movement === "up"
      ? {
          ring: "ring-emerald-400/30",
          border: "border-emerald-400/20",
          glow:
            intensity === "high"
              ? "shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_0_40px_rgba(16,185,129,0.22)]"
              : intensity === "med"
              ? "shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_28px_rgba(16,185,129,0.14)]"
              : "shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_0_18px_rgba(16,185,129,0.10)]",
          badge: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25",
          dot: "bg-emerald-400",
        }
      : movement === "down"
      ? {
          ring: "ring-rose-400/30",
          border: "border-rose-400/20",
          glow:
            intensity === "high"
              ? "shadow-[0_0_0_1px_rgba(251,113,133,0.25),0_0_40px_rgba(244,63,94,0.20)]"
              : intensity === "med"
              ? "shadow-[0_0_0_1px_rgba(251,113,133,0.18),0_0_28px_rgba(244,63,94,0.12)]"
              : "shadow-[0_0_0_1px_rgba(251,113,133,0.12),0_0_18px_rgba(244,63,94,0.09)]",
          badge: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25",
          dot: "bg-rose-400",
        }
      : {
          ring: "ring-white/10",
          border: "border-white/10",
          glow: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_22px_rgba(99,102,241,0.10)]",
          badge: "bg-white/10 text-white/80 ring-1 ring-white/15",
          dot: "bg-indigo-300",
        };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070B18] text-white">
      {/* Background glow + subtle grid (pure UI) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute -bottom-56 -left-40 h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-[140px]" />
        <div className="absolute -right-40 top-24 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#070B18]/30 to-[#070B18]" />
      </div>

      <section className="relative mx-auto max-w-6xl px-6 pt-10">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 text-sm text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_18px_rgba(165,180,252,0.6)]" />
            Tools
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                  Impact Simulator
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Simulate USD/PHP moves and see how it could affect common expenses.
              </p>
            </div>

            {/* Live Rate pill (looks “premium”, still pure UI) */}
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 backdrop-blur">
              <span className="mr-2 text-white/50">Latest BSP:</span>
              <span className="font-semibold text-white">{fmtDate(latest.date)}</span>
            </div>
          </div>

          {/* Divider glow */}
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Live KPI card that changes color/glow as data changes */}
        <div
          className={[
            "mb-6 rounded-2xl border bg-white/[0.04] p-5 backdrop-blur",
            "ring-1",
            kpiStyles.border,
            kpiStyles.ring,
            kpiStyles.glow,
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={["h-3 w-3 rounded-full", kpiStyles.dot].join(" ")} />
                <div className="absolute inset-0 h-3 w-3 rounded-full opacity-60 blur-[6px]" />
              </div>
              <div>
                <div className="text-xs text-white/60">Live USD/PHP Reference Rate</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="text-2xl font-extrabold tabular-nums">{latestRate.toFixed(3)}</div>
                  <div className="text-xs text-white/50">PHP per 1 USD</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={["rounded-full px-3 py-1 text-xs tabular-nums", kpiStyles.badge].join(" ")}>
                {delta == null ? (
                  "No prior day"
                ) : (
                  <>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(3)} ({deltaPct! >= 0 ? "+" : ""}
                    {deltaPct!.toFixed(2)}%)
                  </>
                )}
              </span>

              <div className="text-right">
                <div className="text-xs text-white/60">Last updated</div>
                <div className="text-xs text-white/80">{fmtDate(latest.date)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-white/60">
            Tip: This card’s glow and badge color update automatically when new BSP data lands (bigger moves → stronger glow).
          </div>
        </div>

        {/* Your existing feature — unchanged */}
        <ImpactMode latestRate={latestRate} />
      </section>

      <div className="h-14" />
    </main>
  );
}
