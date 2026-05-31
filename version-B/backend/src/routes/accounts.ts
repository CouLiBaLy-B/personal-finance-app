// ===========================================
// FinTrack Backend - Account Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalance,
} from "../controllers/accountController";
import { createAccountSchema, updateAccountSchema, transactionQuerySchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/accounts - Get all accounts
router.get("/", defaultLimiter, requireAuth, validateQuery(transactionQuerySchema), getAllAccounts);

// GET /api/v1/accounts/:id - Get account by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getAccountById);

// POST /api/v1/accounts - Create new account
router.post("/", defaultLimiter, requireAuth, validateBody(createAccountSchema), createAccount);

// PUT /api/v1/accounts/:id - Update account
router.put("/:id", defaultLimiter, requireAuth, 
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateAccountSchema),
  updateAccount
);

// DELETE /api/v1/accounts/:id - Delete account
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteAccount);

// GET /api/v1/accounts/:id/balance - Get account balance
router.get("/:id/balance", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getAccountBalance);

export default router;
