// ===========================================
// FinTrack Backend - Main Routes Index
// Combines all route files
// ===========================================

import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import accountRoutes from "./accounts";
import categoryRoutes from "./categories";
import transactionRoutes from "./transactions";
import budgetRoutes from "./budgets";
import goalRoutes from "./goals";
import recurringRoutes from "./recurring";
import reportRoutes from "./reports";
import fxRoutes from "./fx";

const router = Router();

// Health check endpoint
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Mount all route groups under /api/v1
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/accounts", accountRoutes);
router.use("/categories", categoryRoutes);
router.use("/transactions", transactionRoutes);
router.use("/budgets", budgetRoutes);
router.use("/goals", goalRoutes);
router.use("/recurring", recurringRoutes);
router.use("/reports", reportRoutes);
router.use("/fx", fxRoutes);

export default router;
