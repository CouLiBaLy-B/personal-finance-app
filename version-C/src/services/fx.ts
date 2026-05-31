/**
 * Service de taux de change multi-devises.
 *
 * - Récupère les taux depuis open.er-api.com (gratuit, sans clé).
 * - Cache local 6 h dans localStorage pour fonctionner offline.
 * - Fallback vers des taux statiques en cas d'échec réseau total.
 */

const CACHE_KEY = "fintrack.fx.cache";
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 h

export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "JPY",
  "AUD",
  "CNY",
  "MAD",
  "XOF",
];

// Fallback statique (utilisé uniquement si pas de réseau et pas de cache)
const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.96,
  CAD: 1.47,
  JPY: 162.4,
  AUD: 1.62,
  CNY: 7.78,
  MAD: 10.8,
  XOF: 655.96,
};

interface FxCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

export async function getRates(base = "EUR"): Promise<Record<string, number>> {
  // Cache valide ?
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: FxCache = JSON.parse(raw);
      if (cached.base === base && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.rates;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) throw new Error("FX fetch failed");
    const json = await res.json();
    if (json.result !== "success") throw new Error("FX bad payload");
    const rates: Record<string, number> = json.rates;
    const cache: FxCache = { base, rates, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return rates;
  } catch {
    // Cache périmé mais existant ?
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: FxCache = JSON.parse(raw);
        if (cached.base === base) return cached.rates;
      }
    } catch {
      /* ignore */
    }
    return FALLBACK_RATES;
  }
}

/**
 * Convertit un montant d'une devise vers une autre via les taux fournis.
 * Si la devise est absente, on retourne le montant tel quel.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  // rates sont exprimés par rapport à `base`. On convertit via la base.
  const inBase = amount / fromRate;
  return inBase * toRate;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
