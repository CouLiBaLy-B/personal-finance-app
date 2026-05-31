// ===========================================
// FinTrack Backend - Request Validation Middleware
// Using Zod for schema validation
// ===========================================

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import logger from "../utils/logger";

// ===========================================
// User Schemas
// ===========================================

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional(),
  baseCurrency: z.string().default("EUR"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  baseCurrency: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirmation do not match",
  path: ["confirmPassword"],
});

// ===========================================
// Account Schemas
// ===========================================

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  type: z.enum(["checking", "saving", "cash", "card"]),
  currency: z.string().default("EUR"),
  initialBalance: z.coerce.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").optional(),
  type: z.enum(["checking", "saving", "cash", "card"]).optional(),
  currency: z.string().optional(),
  initialBalance: z.coerce.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ===========================================
// Category Schemas
// ===========================================

export const createCategorySchema = z.object({
  label: z.string().min(1, "Category label is required"),
  kind: z.enum(["expense", "income"]),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export const updateCategorySchema = z.object({
  label: z.string().min(1, "Category label is required").optional(),
  kind: z.enum(["expense", "income"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const categoryQuerySchema = z.object({
  kind: z.enum(["expense", "income"]).optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ===========================================
// Transaction Schemas
// ===========================================

export const createTransactionSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.enum(["expense", "income", "transfer"]),
  currency: z.string().default("EUR"),
  date: z.coerce.date(),
  description: z.string().optional(),
  recurringId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const updateTransactionSchema = z.object({
  accountId: z.string().uuid("Invalid account ID").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  currency: z.string().optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional(),
  recurringId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const transactionQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["date", "amount", "description"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ===========================================
// Budget Schemas
// ===========================================

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  year: z.coerce.number().int().positive(),
  limit: z.coerce.number().positive("Limit must be positive"),
  alertThreshold: z.coerce.number().int().min(0).max(100).default(80),
});

export const updateBudgetSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID").optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format").optional(),
  year: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().positive("Limit must be positive").optional(),
  alertThreshold: z.coerce.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ===========================================
// Goal Schemas
// ===========================================

export const createGoalSchema = z.object({
  label: z.string().min(1, "Goal label is required"),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive("Target amount must be positive"),
  targetDate: z.coerce.date(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateGoalSchema = z.object({
  label: z.string().min(1, "Goal label is required").optional(),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive("Target amount must be positive").optional(),
  targetDate: z.coerce.date().optional(),
  currentAmount: z.coerce.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isCompleted: z.boolean().optional(),
});

export const goalContributionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// ===========================================
// Recurring Transaction Schemas
// ===========================================

export const createRecurringSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.enum(["expense", "income"]),
  currency: z.string().default("EUR"),
  description: z.string().min(1, "Description is required"),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  interval: z.coerce.number().int().positive().default(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateRecurringSchema = z.object({
  accountId: z.string().uuid("Invalid account ID").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  type: z.enum(["expense", "income"]).optional(),
  currency: z.string().optional(),
  description: z.string().min(1, "Description is required").optional(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]).optional(),
  interval: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional().nullable(),
  nextDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  occurrences: z.coerce.number().int().optional(),
});

// ===========================================
// Validation Middleware
// ===========================================

/**
 * Create validation middleware for a specific schema
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine which part of the request to validate
      let dataToValidate = req.body;
      
      if (req.method === "GET") {
        // For GET requests, validate query params
        dataToValidate = req.query;
      }

      // Parse and validate
      const parsed = schema.parse(dataToValidate);
      
      // Attach parsed data to request
      if (req.method === "GET") {
        (req as any).query = parsed;
      } else {
        (req as any).body = parsed;
      }

      next();
    } catch (error) {
      logger.error("Validation Error:", error);

      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        
        const issues = error.issues ?? (error as any).errors ?? [];
        issues.forEach((err: any) => {
          const path = err.path.join(".");
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid request data",
      });
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      logger.error("Body Validation Error:", error);

      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        
        const issues = error.issues ?? (error as any).errors ?? [];
        issues.forEach((err: any) => {
          const path = err.path.join(".");
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }
  };
}

/**
 * Validate request query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      logger.error("Query Validation Error:", error);

      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        
        const issues = error.issues ?? (error as any).errors ?? [];
        issues.forEach((err: any) => {
          const path = err.path.join(".");
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
      });
    }
  };
}

/**
 * Validate request params
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      logger.error("Params Validation Error:", error);

      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        
        const issues = error.issues ?? (error as any).errors ?? [];
        issues.forEach((err: any) => {
          const path = err.path.join(".");
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid URL parameters",
      });
    }
  };
}
