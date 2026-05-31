// ===========================================
// FinTrack Backend - Exchange Rate Utilities
// ===========================================

import axios from "axios";
import logger from "./logger";

// Supported currencies (ISO 4217)
export const SUPPORTED_CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "CAD", "JPY", "AUD", "CNY", "MAD", "XOF",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "HRK",
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

// Cache for exchange rates
interface RateCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const rateCache: Map<string, RateCache> = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Exchange rate API providers
interface ExchangeRateProvider {
  name: string;
  url: (base: string) => string;
  parse: (data: unknown) => Record<string, number>;
}

const providers: ExchangeRateProvider[] = [
  {
    name: "exchangerate.host",
    url: (base: string) => `https://api.exchangerate.host/latest?base=${base}&symbols=${SUPPORTED_CURRENCIES.join(",")}`,
    parse: (data: unknown) => {
      const result = data as { rates?: Record<string, number> };
      return result.rates || {};
    },
  },
  {
    name: "open.er-api.com",
    url: (base: string) => `https://open.er-api.com/v6/latest/${base}?symbols=${SUPPORTED_CURRENCIES.join(",")}`,
    parse: (data: unknown) => {
      const result = data as { rates?: Record<string, number> };
      return result.rates || {};
    },
  },
];

/**
 * Get exchange rates for a base currency
 */
export async function getRates(base: CurrencyCode = "EUR"): Promise<Record<string, number>> {
  // Check cache first
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    logger.debug(`Returning cached rates for ${base}`);
    return cached.rates;
  }

  // Try each provider until one succeeds
  for (const provider of providers) {
    try {
      logger.info(`Fetching rates from ${provider.name} for base ${base}`);
      const response = await axios.get(provider.url(base), {
        timeout: 5000,
      });

      if (response.status === 200) {
        const rates = provider.parse(response.data);
        
        // Ensure base currency is in rates with value 1
        rates[base] = 1;

        // Cache the result
        rateCache.set(base, {
          base,
          rates,
          fetchedAt: Date.now(),
        });

        logger.debug(`Successfully fetched rates from ${provider.name}`);
        return rates;
      }
    } catch (error) {
      logger.warn(`Failed to fetch rates from ${provider.name}: ${error}`);
      // Continue to next provider
    }
  }

  // If all providers fail, return fallback rates
  logger.warn("All exchange rate providers failed, using fallback rates");
  return getFallbackRates(base);
}

/**
 * Fallback rates when API is unavailable
 */
function getFallbackRates(base: CurrencyCode): Record<string, number> {
  // Fallback rates relative to EUR
  const fallbackRates: Record<string, number> = {
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
    SEK: 11.5,
    NOK: 11.8,
    DKK: 7.45,
    PLN: 4.35,
    CZK: 24.5,
    HUF: 385,
    RON: 4.9,
    BGN: 1.95,
    HRK: 7.5,
  };

  // If base is not EUR, we need to recalculate all rates
  if (base !== "EUR") {
    const baseRate = fallbackRates[base] || 1;
    const result: Record<string, number> = {};
    for (const [currency, rate] of Object.entries(fallbackRates)) {
      result[currency as CurrencyCode] = rate / baseRate;
    }
    return result;
  }

  return fallbackRates;
}

/**
 * Convert amount from one currency to another
 */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  
  const fromRate = rates[from];
  const toRate = rates[to];
  
  if (fromRate === undefined || toRate === undefined) {
    logger.warn(`Missing rate for conversion: ${from} -> ${to}`);
    return amount; // Return original amount if conversion not possible
  }
  
  // Convert via base currency
  const amountInBase = amount / fromRate;
  return amountInBase * toRate;
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): CurrencyCode[] {
  return [...SUPPORTED_CURRENCIES];
}

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(code as CurrencyCode);
}

/**
 * Clear the rate cache (useful for testing or when rates need to be refreshed)
 */
export function clearRateCache(): void {
  rateCache.clear();
}
