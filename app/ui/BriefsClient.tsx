"use client";

import { useEffect, useMemo, useState } from "react";

type Regime = "LOW" | "NORMAL" | "HIGH";
type FxBehavior = "RANGE_BOUND" | "CHOPPY" | "DIRECTIONAL_WITH_SWINGS";
type HedgeReadiness = "LOW" | "MEDIUM" | "HIGH";
type TreasurySignal = "LOW_RISK" | "MODERATE_RISK" | "ELEVATED_RISK";

type RiskReportResponse = {
  pointsCount: number;
  report: {
    meta: {
      title: string;
      pair: string;
      source: string;
      period: { start: string; end: string };
      generatedAt: string;
    };
    metrics: {
      latestExchangeRate: { value: number; date: string };
      periodMin: { value: number; date: string };
      periodMax: { value: number; date: string };
      rollingVolatility: { valueAnnPct30d: number | null; display: string; window: number };
      volatilityRegime: Regime;
      riskScore: number;
      fxBehavior?: {
        label: FxBehavior | null;
        rangePct: number | null;
        netMovePct: number | null;
        reversals: number | null;
        userText: string;
      };
    };
    narrative: {
      executiveSummary: string;
      keyMetricsExplained: Array<{ label: string; value: string; body: string }>;
      regimeInterpretation: { current: Regime; body: string };
    };
    data?: {
      count: number;
      points: Array<{ date: string; rate: number }>;
    };
  };
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoneyPHP(n: number) {
  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);
  return `${sign}₱${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtMoneyUSD(n: number) {
  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);
  return `${sign}$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number, digits = 2) {
  return `${n.toFixed(digits)}%`;
}

function regimeChip(regime: Regime) {
  switch (regime) {
    case "LOW":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25";
    case "NORMAL":
      return "bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/25";
    case "HIGH":
      return "bg-red-500/10 text-red-200 ring-1 ring-red-400/25";
  }
}

function regimeLabel(regime: Regime) {
  if (regime === "LOW") return "Low";
  if (regime === "NORMAL") return "Normal";
  return "High";
}

function behaviorChip(b: FxBehavior) {
  switch (b) {
    case "RANGE_BOUND":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25";
    case "CHOPPY":
      return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/25";
    case "DIRECTIONAL_WITH_SWINGS":
      return "bg-red-500/10 text-red-200 ring-1 ring-red-400/25";
  }
}

function behaviorLabel(b: FxBehavior) {
  if (b === "RANGE_BOUND") return "Range-Bound";
  if (b === "CHOPPY") return "Choppy";
  return "Directional w/ Swings";
}

function readinessChip(r: HedgeReadiness) {
  switch (r) {
    case "LOW":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25";
    case "MEDIUM":
      return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/25";
    case "HIGH":
      return "bg-red-500/10 text-red-200 ring-1 ring-red-400/25";
  }
}

function readinessLabel(r: HedgeReadiness) {
  if (r === "LOW") return "Low";
  if (r === "MEDIUM") return "Medium";
  return "High";
}

function computeHedgeReadiness(regime: Regime, behavior?: FxBehavior | null) {
  const b = behavior ?? null;

  if (regime === "HIGH") {
    if (b === "DIRECTIONAL_WITH_SWINGS") {
      return {
        readiness: "HIGH" as HedgeReadiness,
        explanation:
          "Volatility is elevated and price action is directionally biased with sizable swings. Consider tighter monitoring, faster decision cycles, and higher hedge urgency for open USD exposures.",
      };
    }
    if (b === "CHOPPY") {
      return {
        readiness: "HIGH" as HedgeReadiness,
        explanation:
          "Volatility is elevated with uneven price swings. Timing risk is high; consider earlier execution windows and stronger hedge readiness for near-term USD flows.",
      };
    }
    return {
      readiness: "HIGH" as HedgeReadiness,
      explanation:
        "Volatility is elevated. Even without a strong directional signal, short-term FX outcomes are less predictable; hedge readiness should be high.",
    };
  }

  if (regime === "NORMAL") {
    if (b === "DIRECTIONAL_WITH_SWINGS") {
      return {
        readiness: "MEDIUM" as HedgeReadiness,
        explanation:
          "Volatility is within normal bounds, but price action shows a directional bias. Consider moderate hedge readiness and review exposure timing for USD-linked transactions.",
      };
    }
    if (b === "CHOPPY") {
      return {
        readiness: "MEDIUM" as HedgeReadiness,
        explanation:
          "Volatility is typical, but movements are choppy with frequent reversals. Timing risk increases; hedge readiness should be medium with disciplined execution windows.",
      };
    }
    return {
      readiness: "LOW" as HedgeReadiness,
      explanation:
        "Volatility is typical and price action appears contained. Hedge readiness can remain low-to-standard, with routine monitoring and policy-aligned coverage.",
    };
  }

  if (b === "DIRECTIONAL_WITH_SWINGS") {
    return {
      readiness: "MEDIUM" as HedgeReadiness,
      explanation:
        "Volatility is subdued, but price action shows a directional bias. Consider medium hedge readiness for exposures sensitive to continued drift.",
    };
  }

  if (b === "CHOPPY") {
    return {
      readiness: "MEDIUM" as HedgeReadiness,
      explanation:
        "Volatility is subdued, but price swings are uneven with reversals. Timing risk can still matter; keep medium hedge readiness for near-term USD flows.",
    };
  }

  return {
    readiness: "LOW" as HedgeReadiness,
    explanation:
      "Volatility is subdued and price action is relatively stable. Near-term FX risk is limited; hedge readiness can be low with routine monitoring.",
  };
}

