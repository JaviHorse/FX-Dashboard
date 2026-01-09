// app/(app)/layout.tsx
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "rgb(15, 23, 42)",
      }}
    >
      <AppSidebar />

      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          height: "100%",
          overflowY: "auto",
          padding: "clamp(12px, 2.2vw, 18px)",
        }}
      >
        <main style={{ minWidth: 0 }}>
          {children}

          {/* Mobile-only spacer so fixed bottom nav doesn't cover content */}
          <div className="pp-mobile-bottom-spacer" />
        </main>
      </div>

      <style>{`
        .pp-mobile-bottom-spacer {
          height: 0px;
        }
        @media (max-width: 767px) {
          .pp-mobile-bottom-spacer {
            height: 110px;
          }
        }
      `}</style>
    </div>
  );
}
