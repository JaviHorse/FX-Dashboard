"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildAlerts, type AlertItem, type AlertPack, type AlertSeverity } from "@/lib/alerts";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

type ApiPoint = { date: string; rate: string | number };

// --------- small UI helpers ----------
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtLocal(tsISO: string) {
  const d = new Date(tsISO);
  return d.toLocaleString();
}

function safeNum(x: any): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function fmt3(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = n * 100;
  return `${v.toFixed(2)}%`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ----- severity + accents -----
function severityStyles(sev: AlertSeverity) {
  switch (sev) {
    case "CRITICAL":
      return {
        pill: "bg-red-500/12 text-red-200 ring-1 ring-red-400/35",
        glow: "shadow-[0_0_0_1px_rgba(248,113,113,0.18),0_18px_50px_rgba(0,0,0,0.28)]",
        accent: "from-red-400/70 to-rose-500/30",
        accentLine: "bg-gradient-to-b from-red-300 to-rose-400",
      };
    case "ALERT":
      return {
        pill: "bg-amber-500/12 text-amber-200 ring-1 ring-amber-400/35",
        glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.16),0_18px_50px_rgba(0,0,0,0.28)]",
        accent: "from-amber-300/70 to-orange-500/25",
        accentLine: "bg-gradient-to-b from-amber-200 to-orange-300",
      };
    case "WATCH":
      return {
        pill: "bg-sky-500/12 text-sky-200 ring-1 ring-sky-400/35",
        glow: "shadow-[0_0_0_1px_rgba(56,189,248,0.16),0_18px_50px_rgba(0,0,0,0.28)]",
        accent: "from-sky-300/70 to-cyan-500/25",
        accentLine: "bg-gradient-to-b from-sky-200 to-cyan-300",
      };
    default:
      return {
        pill: "bg-slate-500/12 text-slate-200 ring-1 ring-slate-400/25",
        glow: "shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_18px_50px_rgba(0,0,0,0.28)]",
        accent: "from-slate-300/40 to-slate-600/20",
        accentLine: "bg-gradient-to-b from-slate-200 to-slate-400",
      };
  }
}

function StatusPill({ status }: { status: "LIVE" | "WAITING" }) {
  const live = status === "LIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase",
        "ring-1",
        live
          ? "bg-emerald-500/12 text-emerald-200 ring-emerald-400/35"
          : "bg-amber-500/12 text-amber-200 ring-amber-400/35"
      )}
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          live ? "bg-emerald-300" : "bg-amber-300",
          "animate-pulse"
        )}
      />
      {status}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const toneRing =
    tone === "good"
      ? "ring-emerald-400/20"
      : tone === "warn"
      ? "ring-amber-400/20"
      : tone === "bad"
      ? "ring-red-400/20"
      : tone === "info"
      ? "ring-sky-400/20"
      : "ring-white/10";

  const toneGlow =
    tone === "good"
      ? "shadow-[0_0_0_1px_rgba(52,211,153,0.10),0_18px_60px_rgba(0,0,0,0.32)]"
      : tone === "warn"
      ? "shadow-[0_0_0_1px_rgba(251,191,36,0.10),0_18px_60px_rgba(0,0,0,0.32)]"
      : tone === "bad"
      ? "shadow-[0_0_0_1px_rgba(248,113,113,0.10),0_18px_60px_rgba(0,0,0,0.32)]"
      : tone === "info"
      ? "shadow-[0_0_0_1px_rgba(56,189,248,0.10),0_18px_60px_rgba(0,0,0,0.32)]"
      : "shadow-[0_18px_60px_rgba(0,0,0,0.30)]";

  return (
    <div className={cn("rounded-2xl bg-white/[0.04] ring-1 px-4 py-3", toneRing, toneGlow)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">{label}</div>
        {hint ? <span className="text-[11px] text-slate-400/80">{hint}</span> : null}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  );
}

