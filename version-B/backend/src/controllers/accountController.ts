// ===========================================
// FinTrack Backend - Account Controller
// Handles account management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createAccountSchema, updateAccountSchema } from "../middleware/validation";
import { getPaginationOptions, paginate, handlePrismaError } from "../utils/index";

const prisma = new PrismaClient();

/**
 * Get all accounts for the authenticated user
 */
export async function getAllAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const pagination = getPaginationOptions(req);

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.account.count({ where: { userId: user.id } }),
    ]);

    const result = paginate(accounts, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific account by ID
 */
export async function getAccountById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
    });

    if (!account) {
      throw new NotFoundError("Account not found or you don't have access");
    }

    res.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new account
 */
export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createAccountSchema.parse(req.body);

    // Check if account with same name already exists for this user
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, name: data.name },
    });

    if (existing) {
      throw new ValidationError("An account with this name already exists");
    }

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        name: data.name,
        type: data.type,
        currency: data.currency || user.baseCurrency,
        initialBalance: data.initialBalance || 0,
        currentBalance: data.initialBalance || 0,
        color: data.color,
        icon: data.icon,
      },
    });

    logger.info(`Account created: ${account.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { account },
      message: "Account created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing account
 */
export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if account exists and belongs to user
    const existing = await prisma.account.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Account not found or you don't have access");
    }

    const data = updateAccountSchema.parse(req.body);

    // If name is being updated, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.account.findFirst({
        where: { userId: user.id, name: data.name },
      });

      if (duplicate) {
        throw new ValidationError("An account with this name already exists");
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data,
    });

    logger.info(`Account updated: ${account.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { account },
      message: "Account updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an account
 */
export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!account) {
      throw new NotFoundError("Account not found or you don't have access");
    }

    // If account has transactions, we need to handle them
    // For now, we'll just delete the account and let Prisma cascade delete transactions
    // In production, you might want to move transactions to another account first
    if (account._count.transactions > 0) {
      // Option: Move transactions to a default account
      const defaultAccount = await prisma.account.findFirst({
        where: { userId: user.id, id: { not: id } },
      });

      if (defaultAccount) {
        await prisma.transaction.updateMany({
          where: { accountId: id },
          data: { accountId: defaultAccount.id },
        });
      }
    }

    await prisma.account.delete({
      where: { id },
    });

    logger.info(`Account deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get account balance (calculated from transactions)
 */
export async function getAccountBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: {
        transactions: true,
      },
    });

    if (!account) {
      throw new NotFoundError("Account not found or you don't have access");
    }

    // Calculate balance from transactions
    // Note: This is a simplified calculation
    // In production, you might want to use a more sophisticated method
    // that accounts for transfers between accounts
    let balance = account.initialBalance;

    for (const tx of account.transactions) {
      if (tx.type === "income") {
        balance += tx.amount;
      } else if (tx.type === "expense") {
        balance -= tx.amount;
      }
      // Transfers are handled separately
    }

    // Update the current balance in the database
    await prisma.account.update({
      where: { id },
      data: { currentBalance: balance },
    });

    res.json({
      success: true,
      data: {
        account: {
          ...account,
          currentBalance: balance,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
