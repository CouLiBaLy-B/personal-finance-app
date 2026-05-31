// ===========================================
// FinTrack Backend - Category Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
} from "../controllers/categoryController";
import { createCategorySchema, updateCategorySchema, categoryQuerySchema } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// GET /api/v1/categories - Get all categories
router.get("/", defaultLimiter, requireAuth, validateQuery(categoryQuerySchema), getAllCategories);

// GET /api/v1/categories/tree - Get category tree
router.get("/tree", defaultLimiter, requireAuth, getCategoryTree);

// POST /api/v1/categories - Create new category
router.post("/", defaultLimiter, requireAuth, validateBody(createCategorySchema), createCategory);

// PUT /api/v1/categories/:id - Update category
router.put("/:id", defaultLimiter, requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateCategorySchema),
  updateCategory
);

// DELETE /api/v1/categories/:id - Delete category
router.delete("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), deleteCategory);

// GET /api/v1/categories/:id - Get category by ID
router.get("/:id", defaultLimiter, requireAuth, validateParams(z.object({ id: z.string().uuid() })), getCategoryById);

export default router;