/** FIXED Range UI + hover tooltip (shows full range when truncated) */
function RangeMetric({ fromISO, toISO }: { fromISO: string | null; toISO: string | null }) {
  const has = Boolean(fromISO && toISO);
  const full = has ? `${fromISO} → ${toISO}` : "— → —";

  return (
    <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3">
      <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Range</div>

      {!has ? (
        <div className="mt-2 text-3xl font-semibold text-slate-100">—</div>
      ) : (
        <div className="mt-2 relative group">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.18em] uppercase text-slate-500">From</div>
              <div
                className="mt-1 font-mono tabular-nums text-[15px] leading-[1.1] text-slate-100 truncate"
                title={full}
              >
                {fromISO}
              </div>
            </div>

            <div className="mt-4 text-slate-400/80 font-semibold">→</div>

            <div className="min-w-0 text-right">
              <div className="text-[10px] tracking-[0.18em] uppercase text-slate-500">To</div>
              <div
                className="mt-1 font-mono tabular-nums text-[15px] leading-[1.1] text-slate-100 truncate"
                title={full}
              >
                {toISO}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[320px]",
              "-translate-x-1/2 rounded-xl bg-slate-950/95 px-3 py-2 text-xs",
              "ring-1 ring-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
              "opacity-0 translate-y-1 transition",
              "group-hover:opacity-100 group-hover:translate-y-0"
            )}
          >
            <div className="font-semibold text-slate-100">Full range</div>
            <div className="mt-1 font-mono text-slate-200">{full}</div>
          </div>

          <div className="mt-2 text-[11px] text-slate-400/80">Daily window used for thresholds</div>
        </div>
      )}
    </div>
  );
}

// --------- robust response parsing ----------
function extractPoints(data: any): ApiPoint[] {
  if (Array.isArray(data)) return data as ApiPoint[];

  const candidates = [data?.points, data?.rows, data?.data, data?.items, data?.result];
  for (const c of candidates) if (Array.isArray(c)) return c as ApiPoint[];

  return [];
}

function normalizePoints(raw: ApiPoint[]): ApiPoint[] {
  return raw
    .map((p) => ({
      date: String((p as any)?.date ?? ""),
      rate: (p as any)?.rate,
    }))
    .filter((p) => p.date.length > 0 && p.rate !== undefined && p.rate !== null);
}

function zContext(z: number | null) {
  if (z === null || !Number.isFinite(z)) {
    return { label: "No z-score yet", tone: "neutral" as const, blurb: "Need more history for a reliable baseline." };
  }
  const az = Math.abs(z);

  if (az >= 2.0)
    return {
      label: "Extreme move",
      tone: "bad" as const,
      blurb: "Price is far from its recent norm — treat as high attention.",
    };
  if (az >= 1.25)
    return {
      label: "Stretched",
      tone: "warn" as const,
      blurb: "Price is noticeably away from the average — review exposures today.",
    };
  if (az >= 0.6)
    return {
      label: "Leaning",
      tone: "info" as const,
      blurb: "A mild drift away from the mean — keep an eye on direction.",
    };
  return {
    label: "Near average",
    tone: "good" as const,
    blurb: "Price is behaving normally vs the last 90 days.",
  };
}

// UPDATED: make recent alerts useful + understandable (ONLY affects the 3 boxes)
function explainRecent(a: AlertItem) {
  const rawWhat = (a.signal || a.title || "").trim();
  const rawWhy = (a.whyCare || "").trim();
  const rawAction = (a.nextStep || "").trim();

  const clean = (s: string) =>
    (s || "")
      .replace(/\s+/g, " ")
      .replace(/z-?score/gi, "how unusual this move is")
      .replace(/sigma|σ/gi, "normal range")
      .replace(/stdev|std dev|standard deviation/gi, "normal range")
      .replace(/regime/gi, "market mode")
      .replace(/thresholds?/gi, "alert level")
      .trim();

  const short = (s: string, max = 120) => {
    const t = clean(s);
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1).trimEnd() + "…";
  };

  const what = short(rawWhat, 110) || "Something changed in the USD/PHP pattern compared to the recent days.";

  const whyReadable =
    rawWhy &&
    rawWhy.length >= 18 &&
    !/z-?score|sigma|stdev|std dev|standard deviation|threshold|regime/i.test(rawWhy);

  const why = whyReadable
    ? short(rawWhy, 160)
    : (() => {
        if (a.severity === "CRITICAL") {
          return "This move is big enough to change today’s risk. If you have USD-related costs or payments, your expected peso amount can shift fast.";
        }
        if (a.severity === "ALERT") {
          return "This is a meaningful shift — not just normal daily movement. It can affect your near-term budget, pricing, or hedge timing.";
        }
        return "This looks like an early warning. It may be the start of a bigger move, so it’s worth watching before it gets expensive.";
      })();

  const actionReadable =
    rawAction &&
    rawAction.length >= 12 &&
    !/monitor|keep an eye|watch closely|review today|consider/i.test(rawAction);

  const action = actionReadable
    ? short(rawAction, 160)
    : (() => {
        if (a.severity === "CRITICAL") {
          return "Open the dashboard → check if the latest rate is outside the normal range → if you have USD exposure today, consider hedging or locking a rate.";
        }
        if (a.severity === "ALERT") {
          return "Check what you’re paying/receiving in USD this week → decide if you need a partial hedge or an internal “do-not-cross” rate.";
        }
        return "Set a watch trigger (a rate level you care about) → re-check tomorrow to see if the move continues or fades.";
      })();

  return { what, why, action };
}

