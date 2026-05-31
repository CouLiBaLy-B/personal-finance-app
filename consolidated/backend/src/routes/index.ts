/**
 * API router — assembles all route modules under /api/v1.
 */
import { Router } from "express";
import authRoutes from "./auth.js";
import accountRoutes from "./accounts.js";
import categoryRoutes from "./categories.js";
import transactionRoutes from "./transactions.js";
import budgetRoutes from "./budgets.js";
import goalRoutes from "./goals.js";
import recurringRoutes from "./recurring.js";
import reportRoutes from "./reports.js";
import fxRoutes from "./fx.js";
import syncRoutes from "./sync.js";
import userRoutes from "./users.js";

const router = Router();

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
router.use("/sync", syncRoutes);

export default router;
