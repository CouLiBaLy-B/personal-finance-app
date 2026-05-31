/**
 * Report controller — summary JSON + PDF bilan.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /reports/summary */
export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const where: any = { userId: req.userId!, deletedAt: null };
    if (from || to) where.date = dateFilter;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: { select: { label: true, color: true, icon: true, kind: true } } },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const byCategory: Record<string, { label: string; color: string; icon: string; total: number; count: number }> = {};
    const byMonth: Record<string, { income: number; expense: number }> = {};

    for (const tx of transactions) {
      const amt = toNumber(tx.amount);
      const month = tx.date.toISOString().slice(0, 7);

      if (tx.type === "income") {
        totalIncome += amt;
      } else if (tx.type === "expense") {
        totalExpense += amt;
      }

      // By category
      if (tx.category) {
        const key = tx.categoryId!;
        if (!byCategory[key]) {
          byCategory[key] = {
            label: tx.category.label,
            color: tx.category.color,
            icon: tx.category.icon ?? "🏷️",
            total: 0,
            count: 0,
          };
        }
        byCategory[key].total += amt;
        byCategory[key].count++;
      }

      // By month
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      if (tx.type === "income") byMonth[month].income += amt;
      else if (tx.type === "expense") byMonth[month].expense += amt;
    }

    res.json({
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      transactionCount: transactions.length,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byMonth: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data })),
    });
  } catch (err) { next(err); }
}

/** GET /reports/trend */
export async function trend(req: Request, res: Response, next: NextFunction) {
  try {
    const months = Math.min(24, Math.max(1, Number(req.query.months) || 6));
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId!,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      select: { amount: true, type: true, date: true },
    });

    const monthly: Record<string, { income: number; expense: number; net: number }> = {};

    for (const tx of transactions) {
      const month = tx.date.toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { income: 0, expense: 0, net: 0 };
      const amt = toNumber(tx.amount);
      if (tx.type === "income") {
        monthly[month].income += amt;
        monthly[month].net += amt;
      } else if (tx.type === "expense") {
        monthly[month].expense += amt;
        monthly[month].net -= amt;
      }
    }

    res.json(
      Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          income: Math.round(data.income * 100) / 100,
          expense: Math.round(data.expense * 100) / 100,
          net: Math.round(data.net * 100) / 100,
        }))
    );
  } catch (err) { next(err); }
}

/** GET /reports/category-breakdown */
export async function categoryBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const month = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = month.split("-");
    const start = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const end = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId!,
        type: "expense",
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      include: { category: { select: { label: true, color: true, icon: true } } },
    });

    const breakdown: Record<string, { label: string; color: string; icon: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const tx of transactions) {
      const amt = toNumber(tx.amount);
      grandTotal += amt;
      const key = tx.categoryId ?? "uncategorized";
      if (!breakdown[key]) {
        breakdown[key] = {
          label: tx.category?.label ?? "Non catégorisé",
          color: tx.category?.color ?? "#94a3b8",
          icon: tx.category?.icon ?? "❓",
          total: 0,
          count: 0,
        };
      }
      breakdown[key].total += amt;
      breakdown[key].count++;
    }

    const result = Object.values(breakdown)
      .map((c) => ({
        ...c,
        total: Math.round(c.total * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ month, grandTotal: Math.round(grandTotal * 100) / 100, categories: result });
  } catch (err) { next(err); }
}
