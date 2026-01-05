import { headers } from "next/headers";
import { getLatestRate } from "@/lib/fxApi";
import DashboardClient from "./ui/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) throw new Error("Host header missing");

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const latest = await getLatestRate();

  return (
    <main>
      <DashboardClient latest={latest} />
    </main>
  );
}
