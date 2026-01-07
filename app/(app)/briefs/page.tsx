export const dynamic = "force-dynamic";

export default function FxBriefsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 22,
          padding: 22,
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: "white" }}>
            FX Briefs
          </h1>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(16,185,129,0.18)",
              border: "1px solid rgba(16,185,129,0.28)",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Placeholder
          </span>
        </div>

        <p style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
          placeholder components muna toh para hindi mag 404 yung route. This page will eventually do the shits
        </p>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {[
            {
              title: "Daily Snapshot (coming soon)",
              bullets: ["Live rate + change", "Regime + volatility", "Range + drawdown"],
            },
            {
              title: "Outlook & Scenarios (coming soon)",
              bullets: ["Base / Upside / Downside", "Sensitivity curve summary", "Confidence bands"],
            },
            {
              title: "Risk Notes (coming soon)",
              bullets: ["Exposure implications", "Hedges / mitigants", "Assumptions + caveats"],
            },
          ].map((s) => (
            <div
              key={s.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ color: "white", fontWeight: 900 }}>{s.title}</div>
              <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18 }}>
                {s.bullets.map((b) => (
                  <li key={b} style={{ color: "rgba(255,255,255,0.68)", fontSize: 13, marginTop: 6 }}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          Lets replace this with JP Morgan style shits
        </div>
      </div>
    </div>
  );
}
