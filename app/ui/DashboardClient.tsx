"use client";

import { useEffect, useMemo, useState } from "react";
import type { LatestRate } from "@/lib/fxApi";
import { computeFxRiskMetrics } from "@/lib/fxMetrics";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  AreaChart,
  Area,
  ReferenceLine,
  Line,
  LineChart,
} from "recharts";

type Props = { latest: LatestRate };

// ========================================
// CUSTOM HOOK: Animated Number Tick-Up
// ========================================
function useAnimatedNumber(target: number, duration = 800) {
  const [current, setCurrent] = useState(target);
  const [prevTarget, setPrevTarget] = useState(target);

  useEffect(() => {
    if (target === prevTarget) return;

    setPrevTarget(target);
    const start = current;
    const diff = target - start;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setCurrent(start + diff * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, current, prevTarget]);

  return current;
}

// ========================================
// CONFIDENCE BANDS / FAN CHART HELPERS
// ========================================
type FanPoint = {
  date: string;
  expected: number;

  // Baseline+band (upper-lower) lets Recharts fill a clean interval
  base95: number;
  band95: number;

  base75: number;
  band75: number;

  base50: number;
  band50: number;
};

// Two-sided z-scores (approx)
const Z50 = 0.674; // 50%
const Z75 = 1.15; // 75%
const Z95 = 1.96; // 95%

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Volatility-driven lognormal envelope:
 * expected_t = spot * exp(muDaily * t)
 * band uses exp(± z * sigmaDaily * sqrt(t))
 *
 * annualVol is decimal (0.12 = 12%).
 */
function buildFanChart({
  spot,
  startDate,
  annualVol,
  muDaily = 0,
  days = 30,
}: {
  spot: number;
  startDate: Date;
  annualVol: number;
  muDaily?: number;
  days?: number;
}): FanPoint[] {
  if (!Number.isFinite(spot) || spot <= 0) return [];
  if (!Number.isFinite(annualVol) || annualVol <= 0) return [];

  const tradingDays = 252;
  const sigmaDaily = annualVol / Math.sqrt(tradingDays);

  const out: FanPoint[] = [];
  for (let t = 1; t <= days; t++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + t);

    const expected = spot * Math.exp(muDaily * t);
    const st = sigmaDaily * Math.sqrt(t);

    const upper50 = expected * Math.exp(+Z50 * st);
    const lower50 = expected * Math.exp(-Z50 * st);

    const upper75 = expected * Math.exp(+Z75 * st);
    const lower75 = expected * Math.exp(-Z75 * st);

    const upper95 = expected * Math.exp(+Z95 * st);
    const lower95 = expected * Math.exp(-Z95 * st);

    out.push({
      date: toISODate(d),
      expected,

      base95: lower95,
      band95: upper95 - lower95,

      base75: lower75,
      band75: upper75 - lower75,

      base50: lower50,
      band50: upper50 - lower50,
    });
  }

  return out;
}