function impliedMove30DFromAnnVol(volAnnPct: number | null) {
  if (volAnnPct == null) return null;
  const vol = volAnnPct / 100;
  const move = vol * Math.sqrt(30 / 252);
  return move * 100;
}

function treasurySignalFromImpliedMove(movePct: number | null): TreasurySignal | null {
  if (movePct == null) return null;
  if (movePct < 1) return "LOW_RISK";
  if (movePct <= 2) return "MODERATE_RISK";
  return "ELEVATED_RISK";
}

function treasurySignalChip(sig: TreasurySignal) {
  switch (sig) {
    case "LOW_RISK":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25";
    case "MODERATE_RISK":
      return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/25";
    case "ELEVATED_RISK":
      return "bg-red-500/10 text-red-200 ring-1 ring-red-400/25";
  }
}

function treasurySignalLabel(sig: TreasurySignal) {
  if (sig === "LOW_RISK") return "Low risk";
  if (sig === "MODERATE_RISK") return "Moderate risk";
  return "Elevated risk";
}

function treasurySignalExplanation(sig: TreasurySignal, movePct: number) {
  if (sig === "LOW_RISK") {
    return `The current implied FX move is below 1% (${fmtPct(movePct, 2)}), suggesting tighter near-term uncertainty around USD-linked cash flows.`;
  }
  if (sig === "MODERATE_RISK") {
    return `The current implied FX move is around 1–2% (${fmtPct(movePct, 2)}), indicating moderate uncertainty around near-term USD costs and receipts.`;
  }
  return `The current implied FX move exceeds 2% (${fmtPct(movePct, 2)}), indicating increased uncertainty around near-term USD costs. Consider hedging part of your exposure.`;
}

