// ===========================================
// FinTrack Backend - Budget Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetReport,
  getCurrentBudgetStatus,
} from "../controllers/budgetController";
import { createBudgetSchema, updateBudgetSchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/budgets - Get all budgets
router.get("/", defaultLimiter, requireAuth, getAllBudgets);

// GET /api/v1/budgets/report - Get budget report for a month
router.get("/report", defaultLimiter, requireAuth, getBudgetReport);

// GET /api/v1/budgets/current/status - Get current month budget status
router.get("/current/status", defaultLimiter, requireAuth, getCurrentBudgetStatus);

// POST /api/v1/budgets - Create new budget
router.post("/", defaultLimiter, requireAuth, validateBody(createBudgetSchema), createBudget);

// PUT /api/v1/budgets/:id - Update budget
router.put("/:id", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateBudgetSchema),
  updateBudget
);

// DELETE /api/v1/budgets/:id - Delete budget
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteBudget);

// GET /api/v1/budgets/:id - Get budget by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getBudgetById);

export default router;
