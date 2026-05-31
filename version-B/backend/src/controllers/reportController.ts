// ===========================================
// FinTrack Backend - Report Controller
// Handles financial reports and exports
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { getPaginationOptions, paginate, formatCurrency, getMonthKey, startOfMonth as startOfMonthUtil, endOfMonth as endOfMonthUtil } from "../utils/index";
import { getRates, convert, SUPPORTED_CURRENCIES } from "../utils/fx";
import { generateBilanPdf, generateBudgetReportPdf, generateGoalReportPdf } from "../utils/pdf";

const prisma = new PrismaClient();

/**
 * Get financial summary for a period
 */
export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { period, startDate, endDate } = req.query;

    let dateFrom: Date;
    let dateTo: Date;
    let periodLabel = "";

    if (period === "month") {
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
      periodLabel = format(now, "MMMM yyyy", { locale: fr });
    } else if (period === "year") {
      const now = new Date();
      dateFrom = startOfYear(now);
      dateTo = endOfYear(now);
      periodLabel = now.getFullYear().toString();
    } else if (startDate && endDate) {
      dateFrom = new Date(startDate as string);
      dateTo = new Date(endDate as string);
      periodLabel = `${format(dateFrom, "dd/MM/yyyy", { locale: fr })} - ${format(dateTo, "dd/MM/yyyy", { locale: fr })}`;
    } else {
      // Default to current month
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
      periodLabel = format(now, "MMMM yyyy", { locale: fr });
    }

    // Get all transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        account: true,
        category: true,
      },
    });

    // Calculate summary
    let totalIncome = 0;
    let totalExpense = 0;
    const byCategory: Record<string, { amount: number; count: number }> = {};
    const byAccount: Record<string, { amount: number; count: number }> = {};

    for (const tx of transactions) {
      const amount = tx.amount;
      
      if (tx.type === "income") {
        totalIncome += amount;
      } else if (tx.type === "expense") {
        totalExpense += amount;
      }

      // By category
      const catLabel = tx.category?.label || "Non classé";
      if (!byCategory[catLabel]) {
        byCategory[catLabel] = { amount: 0, count: 0 };
      }
      if (tx.type === "expense") {
        byCategory[catLabel].amount += amount;
      } else if (tx.type === "income") {
        byCategory[catLabel].amount -= amount; // Negative for income in expense view
      }
      byCategory[catLabel].count++;

      // By account
      const accName = tx.account?.name || "Compte inconnu";
      if (!byAccount[accName]) {
        byAccount[accName] = { amount: 0, count: 0 };
      }
      if (tx.type === "income") {
        byAccount[accName].amount += amount;
      } else if (tx.type === "expense") {
        byAccount[accName].amount -= amount;
      }
      byAccount[accName].count++;
    }

    const netSavings = totalIncome - totalExpense;

    // Convert to category array
    const byCategoryArray = Object.entries(byCategory).map(([label, data]) => ({
      label,
      amount: data.amount,
      count: data.count,
      percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
    }));

    // Convert to account array
    const byAccountArray = Object.entries(byAccount).map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
    }));

    res.json({
      success: true,
      data: {
        period: periodLabel,
        totalIncome,
        totalExpense,
        netSavings,
        byCategory: byCategoryArray,
        byAccount: byAccountArray,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate and download bilan PDF
 */
export async function downloadBilanPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { period, startDate, endDate } = req.query;

    let dateFrom: Date;
    let dateTo: Date;
    let periodLabel = "";

    if (period === "month") {
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
      periodLabel = format(now, "MMMM yyyy", { locale: fr });
    } else if (period === "year") {
      const now = new Date();
      dateFrom = startOfYear(now);
      dateTo = endOfYear(now);
      periodLabel = now.getFullYear().toString();
    } else if (startDate && endDate) {
      dateFrom = new Date(startDate as string);
      dateTo = new Date(endDate as string);
      periodLabel = `${format(dateFrom, "dd/MM/yyyy", { locale: fr })} - ${format(dateTo, "dd/MM/yyyy", { locale: fr })}`;
    } else {
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
      periodLabel = format(now, "MMMM yyyy", { locale: fr });
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: "desc" },
    });

    // Get categories with colors
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Calculate summary
    let totalIncome = 0;
    let totalExpense = 0;
    const byCategory: Array<{ label: string; amount: number; color: string }> = [];

    for (const tx of transactions) {
      const amount = tx.amount;
      
      if (tx.type === "income") {
        totalIncome += amount;
      } else if (tx.type === "expense") {
        totalExpense += amount;
        
        // Add to category breakdown
        const cat = categoryMap.get(tx.categoryId);
        const existing = byCategory.find((c) => c.label === (cat?.label || "Non classé"));
        if (existing) {
          existing.amount += amount;
        } else {
          byCategory.push({
            label: cat?.label || "Non classé",
            amount,
            color: cat?.color || "#64748b",
          });
        }
      }
    }

    const netSavings = totalIncome - totalExpense;

    // Generate PDF
    const pdfBuffer = generateBilanPdf({
      periodLabel,
      baseCurrency: user.baseCurrency,
      totalIncome,
      totalExpense,
      netSavings,
      byCategory,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description || "",
        categoryLabel: tx.category?.label || "Non classé",
        accountName: tx.account?.name || "Compte inconnu",
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
      })),
      userName: user.fullName || user.email,
      userEmail: user.email,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="fintrack-bilan-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length.toString());

    logger.info(`Generated bilan PDF for user ${user.id}`);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate and download budget report PDF
 */
