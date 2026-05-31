// ===========================================
// FinTrack Backend - Goal Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  getAllGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalContribution,
  getGoalReport,
  markGoalCompleted,
} from "../controllers/goalController";
import { createGoalSchema, updateGoalSchema, goalContributionSchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/goals - Get all goals
router.get("/", defaultLimiter, requireAuth, getAllGoals);

// GET /api/v1/goals/report - Get goal report
router.get("/report", defaultLimiter, requireAuth, getGoalReport);

// POST /api/v1/goals - Create new goal
router.post("/", defaultLimiter, requireAuth, validateBody(createGoalSchema), createGoal);

// PUT /api/v1/goals/:id - Update goal
router.put("/:id", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateGoalSchema),
  updateGoal
);

// DELETE /api/v1/goals/:id - Delete goal
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteGoal);

// POST /api/v1/goals/:id/contribute - Add contribution to goal
router.post("/:id/contribute", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(goalContributionSchema),
  addGoalContribution
);

// GET /api/v1/goals/:id - Get goal by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getGoalById);

// PATCH /api/v1/goals/:id/complete - Mark goal as completed
router.patch("/:id/complete", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  markGoalCompleted
);

export default router;
