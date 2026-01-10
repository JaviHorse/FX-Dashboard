import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Regime = "LOW" | "NORMAL" | "HIGH";
type FxBehavior = "RANGE_BOUND" | "CHOPPY" | "DIRECTIONAL_WITH_SWINGS";

function parseISODateOnly(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (!Number.isFinite(d.getTime())) return null;

  return d;
}

function toISODateOnlyUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function pct(n: number, digits = 2) {
  return `${n.toFixed(digits)}%`;
}

function num(n: number, digits = 3) {
  return n.toFixed(digits);
}

function rollingAnnualizedVol(points: Array<{ rate: number }>, window = 30) {
  if (points.length < window + 1) return null;

  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1].rate;
    const p1 = points[i].rate;
    if (p0 > 0 && p1 > 0) rets.push(Math.log(p1 / p0));
  }

  if (rets.length < window) return null;

  const slice = rets.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const varx =
    slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (slice.length - 1);
  const stdev = Math.sqrt(varx);

  const ann = stdev * Math.sqrt(252) * 100;
  return ann;
}

function classifyRegime(volAnnPct: number): Regime {
  if (volAnnPct < 8) return "LOW";
  if (volAnnPct <= 15) return "NORMAL";
  return "HIGH";
}

function regimeWords(regime: Regime) {
  switch (regime) {
    case "LOW":
      return {
        dynamics: "subdued",
        predictability: "greater",
        sensitivity: "lower",
        planning: "longer planning horizons",
      };
    case "NORMAL":
      return {
        dynamics: "typical",
        predictability: "moderate",
        sensitivity: "standard",
        planning: "standard assumptions",
      };
    case "HIGH":
      return {
        dynamics: "elevated",
        predictability: "reduced",
        sensitivity: "higher",
        planning: "heightened caution",
      };
  }
}

