import DashboardClient from "@/app/ui/DashboardClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const latest = await prisma.exchangeRate.findFirst({
    where: { pair: "USD/PHP", source: "BSP" },
    orderBy: { date: "desc" },
    select: {
      date: true,
      pair: true,
      source: true,
      rate: true,
    },
  });

  if (!latest) {
    return (
      <div style={{ padding: 24 }}>
        <h2>No data available</h2>
        <p>The dashboard could not load exchange-rate data.</p>
      </div>
    );
  }

  const latestForClient = {
    date: latest.date.toISOString(),
    pair: latest.pair,
    source: latest.source,
    rate: Number(latest.rate),
  };

  return <DashboardClient latest={latestForClient as any} />;
}
