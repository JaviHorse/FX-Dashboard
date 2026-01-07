// lib/alerts.ts
export type AlertSeverity = "CRITICAL" | "ALERT" | "WATCH" | "INFO";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;

  // “Read it like this: signal → why care → next step”
  signal: string;
  whyCare: string;
  nextStep: string;

  timestampISO: string;
  meta?: Record<string, string | number>;
};

export type AlertPack = {
  alerts: AlertItem[];
  firedAt: Record<string, string>;

  latest?: { dateISO: string; rate: number };
  series90?: { date: string; rate: number; mean: number; band2: number; band3: number }[];
  zScore90?: number | null;

  diagnostics: {
    totalPoints: number;
    numericPoints: number;
    fromISO: string | null;
    toISO: string | null;
    status: "LIVE" | "WAITING";
    reason?: string;
  };
};

type ApiPoint = { date: string; rate: string | number };

function safeNum(x: any): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x !== "string") return null;
  const cleaned = x.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function rollingVolAnnualized(rates: number[], window: number) {
  if (rates.length < window + 1) return null;
  const xs = rates.slice(-window - 1);

  const rets: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1];
    const b = xs[i];
    if (a <= 0 || b <= 0) continue;
    rets.push(Math.log(b / a));
  }

  if (rets.length < Math.max(10, window - 2)) return null;
  const s = std(rets);
  return s * Math.sqrt(252);
}

function rangeBreak(rates: number[], lookback: number) {
  if (rates.length < lookback) return null;
  const latest = rates[rates.length - 1];
  const prev = rates.slice(-lookback, -1);
  const lo = Math.min(...prev);
  const hi = Math.max(...prev);
  if (latest > hi) return { dir: "UP" as const, ref: hi, latest };
  if (latest < lo) return { dir: "DOWN" as const, ref: lo, latest };
  return null;
}

