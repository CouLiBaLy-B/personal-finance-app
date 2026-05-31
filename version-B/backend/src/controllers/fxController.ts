// ===========================================
// FinTrack Backend - Exchange Rate Controller
// Handles currency conversion and rate fetching
// ===========================================

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { getRates, convert, getSupportedCurrencies, isSupportedCurrency, clearRateCache } from "../utils/fx";
import { ValidationError } from "../middleware/errorHandler";

/**
 * Get all supported currencies
 */
export async function getCurrencies(req: Request, res: Response, next: NextFunction) {
  try {
    const currencies = getSupportedCurrencies();
    
    res.json({
      success: true,
      data: { currencies },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get exchange rates for a base currency
 */
export async function getExchangeRates(req: Request, res: Response, next: NextFunction) {
  try {
    const { base = "EUR" } = req.query;

    if (!isSupportedCurrency(base as string)) {
      throw new ValidationError(`Currency ${base} is not supported`);
    }

    const rates = await getRates(base as string);

    res.json({
      success: true,
      data: {
        base,
        rates,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, from, to } = req.query;

    if (amount === undefined || from === undefined || to === undefined) {
      throw new ValidationError("amount, from, and to are required");
    }

    const amountNum = parseFloat(amount as string);
    const fromCurrency = String(from);
    const toCurrency = String(to);

    if (isNaN(amountNum)) {
      throw new ValidationError("amount must be a number");
    }

    if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
      throw new ValidationError("One or both currencies are not supported");
    }

    const rates = await getRates(fromCurrency);
    const converted = convert(amountNum, fromCurrency, toCurrency, rates);

    res.json({
      success: true,
      data: {
        original: {
          amount: amountNum,
          currency: fromCurrency,
        },
        converted: {
          amount: Math.round(converted * 100) / 100,
          currency: toCurrency,
        },
        rate: rates[toCurrency],
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get latest rates for all supported currencies (with EUR as base)
 */
export async function getAllRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rates = await getRates("EUR");

    res.json({
      success: true,
      data: {
        base: "EUR",
        rates,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Clear the rate cache (admin/debug endpoint)
 */
export async function clearCache(req: Request, res: Response, next: NextFunction) {
  try {
    clearRateCache();
    
    logger.info("Exchange rate cache cleared");

    res.json({
      success: true,
      message: "Exchange rate cache cleared successfully",
    });
  } catch (error) {
    next(error);
  }
}
