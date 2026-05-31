// ===========================================
// FinTrack Backend - Report Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter, publicLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateQuery } from "../middleware/validation";
import {
  getFinancialSummary,
  downloadBilanPdf,
  downloadBudgetReportPdf,
  downloadGoalReportPdf,
  getMonthlyTrend,
  getCategoryBreakdown,
} from "../controllers/reportController";
import { transactionQuerySchema } from "../middleware/validation";

const router = Router();

// GET /api/v1/reports/summary - Get financial summary
router.get("/summary", defaultLimiter, requireAuth, validateQuery(transactionQuerySchema), getFinancialSummary);

// GET /api/v1/reports/bilan/pdf - Download bilan PDF
router.get("/bilan/pdf", defaultLimiter, requireAuth, downloadBilanPdf);

// GET /api/v1/reports/budget/pdf - Download budget report PDF
router.get("/budget/pdf", defaultLimiter, requireAuth, downloadBudgetReportPdf);

// GET /api/v1/reports/goals/pdf - Download goal report PDF
router.get("/goals/pdf", defaultLimiter, requireAuth, downloadGoalReportPdf);

// GET /api/v1/reports/trend - Get monthly trend data
router.get("/trend", defaultLimiter, requireAuth, getMonthlyTrend);

// GET /api/v1/reports/category-breakdown - Get category breakdown
router.get("/category-breakdown", defaultLimiter, requireAuth, getCategoryBreakdown);

export default router;