export async function downloadBudgetReportPdf(req: Request, res: Response, next: NextFunction) {
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

    // Get budgets for this month
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
      throw new NotFoundError("No budgets found for the specified month");
    }

    // Calculate budget report data
    let totalBudget = 0;
    let totalSpent = 0;
    const budgetReports = [];

    for (const budget of budgets) {
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

      budgetReports.push({
        categoryLabel: budget.category.label,
        limit: budget.limit,
        spent,
        remaining,
        percentage: Math.round(percentage),
        status,
      });
    }

    const remaining = totalBudget - totalSpent;

    // Generate PDF
    const pdfBuffer = generateBudgetReportPdf({
      month: `${monthStr}`,
      baseCurrency: user.baseCurrency,
      totalBudget,
      totalSpent,
      remaining,
      budgets: budgetReports,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="fintrack-budget-${monthStr}-${yearNum}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length.toString());

    logger.info(`Generated budget report PDF for user ${user.id}`);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate and download goal report PDF
 */
export async function downloadGoalReportPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (goals.length === 0) {
      throw new NotFoundError("No goals found");
    }

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
        label: goal.label,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
        progressPercentage: Math.round(progressPercentage),
        daysRemaining,
        status,
      };
    });

    // Generate PDF
    const pdfBuffer = generateGoalReportPdf({
      period: format(now, "MMMM yyyy", { locale: fr }),
      baseCurrency: user.baseCurrency,
      goals: goalReports,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="fintrack-goals-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length.toString());

    logger.info(`Generated goal report PDF for user ${user.id}`);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Get monthly trend data for charts
 */
export async function getMonthlyTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { months = 6 } = req.query;
    const count = parseInt(months as string);

    const now = new Date();
    const startDate = subMonths(now, count - 1);
    const months = eachMonthOfInterval({ start: startDate, end: now });

    const trendData = [];

    for (const month of months) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      let income = 0;
      let expense = 0;

      for (const tx of transactions) {
        if (tx.type === "income") {
          income += tx.amount;
        } else if (tx.type === "expense") {
          expense += tx.amount;
        }
      }

      trendData.push({
        month: format(month, "MMM yyyy", { locale: fr }),
        income,
        expense,
        savings: income - expense,
      });
    }

    res.json({
      success: true,
      data: { trend: trendData },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get category breakdown for pie chart
 */
export async function getCategoryBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { period, startDate, endDate, type = "expense" } = req.query;

    let dateFrom: Date;
    let dateTo: Date;

    if (period === "month") {
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
    } else if (period === "year") {
      const now = new Date();
      dateFrom = startOfYear(now);
      dateTo = endOfYear(now);
    } else if (startDate && endDate) {
      dateFrom = new Date(startDate as string);
      dateTo = new Date(endDate as string);
    } else {
      const now = new Date();
      dateFrom = startOfMonthUtil(now);
      dateTo = endOfMonthUtil(now);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: type as "expense" | "income",
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        category: true,
      },
    });

    const byCategory: Record<string, { amount: number; count: number; color: string }> = {};

    for (const tx of transactions) {
      const catLabel = tx.category?.label || "Non classé";
      const catColor = tx.category?.color || "#64748b";

      if (!byCategory[catLabel]) {
        byCategory[catLabel] = { amount: 0, count: 0, color: catColor };
      }

      byCategory[catLabel].amount += tx.amount;
      byCategory[catLabel].count++;
    }

    const breakdown = Object.entries(byCategory).map(([label, data]) => ({
      label,
      amount: data.amount,
      count: data.count,
      color: data.color,
      percentage: transactions.length > 0 ? (data.amount / transactions.reduce((sum, t) => sum + t.amount, 0)) * 100 : 0,
    }));

    res.json({
      success: true,
      data: { breakdown },
    });
  } catch (error) {
    next(error);
  }
}
