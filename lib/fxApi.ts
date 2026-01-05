// lib/fxApi.ts

export type FxPoint = { date: string; rate: string };

export type LatestRate = {
  date: string;
  pair: string;
  source: string;
  rate: string;
};

export type LastNDaysResponse = {
  pair: string;
  source: string;
  count: number;
  data: FxPoint[];
};

export async function getLatestRate(baseUrl: string): Promise<LatestRate> {
  const res = await fetch(`${baseUrl}/api/rates/latest`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch latest rate: ${res.status}`);
  return res.json();
}

export async function getLastNDays(
  n: number,
  baseUrl: string
): Promise<LastNDaysResponse> {
  const res = await fetch(`${baseUrl}/api/rates/last?n=${n}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch last ${n} days: ${res.status}`);
  return res.json();
}
