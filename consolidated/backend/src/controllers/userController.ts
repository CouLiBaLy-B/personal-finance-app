/**
 * User controller — RGPD export + admin listing.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /users/export — Export all user data (RGPD) */
export async function exportData(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;

    const [user, accounts, categories, transactions, budgets, goals, recurring] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, fullName: true, baseCurrency: true, createdAt: true },
      }),
      prisma.account.findMany({ where: { userId, deletedAt: null } }),
      prisma.category.findMany({ where: { userId, deletedAt: null } }),
      prisma.transaction.findMany({ where: { userId, deletedAt: null }, orderBy: { date: "desc" } }),
      prisma.budget.findMany({ where: { userId, deletedAt: null } }),
      prisma.goal.findMany({ where: { userId, deletedAt: null } }),
      prisma.recurringTransaction.findMany({ where: { userId, deletedAt: null } }),
    ]);

    if (!user) throw new AppError("Utilisateur introuvable.", 404);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      accounts: accounts.map((a) => ({ ...a, initialBalance: toNumber(a.initialBalance), currentBalance: toNumber(a.currentBalance) })),
      categories,
      transactions: transactions.map((t) => ({ ...t, amount: toNumber(t.amount) })),
      budgets: budgets.map((b) => ({ ...b, limit: toNumber(b.limit), currentAmount: toNumber(b.currentAmount) })),
      goals: goals.map((g) => ({ ...g, targetAmount: toNumber(g.targetAmount), currentAmount: toNumber(g.currentAmount) })),
      recurring: recurring.map((r) => ({ ...r, amount: toNumber(r.amount) })),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=fintrack-export-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(exportData);
  } catch (err) { next(err); }
}

/** GET /users/me — Current user details */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            accounts: true,
            categories: true,
            transactions: true,
            budgets: true,
            goals: true,
          },
        },
      },
    });
    if (!user) throw new AppError("Utilisateur introuvable.", 404);
    res.json({ user });
  } catch (err) { next(err); }
}
