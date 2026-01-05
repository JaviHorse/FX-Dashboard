// lib/fxMetrics.ts
// Risk metrics computed from chart points [{date, rate}].
// Designed to be stable and ALWAYS show reasonable values when possible.

type Point = { date: string; rate: number };

export type FxRiskMetrics = {
  points: number;
  returnsCount: number;

  // Annualized volatility (decimal: 0.12 = 12%)
  vol30Ann: number | null;
  vol90Ann: number | null;

  // Max drawdown (decimal: -0.08 = -8%)
  maxDrawdown: number | null;

  // Worst / best single-day % returns (decimal)
  worstDailyMove: number | null;
  bestDailyMove: number | null;
};

export function computeFxRiskMetrics(points: Point[]): FxRiskMetrics {
  const cleanRates = points
    .map((p) => Number(p.rate))
    .filter((x) => Number.isFinite(x));

  const n = cleanRates.length;

  // Need at least 2 points to compute returns
  if (n < 2) {
    return {
      points: n,
      returnsCount: 0,
      vol30Ann: null,
      vol90Ann: null,
      maxDrawdown: null,
      worstDailyMove: null,
      bestDailyMove: null,
    };
  }

  // Simple daily returns: (today/prev - 1)
  const rets: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = cleanRates[i - 1];
    const cur = cleanRates[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) continue;
    rets.push(cur / prev - 1);
  }

  const returnsCount = rets.length;

  // ---- Volatility helpers ----
  // Annualize daily volatility: sigma_daily * sqrt(252)
  const annualize = (sigmaDaily: number) => sigmaDaily * Math.sqrt(252);

  // IMPORTANT CHANGE:
  // Instead of requiring EXACTLY 30 or 90 returns, we use "up to" that many.
  // This guarantees you see a value whenever there is enough data to be meaningful.
  // (We also set a minimum threshold so it doesn’t show junk on tiny samples.)
  const MIN_RETURNS_FOR_VOL = 10;

  const volAnnUpTo = (maxReturns: number): number | null => {
    if (returnsCount < MIN_RETURNS_FOR_VOL) return null;
    const slice = rets.slice(-Math.min(maxReturns, returnsCount));
    const sigma = stdevSample(slice);
    if (sigma == null) return null;
    return annualize(sigma);
  };

  const vol30Ann = volAnnUpTo(30);
  const vol90Ann = volAnnUpTo(90);

  // ---- Worst / best day ----
  const worstDailyMove = returnsCount ? Math.min(...rets) : null;
  const bestDailyMove = returnsCount ? Math.max(...rets) : null;

  // ---- Max drawdown ----
  const maxDrawdown = computeMaxDrawdown(cleanRates);

  return {
    points: n,
    returnsCount,
    vol30Ann,
    vol90Ann,
    maxDrawdown,
    worstDailyMove,
    bestDailyMove,
  };
}

function stdevSample(xs: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;

  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let sse = 0;
  for (const x of xs) {
    const d = x - mean;
    sse += d * d;
  }

  const variance = sse / (n - 1);
  if (!Number.isFinite(variance) || variance < 0) return null;
  return Math.sqrt(variance);
}

// Drawdown computed on price-level series.
// Returns most negative drawdown as a negative decimal (e.g., -0.12).
function computeMaxDrawdown(rates: number[]): number | null {
  if (rates.length < 2) return null;

  let peak = rates[0];
  let maxDd = 0;

  for (let i = 1; i < rates.length; i++) {
    const x = rates[i];
    if (!Number.isFinite(x)) continue;

    if (x > peak) peak = x;

    const dd = peak === 0 ? 0 : (x - peak) / peak; // <= 0
    if (dd < maxDd) maxDd = dd;
  }

  return Number.isFinite(maxDd) ? maxDd : null;
}

