"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [breakpointPx]);

  return isMobile;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile(768);

  const [collapsed, setCollapsed] = useState(false);

  const NAV: NavItem[] = useMemo(
    () => [
      { href: "/peso-pilot", label: "Dashboard", icon: <GridIcon /> },
      { href: "/impact", label: "Impact Simulator", icon: <SparkIcon /> },
      { href: "/alerts", label: "Alerts", icon: <BellIcon /> },
      { href: "/briefs", label: "FX Briefs", icon: <DocIcon /> },
    ],
    []
  );

  const isActive = (href: string) => pathname === href;

  // Force a sane behavior on mobile (bottom bar should not be "collapsed")
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  /* =========================
     STYLES
     ========================= */

  // Desktop shell (your original)
  const shellDesktop: React.CSSProperties = {
    position: "sticky",
    top: 18,
    alignSelf: "flex-start",
    width: collapsed ? 86 : 260,
    height: "calc(100vh - 36px)",
    padding: 18,
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(11,16,32,0.95), rgba(9,14,26,0.95))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    transition: "width 220ms ease",
    backdropFilter: "blur(16px)",
  };

  // Mobile shell (bottom bar)
  const shellMobile: React.CSSProperties = {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    height: 74,
    padding: 10,
    borderRadius: 26,
    background: "linear-gradient(180deg, rgba(11,16,32,0.92), rgba(9,14,26,0.92))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.55)",
    backdropFilter: "blur(16px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    zIndex: 60,
  };

  const shell: React.CSSProperties = isMobile ? shellMobile : shellDesktop;

  const topRow: React.CSSProperties = {
    display: isMobile ? "none" : "flex",
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
    background: "radial-gradient(circle at 30% 25%, #5ddcff 0%, #4f46e5 60%, #1b2b55 100%)",
    boxShadow: "0 12px 26px rgba(79,70,229,0.45)",
    flexShrink: 0,
  };

  const collapseBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: collapsed || isMobile ? "none" : "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.9)",
    cursor: "pointer",
  };

  const navDesktop: React.CSSProperties = {
    display: "grid",
    gap: 12,
    marginTop: 6,
    justifyItems: collapsed ? "center" : "stretch",
  };

  const navMobile: React.CSSProperties = {
    display: "flex",
    gap: 10,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const nav: React.CSSProperties = isMobile ? navMobile : navDesktop;

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

  const itemBaseMobile: React.CSSProperties = {
    flex: "1 1 0%",
    height: 54,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
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

  const activeItemMobile: React.CSSProperties = {
    background: "rgba(255,255,255,0.95)",
    color: "#0b1020",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.22)",
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

  const bottomCluster: React.CSSProperties = {
    marginTop: "auto",
    display: isMobile ? "none" : "grid",
    gap: 12,
    justifyItems: collapsed ? "center" : "stretch",
  };

  const divider: React.CSSProperties = {
    height: 1,
    width: "100%",
    background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.14), rgba(255,255,255,0))",
    opacity: 0.9,
  };

  const homeCardExpanded: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    borderRadius: 18,
    padding: "12px 14px",
    color: "rgba(255,255,255,0.92)",
    background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(93,220,255,0.14))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
    transition: "transform 160ms ease, background 160ms ease",
    userSelect: "none",
  };

  const homeCardCollapsed: React.CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: 56,
    height: 56,
    textDecoration: "none",
    borderRadius: 18,
    color: "rgba(255,255,255,0.92)",
    background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(93,220,255,0.14))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
    transition: "transform 160ms ease, background 160ms ease",
    userSelect: "none",
  };

  const homeIconBoxExpanded: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.95)",
    flexShrink: 0,
  };

  const homeIconBoxCollapsed: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.95)",
  };

  const homeLabelWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.05,
  };

  const homeTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.2,
  };

  const homeSub: React.CSSProperties = {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.70)",
  };

  const slimToggle: React.CSSProperties = {
    width: collapsed ? 56 : 44,
    height: 44,
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    alignSelf: collapsed ? "center" : "flex-start",
  };

  return (
    <aside style={shell} aria-label="App navigation">
      {/* Top (desktop only) */}
      <div style={topRow}>
        <div style={logoCircle} title="Peso Pilot">
          ₱
        </div>

        <button style={collapseBtn} onClick={() => setCollapsed(true)} aria-label="Collapse sidebar">
          <ArrowLeftIcon />
        </button>
      </div>

      {/* Navigation */}
      <nav style={nav}>
        {NAV.map((item) => {
          const active = isActive(item.href);

          if (isMobile) {
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...itemBaseMobile,
                  ...(active ? activeItemMobile : {}),
                }}
                title={item.label}
              >
                {item.icon}
              </Link>
            );
          }

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
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
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

      {/* Bottom cluster (desktop only) */}
      <div style={bottomCluster}>
        <div style={divider} />

        <Link
          href="/"
          style={collapsed ? homeCardCollapsed : homeCardExpanded}
          title="Home"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.34), rgba(93,220,255,0.18))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0px)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(93,220,255,0.14))";
          }}
        >
          {collapsed ? (
            <span style={homeIconBoxCollapsed}>
              <HomeIcon />
            </span>
          ) : (
            <>
              <span style={homeIconBoxExpanded}>
                <HomeIcon />
              </span>
              <span style={homeLabelWrap}>
                <span style={homeTitle}>Home</span>
                <span style={homeSub}>Back to landing</span>
              </span>
            </>
          )}
        </Link>

        <button style={slimToggle} onClick={() => setCollapsed((v) => !v)} aria-label="Toggle sidebar size">
          {collapsed ? <ArrowRightIcon /> : <BarsIcon />}
        </button>
      </div>
    </aside>
  );
}

/* =========================
   ICONS
   ========================= */

function IconWrap({ children }: { children: React.ReactNode }) {
  return <span style={{ width: 18, height: 18, display: "grid", placeItems: "center" }}>{children}</span>;
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

function SparkIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
      </svg>
    </IconWrap>
  );
}

function HomeIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 3 3 10v11a1 1 0 0 0 1 1h6v-7h4v7h6a1 1 0 0 0 1-1V10l-9-7Z" />
      </svg>
    </IconWrap>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M15 18 9 12l6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
