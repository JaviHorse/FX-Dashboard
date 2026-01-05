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

/**
 * CLIENT-SIDE ONLY
 * Fetches the latest USD/PHP rate from the API
 */
export async function getLatestRate(): Promise<LatestRate> {
  const res = await fetch("/api/rates/latest", { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch latest rate: ${res.status}`);
  }

  return res.json();
}

/**
 * CLIENT-SIDE ONLY
 * Fetches the last N days of USD/PHP rates
 */
export async function getLastNDays(n: number): Promise<LastNDaysResponse> {
  const res = await fetch(`/api/rates/last?n=${n}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch last ${n} days: ${res.status}`);
  }

  return res.json();
}

/**
 * CLIENT-SIDE ONLY
 * Fetches a custom date range of USD/PHP rates
 */
export async function getRange(
  start: string,
  end: string
): Promise<LastNDaysResponse> {
  const res = await fetch(
    `/api/rates/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch range: ${res.status}`);
  }

  return res.json();
}
