"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export default function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const NAV: NavItem[] = useMemo(
    () => [
      { href: "/peso-pilot", label: "Dashboard", icon: <GridIcon /> },
      { href: "/alerts", label: "Alerts", icon: <BellIcon /> },
      { href: "/briefs", label: "FX Briefs", icon: <DocIcon /> },
    ],
    []
  );

  const isActive = (href: string) => pathname === href;

  /* =========================
     STYLES
     ========================= */

  const shell: React.CSSProperties = {
    position: "sticky",
    top: 18,
    alignSelf: "flex-start",
    width: collapsed ? 86 : 260,
    height: "calc(100vh - 36px)",
    padding: 18,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(11,16,32,0.95), rgba(9,14,26,0.95))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    transition: "width 220ms ease",
    backdropFilter: "blur(16px)",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    gap: 12,
  };

  const logoCircle: React.CSSProperties = {
    width: 46,
    height: 46,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    color: "white",
    fontWeight: 900,
    fontSize: 16,
    background:
      "radial-gradient(circle at 30% 25%, #5ddcff 0%, #4f46e5 60%, #1b2b55 100%)",
    boxShadow: "0 12px 26px rgba(79,70,229,0.45)",
    flexShrink: 0,
  };

  const collapseBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: collapsed ? "none" : "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.9)",
    cursor: "pointer",
  };

  const nav: React.CSSProperties = {
    display: "grid",
    gap: 12,
    marginTop: 6,
    justifyItems: collapsed ? "center" : "stretch", // ✅ center the whole button in collapsed mode
  };

  // ✅ Expanded vs collapsed button styles (THIS fixes the “off” alignment)
  const itemBaseExpanded: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    borderRadius: 16,
    padding: "12px 14px",
    border: "1px solid transparent",
    color: "rgba(255,255,255,0.88)",
    transition: "all 160ms ease",
    userSelect: "none",
  };

  const itemBaseCollapsed: React.CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: 56,
    height: 56,
    textDecoration: "none",
    borderRadius: 18,
    border: "1px solid transparent",
    color: "rgba(255,255,255,0.90)",
    transition: "all 160ms ease",
    userSelect: "none",
  };

  const activeItemExpanded: React.CSSProperties = {
    background: "rgba(255,255,255,0.95)",
    color: "#0b1020",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
  };

  const activeItemCollapsed: React.CSSProperties = {
    background: "rgba(255,255,255,0.95)",
    color: "#0b1020",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
  };

  const iconBoxExpanded = (active: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: active ? "transparent" : "rgba(255,255,255,0.08)",
    border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
    color: active ? "#0b1020" : "rgba(255,255,255,0.95)",
    flexShrink: 0,
  });

  // ✅ In collapsed mode, the icon itself becomes the centered element (no extra padding/gap)
  const iconBoxCollapsed = (active: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: active ? "transparent" : "rgba(255,255,255,0.08)",
    border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
    color: active ? "#0b1020" : "rgba(255,255,255,0.95)",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.2,
  };

  const slimToggle: React.CSSProperties = {
    marginTop: "auto",
    width: collapsed ? 56 : 44,
    height: 44,
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    alignSelf: collapsed ? "center" : "flex-start", // ✅ clean alignment
  };

  return (
    <aside style={shell}>
      {/* Top */}
      <div style={topRow}>
        <div style={logoCircle} title="Peso Pilot">
          ₱
        </div>

        <button
          style={collapseBtn}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <ArrowLeftIcon />
        </button>
      </div>

      {/* Navigation */}
      <nav style={nav}>
        {NAV.map((item) => {
          const active = isActive(item.href);

          const base = collapsed ? itemBaseCollapsed : itemBaseExpanded;
          const activeStyle = collapsed ? activeItemCollapsed : activeItemExpanded;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...base,
                ...(active ? activeStyle : {}),
              }}
              title={item.label}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {collapsed ? (
                <span style={iconBoxCollapsed(active)}>{item.icon}</span>
              ) : (
                <>
                  <span style={iconBoxExpanded(active)}>{item.icon}</span>
                  <span style={labelStyle}>{item.label}</span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Expand / Collapse Toggle */}
      <button
        style={slimToggle}
        onClick={() => setCollapsed((v) => !v)}
        aria-label="Toggle sidebar size"
      >
        {collapsed ? <ArrowRightIcon /> : <BarsIcon />}
      </button>
    </aside>
  );
}

/* =========================
   ICONS
   ========================= */

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 18, height: 18, display: "grid", placeItems: "center" }}>
      {children}
    </span>
  );
}

function GridIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
      </svg>
    </IconWrap>
  );
}

function BellIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm7-6V11a7 7 0 1 0-14 0v5L3 18v1h18v-1l-2-2Z" />
      </svg>
    </IconWrap>
  );
}

function DocIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 2v4h4" />
      </svg>
    </IconWrap>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M15 18 9 12l6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