export default function AlertsPage() {
  const [points, setPoints] = useState<ApiPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState<AlertPack | null>(null);

  const [alertMemory, setAlertMemory] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("pesopilot_alerts_firedAt");
      if (raw) setAlertMemory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);

        const res = await fetch("/api/rates/last?n=180", { cache: "no-store" });
        const data = await res.json();

        const pts = normalizePoints(extractPoints(data));

        if (!alive) return;
        setPoints(pts);

        const nextPack = buildAlerts(pts, { ...alertMemory });

        if (!alive) return;
        setPack(nextPack);

        const nextFiredAtJSON = JSON.stringify(nextPack.firedAt ?? {});
        const prevJSON = JSON.stringify(alertMemory);

        if (nextFiredAtJSON !== prevJSON) {
          setAlertMemory(nextPack.firedAt ?? {});
          try {
            localStorage.setItem("pesopilot_alerts_firedAt", nextFiredAtJSON);
          } catch {
            // ignore
          }
        }
      } catch {
        if (!alive) return;
        setPack(buildAlerts([], { ...alertMemory }));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alerts: AlertItem[] = pack?.alerts ?? [];
  const diagnostics = pack?.diagnostics;
  const status = diagnostics?.status ?? "WAITING";

  const latestRate = pack?.latest?.rate ?? null;
  const latestRateStr = latestRate !== null && latestRate !== undefined ? latestRate.toFixed(3) : "—";

  const z = pack?.zScore90 === null || pack?.zScore90 === undefined ? null : pack.zScore90;
  const zStr = z === null ? "—" : z.toFixed(2);

  const series90 = pack?.series90 ?? [];
  const chartHeight = 240;

  // ---- extra context derived from series ----
  const derived = useMemo(() => {
    const last = series90.length ? series90[series90.length - 1] : null;
    const lastRate = safeNum((last as any)?.rate);
    const mean = safeNum((last as any)?.mean ?? (series90[0] as any)?.mean);
    const stdev = safeNum((last as any)?.stdev ?? (series90[0] as any)?.stdev);

    const first = series90.length ? series90[0] : null;
    const firstRate = safeNum((first as any)?.rate);

    const delta = lastRate !== null && firstRate !== null ? lastRate - firstRate : null;
    const deltaPct = delta !== null && firstRate ? delta / firstRate : null;

    const dist = lastRate !== null && mean !== null ? lastRate - mean : null;
    const distPct = dist !== null && mean ? dist / mean : null;

    const sigma1Hi = mean !== null && stdev !== null ? mean + stdev : null;
    const sigma1Lo = mean !== null && stdev !== null ? mean - stdev : null;
    const sigma2Hi = mean !== null && stdev !== null ? mean + 2 * stdev : null;
    const sigma2Lo = mean !== null && stdev !== null ? mean - 2 * stdev : null;

    return {
      lastRate,
      mean,
      stdev,
      delta,
      deltaPct,
      dist,
      distPct,
      sigma1Hi,
      sigma1Lo,
      sigma2Hi,
      sigma2Lo,
    };
  }, [series90]);

  const ctx = zContext(z);

  const updatedAt =
    mounted && pack?.alerts?.[0]?.timestampISO ? fmtLocal(pack.alerts[0].timestampISO) : "—";

  const allClear = !loading && alerts.length === 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#070B18] via-[#0A1024] to-[#070B18] text-slate-100">
      {/* subtle background glow accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-120px] top-[-120px] h-[380px] w-[380px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[-140px] top-[120px] h-[420px] w-[420px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute left-[20%] bottom-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] tracking-[0.28em] uppercase text-slate-400">
              Pesopilot • Risk Alerts
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="text-4xl font-semibold text-slate-100">Alerts</div>
              <span className="hidden sm:inline-flex items-center rounded-full bg-white/[0.06] px-3 py-1 text-xs ring-1 ring-white/10 text-slate-200">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
                Live context, not noise
              </span>
            </div>

            <div className="mt-2 max-w-2xl text-sm text-slate-300/90">
              Built to trigger on meaningful shifts (risk jumps, unusual moves, stress build-ups) — not daily wiggles.
            </div>
          </div>

          <Link
            href="/peso-pilot"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.10] transition"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* AT-A-GLANCE STRIP */}
        <div className="mt-8 rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">At a glance</div>
              <div className="mt-1 text-sm text-slate-300">
                Updated: <span className="text-slate-100 font-semibold">{updatedAt}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1 text-xs ring-1 ring-white/10 text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Latest <span className="font-semibold text-slate-100">{latestRateStr}</span>
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
                    ctx.tone === "good"
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/25"
                      : ctx.tone === "info"
                      ? "bg-sky-500/10 text-sky-200 ring-sky-400/25"
                      : ctx.tone === "warn"
                      ? "bg-amber-500/10 text-amber-200 ring-amber-400/25"
                      : ctx.tone === "bad"
                      ? "bg-red-500/10 text-red-200 ring-red-400/25"
                      : "bg-slate-500/10 text-slate-200 ring-slate-400/25"
                  )}
                >
                  Z <span className="font-semibold text-slate-100">{zStr}</span>
                  <span className="opacity-80">•</span>
                  {ctx.label}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1 text-xs ring-1 ring-white/10 text-slate-200">
                  Mean <span className="font-semibold text-slate-100">{fmt3(derived.mean)}</span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1 text-xs ring-1 ring-white/10 text-slate-200">
                  Distance{" "}
                  <span className="font-semibold text-slate-100">
                    {fmt3(derived.dist)} ({pct(derived.distPct)})
                  </span>
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <MiniMetric
                label="90D move"
                value={fmt3(derived.delta)}
                hint={pct(derived.deltaPct)}
                tone={derived.delta !== null ? (derived.delta > 0 ? "info" : "neutral") : "neutral"}
              />
              <MiniMetric label="Stdev (σ)" value={fmt3(derived.stdev)} hint="90D" tone="neutral" />
              <MiniMetric
                label="Alerts today"
                value={loading ? "…" : String(alerts.length)}
                hint={status}
                tone={status === "LIVE" ? (alerts.length >= 1 ? "warn" : "good") : "warn"}
              />
            </div>
          </div>

          <div
            className={cn(
              "mt-4 rounded-2xl p-4 ring-1 text-sm",
              ctx.tone === "good"
                ? "bg-emerald-500/10 ring-emerald-400/20 text-emerald-100"
                : ctx.tone === "info"
                ? "bg-sky-500/10 ring-sky-400/20 text-sky-100"
                : ctx.tone === "warn"
                ? "bg-amber-500/10 ring-amber-400/20 text-amber-100"
                : ctx.tone === "bad"
                ? "bg-red-500/10 ring-red-400/20 text-red-100"
                : "bg-white/[0.03] ring-white/10 text-slate-200"
            )}
          >
            <span className="font-semibold text-slate-100">Meaning right now:</span> {ctx.blurb}
          </div>
        </div>

        {/* quick guidance cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent" />
            <div className="relative">
              <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">What this is</div>
              <div className="mt-2 text-sm text-slate-200">
                Risk signals, not headlines. Alerts fire only when behavior shifts meaningfully.
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />
            <div className="relative">
              <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">How to use it</div>
              <div className="mt-2 text-sm text-slate-200">
                Decide what to do today. Every alert ends with a single{" "}
                <span className="text-slate-100 font-semibold">next step</span>.
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
            <div className="relative">
              <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Noise control</div>
              <div className="mt-2 text-sm text-slate-200">
                Cooldowns prevent spam. If nothing changed, you’ll see{" "}
                <span className="text-slate-100 font-semibold">All clear</span>.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          {/* LEFT: Alert feed */}
          <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-slate-100">Alert Feed</div>
                <div className="mt-1 text-sm text-slate-300">
                  Read it like: <span className="text-slate-100 font-semibold">signal</span> →{" "}
                  <span className="text-slate-100 font-semibold">why care</span> →{" "}
                  <span className="text-slate-100 font-semibold">next step</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Updated</div>
                <div className="mt-1 text-xs text-slate-300">{updatedAt}</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {loading && (
                <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
                    <div className="text-sm text-slate-200">Scanning signals…</div>
                  </div>
                </div>
              )}

              {allClear && (
                <div className="rounded-3xl bg-emerald-500/10 p-5 ring-1 ring-emerald-400/20 shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-emerald-100">
                        All clear (no thresholds crossed)
                      </div>
                      <div className="mt-2 text-sm text-emerald-100/90">
                        That’s actually useful: it means the market is behaving within its recent “normal zone.” If you
                        need action, check exposures or set tighter internal limits — not your FX feed.
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-400/15 px-3 py-1 text-xs ring-1 ring-emerald-400/25 text-emerald-100">
                      NORMAL
                    </span>
                  </div>
                </div>
              )}

              {!loading &&
                alerts.map((a) => {
                  const s = severityStyles(a.severity);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "relative overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5",
                        s.glow,
                        "animate-[fadeUp_.35s_ease-out]"
                      )}
                    >
                      <div className={cn("absolute left-0 top-0 h-full w-[6px]", s.accentLine)} />
                      <div className={cn("absolute inset-0 opacity-[0.70] bg-gradient-to-br", s.accent)} />

                      <div className="relative">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", s.pill)}>
                              {a.severity}
                            </span>
                            <div className="text-base font-semibold text-slate-100">{a.title}</div>
                          </div>

                          <div className="text-xs text-slate-200/80">{mounted ? fmtLocal(a.timestampISO) : ""}</div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl bg-black/10 backdrop-blur-[2px] p-4 ring-1 ring-white/10">
                            <div className="text-[11px] tracking-[0.18em] uppercase text-slate-300/90">Signal</div>
                            <div className="mt-2 text-sm text-slate-100">{a.signal}</div>
                          </div>

                          <div className="rounded-2xl bg-black/10 backdrop-blur-[2px] p-4 ring-1 ring-white/10">
                            <div className="text-[11px] tracking-[0.18em] uppercase text-slate-300/90">
                              Why you should care
                            </div>
                            <div className="mt-2 text-sm text-slate-100/90">{a.whyCare}</div>
                          </div>

                          <div className="rounded-2xl bg-black/10 backdrop-blur-[2px] p-4 ring-1 ring-white/10">
                            <div className="text-[11px] tracking-[0.18em] uppercase text-slate-300/90">Next step</div>
                            <div className="mt-2 text-sm font-semibold text-slate-100">{a.nextStep}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-6 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
              <div className="text-sm font-semibold text-slate-100">Severity guide</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li>
                  <span className="font-semibold text-slate-100">CRITICAL</span> = big risk change (treat as urgent).
                </li>
                <li>
                  <span className="font-semibold text-slate-100">ALERT</span> = meaningful shift (review today).
                </li>
                <li>
                  <span className="font-semibold text-slate-100">WATCH</span> = early warning (monitor closely).
                </li>
                <li className="text-slate-300">Cooldowns prevent spam: alerts won’t re-fire every refresh.</li>
              </ul>
            </div>

            {/* Recent alerts (latest 3) under Severity guide */}
            <div className="mt-6 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Recent alerts (latest 3)</div>
                  <div className="mt-1 text-xs text-slate-300">
                    Quick recap: what changed, why it matters, and what to do next.
                  </div>
                </div>

                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                  {loading ? "…" : `${alerts.slice(0, 3).length} shown`}
                </span>
              </div>

              {!loading && alerts.length === 0 && (
                <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/20 text-sm text-emerald-100">
                  No recent alerts. That means nothing has crossed your thresholds — the market is behaving within its
                  normal range.
                </div>
              )}

              <div className="mt-4 space-y-3">
                {!loading &&
                  alerts.slice(0, 3).map((a) => {
                    const s = severityStyles(a.severity);
                    const ex = explainRecent(a);

                    return (
                      <div
                        key={`recent-${a.id}`}
                        className={cn("rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4", s.glow)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", s.pill)}>
                              {a.severity}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-100 truncate">{a.title}</div>
                              <div className="mt-1 text-xs text-slate-300">{mounted ? fmtLocal(a.timestampISO) : ""}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl bg-black/10 p-3 ring-1 ring-white/10">
                            <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400">What happened</div>
                            <div className="mt-2 text-sm text-slate-100">{ex.what}</div>
                          </div>

                          <div className="rounded-xl bg-black/10 p-3 ring-1 ring-white/10">
                            <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400">Why it matters</div>
                            <div className="mt-2 text-sm text-slate-200">{ex.why}</div>
                          </div>

                          <div className="rounded-xl bg-black/10 p-3 ring-1 ring-white/10">
                            <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400">Do this now</div>
                            <div className="mt-2 text-sm font-semibold text-slate-100">{ex.action}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* RIGHT: status + chart */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-slate-100">System status</div>
                  <div className="mt-1 text-sm text-slate-300">
                    Data checks first. Signals go live only when history is sufficient.
                  </div>
                </div>
                <StatusPill status={status} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <MiniMetric label="Rows" value={String(diagnostics?.totalPoints ?? 0)} tone="neutral" />
                <MiniMetric label="Numeric" value={String(diagnostics?.numericPoints ?? 0)} tone="neutral" />
                <RangeMetric fromISO={diagnostics?.fromISO ?? null} toISO={diagnostics?.toISO ?? null} />
              </div>

              <div
                className={cn(
                  "mt-4 rounded-2xl p-4 ring-1 text-sm",
                  status === "LIVE"
                    ? "bg-emerald-500/10 ring-emerald-400/20 text-emerald-100"
                    : "bg-amber-500/10 ring-amber-400/20 text-amber-100"
                )}
              >
                {diagnostics?.reason ?? "Signals are live. This page will only light up when thresholds are crossed."}
              </div>
            </div>

            <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-100">Market context</div>
                  <div className="mt-1 text-sm text-slate-300">
                    Last 90 days with mean + bands (shows what “normal” looks like).
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Latest</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{latestRateStr}</div>
                  <div className="mt-2 text-[11px] tracking-[0.18em] uppercase text-slate-400">Z-score</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{zStr}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series90}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="date" hide />
                      <YAxis
                        domain={["auto", "auto"]}
                        width={44}
                        tick={{ fill: "rgba(226,232,240,0.75)", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(2,6,23,0.92)",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: 12,
                          color: "rgba(226,232,240,0.9)",
                        }}
                        labelStyle={{ color: "rgba(226,232,240,0.9)" }}
                      />

                      {derived.sigma2Lo !== null && derived.sigma2Hi !== null && (
                        <>
                          <ReferenceLine y={derived.sigma2Hi} stroke="rgba(244,114,182,0.35)" strokeDasharray="4 8" />
                          <ReferenceLine y={derived.sigma2Lo} stroke="rgba(244,114,182,0.35)" strokeDasharray="4 8" />
                        </>
                      )}

                      {derived.sigma1Lo !== null && derived.sigma1Hi !== null && (
                        <>
                          <ReferenceLine y={derived.sigma1Hi} stroke="rgba(56,189,248,0.55)" strokeDasharray="5 7" />
                          <ReferenceLine y={derived.sigma1Lo} stroke="rgba(56,189,248,0.55)" strokeDasharray="5 7" />
                        </>
                      )}

                      <ReferenceLine
                        y={derived.mean ?? (series90?.[0] as any)?.mean}
                        stroke="rgba(148,163,184,0.55)"
                        strokeDasharray="6 6"
                      />

                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="rgba(56,189,248,0.90)"
                        fill="rgba(56,189,248,0.14)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={650}
                      />

                      {derived.lastRate !== null && (
                        <ReferenceLine y={derived.lastRate} stroke="rgba(52,211,153,0.55)" strokeDasharray="2 6" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <div>• Dashed gray = average (mean)</div>
                  <div>• Blue dashed = ±1σ (typical range)</div>
                  <div>• Pink dashed = ±2σ (unusual territory)</div>
                  <div>• Green dashed = latest level (“you are here”)</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 text-sm text-slate-200">
                <span className="font-semibold text-slate-100">Practical read:</span> If price lives inside ±1σ, alerts
                should be quiet. When it pushes toward ±2σ, that’s when this page becomes action-heavy.
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
