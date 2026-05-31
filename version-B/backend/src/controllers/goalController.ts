// ===========================================
// FinTrack Backend - Goal Controller
// Handles goal management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createGoalSchema, updateGoalSchema, goalContributionSchema } from "../middleware/validation";
import { getPaginationOptions, paginate } from "../utils/index";

const prisma = new PrismaClient();

/**
 * Get all goals for the authenticated user
 */
export async function getAllGoals(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const pagination = getPaginationOptions(req);
    const { isCompleted, isActive } = req.query;

    const where: any = { userId: user.id };
    if (isCompleted !== undefined) where.isCompleted = isCompleted === "true";
    if (isActive !== undefined) where.isActive = isActive === "true";

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.goal.count({ where }),
    ]);

    const result = paginate(goals, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific goal by ID
 */
export async function getGoalById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
      include: {
        transactions: {
          include: {
            transaction: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found or you don't have access");
    }

    res.json({
      success: true,
      data: { goal },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new goal
 */
export async function createGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createGoalSchema.parse(req.body);

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        label: data.label,
        description: data.description,
        targetAmount: data.targetAmount,
        currentAmount: 0,
        targetDate: new Date(data.targetDate),
        color: data.color || "#0ea5e9",
        icon: data.icon || "🎯",
      },
    });

    logger.info(`Goal created: ${goal.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { goal },
      message: "Goal created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing goal
 */
export async function updateGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if goal exists and belongs to user
    const existing = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Goal not found or you don't have access");
    }

    const data = updateGoalSchema.parse(req.body);

    // If currentAmount is being updated, ensure it doesn't exceed target
    if (data.currentAmount !== undefined) {
      if (data.currentAmount > (data.targetAmount || existing.targetAmount)) {
        throw new ValidationError("Current amount cannot exceed target amount");
      }
    }

    const goal = await prisma.goal.update({
      where: { id },
      data,
    });

    logger.info(`Goal updated: ${goal.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { goal },
      message: "Goal updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a goal
 */
export async function deleteGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found or you don't have access");
    }

    // If goal has linked transactions, unlink them first
    if (goal._count.transactions > 0) {
      await prisma.transaction.updateMany({
        where: { goalId: id },
        data: { goalId: null },
      });
    }

    await prisma.goal.delete({
      where: { id },
    });

    logger.info(`Goal deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a contribution to a goal
 */
export async function addGoalContribution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found or you don't have access");
    }

    const data = goalContributionSchema.parse(req.body);

    // Check if this would exceed the target
    const newAmount = goal.currentAmount + data.amount;
    if (newAmount > goal.targetAmount) {
      throw new ValidationError("Contribution would exceed target amount");
    }

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        currentAmount: newAmount,
        isCompleted: newAmount >= goal.targetAmount,
      },
    });

    // Create a goal transaction record
    await prisma.goalTransaction.create({
      data: {
        userId: user.id,
        goalId: id,
        transactionId: null, // Not linked to a specific transaction
        amount: data.amount,
        date: new Date(data.date || new Date()),
        notes: data.notes || null,
      },
    });

    logger.info(`Goal contribution added: ${data.amount} to goal ${id} for user ${user.id}`);

    res.json({
      success: true,
      data: { goal: updatedGoal },
      message: "Contribution added successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get goal progress report
 */
export async function getGoalReport(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    const goalReports = goals.map((goal) => {
      const targetDate = new Date(goal.targetDate);
      const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const progressPercentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);

      let status: "on_track" | "behind" | "completed" = "on_track";
      if (goal.isCompleted) {
        status = "completed";
      } else if (daysRemaining === 0 && !goal.isCompleted) {
        status = "behind";
      } else if (progressPercentage < 50 && daysRemaining < 30) {
        status = "behind";
      }

      return {
        id: goal.id,
        label: goal.label,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
        progressPercentage: Math.round(progressPercentage),
        daysRemaining,
        status,
      };
    });

    const totalSaved = goalReports.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goalReports.reduce((sum, g) => sum + g.targetAmount, 0);

    res.json({
      success: true,
      data: {
        totalGoals: goals.length,
        completedGoals: goalReports.filter((g) => g.status === "completed").length,
        inProgressGoals: goalReports.filter((g) => g.status !== "completed").length,
        totalSaved,
        totalTarget,
        overallProgress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
        goals: goalReports,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a goal as completed
 */
export async function markGoalCompleted(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found or you don't have access");
    }

    // If goal is already completed, we can unmark it
    const isCompleted = goal.isCompleted ? false : goal.currentAmount >= goal.targetAmount;

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: { isCompleted },
    });

    logger.info(`Goal ${isCompleted ? "completed" : "reopened"}: ${id} for user ${user.id}`);

    res.json({
      success: true,
      data: { goal: updatedGoal },
      message: `Goal ${isCompleted ? "marked as completed" : "reopened"} successfully`,
    });
  } catch (error) {
    next(error);
  }
}