export function buildAlerts(points: ApiPoint[], firedAt: Record<string, string> = {}): AlertPack {
  const nowISO = new Date().toISOString();

  const parsed = points
    .map((p) => {
      const t = new Date(p.date).getTime();
      const r = safeNum(p.rate);
      return { t, dateISO: new Date(p.date).toISOString(), rate: r };
    })
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const totalPoints = parsed.length;
  const numeric = parsed.filter((p) => p.rate !== null) as Array<{ t: number; dateISO: string; rate: number }>;
  const numericPoints = numeric.length;

  const fromISO = parsed.length ? new Date(parsed[0].t).toISOString().slice(0, 10) : null;
  const toISO = parsed.length ? new Date(parsed[parsed.length - 1].t).toISOString().slice(0, 10) : null;

  const minNeeded = 40;
  const status = numericPoints >= minNeeded ? "LIVE" : "WAITING";

  const base: AlertPack = {
    alerts: [],
    firedAt,
    diagnostics: {
      totalPoints,
      numericPoints,
      fromISO,
      toISO,
      status,
      reason: status === "WAITING" ? `Need at least ${minNeeded} valid daily points to avoid noisy signals.` : undefined,
    },
  };

  if (status === "WAITING") {
    base.alerts.push({
      id: "system:waiting_for_history",
      severity: "INFO",
      title: "Alerts aren’t ready yet",
      signal: "Not enough clean history to set reliable thresholds.",
      whyCare: "With small samples, alerts become spammy and untrustworthy.",
      nextStep: "Load more daily history (recommended: 90–180 days). Then alerts will auto-enable.",
      timestampISO: nowISO,
      meta: { minNeeded },
    });
    return base;
  }

  const rates = numeric.map((p) => p.rate);
  const dates = numeric.map((p) => isoDay(new Date(p.t)));

  const latestRate = rates[rates.length - 1];
  const latestDateISO = numeric[numeric.length - 1].dateISO;
  base.latest = { dateISO: latestDateISO, rate: latestRate };

  const n90 = Math.min(90, rates.length);
  const rates90 = rates.slice(-n90);
  const dates90 = dates.slice(-n90);
  const m90 = mean(rates90);
  const s90 = std(rates90);
  const z = s90 > 0 ? (latestRate - m90) / s90 : null;
  base.zScore90 = z;

  base.series90 = dates90.map((d, i) => ({
    date: d,
    rate: rates90[i],
    mean: m90,
    band2: 2 * s90,
    band3: 3 * s90,
  }));

  const alerts: AlertItem[] = [];

  const COOLDOWN_HOURS = {
    CRITICAL: 12,
    ALERT: 24,
    WATCH: 24,
    INFO: 6,
  };

  function canFire(id: string, sev: AlertSeverity) {
    const prev = firedAt[id];
    if (!prev) return true;
    const ageMs = Date.now() - new Date(prev).getTime();
    const hours = ageMs / (1000 * 60 * 60);
    return hours >= COOLDOWN_HOURS[sev];
  }

  function fire(alert: Omit<AlertItem, "timestampISO">) {
    if (!canFire(alert.id, alert.severity)) return;
    alerts.push({ ...alert, timestampISO: nowISO });
    firedAt[alert.id] = nowISO;
  }

  // 1) Notable move via z-score
  if (z !== null) {
    const absZ = Math.abs(z);

    if (absZ >= 3) {
      fire({
        id: "move:rare",
        severity: "CRITICAL",
        title: "Rare move detected",
        signal: `USD/PHP is unusually far from its recent norm (|z| ≈ ${absZ.toFixed(2)}).`,
        whyCare: "These moves can force quick hedging decisions and stress limits.",
        nextStep: "Review open exposure + hedge coverage immediately.",
        meta: { zScore90: Number(absZ.toFixed(2)) },
      });
    } else if (absZ >= 2) {
      fire({
        id: "move:notable",
        severity: "ALERT",
        title: "Notable move detected",
        signal: `USD/PHP is outside its typical recent range (|z| ≈ ${absZ.toFixed(2)}).`,
        whyCare: "Deviations like this can move P&L and hedge effectiveness quickly.",
        nextStep: "Check exposures and confirm hedge ratios still make sense today.",
        meta: { zScore90: Number(absZ.toFixed(2)) },
      });
    } else if (absZ >= 1.5) {
      fire({
        id: "move:watch",
        severity: "WATCH",
        title: "Early warning: drift building",
        signal: `USD/PHP is drifting away from the mean (|z| ≈ ${absZ.toFixed(2)}).`,
        whyCare: "Drift can turn into a break if catalysts hit.",
        nextStep: "Watch today’s catalysts; avoid overconfidence in tight ranges.",
        meta: { zScore90: Number(absZ.toFixed(2)) },
      });
    }
  }

  // 2) Vol jump (30D vs 90D)
  const vol30 = rollingVolAnnualized(rates, 30);
  const vol90 = rollingVolAnnualized(rates, 90);

  if (vol30 !== null && vol90 !== null) {
    const ratio = vol30 / Math.max(1e-9, vol90);

    if (ratio >= 1.6) {
      fire({
        id: "vol:jump",
        severity: "ALERT",
        title: "Risk level jumped (vol upshift)",
        signal: `Recent swings are meaningfully larger than baseline (30D/90D ≈ ${ratio.toFixed(2)}).`,
        whyCare: "Higher volatility increases VaR and makes hedges more expensive.",
        nextStep: "Re-check limits and consider tightening hedge triggers.",
        meta: { ratio: Number(ratio.toFixed(2)) },
      });
    } else if (ratio >= 1.3) {
      fire({
        id: "vol:rising",
        severity: "WATCH",
        title: "Volatility is rising",
        signal: `30D volatility is trending above baseline (30D/90D ≈ ${ratio.toFixed(2)}).`,
        whyCare: "Rising vol is an early sign ranges may break.",
        nextStep: "Monitor catalysts and don’t assume mean-reversion will hold.",
        meta: { ratio: Number(ratio.toFixed(2)) },
      });
    }
  }

  // 3) Range break (20D)
  const rb = rangeBreak(rates, 20);
  if (rb) {
    const dirText = rb.dir === "UP" ? "above" : "below";
    fire({
      id: "range:break20",
      severity: "ALERT",
      title: "Range break detected (20D)",
      signal: `USD/PHP moved ${dirText} the last ~20 trading day range.`,
      whyCare: "Range breaks often trigger follow-through and re-hedging.",
      nextStep: "Validate hedge triggers; scale hedges if the break holds into close.",
      meta: { ref: Number(rb.ref.toFixed(3)), latest: Number(rb.latest.toFixed(3)) },
    });
  }

  if (!alerts.length) {
    alerts.push({
      id: "system:all_clear",
      severity: "INFO",
      title: "All clear (no risk triggers right now)",
      signal: "USD/PHP is behaving within expected bounds for this window.",
      whyCare: "Quiet is good: no meaningful regime/range signal tripped.",
      nextStep: "Review upcoming catalysts and maintain hedge discipline.",
      timestampISO: nowISO,
    });
  }

  base.alerts = alerts;
  base.firedAt = firedAt;
  return base;
}
