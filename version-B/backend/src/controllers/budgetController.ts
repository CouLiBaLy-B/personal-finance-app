// ===========================================
// FinTrack Backend - Budget Controller
// Handles budget management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createBudgetSchema, updateBudgetSchema } from "../middleware/validation";
import { getPaginationOptions, paginate, getMonthKey } from "../utils/index";

const prisma = new PrismaClient();

/**
 * Get all budgets for the authenticated user
 */
export async function getAllBudgets(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const pagination = getPaginationOptions(req);
    const { month, year, categoryId } = req.query;

    const where: any = { userId: user.id };
    if (month) where.month = String(month);
    if (year) where.year = parseInt(year as string);
    if (categoryId) where.categoryId = String(categoryId);

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          category: true,
        },
      }),
      prisma.budget.count({ where }),
    ]);

    const result = paginate(budgets, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get budget by ID
 */
export async function getBudgetById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: user.id },
      include: {
        category: true,
        user: true,
      },
    });

    if (!budget) {
      throw new NotFoundError("Budget not found or you don't have access");
    }

    res.json({
      success: true,
      data: { budget },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new budget
 */
export async function createBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createBudgetSchema.parse(req.body);

    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
    });

    if (!category) {
      throw new NotFoundError("Category not found or doesn't belong to you");
    }

    // Check if budget already exists for this category and month
    const existing = await prisma.budget.findFirst({
      where: {
        userId: user.id,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
      },
    });

    if (existing) {
      throw new ValidationError("A budget for this category and month already exists");
    }

    const budget = await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
        limit: data.limit,
        alertThreshold: data.alertThreshold || 80,
      },
      include: {
        category: true,
      },
    });

    logger.info(`Budget created: ${budget.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { budget },
      message: "Budget created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing budget
 */
export async function updateBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if budget exists and belongs to user
    const existing = await prisma.budget.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Budget not found or you don't have access");
    }

    const data = updateBudgetSchema.parse(req.body);

    // If categoryId is being updated, check if category exists
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });

      if (!category) {
        throw new NotFoundError("Category not found or doesn't belong to you");
      }
    }

    const budget = await prisma.budget.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });

    logger.info(`Budget updated: ${budget.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { budget },
      message: "Budget updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a budget
 */
export async function deleteBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if budget exists and belongs to user
    const budget = await prisma.budget.findFirst({
      where: { id, userId: user.id },
    });

    if (!budget) {
      throw new NotFoundError("Budget not found or you don't have access");
    }

    await prisma.budget.delete({
      where: { id },
    });

    logger.info(`Budget deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Budget deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get budget report for a specific month
 */
export async function getBudgetReport(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { month, year } = req.query;

    if (!month || !year) {
      throw new ValidationError("Month and year are required");
    }

    const monthStr = String(month);
    const yearNum = parseInt(year as string);

    // Get all budgets for this month
    const budgets = await prisma.budget.findMany({
      where: {
        userId: user.id,
        month: monthStr,
        year: yearNum,
      },
      include: {
        category: true,
      },
    });

    if (budgets.length === 0) {
      return res.json({
        success: true,
        data: {
          month: monthStr,
          year: yearNum,
          totalBudget: 0,
          totalSpent: 0,
          remaining: 0,
          budgets: [],
        },
      });
    }

    // Calculate totals
    let totalBudget = 0;
    let totalSpent = 0;

    const budgetReports = await Promise.all(
      budgets.map(async (budget) => {
        // Get spent amount for this category in this month
        const transactions = await prisma.transaction.findMany({
          where: {
            userId: user.id,
            categoryId: budget.categoryId,
            type: "expense",
            date: {
              gte: new Date(yearNum, parseInt(monthStr.split("-")[1]) - 1, 1),
              lte: new Date(yearNum, parseInt(monthStr.split("-")[1]), 0),
            },
          },
        });

        const spent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const remaining = budget.limit - spent;
        const percentage = (spent / budget.limit) * 100;

        totalBudget += budget.limit;
        totalSpent += spent;

        let status: "under" | "warning" | "over" = "under";
        if (percentage >= 100) {
          status = "over";
        } else if (percentage >= budget.alertThreshold) {
          status = "warning";
        }

        return {
          categoryId: budget.categoryId,
          categoryLabel: budget.category.label,
          limit: budget.limit,
          spent,
          remaining,
          percentage: Math.round(percentage),
          status,
        };
      })
    );

    const remaining = totalBudget - totalSpent;

    res.json({
      success: true,
      data: {
        month: monthStr,
        year: yearNum,
        baseCurrency: user.baseCurrency,
        totalBudget,
        totalSpent,
        remaining,
        budgets: budgetReports,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current month's budget status
 */
export async function getCurrentBudgetStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const now = new Date();
    const currentMonth = getMonthKey(now);
    const currentYear = now.getFullYear();

    const budgets = await prisma.budget.findMany({
      where: {
        userId: user.id,
        month: currentMonth,
        year: currentYear,
      },
      include: {
        category: true,
      },
    });

    const alerts = [];
    const warnings = [];

    for (const budget of budgets) {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          categoryId: budget.categoryId,
          type: "expense",
          date: {
            gte: new Date(currentYear, now.getMonth(), 1),
            lte: new Date(currentYear, now.getMonth() + 1, 0),
          },
        },
      });

      const spent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const percentage = (spent / budget.limit) * 100;

      if (percentage >= 100) {
        alerts.push({
          categoryId: budget.categoryId,
          categoryLabel: budget.category.label,
          spent,
          limit: budget.limit,
          percentage: Math.round(percentage),
        });
      } else if (percentage >= budget.alertThreshold) {
        warnings.push({
          categoryId: budget.categoryId,
          categoryLabel: budget.category.label,
          spent,
          limit: budget.limit,
          percentage: Math.round(percentage),
        });
      }
    }

    res.json({
      success: true,
      data: {
        month: currentMonth,
        year: currentYear,
        alerts,
        warnings,
      },
    });
  } catch (error) {
    next(error);
  }
}
