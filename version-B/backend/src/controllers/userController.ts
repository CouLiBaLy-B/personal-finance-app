// ===========================================
// FinTrack Backend - User Controller
// Handles user-related operations
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError } from "../middleware/errorHandler";
import { updateProfileSchema, changePasswordSchema } from "../middleware/validation";

const prisma = new PrismaClient();

/**
 * Get all users (Admin only - placeholder for future)
 */
export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user by ID
 */
export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Users can only access their own profile (unless admin)
    if (user?.id !== id) {
      throw new AuthenticationError("You can only access your own profile");
    }

    const profile = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundError("User not found");
    }

    res.json({
      success: true,
      data: { user: profile },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Export all user data (RGPD compliance)
 */
export async function exportUserData(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Fetch all user data
    const [profile, accounts, categories, transactions, budgets, goals, recurring, sessions] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            fullName: true,
            baseCurrency: true,
            avatarUrl: true,
            googleId: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.account.findMany({ where: { userId: user.id } }),
        prisma.category.findMany({ where: { userId: user.id } }),
        prisma.transaction.findMany({ where: { userId: user.id } }),
        prisma.budget.findMany({ where: { userId: user.id } }),
        prisma.goal.findMany({ where: { userId: user.id } }),
        prisma.recurringTransaction.findMany({ where: { userId: user.id } }),
        prisma.session.findMany({ where: { userId: user.id } }),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: profile && { ...profile, passwordHash: "[REDACTED]" },
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      recurring,
      sessions: sessions.map((s) => ({ ...s, refreshToken: "[REDACTED]" })),
    };

    // Set response headers
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="fintrack-export-${user.id}-${Date.now()}.json"`);

    logger.info(`User data exported: ${user.id}`);

    res.json(exportData);
  } catch (error) {
    next(error);
  }
}
