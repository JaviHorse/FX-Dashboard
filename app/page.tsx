import { prisma } from "@/lib/prisma";
import DashboardClient from "./ui/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = new Date();

  const latest = await prisma.exchangeRate.findFirst({
    where: {
      pair: "USD/PHP",
      source: "BSP",
      date: { lte: today },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      pair: true,
      source: true,
      rate: true,
    },
  });

  if (!latest) {
    throw new Error("No exchange rates found for USD/PHP from BSP.");
  }

  return (
    <main>
      <DashboardClient
        latest={{
          date: latest.date.toISOString(),
          pair: latest.pair,
          source: latest.source,
          rate: latest.rate.toString(),
        }}
      />
    </main>
  );
}
