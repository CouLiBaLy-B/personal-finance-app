// ===========================================
// FinTrack Backend - Recurring Transaction Controller
// Handles recurring transaction management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { addDays, addWeeks, addMonths, addQuarters, addYears } from "date-fns";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createRecurringSchema, updateRecurringSchema } from "../middleware/validation";
import { getPaginationOptions, paginate } from "../utils/index";

const prisma = new PrismaClient();

/**
 * Get all recurring transactions for the authenticated user
 */
export async function getAllRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const pagination = getPaginationOptions(req);
    const { isActive, frequency } = req.query;

    const where: any = { userId: user.id };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (frequency) where.frequency = frequency;

    const [recurring, total] = await Promise.all([
      prisma.recurringTransaction.findMany({
        where,
        orderBy: { nextDate: "asc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          account: true,
          category: true,
          transactions: {
            orderBy: { date: "desc" },
            take: 5,
          },
        },
      }),
      prisma.recurringTransaction.count({ where }),
    ]);

    const result = paginate(recurring, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific recurring transaction by ID
 */
export async function getRecurringById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id, userId: user.id },
      include: {
        account: true,
        category: true,
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!recurring) {
      throw new NotFoundError("Recurring transaction not found or you don't have access");
    }

    res.json({
      success: true,
      data: { recurring },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new recurring transaction
 */
export async function createRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createRecurringSchema.parse(req.body);

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId: user.id },
    });

    if (!account) {
      throw new NotFoundError("Account not found or doesn't belong to you");
    }

    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
    });

    if (!category) {
      throw new NotFoundError("Category not found or doesn't belong to you");
    }

    // Calculate next date based on frequency
    const startDate = new Date(data.startDate);
    let nextDate = new Date(startDate);

    switch (data.frequency) {
      case "daily":
        nextDate = addDays(startDate, data.interval);
        break;
      case "weekly":
        nextDate = addWeeks(startDate, data.interval);
        break;
      case "biweekly":
        nextDate = addWeeks(startDate, data.interval * 2);
        break;
      case "monthly":
        nextDate = addMonths(startDate, data.interval);
        break;
      case "quarterly":
        nextDate = addQuarters(startDate, data.interval);
        break;
      case "yearly":
        nextDate = addYears(startDate, data.interval);
        break;
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        categoryId: data.categoryId,
        amount: data.amount,
        type: data.type,
        currency: data.currency || account.currency,
        description: data.description,
        frequency: data.frequency,
        interval: data.interval,
        startDate,
        nextDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive,
      },
      include: {
        account: true,
        category: true,
      },
    });

    logger.info(`Recurring transaction created: ${recurring.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { recurring },
      message: "Recurring transaction created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing recurring transaction
 */
export async function updateRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if recurring transaction exists and belongs to user
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Recurring transaction not found or you don't have access");
    }

    const data = updateRecurringSchema.parse(req.body);

    // If accountId is being updated, check if account exists
    if (data.accountId && data.accountId !== existing.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.accountId, userId: user.id },
      });

      if (!account) {
        throw new NotFoundError("Account not found or doesn't belong to you");
      }
    }

    // If categoryId is being updated, check if category exists
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });

      if (!category) {
        throw new NotFoundError("Category not found or doesn't belong to you");
      }
    }

    // Calculate next date if start date or frequency changed
    let nextDate = data.nextDate ? new Date(data.nextDate) : existing.nextDate;
    
    if (data.startDate || data.frequency || data.interval) {
      const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
      const frequency = data.frequency || existing.frequency;
      const interval = data.interval || existing.interval;

      switch (frequency) {
        case "daily":
          nextDate = addDays(startDate, interval);
          break;
        case "weekly":
          nextDate = addWeeks(startDate, interval);
          break;
        case "biweekly":
          nextDate = addWeeks(startDate, interval * 2);
          break;
        case "monthly":
          nextDate = addMonths(startDate, interval);
          break;
        case "quarterly":
          nextDate = addQuarters(startDate, interval);
          break;
        case "yearly":
          nextDate = addYears(startDate, interval);
          break;
      }
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...data,
        nextDate,
      },
      include: {
        account: true,
        category: true,
      },
    });

    logger.info(`Recurring transaction updated: ${recurring.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { recurring },
      message: "Recurring transaction updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a recurring transaction
 */
export async function deleteRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if recurring transaction exists and belongs to user
    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!recurring) {
      throw new NotFoundError("Recurring transaction not found or you don't have access");
    }

    // Note: We don't delete the generated transactions, just the recurring definition
    // The transactions will remain in the database

    await prisma.recurringTransaction.delete({
      where: { id },
    });

    logger.info(`Recurring transaction deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Recurring transaction deleted successfully. Generated transactions remain in your history.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate transactions from recurring definitions
 * This should be run daily via a cron job
 */
export async function generateRecurringTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const now = new Date();
    
    // Find all recurring transactions that are due
    const recurringList = await prisma.recurringTransaction.findMany({
      where: {
        userId: user.id,
        isActive: true,
        nextDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      include: {
        account: true,
        category: true,
      },
    });

    let generatedCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const recurring of recurringList) {
      try {
        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: user.id,
            accountId: recurring.accountId,
            categoryId: recurring.categoryId,
            amount: recurring.amount,
            type: recurring.type,
            currency: recurring.currency,
            date: recurring.nextDate,
            description: `${recurring.description} (Récurrent)`,
            recurringId: recurring.id,
          },
        });

        // Update recurring transaction
        let newNextDate = new Date();
        
        switch (recurring.frequency) {
          case "daily":
            newNextDate = addDays(recurring.nextDate, recurring.interval);
            break;
          case "weekly":
            newNextDate = addWeeks(recurring.nextDate, recurring.interval);
            break;
          case "biweekly":
            newNextDate = addWeeks(recurring.nextDate, recurring.interval * 2);
            break;
          case "monthly":
            newNextDate = addMonths(recurring.nextDate, recurring.interval);
            break;
          case "quarterly":
            newNextDate = addQuarters(recurring.nextDate, recurring.interval);
            break;
          case "yearly":
            newNextDate = addYears(recurring.nextDate, recurring.interval);
            break;
        }

        // Check if we've exceeded the end date
        if (recurring.endDate && newNextDate > recurring.endDate) {
          // Deactivate this recurring transaction
          await prisma.recurringTransaction.update({
            where: { id: recurring.id },
            data: {
              nextDate: newNextDate,
              isActive: false,
              occurrences: recurring.occurrences + 1,
            },
          });
        } else {
          await prisma.recurringTransaction.update({
            where: { id: recurring.id },
            data: {
              nextDate: newNextDate,
              occurrences: recurring.occurrences + 1,
            },
          });
        }

        generatedCount++;
      } catch (error) {
        errors.push({
          id: recurring.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info(`Generated ${generatedCount} recurring transactions for user ${user.id}`);

    res.json({
      success: true,
      data: {
        generated: generatedCount,
        errors,
      },
      message: `Successfully generated ${generatedCount} transactions from recurring definitions`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Skip the next occurrence of a recurring transaction
 */
export async function skipNextOccurrence(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if recurring transaction exists and belongs to user
    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!recurring) {
      throw new NotFoundError("Recurring transaction not found or you don't have access");
    }

    // Calculate the next date after the current nextDate
    let newNextDate = new Date();
    
    switch (recurring.frequency) {
      case "daily":
        newNextDate = addDays(recurring.nextDate, recurring.interval);
        break;
      case "weekly":
        newNextDate = addWeeks(recurring.nextDate, recurring.interval);
        break;
      case "biweekly":
        newNextDate = addWeeks(recurring.nextDate, recurring.interval * 2);
        break;
      case "monthly":
        newNextDate = addMonths(recurring.nextDate, recurring.interval);
        break;
      case "quarterly":
        newNextDate = addQuarters(recurring.nextDate, recurring.interval);
        break;
      case "yearly":
        newNextDate = addYears(recurring.nextDate, recurring.interval);
        break;
    }

    await prisma.recurringTransaction.update({
      where: { id },
      data: { nextDate: newNextDate },
    });

    logger.info(`Skipped next occurrence for recurring transaction: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Next occurrence skipped successfully",
    });
  } catch (error) {
    next(error);
  }
}
