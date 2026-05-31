// ===========================================
// FinTrack Backend - Recurring Transaction Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  getAllRecurring,
  getRecurringById,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  generateRecurringTransactions,
  skipNextOccurrence,
} from "../controllers/recurringController";
import { createRecurringSchema, updateRecurringSchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/recurring - Get all recurring transactions
router.get("/", defaultLimiter, requireAuth, getAllRecurring);

// POST /api/v1/recurring/generate - Generate transactions from recurring definitions
router.post("/generate", defaultLimiter, requireAuth, generateRecurringTransactions);

// POST /api/v1/recurring - Create new recurring transaction
router.post("/", defaultLimiter, requireAuth, validateBody(createRecurringSchema), createRecurring);

// PUT /api/v1/recurring/:id - Update recurring transaction
router.put("/:id", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateRecurringSchema),
  updateRecurring
);

// DELETE /api/v1/recurring/:id - Delete recurring transaction
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteRecurring);

// GET /api/v1/recurring/:id - Get recurring transaction by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getRecurringById);

// POST /api/v1/recurring/:id/skip - Skip next occurrence
router.post("/:id/skip", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  skipNextOccurrence
);

export default router;
