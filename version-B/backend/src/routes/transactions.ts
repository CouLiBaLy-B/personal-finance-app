// ===========================================
// FinTrack Backend - Transaction Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter, publicLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import { upload, handleUploadError } from "../middleware/upload";
import {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
  exportTransactions,
} from "../controllers/transactionController";
import { createTransactionSchema, updateTransactionSchema, transactionQuerySchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/transactions - Get all transactions
router.get("/", defaultLimiter, requireAuth, validateQuery(transactionQuerySchema), getAllTransactions);

// POST /api/v1/transactions/import - Import transactions from CSV
router.post("/import", defaultLimiter, requireAuth, upload.single("file"), handleUploadError, importTransactions);

// GET /api/v1/transactions/export - Export transactions to CSV
router.get("/export", defaultLimiter, requireAuth, validateQuery(transactionQuerySchema), exportTransactions);

// POST /api/v1/transactions - Create new transaction
router.post("/", defaultLimiter, requireAuth, validateBody(createTransactionSchema), createTransaction);

// PUT /api/v1/transactions/:id - Update transaction
router.put("/:id", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateTransactionSchema),
  updateTransaction
);

// DELETE /api/v1/transactions/:id - Delete transaction
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteTransaction);

// GET /api/v1/transactions/:id - Get transaction by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getTransactionById);

export default router;