function Sparkline({
  points,
  height = 44,
  width = 220,
}: {
  points: Array<{ rate: number }>;
  height?: number;
  width?: number;
}) {
  if (!points || points.length < 2) {
    return (
      <div className="mt-3 rounded-xl bg-white/[0.03] p-3 text-xs text-white/60 ring-1 ring-white/10">
        Not enough data for sparkline
      </div>
    );
  }

  const ys = points.map((p) => p.rate);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;

  const padX = 2;
  const padY = 2;

  const scaled = points.map((p, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(1, points.length - 1);
    const y = padY + (1 - (p.rate - minY) / range) * (height - padY * 2);
    return { x, y };
  });

  const d =
    `M ${scaled[0].x.toFixed(2)} ${scaled[0].y.toFixed(2)} ` +
    scaled
      .slice(1)
      .map((pt) => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(" ");

  return (
    <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white">Mini Trend</div>
        <div className="text-xs text-white/60">
          Range: ₱{minY.toFixed(3)} → ₱{maxY.toFixed(3)}
        </div>
      </div>

      <div className="mt-3">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="block h-[44px] w-full"
          preserveAspectRatio="none"
        >
          <path
            d={`M 0 ${(height * 0.33).toFixed(2)} L ${width} ${(height * 0.33).toFixed(2)}`}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d={`M 0 ${(height * 0.66).toFixed(2)} L ${width} ${(height * 0.66).toFixed(2)}`}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            fill="none"
          />

          <path
            d={d}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle
            cx={scaled[scaled.length - 1].x}
            cy={scaled[scaled.length - 1].y}
            r="2.6"
            fill="rgba(255,255,255,0.9)"
          />
        </svg>
      </div>
    </div>
  );
}

function PracticalImplications({ regime }: { regime: Regime }) {
  if (regime === "LOW") {
    return (
      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="text-sm font-semibold text-white">Low Volatility Regime (&lt;8%)</div>
        <div className="mt-3 grid gap-3 text-sm text-white/70">
          <div>
            <div className="font-medium text-white/85">Corporate Planning</div>
            <div>
              Exchange-rate assumptions tend to be more stable, allowing firms to plan with narrower FX buffers and
              longer forecast horizons. Budget variance driven by FX movements is generally limited.
            </div>
          </div>
          <div>
            <div className="font-medium text-white/85">Treasury Management</div>
            <div>
              Treasury operations can follow standard monitoring and reporting cycles, with reduced need for ad hoc
              interventions or escalation. Existing risk limits are typically sufficient.
            </div>
          </div>
          <div>
            <div className="font-medium text-white/85">Hedging Decisions</div>
            <div>
              Baseline hedging strategies often provide adequate protection in this environment. Lower implied
              volatility may reduce hedging costs, supporting cost-efficient maintenance of core hedge coverage.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (regime === "NORMAL") {
    return (
      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="text-sm font-semibold text-white">Normal Volatility Regime (8–15%)</div>
        <div className="mt-3 grid gap-3 text-sm text-white/70">
          <div>
            <div className="font-medium text-white/85">Corporate Planning</div>
            <div>
              FX movements reflect typical market dynamics, requiring moderate contingency buffers in pricing and
              budgeting. Forecast assumptions should account for routine fluctuations without over-adjustment.
            </div>
          </div>
          <div>
            <div className="font-medium text-white/85">Treasury Management</div>
            <div>
              Standard treasury controls, reporting frequency, and risk limits generally remain appropriate. Periodic
              review of exposures and hedge effectiveness is usually sufficient.
            </div>
          </div>
          <div>
            <div className="font-medium text-white/85">Hedging Decisions</div>
            <div>
              Conventional hedging approaches tend to perform as expected, balancing risk reduction with manageable
              costs. Hedge ratios and tenors can be aligned with established policy guidelines.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <div className="text-sm font-semibold text-white">High Volatility Regime (&gt;15%)</div>
      <div className="mt-3 grid gap-3 text-sm text-white/70">
        <div>
          <div className="font-medium text-white/85">Corporate Planning</div>
          <div>
            FX uncertainty increases, reducing confidence in point forecasts and increasing the importance of
            scenario-based planning. Wider FX buffers may be required to protect margins and cash flows.
          </div>
        </div>
        <div>
          <div className="font-medium text-white/85">Treasury Management</div>
          <div>
            More frequent monitoring and tighter oversight are often warranted. Treasury teams may reassess exposure
            concentrations, risk limits, and escalation triggers as market conditions evolve.
          </div>
        </div>
        <div>
          <div className="font-medium text-white/85">Hedging Decisions</div>
          <div>
            Higher volatility may justify increased hedge coverage, shorter hedge tenors, or more flexible instruments
            despite higher costs. The trade-off between hedging expense and downside protection becomes more critical.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BriefsClient() {
  const [start, setStart] = useState(daysAgoISO(90));
  const [end, setEnd] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<RiskReportResponse | null>(null);

  const [usdExposure, setUsdExposure] = useState<number>(2_000_000);

  const canGenerate = useMemo(() => {
    if (!start || !end) return false;
    return start <= end;
  }, [start, end]);

  async function generate() {
    if (!canGenerate) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `/api/briefs/risk-report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }

      const j = (await res.json()) as RiskReportResponse;
      setData(j);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = data?.report;

  const coverageLabel = useMemo(() => {
    if (!data) return "";
    const n = data.pointsCount;
    if (n <= 0) return "No data";
    if (n < 31) return `Partial coverage (${n} pts) — rolling vol needs ≥ 31`;
    return `Coverage: ${n} daily points`;
  }, [data]);

  const volMissing = report?.metrics.rollingVolatility.valueAnnPct30d === null;

  const hedge = useMemo(() => {
    if (!report) return null;
    const b = report.metrics.fxBehavior?.label ?? null;
    const { readiness, explanation } = computeHedgeReadiness(report.metrics.volatilityRegime, b);
    return { readiness, explanation, behavior: b };
  }, [report]);

  const treasury = useMemo(() => {
    if (!report) return null;

    const latest = report.metrics.latestExchangeRate.value;
    const impliedMovePct = impliedMove30DFromAnnVol(report.metrics.rollingVolatility.valueAnnPct30d);
    const sig = treasurySignalFromImpliedMove(impliedMovePct);

    const moveFrac = impliedMovePct == null ? null : impliedMovePct / 100;
    const lower = moveFrac == null ? null : latest * (1 - moveFrac);
    const upper = moveFrac == null ? null : latest * (1 + moveFrac);

    const phpAtSpot = usdExposure * latest;
    const phpAtUpper = upper == null ? null : usdExposure * upper;
    const swing = phpAtUpper == null ? null : phpAtUpper - phpAtSpot;

    return {
      impliedMovePct,
      signal: sig,
      lower,
      upper,
      phpAtSpot,
      phpAtUpper,
      swing,
    };
  }, [report, usdExposure]);

  const treasuryInterpretation = useMemo(() => {
    if (!report || !treasury) return null;

    const implied = treasury.impliedMovePct;
    if (implied == null) {
      return {
        headline: "What this means for treasury",
        body:
          "Volatility data is insufficient to estimate an implied 30-day move for the selected period. Consider widening the date range to compute a more stable volatility estimate.",
      };
    }

    const volLine = `Current FX volatility implies that USD/PHP could move by about ±${fmtPct(implied, 2)} over the next 30 days.`;
    const exposureLine =
      treasury.swing == null
        ? `For ${fmtMoneyUSD(usdExposure)} of USD exposure, this represents a material budget sensitivity to near-term FX moves.`
        : `For ${fmtMoneyUSD(usdExposure)} of USD exposure, this represents roughly ${fmtMoneyPHP(
            treasury.swing
          )} of potential FX impact.`;

    const cadenceLine = "Higher volatility = wider budget uncertainty.";

    return {
      headline: "What this means for treasury",
      body: `${volLine}\n\n${exposureLine}\n\n${cadenceLine}`,
    };
  }, [report, treasury, usdExposure]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">FX Briefs</h1>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/10">
              Generator
            </span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            Pick a period → generate an FX Risk Summary report.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-white/60">Start</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 w-[160px] rounded-xl bg-white/5 px-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-white/20"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-white/60">End</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 w-[160px] rounded-xl bg-white/5 px-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-white/20"
            />
          </div>

          <button
            onClick={generate}
            disabled={!canGenerate || loading}
            className={cn(
              "h-10 rounded-xl px-4 text-sm font-medium ring-1 transition",
              loading || !canGenerate
                ? "cursor-not-allowed bg-white/5 text-white/40 ring-white/10"
                : "bg-white/10 text-white ring-white/15 hover:bg-white/15"
            )}
          >
            {loading ? "Generating..." : "Generate FX Brief"}
          </button>
        </div>
      </div>

      {err && (
        <div className="no-print mb-6 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-red-400/20">
          {err}
        </div>
      )}

      {data && (
        <div className="no-print mb-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
            {coverageLabel}
          </span>

          {volMissing && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200 ring-1 ring-amber-400/20">
              Rolling volatility is N/A (insufficient points)
            </span>
          )}
        </div>
      )}

      <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/60">Report Score</div>
              <div className="text-xs text-white/50">
                {report ? new Date(report.meta.generatedAt).toLocaleString() : ""}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Risk Score</div>
                  <div className="mt-1 text-xs text-white/60">Proxy based on rolling vol</div>
                </div>
                <div className="text-3xl font-semibold text-white">{report ? report.metrics.riskScore : 0}</div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/60"
                  style={{ width: `${report ? report.metrics.riskScore : 0}%` }}
                />
              </div>

              {report && (
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                      regimeChip(report.metrics.volatilityRegime)
                    )}
                  >
                    {regimeLabel(report.metrics.volatilityRegime)} Volatility
                  </span>
                  <span className="text-xs text-white/60">30D vol: {report.metrics.rollingVolatility.display}</span>
                </div>
              )}

              {report?.metrics.fxBehavior?.label ? (
                <div className="mt-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-white">FX Behavior</div>

                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        behaviorChip(report.metrics.fxBehavior.label)
                      )}
                    >
                      {behaviorLabel(report.metrics.fxBehavior.label)}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-white/60">
                    {report.metrics.fxBehavior.rangePct != null && report.metrics.fxBehavior.netMovePct != null ? (
                      <>
                        Range: {report.metrics.fxBehavior.rangePct.toFixed(2)}% · Net:{" "}
                        {report.metrics.fxBehavior.netMovePct.toFixed(2)}% · Reversals:{" "}
                        {report.metrics.fxBehavior.reversals ?? 0}
                      </>
                    ) : (
                      "N/A (needs more points)"
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-white/70">{report.metrics.fxBehavior.userText}</p>
                </div>
              ) : null}
            </div>

            {report?.data?.points?.length ? (
              <Sparkline points={report.data.points.map((p) => ({ rate: p.rate }))} />
            ) : null}

            <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div className="text-sm font-semibold text-white">Quick Facts</div>

              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-white/60">Pair</div>
                  <div className="text-white">{report?.meta.pair ?? "USD/PHP"}</div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-white/60">Source</div>
                  <div className="text-white">{report?.meta.source ?? "BSP"}</div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-white/60">Period</div>
                  <div className="text-white text-right">
                    {report ? `${report.meta.period.start} → ${report.meta.period.end}` : ""}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="text-white/60">Latest</div>
                  <div className="text-white text-right">
                    {report ? `₱${report.metrics.latestExchangeRate.value.toFixed(3)}` : ""}
                    <div className="text-xs text-white/50">{report ? report.metrics.latestExchangeRate.date : ""}</div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="text-white/60">Range</div>
                  <div className="text-white text-right">
                    {report
                      ? `₱${report.metrics.periodMin.value.toFixed(3)} → ₱${report.metrics.periodMax.value.toFixed(3)}`
                      : ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-white">Regime Thresholds</div>

                {treasury?.signal ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                      treasurySignalChip(treasury.signal)
                    )}
                  >
                    Treasury Signal: {treasurySignalLabel(treasury.signal)}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2 text-xs text-white/70">
                <div className="flex items-center justify-between">
                  <span>Low</span>
                  <span>&lt; 8%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Normal</span>
                  <span>8–15%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>High</span>
                  <span>&gt; 15%</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Implied 30D Move</span>
                  <span className="text-white">
                    {treasury?.impliedMovePct == null ? "N/A" : `±${fmtPct(treasury.impliedMovePct, 2)}`}
                  </span>
                </div>
                <div className="mt-2 text-xs text-white/55">This is a risk envelope, not a forecast.</div>
              </div>

              <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Decision Logic</div>

                  {treasury?.signal ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        treasurySignalChip(treasury.signal)
                      )}
                    >
                      Treasury Signal: {treasurySignalLabel(treasury.signal)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <div className="grid grid-cols-3 bg-white/[0.03] text-xs font-semibold text-white/75">
                    <div className="px-3 py-2">Volatility</div>
                    <div className="px-3 py-2">Implied 30-Day Move</div>
                    <div className="px-3 py-2">Treasury Signal</div>
                  </div>

                  <div className="grid grid-cols-3 text-xs text-white/70">
                    <div className="px-3 py-2">Low</div>
                    <div className="px-3 py-2">&lt; 1%</div>
                    <div className="px-3 py-2">Low risk</div>

                    <div className="px-3 py-2">Normal</div>
                    <div className="px-3 py-2">1–2%</div>
                    <div className="px-3 py-2">Moderate risk</div>

                    <div className="px-3 py-2">High</div>
                    <div className="px-3 py-2">&gt; 2%</div>
                    <div className="px-3 py-2">Elevated risk</div>
                  </div>
                </div>

                {treasury?.signal && treasury.impliedMovePct != null ? (
                  <div className="mt-3 text-sm text-white/70">
                    {treasurySignalExplanation(treasury.signal, treasury.impliedMovePct)}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/60">N/A (requires sufficient data to estimate volatility).</div>
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-white">Expected 30-Day USD/PHP Range</div>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <div className="text-2xl font-semibold text-white">
                    {treasury?.lower == null ? "N/A" : `₱${treasury.lower.toFixed(2)}`}
                  </div>
                  <div className="text-white/40">—</div>
                  <div className="text-2xl font-semibold text-white">
                    {treasury?.upper == null ? "N/A" : `₱${treasury.upper.toFixed(2)}`}
                  </div>
                </div>

                <div className="mt-2 text-xs text-white/60">Based on current market volatility</div>
                <div className="mt-2 text-sm text-white/70">
                  This range reflects the level of uncertainty priced into the FX market today.
                </div>
              </div>
            </div>
          </aside>

          <main className="p-6">
            <div className="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs text-white/60">Report Title</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                    {report?.meta.title ?? "FX Risk Summary Report — PHP/USD"}
                  </h2>
                </div>

                {report && (
                  <div className="text-xs text-white/60">
                    Analysis period:{" "}
                    <span className="text-white/80">
                      {report.meta.period.start} to {report.meta.period.end}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-white">Executive Summary</div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{report?.narrative.executiveSummary ?? ""}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
              <div className="text-sm font-semibold text-white">Key Metrics Explained</div>

              <div className="mt-4 grid gap-3">
                {report?.narrative.keyMetricsExplained.map((k) => (
                  <div key={k.label} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-sm font-medium text-white">{k.label}</div>
                      <div className="text-sm font-semibold text-white">{k.value}</div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{k.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {report && (
              <div className="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-white">Practical Implications by Volatility Regime</div>

                <div className="mt-4">
                  <PracticalImplications regime={report.metrics.volatilityRegime} />
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
              <div className="text-sm font-semibold text-white">Volatility Regime Interpretation</div>

              {report && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-white/70">Current Volatility Regime:</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      regimeChip(report.metrics.volatilityRegime)
                    )}
                  >
                    {regimeLabel(report.metrics.volatilityRegime)}
                  </span>
                </div>
              )}

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {report?.narrative.regimeInterpretation.body ?? ""}
              </p>
            </div>

            {report && hedge && (
              <div className="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Hedge Readiness Monitor</div>

                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      readinessChip(hedge.readiness)
                    )}
                  >
                    Hedge Readiness: {readinessLabel(hedge.readiness)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-white/70">Volatility Regime:</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      regimeChip(report.metrics.volatilityRegime)
                    )}
                  >
                    {regimeLabel(report.metrics.volatilityRegime)}
                  </span>

                  {hedge.behavior ? (
                    <>
                      <span className="text-sm text-white/70">FX Behavior:</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          behaviorChip(hedge.behavior)
                        )}
                      >
                        {behaviorLabel(hedge.behavior)}
                      </span>
                    </>
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-white/70">{hedge.explanation}</p>
              </div>
            )}

            {report && (
              <div className="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Treasury FX Risk Brief</div>

                  {treasury?.signal ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        treasurySignalChip(treasury.signal)
                      )}
                    >
                      Treasury Signal: {treasurySignalLabel(treasury.signal)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 ring-1 ring-white/10">
                      Signal: N/A
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">Implied % Move</div>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/10">
                        30 Days
                      </span>
                    </div>

                    <div className="mt-3 text-2xl font-semibold text-white">
                      {treasury?.impliedMovePct == null ? "N/A" : `±${fmtPct(treasury.impliedMovePct, 2)}`}
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      Based on current volatility, USD/PHP typically moves about{" "}
                      {treasury?.impliedMovePct == null ? "N/A" : `±${fmtPct(treasury.impliedMovePct, 2)}`} over 30
                      days.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">Budget Impact</div>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/10">
                        30 Days
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-3">
                      <div className="grid gap-1">
                        <div className="text-xs text-white/60">USD Exposure</div>
                        <input
                          value={Number.isFinite(usdExposure) ? String(usdExposure) : ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, "").trim();
                            if (raw === "") {
                              setUsdExposure(0);
                              return;
                            }
                            const n = Number(raw);
                            if (!Number.isFinite(n)) return;
                            setUsdExposure(Math.max(0, n));
                          }}
                          inputMode="numeric"
                          className="h-10 rounded-xl bg-white/5 px-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-white/20"
                          placeholder="2000000"
                        />
                      </div>

                      <div className="grid gap-1">
                        <div className="text-xs text-white/60">At current rate</div>
                        <div className="text-sm font-semibold text-white">
                          {report ? fmtMoneyPHP(treasury?.phpAtSpot ?? 0) : "N/A"}
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <div className="text-xs text-white/60">At implied upper bound</div>
                        <div className="text-sm font-semibold text-white">
                          {treasury?.phpAtUpper == null ? "N/A" : fmtMoneyPHP(treasury.phpAtUpper)}
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <div className="text-xs text-white/60">Potential FX swing</div>
                        <div className="text-sm font-semibold text-white">
                          {treasury?.swing == null ? "N/A" : `≈ ${fmtMoneyPHP(treasury.swing)}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-white">{treasuryInterpretation?.headline}</div>
                  <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">
                    {treasuryInterpretation?.body ?? ""}
                  </div>
                </div>

                <div className="mt-3 text-xs text-white/50">This is a risk envelope, not a forecast.</div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
