/**
 * Budget controller — CRUD + status + report.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber, parsePagination } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /budgets */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const month = req.query.month as string | undefined;
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId!, deletedAt: null, ...(month && { month }) },
      include: { category: { select: { label: true, color: true, icon: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Compute spent amount for each budget
    const result = await Promise.all(
      budgets.map(async (b) => {
        const [yearStr, monthStr] = b.month.split("-");
        const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
        const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59);

        const spent = await prisma.transaction.aggregate({
          where: {
            userId: req.userId!,
            categoryId: b.categoryId,
            type: "expense",
            date: { gte: startDate, lte: endDate },
            deletedAt: null,
          },
          _sum: { amount: true },
        });

        const spentAmount = toNumber(spent._sum.amount);
        const limit = toNumber(b.limit);
        const percentage = limit > 0 ? Math.round((spentAmount / limit) * 100) : 0;

        return {
          ...b,
          limit,
          currentAmount: spentAmount,
          percentage,
          isOverBudget: percentage >= 100,
          isWarning: percentage >= b.alertThreshold,
        };
      })
    );

    res.json(result);
  } catch (err) { next(err); }
}

/** GET /budgets/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
      include: { category: true },
    });
    if (!budget) throw new AppError("Budget introuvable.", 404);
    res.json({ ...budget, limit: toNumber(budget.limit), currentAmount: toNumber(budget.currentAmount) });
  } catch (err) { next(err); }
}

/** POST /budgets */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryId, month, limit, alertThreshold } = req.body;
    const [yearStr] = month.split("-");

    const budget = await prisma.budget.create({
      data: {
        userId: req.userId!,
        categoryId,
        month,
        year: parseInt(yearStr),
        limit,
        alertThreshold: alertThreshold ?? 80,
      },
    });
    res.status(201).json({ ...budget, limit: toNumber(budget.limit) });
  } catch (err) { next(err); }
}

/** PUT /budgets/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Budget introuvable.", 404);

    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ ...budget, limit: toNumber(budget.limit) });
  } catch (err) { next(err); }
}

/** DELETE /budgets/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Budget introuvable.", 404);

    await prisma.budget.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ message: "Budget supprimé." });
  } catch (err) { next(err); }
}

/** GET /budgets/current/status */
export async function currentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Redirect to list with month filter
    req.query.month = month;
    return list(req, res, next);
  } catch (err) { next(err); }
}
