import type { ReactNode } from "react";
import AppSidebar from "../../components/AppSidebar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        gap: 18,
        padding: 18,

        // ✅ prevents the white margin from showing
        background: "#0f172a",
      }}
    >
      <AppSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
