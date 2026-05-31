// ===========================================
// FinTrack Backend - Transaction Controller
// Handles transaction management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";
import fs from "fs";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createTransactionSchema, updateTransactionSchema, transactionQuerySchema } from "../middleware/validation";
import { getPaginationOptions, paginate } from "../utils/index";
import { getUploadPath, cleanupUpload } from "../middleware/upload";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Promisified fs functions
const fsPromises = fs.promises;

/**
 * Get all transactions for the authenticated user
 */
export async function getAllTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const query = transactionQuerySchema.parse(req.query);
    const pagination = getPaginationOptions(req);

    const where: any = { userId: user.id };
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type) where.type = query.type;
    if (query.dateFrom) where.date = { ...where.date, gte: new Date(query.dateFrom) };
    if (query.dateTo) where.date = { ...where.date, lte: new Date(query.dateTo) };
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder || "desc";
    } else {
      orderBy.date = "desc";
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          account: true,
          category: true,
          recurring: true,
          goal: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const result = paginate(transactions, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific transaction by ID
 */
export async function getTransactionById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: {
        account: true,
        category: true,
        recurring: true,
        goal: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you don't have access");
    }

    res.json({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createTransactionSchema.parse(req.body);

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

    // If goalId is provided, check if goal exists and belongs to user
    if (data.goalId) {
      const goal = await prisma.goal.findFirst({
        where: { id: data.goalId, userId: user.id },
      });

      if (!goal) {
        throw new NotFoundError("Goal not found or doesn't belong to you");
      }
    }

    // If recurringId is provided, check if recurring transaction exists
    if (data.recurringId) {
      const recurring = await prisma.recurringTransaction.findUnique({
        where: { id: data.recurringId },
      });

      if (!recurring) {
        throw new NotFoundError("Recurring transaction not found");
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        categoryId: data.categoryId,
        amount: data.amount,
        type: data.type,
        currency: data.currency || account.currency,
        date: new Date(data.date),
        description: data.description || "",
        recurringId: data.recurringId || null,
        goalId: data.goalId || null,
        notes: data.notes || null,
        attachments: data.attachments || [],
      },
      include: {
        account: true,
        category: true,
        recurring: true,
        goal: true,
      },
    });

    // If this transaction is linked to a goal, update the goal's current amount
    if (data.goalId) {
      await prisma.goal.update({
        where: { id: data.goalId },
        data: {
          currentAmount: {
            increment: data.type === "income" ? data.amount : -data.amount,
          },
        },
      });
    }

    logger.info(`Transaction created: ${transaction.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { transaction },
      message: "Transaction created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if transaction exists and belongs to user
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Transaction not found or you don't have access");
    }

    const data = updateTransactionSchema.parse(req.body);

    // If accountId is being updated, check if account exists and belongs to user
    if (data.accountId && data.accountId !== existing.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.accountId, userId: user.id },
      });

      if (!account) {
        throw new NotFoundError("Account not found or doesn't belong to you");
      }
    }

    // If categoryId is being updated, check if category exists and belongs to user
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });

      if (!category) {
        throw new NotFoundError("Category not found or doesn't belong to you");
      }
    }

    // Handle goal amount adjustment if goalId changes
    if (data.goalId && data.goalId !== existing.goalId) {
      // Remove from old goal
      if (existing.goalId) {
        await prisma.goal.update({
          where: { id: existing.goalId },
          data: {
            currentAmount: {
              decrement: existing.type === "income" ? existing.amount : -existing.amount,
            },
          },
        });
      }

      // Add to new goal
      if (data.goalId) {
        const goal = await prisma.goal.findFirst({
          where: { id: data.goalId, userId: user.id },
        });

        if (!goal) {
          throw new NotFoundError("Goal not found or doesn't belong to you");
        }

        await prisma.goal.update({
          where: { id: data.goalId },
          data: {
            currentAmount: {
              increment: data.type === "income" ? (data.amount || existing.amount) : -(data.amount || existing.amount),
            },
          },
        });
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data,
      include: {
        account: true,
        category: true,
        recurring: true,
        goal: true,
      },
    });

    logger.info(`Transaction updated: ${transaction.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { transaction },
      message: "Transaction updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if transaction exists and belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: { goal: true },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you don't have access");
    }

    // If transaction is linked to a goal, update the goal's current amount
    if (transaction.goalId && transaction.goal) {
      await prisma.goal.update({
        where: { id: transaction.goalId },
        data: {
          currentAmount: {
            decrement: transaction.type === "income" ? transaction.amount : -transaction.amount,
          },
        },
      });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    logger.info(`Transaction deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Import transactions from CSV file
 */
export async function importTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const file = (req as any).file;
    if (!file) {
      throw new ValidationError("No file uploaded");
    }

    const { accountId, categoryId, dateFormat } = req.body;

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new NotFoundError("Account not found or doesn't belong to you");
    }

    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
    });

    if (!category) {
      throw new NotFoundError("Category not found or doesn't belong to you");
    }

    const filePath = getUploadPath(file.filename);
    const results: any[] = [];

    // Process CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    // Clean up the uploaded file
    await cleanupUpload(file.filename);

    if (results.length === 0) {
      throw new ValidationError("No data found in CSV file");
    }

    const createdTransactions: any[] = [];
    const errors: { row: number; error: string }[] = [];

    // Process each row
    for (let i = 0; i < results.length; i++) {
      try {
        const row = results[i];

        // Map CSV columns to transaction fields
        // This is a basic mapping - you might need to customize based on your CSV format
        const amount = parseFloat(row.amount || row.Amount || row.Montant || "0");
        const date = new Date(row.date || row.Date || row.date || "");
        const description = row.description || row.Description || row.Libellé || "Imported transaction";

        if (isNaN(amount) || amount <= 0) {
          errors.push({ row: i + 1, error: "Invalid amount" });
          continue;
        }

        if (isNaN(date.getTime())) {
          errors.push({ row: i + 1, error: "Invalid date" });
          continue;
        }

        const type = amount < 0 ? "expense" : "income";

        const transaction = await prisma.transaction.create({
          data: {
            userId: user.id,
            accountId,
            categoryId,
            amount: Math.abs(amount),
            type,
            currency: account.currency,
            date,
            description: String(description).substring(0, 255),
          },
        });

        createdTransactions.push(transaction);
      } catch (error) {
        errors.push({ row: i + 1, error: (error as Error).message });
      }
    }

    logger.info(`Imported ${createdTransactions.length} transactions for user ${user.id}`);

    res.json({
      success: true,
      data: {
        imported: createdTransactions.length,
        errors,
      },
      message: `Successfully imported ${createdTransactions.length} transactions`,
    });
  } catch (error) {
    // Clean up file if it exists
    const file = (req as any).file;
    if (file) {
      await cleanupUpload(file.filename);
    }
    next(error);
  }
}

/**
 * Export transactions to CSV
 */
export async function exportTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const query = transactionQuerySchema.parse(req.query);

    const where: any = { userId: user.id };
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type) where.type = query.type;
    if (query.dateFrom) where.date = { ...where.date, gte: new Date(query.dateFrom) };
    if (query.dateTo) where.date = { ...where.date, lte: new Date(query.dateTo) };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        account: true,
        category: true,
      },
    });

    if (transactions.length === 0) {
      throw new NotFoundError("No transactions found");
    }

    // Create CSV content
    const csvHeader = [
      "ID",
      "Date",
      "Description",
      "Account",
      "Category",
      "Type",
      "Amount",
      "Currency",
    ].join(",");

    const csvRows = transactions.map((tx) => {
      const date = new Date(tx.date).toISOString().split("T")[0];
      const amount = tx.type === "expense" ? `-${tx.amount}` : tx.amount;
      return [
        tx.id,
        date,
        `"${tx.description?.replace(/"/g, '""') || ""}"`,
        `"${tx.account?.name || ""}"`,
        `"${tx.category?.label || ""}"`,
        tx.type,
        amount,
        tx.currency,
      ].join(",");
    });

    const csvContent = [csvHeader, ...csvRows].join("\n");

    // Set response headers
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fintrack-transactions-${Date.now()}.csv"`
    );

    logger.info(`Exported ${transactions.length} transactions for user ${user.id}`);

    res.send(csvContent);
  } catch (error) {
    next(error);
  }
}
