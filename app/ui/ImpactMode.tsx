"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = { latestRate: number };

type BucketKey = "groceries" | "travel" | "rent" | "shopping";

type Bucket = {
  key: BucketKey;
  title: string;
  subtitle: string;
  emoji: string;
  amount: number; // base peso spend
  exposure: number; // 0..1
  whatMoves: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function fmtPeso0(v: number) {
  const abs = Math.abs(v);
  const s = abs.toLocaleString("en-PH", { maximumFractionDigits: 0 });
  return `${v < 0 ? "-" : ""}₱${s}`;
}

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v).toFixed(1);
  return `${sign}${abs}%`;
}

// Lightweight number tween
function useTweenNumber(target: number, durationMs = 520) {
  const [val, setVal] = useState(target);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const targetRef = useRef(target);

  useEffect(() => {
    fromRef.current = val;
    targetRef.current = target;
    startRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = clamp((t - startRef.current) / durationMs, 0, 1);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const next = fromRef.current + (targetRef.current - fromRef.current) * e;
      setVal(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

export default function ImpactMode({ latestRate }: Props) {
  const presets = useMemo(() => [-3, -1, 1, 3], []);
  const [movePct, setMovePct] = useState<number>(1);

  const [buckets, setBuckets] = useState<Record<BucketKey, Bucket>>({
    groceries: {
      key: "groceries",
      title: "Groceries",
      subtitle: "Imported goods proxy",
      emoji: "🛒",
      amount: 4000,
      exposure: 0.25,
      whatMoves: "Imports + fuel-linked costs usually get pricier when USD rises.",
    },
    travel: {
      key: "travel",
      title: "Travel",
      subtitle: "Flights + hotels + fees",
      emoji: "✈️",
      amount: 60000,
      exposure: 0.85,
      whatMoves: "Most travel costs are USD-linked or USD-sensitive.",
    },
    rent: {
      key: "rent",
      title: "Rent / tuition",
      subtitle: "USD-linked portions",
      emoji: "🏠",
      amount: 25000,
      exposure: 0.12,
      whatMoves: "Some contracts and school costs indirectly follow USD moves.",
    },
    shopping: {
      key: "shopping",
      title: "Online shopping",
      subtitle: "International carts",
      emoji: "📦",
      amount: 5000,
      exposure: 0.7,
      whatMoves: "Cross-border pricing and card FX conversion track USD.",
    },
  });

  const direction = movePct >= 0 ? "USD gets stronger" : "PHP gets stronger";
  const directionTone = movePct >= 0 ? "text-rose-200" : "text-emerald-200";
  const directionGlow =
    movePct >= 0
      ? "shadow-[0_0_90px_rgba(244,63,94,0.18)]"
      : "shadow-[0_0_90px_rgba(52,211,153,0.16)]";

  const pill =
    movePct >= 0
      ? "bg-rose-500/10 text-rose-100 ring-1 ring-rose-400/20"
      : "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20";

  const fxMultiplier = 1 + movePct / 100;

  const results = useMemo(() => {
    const out: Record<
      BucketKey,
      { delta: number; newAmount: number; exposurePeso: number }
    > = {} as any;

    (Object.keys(buckets) as BucketKey[]).forEach((k) => {
      const b = buckets[k];
      const exposurePeso = b.amount * b.exposure;
      const delta = exposurePeso * (fxMultiplier - 1);
      const newAmount = b.amount + delta;
      out[k] = { delta, newAmount, exposurePeso };
    });

    return out;
  }, [buckets, fxMultiplier]);

  const totalDelta = useMemo(() => {
    return (
      results.groceries.delta +
      results.travel.delta +
      results.rent.delta +
      results.shopping.delta
    );
  }, [results]);

  const totalDeltaTween = useTweenNumber(totalDelta);
  const totalDeltaColor =
    totalDelta > 0 ? "text-rose-200" : totalDelta < 0 ? "text-emerald-200" : "text-white";

  const impactScore = useMemo(() => {
    const base =
      (buckets.groceries.exposure +
        buckets.travel.exposure +
        buckets.rent.exposure +
        buckets.shopping.exposure) /
      4;
    return clamp(Math.abs(movePct) * 12 * base, 0, 100);
  }, [buckets, movePct]);

  function setBucketAmount(key: BucketKey, amount: number) {
    setBuckets((prev) => ({
      ...prev,
      [key]: { ...prev[key], amount: clamp(Math.round(amount), 0, 2_000_000) },
    }));
  }

  function setBucketExposure(key: BucketKey, exposure: number) {
    setBuckets((prev) => ({
      ...prev,
      [key]: { ...prev[key], exposure: clamp(exposure, 0, 1) },
    }));
  }

  const bucketOrder = useMemo(
    () => ["groceries", "travel", "rent", "shopping"] as BucketKey[],
    []
  );

  const heroMiniCards = (
    <div className="grid gap-3 sm:grid-cols-2">
      {bucketOrder.map((k) => {
        const b = buckets[k];
        const r = results[k];
        const delta = r.delta;

        const tone =
          delta > 0 ? "text-rose-200" : delta < 0 ? "text-emerald-200" : "text-white";
        const chip =
          delta >= 0
            ? "bg-rose-500/10 text-rose-100 ring-1 ring-rose-400/20"
            : "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20";

        const fill = clamp(b.exposure * Math.abs(movePct) * 22, 4, 100);

        return (
          <div
            key={k}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_40px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/6 ring-1 ring-white/10">
                  <span className="text-lg">{b.emoji}</span>
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-extrabold">{b.title}</div>
                  <div className="text-xs text-white/60">{b.subtitle}</div>
                </div>
              </div>

              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", chip)}>
                {delta >= 0 ? "+" : "−"}
                {fmtPeso0(Math.abs(delta)).replace("-", "")}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-xs font-semibold text-white/60">NEW EST.</div>
              <div className={cn("text-sm font-extrabold", tone)}>
                {fmtPeso0(r.newAmount).replace("-", "₱")}
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Sensitivity</span>
                <span>{Math.round(b.exposure * 100)}% USD-linked</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    delta >= 0 ? "bg-rose-400/60" : "bg-emerald-400/60"
                  )}
                  style={{ width: `${fill}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="mt-10">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/6 via-white/4 to-transparent p-7 md:p-8",
          directionGlow
        )}
      >
        {/* background blobs */}
        <div className="pointer-events-none absolute -top-24 left-8 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-6 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)]" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                  Public Impact Mode
                </span>
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", pill)}>
                  {direction}
                </span>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight">
                How would this affect you?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                Move the USD/PHP rate and instantly see{" "}
                <span className="text-white">real-life peso impact</span> on common expenses.
                results update live.
              </p>
            </div>

            {/* headline delta */}
            <div className="min-w-[260px] rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold text-white/60">ESTIMATED TOTAL IMPACT</div>
              <div className={cn("mt-3 text-3xl font-extrabold", totalDeltaColor)}>
                {totalDeltaTween >= 0 ? "+" : "−"}
                {fmtPeso0(Math.abs(totalDeltaTween)).replace("-", "")}
              </div>
              <div className="mt-2 text-xs text-white/60">
                Based on your chosen baskets and USD exposure
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,420px]">
            {/* LEFT: controls */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white/60">IF USD/PHP MOVES BY</div>
                  <div className={cn("mt-1 text-lg font-extrabold", directionTone)}>
                    {fmtPct(movePct)}
                    <span className="ml-2 text-xs font-semibold text-white/60">
                      (current ~ ₱{latestRate.toFixed(3)})
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMovePct(p)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                        movePct === p
                          ? "bg-white/12 ring-white/25"
                          : "bg-white/5 ring-white/10 hover:bg-white/10"
                      )}
                      aria-pressed={movePct === p}
                    >
                      {p > 0 ? `+${p}%` : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* slider */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>PHP stronger</span>
                  <span>USD stronger</span>
                </div>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.5}
                  value={movePct}
                  onChange={(e) => setMovePct(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-400"
                  aria-label="USD/PHP move percent"
                />
                <div className="mt-2 text-xs text-white/60">
                  This simulates an FX move, it’s not a prediction.
                </div>
              </div>

              {/* impact meter */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#070B18]/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/60">IMPACT INTENSITY</div>
                  <div className="text-xs font-semibold text-white/60">
                    {Math.round(impactScore)} / 100
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      movePct >= 0 ? "bg-rose-400/70" : "bg-emerald-400/70"
                    )}
                    style={{ width: `${impactScore}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Higher means more of your basket is USD-sensitive.
                </div>
              </div>
            </div>

            {/* RIGHT: sticky live results */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white/60">LIVE RESULTS</div>
                    <div className="mt-1 text-sm text-white/70">
                      4 baskets update instantly. edit USD exposure below for more accurate results.
                    </div>
                  </div>
                  <div className="text-xs text-white/60">Above the fold </div>
                </div>

                <div className="mt-4">{heroMiniCards}</div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#070B18]/40 p-4">
                  <div className="text-xs font-semibold text-white/60">QUICK NOTE</div>
                  <div className="mt-2 text-sm leading-6 text-white/70">
                    Positive means your basket costs more when USD strengthens.
                    Negative means you benefit when PHP strengthens.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ALWAYS VISIBLE: Spending + Why (no toggle) */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* spending editor */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold text-white/60">SET YOUR SPENDING</div>

              {/* NEW: plain-language exposure explanation */}
              <div className="mt-2 text-sm leading-6 text-white/70">
                <span className="text-white font-semibold">What is “USD exposure”?</span>{" "}
                It’s the part of this expense that usually follows the dollar (imports, USD pricing, card FX conversion).
                <span className="text-white font-semibold"> Drag the exposure slider</span>{" "}
                to tell Peso Pilot how “USD-linked” this spending is and watch the live results update.
              </div>

              <div className="mt-4 space-y-4">
                {(Object.keys(buckets) as BucketKey[]).map((k) => {
                  const b = buckets[k];
                  return (
                    <div
                      key={b.key}
                      className="rounded-xl border border-white/10 bg-white/3 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{b.emoji}</span>
                          <div className="leading-tight">
                            <div className="text-sm font-semibold">{b.title}</div>
                            <div className="text-xs text-white/60">{b.subtitle}</div>
                          </div>
                        </div>
                        <div className="text-xs text-white/60">
                          USD exposure:{" "}
                          <span className="font-semibold text-white">
                            {Math.round(b.exposure * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <div className="text-xs font-semibold text-white/60">Amount (₱)</div>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={b.amount}
                            onChange={(e) => setBucketAmount(k, Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#070B18]/50 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/20"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs font-semibold text-white/60">
                            USD exposure (0–100%)
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(b.exposure * 100)}
                            onChange={(e) => setBucketExposure(k, Number(e.target.value) / 100)}
                            className="mt-3 w-full accent-indigo-400"
                            aria-label={`${b.title} exposure`}
                          />
                          <div className="mt-1 text-[11px] text-white/60">
                            0% = mostly local pricing • 100% = strongly USD-linked
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Reset basket defaults</div>
                <button
                  type="button"
                  onClick={() => {
                    setMovePct(1);
                    setBuckets((prev) => ({
                      ...prev,
                      groceries: { ...prev.groceries, amount: 4000, exposure: 0.25 },
                      travel: { ...prev.travel, amount: 60000, exposure: 0.85 },
                      rent: { ...prev.rent, amount: 25000, exposure: 0.12 },
                      shopping: { ...prev.shopping, amount: 5000, exposure: 0.7 },
                    }));
                  }}
                  className="rounded-xl bg-white/5 px-4 py-2 text-xs font-semibold ring-1 ring-white/10 hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* deeper explanations */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold text-white/60">WHY THESE MOVE</div>
              <div className="mt-2 text-sm text-white/70">
                Quick explanation of what typically drives each basket when the dollar moves.
              </div>

              <div className="mt-4 space-y-4">
                {bucketOrder.map((k) => {
                  const b = buckets[k];
                  const delta = results[k].delta;
                  const chip =
                    delta >= 0
                      ? "bg-rose-500/10 text-rose-100 ring-1 ring-rose-400/20"
                      : "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20";

                  return (
                    <div
                      key={k}
                      className="rounded-2xl border border-white/10 bg-[#070B18]/35 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{b.emoji}</span>
                          <div className="leading-tight">
                            <div className="text-sm font-semibold">{b.title}</div>
                            <div className="text-xs text-white/60">{b.subtitle}</div>
                          </div>
                        </div>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", chip)}>
                          {delta >= 0 ? "+" : "−"}
                          {fmtPeso0(Math.abs(delta)).replace("-", "")}
                        </span>
                      </div>

                      <div className="mt-3 text-sm leading-6 text-white/70">{b.whatMoves}</div>
                      <div className="mt-3 text-xs text-white/60">
                        If this feels too aggressive, lower the USD exposure slider for this basket.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* footer note */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            Results are estimates to show effects of USD change. Checkout our Dashboard and Risk metrics to see more details!
          </div>
        </div>
      </div>
    </section>
  );
}