// ========================================
// MAIN COMPONENT
// ========================================
export default function DashboardClient({ latest }: Props) {
  const [chartData, setChartData] = useState<{ date: string; rate: number }[]>([]);
  const [modeLabel, setModeLabel] = useState("Last 90 Days");
  const [loading, setLoading] = useState(true);

  const [isDark, setIsDark] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activePreset, setActivePreset] = useState<"7D" | "30D" | "90D" | "YTD" | "CUSTOM">("90D");

  const [showMA, setShowMA] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // ========================================
  // Scenario Simulator State
  // ========================================
  const [scenarioPct, setScenarioPct] = useState<number>(1.0); // percent move in USD/PHP
  const [scenarioDirection, setScenarioDirection] = useState<"up" | "down">("up");
  const [scenarioExposureType, setScenarioExposureType] = useState<"receivable" | "payable">("receivable");
  const [scenarioExposureUsd, setScenarioExposureUsd] = useState<number>(100000); // USD exposure

  // ========================================
  // Narrative Dropdown Selection (SAFE)
  // ========================================
  const [narrativeSelection, setNarrativeSelection] = useState<
    "Risk & Exposure Implications" | "Hedging & Treasury Behavior"
  >("Risk & Exposure Implications");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setIsDark(true);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  // ========================================
  // PROFESSIONAL THEME (minimal glow, JP vibe)
  // ========================================
  const theme = {
    bg: isDark ? "#0b1220" : "#f6f8fb",
    text: isDark ? "#e7eef9" : "#0f172a",
    textMuted: isDark ? "#9fb0c7" : "#52607a",
    card: isDark ? "rgba(17,24,39,0.74)" : "rgba(255,255,255,0.90)",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)",
    // restrained accents
    primary: "#1d4ed8", // deep blue
    accent: "#0f766e", // teal
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#b45309",
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card,
    backdropFilter: "blur(12px)",
    border: `1px solid ${theme.border}`,
    borderRadius: "24px",
    padding: "24px",
    boxShadow: isDark ? "0 12px 34px -18px rgba(0,0,0,0.70)" : "0 10px 28px -18px rgba(15,23,42,0.18)",
    transition: "all 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    color: theme.text,
  };

  const latestISO = useMemo(() => latest.date.slice(0, 10), [latest.date]);
  const defaultEnd = latestISO;
  const defaultStart = useMemo(() => isoDaysAgo(defaultEnd, 89), [defaultEnd]);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  function normalizeRange(s: string, e: string) {
    if (!s || !e) return { s, e };
    return s <= e ? { s, e } : { s: e, e: s };
  }

  async function loadDefault90() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rates/last?n=90", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Last 90 fetch failed (${res.status}) ${text}`);
      }

      const json = await res.json();
      const next = (json.data ?? []).map((p: any) => ({
        date: String(p.date).slice(0, 10),
        rate: Number(p.rate),
      }));

      if (!next.length) throw new Error("No data returned for last 90 days.");

      setChartData(next);
      setModeLabel("Last 90 Days");
      setActivePreset("90D");

      setStart(defaultStart);
      setEnd(defaultEnd);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load last 90 days.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDefault90();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rates = useMemo(() => chartData.map((d) => d.rate).filter(Number.isFinite), [chartData]);
  const last = chartData[chartData.length - 1];
  const prev = chartData[chartData.length - 2];

  const dailyDelta = prev && last ? last.rate - prev.rate : 0;
  const dailyPct = prev && last ? (dailyDelta / prev.rate) * 100 : 0;

  const minRange = rates.length ? Math.min(...rates) : 0;
  const maxRange = rates.length ? Math.max(...rates) : 0;

  // ========================================
  // MOVING AVERAGE CALCULATION (7-day)
  // ========================================
  const chartDataWithMA = useMemo(() => {
    if (!showMA || chartData.length < 7) return chartData;

    return chartData.map((point, i) => {
      if (i < 6) return { ...point, ma: null };

      const last7 = chartData.slice(i - 6, i + 1);
      const ma = last7.reduce((sum, p) => sum + p.rate, 0) / 7;

      return { ...point, ma };
    });
  }, [chartData, showMA]);

  // ========================================
  // MARKET STATUS MESSAGE
  // ========================================
  const marketStatus = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const latestDate = latestISO;

    if (latestDate < today) {
      const daysSince = Math.floor(
        (new Date(today).getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        isClosed: true,
        message: `Markets closed. Latest BSP business day: ${new Date(latestDate).toLocaleDateString()} (${daysSince} day${
          daysSince > 1 ? "s" : ""
        } ago)`,
      };
    }

    return { isClosed: false, message: "Live market data" };
  }, [latestISO]);

  async function applyRange(s: string, e: string, label?: string, preset?: typeof activePreset) {
    const norm = normalizeRange(s, e);
    s = norm.s;
    e = norm.e;

    setStart(s);
    setEnd(e);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rates/range?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Range fetch failed (${res.status}) ${text}`);
      }

      const json = await res.json();
      const next = (json.data ?? []).map((p: any) => ({
        date: String(p.date).slice(0, 10),
        rate: Number(p.rate),
      }));

      if (!next.length) throw new Error("No data found for that range.");

      setChartData(next);
      setModeLabel(label ?? "Custom Range");
      setActivePreset(preset ?? "CUSTOM");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load range.");
    } finally {
      setLoading(false);
    }
  }
  // ========================================
  // MINI SPARKLINE COMPONENT
  // ========================================
  const MiniSparkline = ({ data, color }: { data: { rate: number }[]; color: string }) => {
    if (!data.length) return null;

    return (
      <div style={{ height: 40, width: "100%", marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // ========================================
  // KPI CARD WITH ANIMATION + SUBTLE GLOW
  // ========================================
  const KpiCard = ({
    title,
    value,
    sub,
    trend,
    sparklineData,
  }: {
    title: string;
    value: string;
    sub: string;
    trend: number;
    sparklineData?: { rate: number }[];
  }) => {
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const animatedValue = useAnimatedNumber(Number.isFinite(numericValue) ? numericValue : 0);

    const displayValue = value.includes("₱")
      ? `₱${fmt3(animatedValue)}`
      : value.startsWith("+") || value.startsWith("-")
      ? (animatedValue >= 0 ? "+" : "") + fmt3(animatedValue)
      : fmt3(animatedValue);

    // Subtle “professional” glow: blue for neutral, green/red only if trend
    const glow = trend > 0 ? theme.danger : trend < 0 ? theme.success : theme.primary;

    return (
      <div
        style={{
          ...cardStyle,
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${theme.border}`,
          boxShadow: isDark
            ? `0 16px 40px -26px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)`
            : `0 14px 34px -26px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.06)`,
        }}
      >
        {/* subtle top edge glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: -40,
            width: 180,
            height: 180,
            background: `radial-gradient(circle, ${glow}22, transparent 60%)`,
            filter: "blur(2px)",
            pointerEvents: "none",
            opacity: 0.9,
          }}
        />

        <div
          style={{
            color: theme.textMuted,
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {title}
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, margin: "12px 0", color: theme.text }}>{displayValue}</div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: trend > 0 ? theme.danger : trend < 0 ? theme.success : theme.textMuted,
          }}
        >
          {sub}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <MiniSparkline data={sparklineData} color={trend > 0 ? theme.danger : trend < 0 ? theme.success : theme.primary} />
        )}
      </div>
    );
  };

  // Sparkline data for KPIs (last 30 points)
  const sparklineData = useMemo(() => {
    const last30 = chartData.slice(-30);
    return last30.length > 0 ? last30 : [];
  }, [chartData]);

  // ========================================
  // Risk Metrics (computed from chartData)
  // ========================================
  const risk = useMemo(() => computeFxRiskMetrics(chartData), [chartData]);

  const vol30 = risk.vol30Ann;
  const vol90 = risk.vol90Ann;
  const maxDd = risk.maxDrawdown;
  const worstMove = risk.worstDailyMove;
  const bestMove = risk.bestDailyMove;

  // ========================================
  // Regime window selection (changes with preset)
  // ========================================
  function regimeWindowReturns(preset: typeof activePreset) {
    if (preset === "7D") return 7;
    if (preset === "30D") return 30;
    if (preset === "90D") return 90;
    // For YTD/CUSTOM: use a stable default; still reflects window because vol inputs come from chartData
    return 90;
  }

  // ========================================
  // Volatility Regime Badge (changes with preset)
  // ========================================
  const volRegime = useMemo(() => {
    const windowN = regimeWindowReturns(activePreset);

    const volForWindow = windowN <= 30 ? vol30 : vol90;

    if (volForWindow == null) {
      return {
        label: "—",
        helper: "Not enough data to classify volatility regime for this window.",
        color: theme.textMuted,
        bg: isDark ? "rgba(159,176,199,0.10)" : "rgba(82,96,122,0.10)",
        border: isDark ? "rgba(159,176,199,0.18)" : "rgba(15,23,42,0.12)",
        volText: "",
      };
    }

    const v = volForWindow; // decimal (0.12 = 12%)
    const volText = `• ${fmtPct2(v * 100)}%`;

    // Thresholds (annualized):
    // <8% low, 8–15% normal, >15% high
    if (v < 0.08) {
      return {
        label: "Low Vol",
        helper: `Volatility based on up to ${windowN} daily returns (annualized).`,
        color: isDark ? "#86efac" : "#166534",
        bg: isDark ? "rgba(22,163,74,0.12)" : "rgba(220,252,231,0.85)",
        border: isDark ? "rgba(22,163,74,0.22)" : "rgba(22,163,74,0.26)",
        volText,
      };
    }
    if (v < 0.15) {
      return {
        label: "Normal Vol",
        helper: `Volatility based on up to ${windowN} daily returns (annualized).`,
        color: isDark ? "#fde68a" : "#92400e",
        bg: isDark ? "rgba(180,83,9,0.14)" : "rgba(255,247,237,0.90)",
        border: isDark ? "rgba(180,83,9,0.26)" : "rgba(180,83,9,0.26)",
        volText,
      };
    }
    return {
      label: "High Vol",
      helper: `Volatility based on up to ${windowN} daily returns (annualized).`,
      color: isDark ? "#fca5a5" : "#991b1b",
      bg: isDark ? "rgba(220,38,38,0.14)" : "rgba(254,242,242,0.90)",
      border: isDark ? "rgba(220,38,38,0.26)" : "rgba(220,38,38,0.26)",
      volText,
    };
  }, [activePreset, vol30, vol90, isDark, theme]);
  // ========================================
  // Narrative Header + Dropdown Modules — text EXACT as given
  // ========================================
  const CORE_NARRATIVE_LOW = `Low Volatility Regime - Core Narrative (<8%)
Interpretation
 PHP/USD is trading within a relatively narrow range, indicating subdued short-term price fluctuations and stable market conditions. This environment often reflects balanced FX flows and limited near-term shocks, allowing currency movements to be more predictable than usual.`;

  const CORE_NARRATIVE_NORMAL = `Normal Volatility Regime - Core Narrative (8<=15%)
Interpretation
 PHP/USD volatility is within its typical historical range, reflecting routine market adjustments to macroeconomic data and policy signals.  Price movements remain active but orderly, consistent with standard FX market functioning.`;

  const CORE_NARRATIVE_HIGH = `High Volatility Regime - Core Narrative (15%>)
Interpretation
 PHP/USD is experiencing elevated price swings, signaling heightened uncertainty and increased sensitivity to economic, policy, or external developments. Short-term exchange rate movements are less stable, increasing the risk of abrupt and unfavorable currency shifts.`;

  const RISK_EXPOSURE_LOW = `Low Volatility — Risk & Exposure
Risk Implications
 FX exposure tends to be more stable in this regime, with lower day-to-day valuation swings and reduced likelihood of sharp currency shocks.
Decision Context
Forecasting errors are generally smaller, supporting longer planning horizons.`;

  const RISK_EXPOSURE_NORMAL = `Normal Volatility — Risk & Exposure
Risk Implications
 FX exposure reflects typical market risk, with manageable fluctuations that are broadly consistent with historical patterns.
Decision Context
 Standard risk limits and scenario assumptions are usually appropriate in this environment.`;

  const RISK_EXPOSURE_HIGH = `High Volatility — Risk & Exposure
Risk Implications
 FX exposure becomes more sensitive to short-term movements, increasing the probability of adverse currency outcomes over short horizons.
Decision Context
 Forecast uncertainty rises, and stress scenarios gain greater relevance.`;

  const HEDGING_TREASURY_LOW = `Low Volatility — Hedging & Treasury
Treasury Considerations
 Hedging costs are often lower, and firms may favor maintaining baseline hedge coverage rather than frequent tactical adjustments.
Operational Impact
 FX monitoring can typically follow standard review cycles.`;

  const HEDGING_TREASURY_NORMAL = `Normal Volatility — Hedging & Treasury
Treasury Considerations
 Conventional hedging strategies tend to perform as expected, balancing cost efficiency with risk reduction.
Operational Impact
 Routine monitoring and periodic hedge rebalancing are usually sufficient.`;

  const HEDGING_TREASURY_HIGH = `High Volatility — Hedging & Treasury
Treasury Considerations
 Hedging strategies may require higher coverage, shorter tenors, or greater flexibility to manage increased uncertainty.
Operational Impact
 More frequent FX reviews and tighter risk oversight are often warranted.`;

  const narrativeRegimeKey = useMemo(() => {
    const lbl = String(volRegime?.label ?? "").toLowerCase();
    if (lbl.includes("low")) return "low" as const;
    if (lbl.includes("normal") || lbl.includes("medium")) return "normal" as const;
    if (lbl.includes("high")) return "high" as const;
    return "na" as const;
  }, [volRegime]);

  const narrativeLeftText = useMemo(() => {
    if (narrativeRegimeKey === "low") return CORE_NARRATIVE_LOW;
    if (narrativeRegimeKey === "normal") return CORE_NARRATIVE_NORMAL;
    if (narrativeRegimeKey === "high") return CORE_NARRATIVE_HIGH;
    return null;
  }, [narrativeRegimeKey, CORE_NARRATIVE_LOW, CORE_NARRATIVE_NORMAL, CORE_NARRATIVE_HIGH]);

  const narrativeRightText = useMemo(() => {
    if (narrativeRegimeKey === "na") return null;

    if (narrativeSelection === "Risk & Exposure Implications") {
      if (narrativeRegimeKey === "low") return RISK_EXPOSURE_LOW;
      if (narrativeRegimeKey === "normal") return RISK_EXPOSURE_NORMAL;
      return RISK_EXPOSURE_HIGH;
    }

    // Hedging & Treasury Behavior
    if (narrativeRegimeKey === "low") return HEDGING_TREASURY_LOW;
    if (narrativeRegimeKey === "normal") return HEDGING_TREASURY_NORMAL;
    return HEDGING_TREASURY_HIGH;
  }, [
    narrativeRegimeKey,
    narrativeSelection,
    RISK_EXPOSURE_LOW,
    RISK_EXPOSURE_NORMAL,
    RISK_EXPOSURE_HIGH,
    HEDGING_TREASURY_LOW,
    HEDGING_TREASURY_NORMAL,
    HEDGING_TREASURY_HIGH,
  ]);

  // ========================================
  // Narrative UI Helpers (SAFE: display-only)
  // ========================================
  function splitFirstLine(text: string) {
    const idx = text.indexOf("\n");
    if (idx === -1) return { first: text, rest: "" };
    return { first: text.slice(0, idx), rest: text.slice(idx + 1) };
  }

  const highlightHeaders = new Set([
    "Interpretation",
    "Risk Implications",
    "Decision Context",
    "Treasury Considerations",
    "Operational Impact",
  ]);

  function NarrativeCard({
    title,
    subtitle,
    pillLabel,
    pillStyle,
    bodyText,
    theme,
    isDark,
  }: {
    title: string;
    subtitle?: string;
    pillLabel?: string;
    pillStyle?: { bg: string; border: string; color: string };
    bodyText: string;
    theme: any;
    isDark: boolean;
  }) {
    const { first, rest } = splitFirstLine(bodyText);
    const restLines = rest ? rest.split("\n") : [];

    return (
      <div
        style={{
          position: "relative",
          borderRadius: 24,
          padding: 1,
          // subtle premium edge: blue-teal, not loud
          background: isDark
            ? "linear-gradient(135deg, rgba(29,78,216,0.22), rgba(15,118,110,0.10))"
            : "linear-gradient(135deg, rgba(29,78,216,0.14), rgba(15,118,110,0.08))",
          transition: "transform 220ms ease, box-shadow 220ms ease",
          boxShadow: isDark ? "0 16px 40px -22px rgba(0,0,0,0.70)" : "0 16px 40px -28px rgba(15,23,42,0.18)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0px)";
        }}
      >
        <div
          style={{
            borderRadius: 23,
            padding: 22,
            background: theme.card,
            border: `1px solid ${theme.border}`,
            backdropFilter: "blur(12px)",
            height: "100%",
          }}
        >
          {/* Top header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: theme.textMuted,
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 750, color: theme.textMuted }}>{subtitle}</div>
              )}
            </div>

            {pillLabel && pillStyle && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: `1px solid ${pillStyle.border}`,
                  background: pillStyle.bg,
                  color: pillStyle.color,
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: pillStyle.color,
                    boxShadow: `0 0 10px ${pillStyle.color}`,
                    opacity: 0.85,
                  }}
                />
                {pillLabel}
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ marginTop: 16 }}>
            {/* First line as headline */}
            <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.3, color: theme.text }}>{first}</div>

            {/* Rest: line-by-line (highlights headers; preserves exact text) */}
            {restLines.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {restLines.map((line, idx) => {
                  const trimmed = line.trim();
                  const isHeader = highlightHeaders.has(trimmed);

                  if (line.length === 0) return <div key={idx} style={{ height: 8 }} />;

                  return (
                    <div
                      key={idx}
                      style={{
                        fontSize: isHeader ? 13 : 14,
                        fontWeight: isHeader ? 950 : 650,
                        color: isHeader ? theme.accent : theme.text,
                        opacity: isHeader ? 1 : 0.95,
                        lineHeight: 1.55,
                        letterSpacing: isHeader ? 0.2 : 0,
                        textShadow: isHeader && isDark ? "0 0 16px rgba(15,118,110,0.18)" : undefined,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function StyledSelect({
    value,
    onChange,
    theme,
    isDark,
    children,
  }: {
    value: string;
    onChange: (v: string) => void;
    theme: any;
    isDark: boolean;
    children: React.ReactNode;
  }) {
    return (
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          padding: 1,
          background: isDark
            ? "linear-gradient(135deg, rgba(29,78,216,0.20), rgba(15,118,110,0.10))"
            : "linear-gradient(135deg, rgba(29,78,216,0.14), rgba(15,118,110,0.08))",
        }}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            width: "100%",
            borderRadius: 13,
            padding: "10px 42px 10px 14px",
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            fontSize: 13,
            fontWeight: 850,
            outline: "none",
            cursor: "pointer",
          }}
        >
          {children}
        </select>

        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: theme.textMuted,
            fontWeight: 900,
            fontSize: 14,
          }}
        >
          ▾
        </div>
      </div>
    );
  }
  // ========================================
  // CONFIDENCE BANDS DATA (30D FAN CHART)
  // ========================================
  const baseSpot = useMemo(() => {
    // Prefer latest; fallback to last chart point
    const s = Number.isFinite(Number(latest?.rate)) ? Number(latest.rate) : chartData[chartData.length - 1]?.rate ?? 0;
    return Number(s) || 0;
  }, [latest, chartData]);

  const lastChartDate = useMemo(() => {
    const iso = chartData.length ? chartData[chartData.length - 1].date : latestISO;
    return new Date(iso + "T00:00:00");
  }, [chartData, latestISO]);

  const fanAnnualVol = useMemo(() => {
    // Match selected window: <=30 uses 30D vol; >30 uses 90D vol.
    const windowN = regimeWindowReturns(activePreset);
    const v = windowN <= 30 ? vol30 : vol90;
    return v ?? null;
  }, [activePreset, vol30, vol90]);

  const fanData = useMemo(() => {
    if (!fanAnnualVol || !Number.isFinite(fanAnnualVol) || fanAnnualVol <= 0) return [];
    if (!Number.isFinite(baseSpot) || baseSpot <= 0) return [];
    return buildFanChart({
      spot: baseSpot,
      startDate: lastChartDate,
      annualVol: fanAnnualVol,
      muDaily: 0,
      days: 30,
    });
  }, [fanAnnualVol, baseSpot, lastChartDate]);

  const fanChartMerged = useMemo(() => {
    const hist = chartData.map((p) => ({
      date: p.date,
      rate: p.rate,
    }));

    const fwd = fanData.map((p) => ({
      date: p.date,
      expected: p.expected,
      base95: p.base95,
      band95: p.band95,
      base75: p.base75,
      band75: p.band75,
      base50: p.base50,
      band50: p.band50,
    }));

    return [...hist, ...fwd];
  }, [chartData, fanData]);

  // Tooltip for Fan Chart (consistent style)
  const FanTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const row = payload[0]?.payload ?? {};

    const expected = row.expected;
    const rate = row.rate;

    const lo50 = Number.isFinite(row.base50) ? row.base50 : null;
    const up50 = Number.isFinite(row.base50) && Number.isFinite(row.band50) ? row.base50 + row.band50 : null;

    const lo75 = Number.isFinite(row.base75) ? row.base75 : null;
    const up75 = Number.isFinite(row.base75) && Number.isFinite(row.band75) ? row.base75 + row.band75 : null;

    const lo95 = Number.isFinite(row.base95) ? row.base95 : null;
    const up95 = Number.isFinite(row.base95) && Number.isFinite(row.band95) ? row.base95 + row.band95 : null;

    const isForecast = Number.isFinite(expected);

    return (
      <div
        style={{
          background: isDark ? "#101827" : "#ffffff",
          color: isDark ? "#e7eef9" : "#0f172a",
          padding: "14px",
          borderRadius: "16px",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`,
          boxShadow: "0 14px 22px -18px rgba(15,23,42,0.45)",
          minWidth: 240,
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, fontWeight: 900 }}>
          {label} {isForecast ? "• Forecast" : "• History"}
        </div>

        {Number.isFinite(rate) && <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>Spot: ₱{fmt3(rate)}</div>}

        {isForecast && (
          <>
            <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Expected: ₱{fmt3(expected)}</div>

            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 850, display: "grid", gap: 6 }}>
              <div>
                50% band:{" "}
                <span style={{ color: theme.text, fontWeight: 950 }}>
                  {lo50 != null && up50 != null ? `₱${fmt3(lo50)} – ₱${fmt3(up50)}` : "—"}
                </span>
              </div>
              <div>
                75% band:{" "}
                <span style={{ color: theme.text, fontWeight: 950 }}>
                  {lo75 != null && up75 != null ? `₱${fmt3(lo75)} – ₱${fmt3(up75)}` : "—"}
                </span>
              </div>
              <div>
                95% band:{" "}
                <span style={{ color: theme.text, fontWeight: 950 }}>
                  {lo95 != null && up95 != null ? `₱${fmt3(lo95)} – ₱${fmt3(up95)}` : "—"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ========================================
  //  Scenario Simulator Calculations (uses current/latest rate)
  // ========================================
  const scenario = useMemo(() => {
    const baseRate = Number.isFinite(Number(latest?.rate)) ? Number(latest.rate) : chartData[chartData.length - 1]?.rate ?? 0;

    const rate = Number(baseRate) || 0;

    const pct = Math.max(0, Number(scenarioPct) || 0) / 100;
    const signedPct = scenarioDirection === "up" ? pct : -pct;

    const shockedRate = rate * (1 + signedPct);
    const exposureUsd = Math.max(0, Number(scenarioExposureUsd) || 0);

    const baselinePhp = exposureUsd * rate;
    const shockedPhp = exposureUsd * shockedRate;

    const rawDeltaPhp = shockedPhp - baselinePhp;
    const deltaPhp = scenarioExposureType === "receivable" ? rawDeltaPhp : -rawDeltaPhp;

    return {
      rate,
      shockedRate,
      exposureUsd,
      baselinePhp,
      shockedPhp,
      deltaPhp,
    };
  }, [latest, chartData, scenarioPct, scenarioDirection, scenarioExposureUsd, scenarioExposureType]);

  // ========================================
  // Sensitivity Curve Data (P/L vs Shock %)
  // ========================================
  const selectedShockSignedPct = useMemo(() => {
    const pct = Math.max(0, Number(scenarioPct) || 0);
    return scenarioDirection === "up" ? pct : -pct; // in percent units
  }, [scenarioPct, scenarioDirection]);

  const sensitivityData = useMemo(() => {
    const baseRate = scenario.rate || 0;
    const exposureUsd = Math.max(0, Number(scenarioExposureUsd) || 0);

    const minShock = -5;
    const maxShock = 5;
    const step = 0.5;

    const rows: { shock: number; pnlPhp: number; shockedRate: number }[] = [];

    for (let shock = minShock; shock <= maxShock + 1e-9; shock += step) {
      const shockedRate = baseRate * (1 + shock / 100);

      const baselinePhp = exposureUsd * baseRate;
      const shockedPhp = exposureUsd * shockedRate;

      const rawDelta = shockedPhp - baselinePhp;
      const pnlPhp = scenarioExposureType === "receivable" ? rawDelta : -rawDelta;

      rows.push({
        shock: Number(shock.toFixed(1)),
        pnlPhp,
        shockedRate,
      });
    }

    return rows;
  }, [scenario.rate, scenarioExposureUsd, scenarioExposureType]);

  const sensitivityYDomain = useMemo(() => {
    if (!sensitivityData.length) return ["auto", "auto"] as const;
    let min = Infinity;
    let max = -Infinity;
    for (const r of sensitivityData) {
      if (!Number.isFinite(r.pnlPhp)) continue;
      min = Math.min(min, r.pnlPhp);
      max = Math.max(max, r.pnlPhp);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"] as const;

    const pad = Math.max(1, (max - min) * 0.12);
    return [min - pad, max + pad] as const;
  }, [sensitivityData]);

  // ========================================
  // Tooltip for Sensitivity Curve
  // ========================================
  const SensitivityTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const row = payload[0]?.payload as { shock: number; pnlPhp: number; shockedRate: number };
    if (!row) return null;

    const shockText = `${row.shock >= 0 ? "+" : ""}${row.shock.toFixed(1)}%`;
    const pnl = row.pnlPhp;

    return (
      <div
        style={{
          background: isDark ? "#101827" : "#ffffff",
          color: isDark ? "#e7eef9" : "#0f172a",
          padding: "14px",
          borderRadius: "16px",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`,
          boxShadow: "0 14px 22px -18px rgba(15,23,42,0.45)",
          minWidth: 220,
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, fontWeight: 900 }}>Shock: {shockText}</div>
        <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 8, fontWeight: 800 }}>Shocked rate: ₱{fmt3(row.shockedRate)}</div>
        <div style={{ fontSize: 18, fontWeight: 950, color: pnl >= 0 ? theme.success : theme.danger }}>
          {pnl >= 0 ? "+" : ""}
          {pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.8, marginLeft: 6 }}>PHP</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: theme.textMuted, fontWeight: 800 }}>
          {scenarioExposureType === "receivable" ? "Receivable (Long USD)" : "Payable (Short USD)"} • USD{" "}
          {Math.max(0, Number(scenarioExposureUsd) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    );
  };

  return (
    <main
      style={{
        backgroundColor: theme.bg,
        minHeight: "100vh",
        transition: "background 0.4s ease",
        color: theme.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ========================================
          SUBTLE AURORA BACKGROUND (professional)
          ======================================== */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: isDark ? 0.18 : 0.10,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div className="aurora-bg" />
      </div>

      <style jsx>{`
        @keyframes aurora {
          0%,
          100% {
            transform: translate(0%, 0%) rotate(0deg);
            opacity: 0.75;
          }
          33% {
            transform: translate(18%, 12%) rotate(120deg);
            opacity: 0.95;
          }
          66% {
            transform: translate(-14%, 18%) rotate(240deg);
            opacity: 0.85;
          }
        }

        .aurora-bg {
          width: 200%;
          height: 200%;
          background: radial-gradient(
              ellipse at 20% 30%,
              rgba(29, 78, 216, 0.40) 0%,
              transparent 55%
            ),
            radial-gradient(
              ellipse at 80% 70%,
              rgba(15, 118, 110, 0.26) 0%,
              transparent 58%
            ),
            radial-gradient(
              ellipse at 55% 40%,
              rgba(2, 6, 23, 0.28) 0%,
              transparent 60%
            );
          animation: aurora 22s ease-in-out infinite;
          filter: blur(56px);
        }
      `}</style>

      <section
        style={{
          display: "grid",
          gap: 32,
          padding: "40px 20px",
          maxWidth: 1200,
          margin: "0 auto",
          fontFamily: "Inter, sans-serif",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h1
             style={{
                fontSize: 40,
                fontWeight: 950,
                margin: 0,
                letterSpacing: "-1.4px",
                lineHeight: 1.05,
                display: "inline-block",
                backgroundImage: `linear-gradient(135deg, ${theme.text} 35%, ${theme.primary} 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                textShadow: isDark
                  ? "0 1px 12px rgba(15, 23, 42, 0.35)"
                  : "0 1px 8px rgba(15, 23, 42, 0.15)",
              }}
            >
              Peso Pilot
            </h1>

            <p style={{ color: theme.textMuted, margin: "6px 0 0 0", fontSize: 16 }}>
              USD/PHP Market Analytics
            </p>

            {/* Market status */}
            <div
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: marketStatus.isClosed
                  ? isDark
                    ? "rgba(180,83,9,0.12)"
                    : "rgba(255,247,237,0.92)"
                  : isDark
                  ? "rgba(22,163,74,0.10)"
                  : "rgba(220,252,231,0.90)",
                padding: "6px 12px",
                borderRadius: 12,
                border: `1px solid ${
                  marketStatus.isClosed
                    ? isDark
                      ? "rgba(180,83,9,0.26)"
                      : "rgba(180,83,9,0.26)"
                    : isDark
                    ? "rgba(22,163,74,0.22)"
                    : "rgba(22,163,74,0.26)"
                }`,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: marketStatus.isClosed ? theme.warning : theme.success,
                  boxShadow: `0 0 10px ${marketStatus.isClosed ? theme.warning : theme.success}`,
                  opacity: 0.9,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: marketStatus.isClosed ? (isDark ? "#fbbf24" : "#92400e") : isDark ? "#34d399" : "#166534",
                }}
              >
                {marketStatus.message}
              </span>
            </div>
          </div>

          {/* Upper-right controls */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              {/* Date filter bar */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  background: theme.card,
                  padding: 4,
                  borderRadius: 14,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setStart(e.target.value);
                  }}
                  style={{
                    ...inputStyle,
                    padding: "8px 12px",
                    fontSize: 13,
                    background: "transparent",
                    color: theme.text,
                    borderColor: theme.border,
                  }}
                />

                <span style={{ opacity: 0.35, fontWeight: 900 }}>→</span>

                <input
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setEnd(e.target.value);
                  }}
                  style={{
                    ...inputStyle,
                    padding: "8px 12px",
                    fontSize: 13,
                    background: "transparent",
                    color: theme.text,
                    borderColor: theme.border,
                  }}
                />

                <button
                  disabled={loading}
                  onClick={() => {
                    const norm = normalizeRange(start, end);
                    applyRange(norm.s, norm.e, "Custom Range", "CUSTOM");
                  }}
                  style={{
                    ...btnStyle,
                    padding: "8px 16px",
                    borderRadius: 12,
                    background: theme.primary,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 900,
                    // subtle button glow
                    boxShadow: `0 10px 18px -18px ${theme.primary}`,
                  }}
                >
                  Analyze Range
                </button>
              </div>

              {/* Theme + presets */}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  onClick={toggleTheme}
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    padding: "10px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 18,
                    width: 45,
                    height: 45,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.text,
                    boxShadow: isDark ? "0 10px 18px -16px rgba(0,0,0,0.6)" : "0 10px 18px -18px rgba(15,23,42,0.20)",
                  }}
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {isDark ? "🌞" : "🌙"}
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    background: theme.card,
                    padding: 4,
                    borderRadius: 14,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {(["7D", "30D", "90D", "YTD"] as const).map((p) => (
                    <button
                      key={p}
                      disabled={loading}
                      onClick={() => {
                        if (p === "90D") {
                          loadDefault90();
                          return;
                        }

                        if (p === "YTD") {
                          const year = defaultEnd.slice(0, 4);
                          const s = `${year}-01-01`;
                          applyRange(s, defaultEnd, "Year to Date", "YTD");
                          return;
                        }

                        const days = p === "7D" ? 6 : 29;
                        const s = isoDaysAgo(defaultEnd, days);
                        applyRange(s, defaultEnd, p === "7D" ? "Last 7 Days" : "Last 30 Days", p);
                      }}
                      style={{
                        border: "none",
                        background: activePreset === p ? theme.primary : "transparent",
                        color: activePreset === p ? "white" : theme.textMuted,
                        borderRadius: 10,
                        padding: "8px 16px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: 800,
                        transition: "0.2s",
                        boxShadow: activePreset === p ? `0 10px 18px -18px ${theme.primary}` : "none",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              ...cardStyle,
              borderColor: "rgba(220,38,38,0.35)",
              background: isDark ? "rgba(127,29,29,0.22)" : "rgba(254,242,242,0.92)",
              color: isDark ? "#fecaca" : "#991b1b",
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Error</div>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{error}</div>
          </div>
        )}

        {/* KPI CARDS */}
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <KpiCard
            title="Live Rate"
            value={`₱${fmt3(Number(latest.rate))}`}
            sub={new Date(latest.date).toLocaleDateString()}
            trend={dailyDelta}
            sparklineData={sparklineData}
          />
          <KpiCard
            title="24h Change"
            value={(dailyDelta >= 0 ? "+" : "") + fmt3(dailyDelta)}
            sub={(dailyPct >= 0 ? "↑ " : "↓ ") + fmtPct2(dailyPct) + "%"}
            trend={dailyDelta}
            sparklineData={sparklineData}
          />
          <KpiCard title="Range Low" value={`₱${fmt3(minRange)}`} sub="Period Min" trend={0} sparklineData={sparklineData} />
          <KpiCard title="Range High" value={`₱${fmt3(maxRange)}`} sub="Period Max" trend={0} sparklineData={sparklineData} />
        </div>

        {/* MAIN CHART */}
        <div style={{ ...cardStyle, height: 500, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: theme.accent,
                  boxShadow: `0 0 12px rgba(15,118,110,0.45)`,
                  opacity: 0.9,
                }}
              />
              <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>{modeLabel} Overview</span>

              {/* Volatility Regime Badge */}
              <span
                title={volRegime.helper}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${volRegime.border}`,
                  background: volRegime.bg,
                  color: volRegime.color,
                  fontSize: 12,
                  fontWeight: 850,
                  letterSpacing: 0.2,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: volRegime.color,
                    boxShadow: `0 0 10px ${volRegime.color}`,
                    opacity: 0.9,
                  }}
                />
                {volRegime.label}
                {volRegime.volText && <span style={{ marginLeft: 6, opacity: 0.75, fontWeight: 850 }}>{volRegime.volText}</span>}
              </span>

              {loading && <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 8 }}>Loading…</span>}
            </div>

            {/* MA Toggle */}
            <button
              onClick={() => setShowMA(!showMA)}
              disabled={chartData.length < 7}
              style={{
                background: showMA ? theme.primary : "transparent",
                color: showMA ? "white" : theme.textMuted,
                border: `1px solid ${showMA ? theme.primary : theme.border}`,
                borderRadius: 10,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: chartData.length < 7 ? "not-allowed" : "pointer",
                opacity: chartData.length < 7 ? 0.5 : 1,
                transition: "all 0.2s",
                boxShadow: showMA ? `0 10px 18px -18px ${theme.primary}` : "none",
              }}
              title={chartData.length < 7 ? "Need 7+ data points" : "Toggle 7-day moving average"}
            >
              {showMA ? "✓ " : ""}7-Day MA
            </button>
          </div>

          <div style={{ flex: 1, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartDataWithMA}
                onMouseMove={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined) {
                    setHoveredIndex(e.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.primary} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />

                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.textMuted }} minTickGap={40} />

                <YAxis domain={["auto", "auto"]} orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.textMuted }} />

                {hoveredIndex !== null && (
                  <ReferenceLine
                    x={chartDataWithMA[hoveredIndex]?.date}
                    stroke={theme.textMuted}
                    strokeDasharray="3 3"
                    strokeOpacity={0.55}
                  />
                )}

                <Tooltip content={<EnhancedTooltip isDark={isDark} theme={theme} chartData={chartData} />} />

                <Area type="monotone" dataKey="rate" stroke={theme.primary} strokeWidth={4} fill="url(#colorRate)" animationDuration={1000} />

                {showMA && (
                  <Line
                    type="monotone"
                    dataKey="ma"
                    stroke={theme.accent}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    animationDuration={800}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 20 }}>
            <Brush dataKey="date" height={30} stroke={theme.primary} fill={theme.card} travellerWidth={10} />
          </div>
        </div>

        {/* Narrative section */}
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            alignItems: "stretch",
          }}
        >
          {narrativeLeftText ? (
            <NarrativeCard
              key={`core-${narrativeRegimeKey}`}
              title="Volatility Regime Narrative"
              subtitle="Core Narrative Interpretation"
              pillLabel={volRegime.label}
              pillStyle={{ bg: volRegime.bg, border: volRegime.border, color: volRegime.color }}
              bodyText={narrativeLeftText}
              theme={theme}
              isDark={isDark}
            />
          ) : (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: theme.textMuted }}>
                Narrative Header
              </div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                Not enough data to generate the narrative for this window.
              </div>
            </div>
          )}

          <div
            style={{
              position: "relative",
              borderRadius: 24,
              padding: 1,
              background: isDark
                ? "linear-gradient(135deg, rgba(29,78,216,0.20), rgba(15,118,110,0.10))"
                : "linear-gradient(135deg, rgba(29,78,216,0.14), rgba(15,118,110,0.08))",
              boxShadow: isDark ? "0 16px 40px -22px rgba(0,0,0,0.70)" : "0 16px 40px -28px rgba(15,23,42,0.18)",
              transition: "transform 220ms ease, box-shadow 220ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0px)";
            }}
          >
            <div
              style={{
                borderRadius: 23,
                padding: 22,
                background: theme.card,
                border: `1px solid ${theme.border}`,
                backdropFilter: "blur(12px)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: theme.textMuted }}>
                    Dropdown
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 750, color: theme.textMuted }}>
                    Select a lens to interpret the current regime
                  </div>
                </div>

                <div style={{ width: 280, maxWidth: "100%" }}>
                  <StyledSelect value={narrativeSelection} onChange={(v) => setNarrativeSelection(v as any)} theme={theme} isDark={isDark}>
                    <option value="Risk & Exposure Implications">Risk & Exposure Implications</option>
                    <option value="Hedging & Treasury Behavior">Hedging & Treasury Behavior</option>
                  </StyledSelect>
                </div>
              </div>

              <div style={{ marginTop: 16, flex: 1 }}>
                {narrativeRightText ? (
                  <NarrativeCard
                    key={`mod-${narrativeRegimeKey}-${narrativeSelection}`}
                    title="Selected Module"
                    subtitle={narrativeSelection}
                    pillLabel={volRegime.label}
                    pillStyle={{ bg: volRegime.bg, border: volRegime.border, color: volRegime.color }}
                    bodyText={narrativeRightText}
                    theme={theme}
                    isDark={isDark}
                  />
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.8 }}>Not enough data to generate the module for this window.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: -0.5, fontSize: 16 }}>Risk Metrics</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>
              Based on daily moves in current window • Points: {risk.points}
            </div>
          </div>

          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <RiskCard
              title="30D Volatility"
              value={vol30 == null ? "—" : `${fmtPct2(vol30 * 100)}%`}
              sub="Rolling (annualized) • up to last 30 moves"
              cardStyle={cardStyle}
              theme={theme}
            />
            <RiskCard
              title="90D Volatility"
              value={vol90 == null ? "—" : `${fmtPct2(vol90 * 100)}%`}
              sub="Rolling (annualized) • up to last 90 moves"
              cardStyle={cardStyle}
              theme={theme}
            />
            <RiskCard
              title="Max Drawdown"
              value={maxDd == null ? "—" : `${fmtPct2(maxDd * 100)}%`}
              sub="Worst peak-to-trough drop"
              cardStyle={cardStyle}
              theme={theme}
            />
            <RiskCard
              title="Worst / Best Day"
              value={worstMove == null || bestMove == null ? "—" : `${fmtPct2(worstMove * 100)}% / ${fmtPct2(bestMove * 100)}%`}
              sub="Largest 1-day % move in window"
              cardStyle={cardStyle}
              theme={theme}
            />
          </div>
        </div>

        {/* FX Outlook */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: -0.5, fontSize: 16 }}>FX Outlook (30D Confidence Bands)</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>Volatility-driven envelope • 50% / 75% / 95%</div>
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 750, marginBottom: 10 }}>
              Shaded bands show a probabilistic range of USD/PHP outcomes over the next 30 days based on the current volatility
              regime (annualized) from your selected window.
            </div>

            {!fanAnnualVol ? (
              <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 850 }}>
                Not enough data to compute confidence bands for this window.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 850, color: theme.textMuted }}>
                    Spot: <span style={{ color: theme.text, fontWeight: 950 }}>₱{fmt3(baseSpot)}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 850, color: theme.textMuted }}>
                    Vol used:{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>{fmtPct2((fanAnnualVol ?? 0) * 100)}%</span>{" "}
                    <span style={{ opacity: 0.75 }}>(annualized)</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 850, color: theme.textMuted }}>
                    Start:{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>{chartData.length ? chartData[chartData.length - 1].date : latestISO}</span>
                  </span>
                </div>

                <div style={{ height: 320, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fanChartMerged} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />

                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.textMuted }} minTickGap={40} />

                      <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.textMuted }} />

                      <Tooltip content={<FanTooltip />} />

                      <ReferenceLine y={baseSpot} stroke={theme.textMuted} strokeDasharray="4 4" strokeOpacity={0.55} />

                      <Area dataKey="base95" stackId="fan95" stroke="none" fillOpacity={0} />
                      <Area dataKey="band95" stackId="fan95" stroke="none" fill={theme.primary} fillOpacity={0.10} isAnimationActive animationDuration={700} />

                      <Area dataKey="base75" stackId="fan75" stroke="none" fillOpacity={0} />
                      <Area dataKey="band75" stackId="fan75" stroke="none" fill={theme.primary} fillOpacity={0.16} isAnimationActive animationDuration={700} />

                      <Area dataKey="base50" stackId="fan50" stroke="none" fillOpacity={0} />
                      <Area dataKey="band50" stackId="fan50" stroke="none" fill={theme.primary} fillOpacity={0.22} isAnimationActive animationDuration={700} />

                      <Line type="monotone" dataKey="expected" stroke={theme.accent} strokeWidth={3} dot={false} isAnimationActive animationDuration={700} />

                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke={theme.textMuted}
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                        strokeOpacity={0.65}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted, fontWeight: 750, lineHeight: 1.35 }}>
                  Interpretation: The fan widens over time because uncertainty scales with √t. This is a volatility-driven envelope (not a fundamental macro forecast).
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scenario Simulator */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: -0.5, fontSize: 16 }}>Scenario Simulator</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>
              Sensitivity analysis using current rate • {Number.isFinite(scenario.rate) ? `₱${fmt3(scenario.rate)}` : "—"}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 20, display: "grid", gap: 16 }}>
            <div style={{ color: theme.textMuted, fontSize: 13, fontWeight: 750 }}>
              Simulate USD/PHP moves and estimate the PHP impact on a USD exposure.
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {/* Exposure */}
              <div
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 18,
                  padding: 16,
                  background: isDark ? "rgba(15,23,42,0.35)" : "rgba(248,250,252,0.6)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: theme.textMuted }}>
                  Exposure
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setScenarioExposureType("receivable")}
                    style={{
                      ...btnStyle,
                      background: scenarioExposureType === "receivable" ? theme.primary : "transparent",
                      color: scenarioExposureType === "receivable" ? "white" : theme.textMuted,
                      border: `1px solid ${scenarioExposureType === "receivable" ? theme.primary : theme.border}`,
                      padding: "8px 12px",
                      boxShadow: scenarioExposureType === "receivable" ? `0 10px 18px -18px ${theme.primary}` : "none",
                    }}
                  >
                    USD Receivable (Long USD)
                  </button>
                  <button
                    onClick={() => setScenarioExposureType("payable")}
                    style={{
                      ...btnStyle,
                      background: scenarioExposureType === "payable" ? theme.primary : "transparent",
                      color: scenarioExposureType === "payable" ? "white" : theme.textMuted,
                      border: `1px solid ${scenarioExposureType === "payable" ? theme.primary : theme.border}`,
                      padding: "8px 12px",
                      boxShadow: scenarioExposureType === "payable" ? `0 10px 18px -18px ${theme.primary}` : "none",
                    }}
                  >
                    USD Payable (Short USD)
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 850, color: theme.textMuted, marginBottom: 6 }}>Exposure Amount (USD)</div>
                  <input
                    type="number"
                    min={0}
                    value={scenarioExposureUsd}
                    onChange={(e) => setScenarioExposureUsd(Number(e.target.value))}
                    style={{ ...inputStyle, width: "100%", background: theme.card, color: theme.text, borderColor: theme.border }}
                    placeholder="e.g., 100000"
                  />
                </div>
              </div>

              {/* Market Move */}
              <div
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 18,
                  padding: 16,
                  background: isDark ? "rgba(15,23,42,0.35)" : "rgba(248,250,252,0.6)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: theme.textMuted }}>
                  Market Move
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setScenarioDirection("up")}
                    style={{
                      ...btnStyle,
                      background: scenarioDirection === "up" ? theme.primary : "transparent",
                      color: scenarioDirection === "up" ? "white" : theme.textMuted,
                      border: `1px solid ${scenarioDirection === "up" ? theme.primary : theme.border}`,
                      padding: "8px 12px",
                      boxShadow: scenarioDirection === "up" ? `0 10px 18px -18px ${theme.primary}` : "none",
                    }}
                  >
                    USD Strengthens (+)
                  </button>
                  <button
                    onClick={() => setScenarioDirection("down")}
                    style={{
                      ...btnStyle,
                      background: scenarioDirection === "down" ? theme.primary : "transparent",
                      color: scenarioDirection === "down" ? "white" : theme.textMuted,
                      border: `1px solid ${scenarioDirection === "down" ? theme.primary : theme.border}`,
                      padding: "8px 12px",
                      boxShadow: scenarioDirection === "down" ? `0 10px 18px -18px ${theme.primary}` : "none",
                    }}
                  >
                    USD Weakens (−)
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 850, color: theme.textMuted, marginBottom: 6 }}>Shock Size (%)</div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={scenarioPct}
                      onChange={(e) => setScenarioPct(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={scenarioPct}
                      onChange={(e) => setScenarioPct(Number(e.target.value))}
                      style={{
                        ...inputStyle,
                        width: 90,
                        background: theme.card,
                        color: theme.text,
                        borderColor: theme.border,
                        padding: "8px 10px",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>
                    Base Rate: ₱{fmt3(scenario.rate)} → Shocked: ₱{fmt3(scenario.shockedRate)}
                  </div>
                </div>
              </div>

              {/* Results */}
              <div
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 18,
                  padding: 16,
                  background: isDark ? "rgba(15,23,42,0.35)" : "rgba(248,250,252,0.6)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: theme.textMuted }}>
                  Results
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 850 }}>Baseline (PHP)</span>
                    <span style={{ fontSize: 14, fontWeight: 950 }}>{scenario.baselinePhp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 850 }}>Shocked (PHP)</span>
                    <span style={{ fontSize: 14, fontWeight: 950 }}>{scenario.shockedPhp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div style={{ height: 1, background: theme.border, opacity: 0.7, margin: "6px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 950 }}>P/L Impact (PHP)</span>
                    <span style={{ fontSize: 16, fontWeight: 950, color: scenario.deltaPhp >= 0 ? theme.success : theme.danger }}>
                      {scenario.deltaPhp >= 0 ? "+" : ""}
                      {scenario.deltaPhp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: theme.textMuted, fontWeight: 750, lineHeight: 1.35 }}>
                    Interpretation: A{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>
                      {scenarioDirection === "up" ? "+" : "−"}
                      {scenarioPct.toFixed(1)}%
                    </span>{" "}
                    move in USD/PHP implies an estimated{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>{scenario.deltaPhp >= 0 ? "gain" : "loss"}</span>{" "}
                    of{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>
                      PHP{" "}
                      {Math.abs(scenario.deltaPhp).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>{" "}
                    on a{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>
                      USD {scenario.exposureUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>{" "}
                    {scenarioExposureType === "receivable" ? "receivable" : "payable"} exposure.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FX Sensitivity Curve */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: -0.5, fontSize: 16 }}>FX Sensitivity Curve</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>P/L impact (PHP) vs USD/PHP shock • Range: −5% to +5%</div>
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 750, marginBottom: 10 }}>
              This curve visualizes how your estimated PHP P/L changes as USD/PHP moves. The vertical marker shows your current selected shock.
            </div>

            <div style={{ height: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensitivityData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />

                  <XAxis
                    dataKey="shock"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: theme.textMuted }}
                    tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(0)}%`}
                    label={{
                      value: "USD/PHP Shock (%)",
                      position: "insideBottom",
                      offset: -5,
                      fill: theme.textMuted,
                      fontSize: 11,
                      fontWeight: 750,
                    }}
                  />

                  <YAxis
                    domain={sensitivityYDomain as any}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: theme.textMuted }}
                    tickFormatter={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    label={{
                      value: "P/L Impact (PHP)",
                      angle: -90,
                      position: "insideLeft",
                      fill: theme.textMuted,
                      fontSize: 11,
                      fontWeight: 750,
                    }}
                  />

                  <Tooltip content={<SensitivityTooltip />} />

                  <ReferenceLine y={0} stroke={theme.textMuted} strokeDasharray="4 4" strokeOpacity={0.55} />

                  <ReferenceLine
                    x={Number(selectedShockSignedPct.toFixed(1))}
                    stroke={theme.primary}
                    strokeDasharray="6 6"
                    strokeOpacity={0.85}
                  />

                  <Line type="monotone" dataKey="pnlPhp" stroke={theme.primary} strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={650} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted, fontWeight: 750 }}>
              Current selection:{" "}
              <span style={{ color: theme.text, fontWeight: 950 }}>
                {selectedShockSignedPct >= 0 ? "+" : ""}
                {selectedShockSignedPct.toFixed(1)}%
              </span>{" "}
              • Exposure:{" "}
              <span style={{ color: theme.text, fontWeight: 950 }}>
                USD{" "}
                {Math.max(0, Number(scenarioExposureUsd) || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>{" "}
              • Type:{" "}
              <span style={{ color: theme.text, fontWeight: 950 }}>
                {scenarioExposureType === "receivable" ? "Receivable (Long USD)" : "Payable (Short USD)"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function RiskCard({
  title,
  value,
  sub,
  cardStyle,
  theme,
}: {
  title: string;
  value: string;
  sub: string;
  cardStyle: React.CSSProperties;
  theme: any;
}) {
  return (
    <div
      style={{
        ...cardStyle,

        // ✅ FIX: avoid mixing `border` shorthand with `borderLeft`
        border: "none",
        borderTop: `1px solid ${theme.border}`,
        borderRight: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        borderLeft: `3px solid ${theme.primary}33`, // subtle accent left border (safe)
      }}
    >
      <div
        style={{
          color: theme.textMuted,
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 26, fontWeight: 950, margin: "12px 0", color: theme.text }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 650, color: theme.textMuted }}>{sub}</div>
    </div>
  );
}


// ========================================
// ENHANCED TOOLTIP WITH CHANGE INDICATOR
// ========================================
function EnhancedTooltip({ active, payload, label, isDark, theme, chartData }: any) {
  if (!active || !payload?.length) return null;

  const currentRate = payload[0].value;
  const currentIndex = chartData.findIndex((d: any) => d.date === label);
  const prevRate = currentIndex > 0 ? chartData[currentIndex - 1].rate : null;

  const change = prevRate ? currentRate - prevRate : null;
  const changePct = prevRate ? ((change ?? 0) / prevRate) * 100 : null;

  return (
    <div
      style={{
        background: isDark ? "#101827" : "#ffffff",
        color: isDark ? "#e7eef9" : "#0f172a",
        padding: "16px",
        borderRadius: "16px",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`,
        boxShadow: "0 14px 22px -18px rgba(15,23,42,0.45)",
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 8 }}>₱{fmt3(currentRate)}</div>

      {change !== null && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 850,
            color: change > 0 ? theme.danger : change < 0 ? theme.success : theme.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{change > 0 ? "↑" : change < 0 ? "↓" : "→"}</span>
          <span>
            {change >= 0 ? "+" : ""}
            {fmt3(change)}
          </span>
          <span style={{ opacity: 0.75 }}>
            ({changePct && changePct >= 0 ? "+" : ""}
            {fmtPct2(changePct ?? 0)}%)
          </span>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "12px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 700,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  color: "white",
  border: "none",
  padding: "10px 24px",
  borderRadius: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

function fmt3(n: number) {
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
}
function fmtPct2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
function isoDaysAgo(from: string, days: number) {
  const d = new Date(from + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
