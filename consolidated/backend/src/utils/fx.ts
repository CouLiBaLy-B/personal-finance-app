/**
 * Exchange-rate helper — server-side cache for FX rates.
 */

interface RateCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, RateCache>();

export async function getRates(base: string): Promise<Record<string, number>> {
  const cached = cache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (data.rates) {
      cache.set(base, { base, rates: data.rates, fetchedAt: Date.now() });
      return data.rates;
    }
  } catch {
    // Return cached if available, even stale
    if (cached) return cached.rates;
  }

  return {};
}

export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  return (amount / fromRate) * toRate;
}
