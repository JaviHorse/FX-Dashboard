import { prisma } from "@/lib/prisma";
import ImpactMode from "@/app/ui/ImpactMode";

export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const today = new Date();

  const latest = await prisma.exchangeRate.findFirst({
    where: { pair: "USD/PHP", source: "BSP", date: { lte: today } },
    orderBy: { date: "desc" },
    select: { rate: true, date: true },
  });

  if (!latest) throw new Error("No exchange rates found for USD/PHP from BSP.");

  const latestRate = Number(latest.rate);

  return (
    <main className="min-h-screen bg-[#070B18] text-white">
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="mb-6">
          <div className="text-sm text-white/60">Tools</div>
          <h1 className="mt-2 text-4xl font-extrabold">Impact Simulator</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            Simulate USD/PHP moves and see how it could affect common expenses.
          </p>
        </div>

        <ImpactMode latestRate={latestRate} />
      </section>

      <div className="h-14" />
    </main>
  );
}