function pctChange(from: number, to: number) {
  if (!Number.isFinite(from) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

function classifyFxBehavior(pointsAsc: Array<{ rate: number }>) {
  if (!pointsAsc || pointsAsc.length < 3) {
    return {
      behavior: null as FxBehavior | null,
      rangePct: null as number | null,
      netMovePct: null as number | null,
      reversals: null as number | null,
      userText: "N/A (needs more data points in the selected period)",
    };
  }

  const rates = pointsAsc.map((p) => p.rate);

  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const first = rates[0];
  const last = rates[rates.length - 1];

  const rangePct = min > 0 ? ((max - min) / min) * 100 : 0;
  const netMovePct = Math.abs(pctChange(first, last));

  let reversals = 0;
  let prevSign = 0;
  for (let i = 1; i < rates.length; i++) {
    const d = rates[i] - rates[i - 1];
    const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
    if (sign !== 0) {
      if (prevSign !== 0 && sign !== prevSign) reversals++;
      prevSign = sign;
    }
  }

  const days = Math.max(2, pointsAsc.length - 1);
  const scale = Math.sqrt(days / 7);

  const rangeBoundRangeMax = 0.7 * scale;
  const rangeBoundNetMax = 0.4 * scale;
  const directionalNetMin = 0.9 * scale;
  const choppyNetMax = 0.8 * scale;

  let behavior: FxBehavior;
  let userText: string;

  if (netMovePct < rangeBoundNetMax && rangePct < rangeBoundRangeMax) {
    behavior = "RANGE_BOUND";
    userText =
      "Over the selected period, USD/PHP traded within a narrow range, indicating stable short-term conditions. Near-term FX risk is currently limited, reducing the urgency for immediate hedging.";
  } else if (netMovePct < choppyNetMax && rangePct >= rangeBoundRangeMax) {
    behavior = "CHOPPY";
    userText =
      "Recent USD/PHP movements have been uneven, with frequent short-term swings but no clear directional trend. This increases timing risk for USD transactions, making short-term FX exposure harder to manage.";
  } else if (netMovePct >= directionalNetMin) {
    behavior = "DIRECTIONAL_WITH_SWINGS";
    userText =
      "USD/PHP has shown a clear directional move over the selected period, accompanied by sizable day-to-day fluctuations. This raises the risk of unfavorable exchange rate movements for open USD exposures.";
  } else {
    if (reversals >= Math.max(2, Math.floor(days / 4))) {
      behavior = "CHOPPY";
      userText =
        "Recent USD/PHP movements have been uneven, with frequent short-term swings but no clear directional trend. This increases timing risk for USD transactions, making short-term FX exposure harder to manage.";
    } else {
      behavior = "DIRECTIONAL_WITH_SWINGS";
      userText =
        "USD/PHP shows a directional bias over the selected period, with day-to-day swings that can materially affect execution timing for USD exposures.";
    }
  }

  return { behavior, rangePct, netMovePct, reversals, userText };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const startStr = url.searchParams.get("start");
    const endStr = url.searchParams.get("end");

    const pair = url.searchParams.get("pair") ?? "USD/PHP";
    const source = url.searchParams.get("source") ?? "BSP";

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: "Missing required params: start, end (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const startDate = parseISODateOnly(startStr);
    const endDateRaw = parseISODateOnly(endStr);

    if (!startDate || !endDateRaw) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const endDateInclusive = new Date(endDateRaw);
    endDateInclusive.setUTCHours(23, 59, 59, 999);

    const now = new Date();
    const endClamped =
      endDateInclusive.getTime() > now.getTime() ? now : endDateInclusive;

    if (startDate.getTime() > endClamped.getTime()) {
      return NextResponse.json({ error: "start must be <= end" }, { status: 400 });
    }

    const rows = await prisma.exchangeRate.findMany({
      where: {
        pair,
        source,
        date: { gte: startDate, lte: endClamped },
      },
      orderBy: { date: "asc" },
      select: { date: true, rate: true },
    });

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "Not enough data points for this period." },
        { status: 422 }
      );
    }

    const points = rows.map((r) => ({
      dateISO: r.date.toISOString(),
      dateYMD: toISODateOnlyUTC(r.date),
      rate: Number(r.rate),
    }));

    const latest = points[points.length - 1];

    let min = points[0];
    let max = points[0];
    for (const p of points) {
      if (p.rate < min.rate) min = p;
      if (p.rate > max.rate) max = p;
    }

    const vol30 = rollingAnnualizedVol(points, 30);
    const volAnn = vol30 ?? 0;

    const regime = classifyRegime(volAnn);
    const words = regimeWords(regime);

    const volDisplay = vol30 === null ? "N/A (needs ≥ 31 pts)" : pct(vol30, 2);

    const riskScore = clamp(Math.round((volAnn / 25) * 100), 0, 100);

    const fxBehavior = classifyFxBehavior(points);

    const reportTitle =
      pair === "USD/PHP"
        ? "FX Risk Summary Report — PHP/USD"
        : `FX Risk Summary Report — ${pair}`;

    const report = {
      meta: {
        title: reportTitle,
        pair,
        source,
        period: { start: startStr, end: endStr },
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        latestExchangeRate: { value: latest.rate, date: latest.dateYMD },
        periodMin: { value: min.rate, date: min.dateYMD },
        periodMax: { value: max.rate, date: max.dateYMD },
        rollingVolatility: { valueAnnPct30d: vol30, display: volDisplay, window: 30 },
        volatilityRegime: regime,
        riskScore,
        fxBehavior: {
          label: fxBehavior.behavior,
          rangePct: fxBehavior.rangePct,
          netMovePct: fxBehavior.netMovePct,
          reversals: fxBehavior.reversals,
          userText: fxBehavior.userText,
        },
      },
      narrative: {
        executiveSummary: `This report analyzes FX movements and volatility for the PHP/USD currency pair over the selected analysis period from ${startStr} to ${endStr}. FX risk is a material consideration in this context, as exchange-rate fluctuations can directly affect revenues, costs, cash flows, and balance-sheet exposures for entities with USD-linked transactions.`,
        keyMetricsExplained: [
          {
            label: "Latest Exchange Rate",
            value: `₱${num(latest.rate, 3)}`,
            body: "The most recent observed PHP/USD exchange rate at the end of the analysis period.",
          },
          {
            label: "Period Minimum / Maximum",
            value: `₱${num(min.rate, 3)} / ₱${num(max.rate, 3)}`,
            body: "The lowest and highest exchange rates recorded during the analysis window, illustrating the full range of price movement.",
          },
          {
            label: "Rolling Volatility",
            value: volDisplay,
            body: "A statistical measure of recent FX price variability, calculated over a rolling window to capture current market conditions.",
          },
          {
            label: "Volatility Regime Classification",
            value: regime,
            body: "A categorical assessment (Low, Normal, High) based on observed volatility levels relative to defined thresholds.",
          },
        ],
        regimeInterpretation: {
          current: regime,
          body: `In the current regime, FX volatility reflects ${words.dynamics} price dynamics relative to historical norms. This implies ${words.predictability} predictability in short-term exchange-rate movements and ${words.sensitivity} sensitivity to economic or policy developments. As a result, FX risk behavior in this period should be evaluated with ${words.planning}.`,
        },
      },
      data: {
        count: points.length,
        points: points.map((p) => ({ date: p.dateYMD, rate: p.rate })),
      },
    };

    return NextResponse.json({ pointsCount: points.length, report });
  } catch (err) {
    console.error("GET /api/briefs/risk-report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
