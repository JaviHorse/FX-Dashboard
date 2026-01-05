import { getLatestRate } from "@/lib/fxApi";
import DashboardClient from "./ui/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latest = await getLatestRate();

  return (
    <main>
      <DashboardClient latest={latest} />
    </main>
  );
}
