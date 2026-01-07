export const dynamic = "force-dynamic";

export default function AlertsPage() {
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
            Alerts
          </h1>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(99,102,241,0.20)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Placeholder
          </span>
        </div>

        <p style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
          placeholder page muna toh para hindi mag 404 yung route. This page will eventually create and manage FX alerts for USD/PHP based on our defined triggers.
        </p>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {[
            { title: "Create Alert", desc: "Define triggers (rate, vol, drawdown, bands)." },
            { title: "Active Alerts", desc: "View alerts currently enabled for USD/PHP." },
            { title: "Alert History", desc: "Audit fired alerts and timestamps." },
          ].map((c) => (
            <div
              key={c.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ color: "white", fontWeight: 900 }}>{c.title}</div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                {c.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          lets replace this soon with "Alert management coming soon" message pero lets think abt the design muna sa canva
        </div>
      </div>
    </div>
  );
}
