// ===========================================
// FinTrack Backend - Exchange Rate Routes
// ===========================================

import { Router } from "express";
import { publicLimiter } from "../middleware/rateLimiter";
import { validateQuery } from "../middleware/validation";
import {
  getCurrencies,
  getExchangeRates,
  convertCurrency,
  getAllRates,
  clearCache,
} from "../controllers/fxController";
import { z } from "zod";

const router = Router();

// GET /api/v1/fx/currencies - Get all supported currencies
router.get("/currencies", publicLimiter, getCurrencies);

// GET /api/v1/fx/rates - Get exchange rates for a base currency
router.get("/rates", publicLimiter, validateQuery(z.object({
  base: z.string().optional(),
})), getExchangeRates);

// GET /api/v1/fx/convert - Convert amount from one currency to another
router.get("/convert", publicLimiter, validateQuery(z.object({
  amount: z.string(),
  from: z.string(),
  to: z.string(),
})), convertCurrency);

// GET /api/v1/fx/all - Get all rates (EUR base)
router.get("/all", publicLimiter, getAllRates);

// POST /api/v1/fx/cache/clear - Clear rate cache (admin/debug)
router.post("/cache/clear", publicLimiter, clearCache);

export default router;
