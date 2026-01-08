// app/(app)/layout.tsx
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh", // Lock the container to the screen height
        overflow: "hidden", // Prevent the whole page from scrolling
        background: "rgb(15, 23, 42)",
      }}
    >
      <AppSidebar />

      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          height: "100%", 
          overflowY: "auto", // Only this area will scroll
          padding: "clamp(12px, 2.2vw, 18px)",
        }}
      >
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}