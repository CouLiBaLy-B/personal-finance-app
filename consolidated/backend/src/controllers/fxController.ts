/**
 * FX (foreign exchange) controller — rates + convert.
 */
import type { Request, Response, NextFunction } from "express";
import { getRates, convert } from "../utils/fx.js";

const SUPPORTED = [
  "EUR", "USD", "GBP", "CHF", "CAD", "JPY", "AUD", "CNY", "MAD", "XOF",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "BRL", "INR", "KRW",
];

/** GET /fx/currencies */
export async function currencies(_req: Request, res: Response) {
  res.json(SUPPORTED);
}

/** GET /fx/rates?base=EUR */
export async function rates(req: Request, res: Response, next: NextFunction) {
  try {
    const base = (req.query.base as string) ?? "EUR";
    const allRates = await getRates(base);
    // Filter to only supported currencies
    const filtered: Record<string, number> = {};
    for (const c of SUPPORTED) {
      if (allRates[c] !== undefined) filtered[c] = allRates[c];
    }
    res.json({ base, rates: filtered, fetchedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

/** GET /fx/convert?from=EUR&to=USD&amount=100 */
export async function convertAmount(req: Request, res: Response, next: NextFunction) {
  try {
    const from = (req.query.from as string) ?? "EUR";
    const to = (req.query.to as string) ?? "USD";
    const amount = Number(req.query.amount) || 0;

    const allRates = await getRates(from);
    const result = convert(amount, from, to, allRates);

    res.json({
      from,
      to,
      amount,
      result: Math.round(result * 100) / 100,
      rate: allRates[to] ?? null,
    });
  } catch (err) { next(err); }
}
