/**
 * Recurring transaction controller — CRUD + generate.
 */
import type { Request, Response, NextFunction } from "express";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import prisma from "../lib/prisma.js";
import { toNumber, parsePagination } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /recurring */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const recurring = await prisma.recurringTransaction.findMany({
      where: { userId: req.userId!, deletedAt: null },
      include: {
        account: { select: { name: true, currency: true } },
        category: { select: { label: true, color: true, icon: true } },
      },
      orderBy: { nextDate: "asc" },
    });
    res.json(recurring.map((r) => ({ ...r, amount: toNumber(r.amount) })));
  } catch (err) { next(err); }
}

/** GET /recurring/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
      include: { account: true, category: true },
    });
    if (!r) throw new AppError("Récurrence introuvable.", 404);
    res.json({ ...r, amount: toNumber(r.amount) });
  } catch (err) { next(err); }
}

/** POST /recurring */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, categoryId, amount, type, currency, description, frequency, interval, startDate, nextDate, endDate } = req.body;

    const r = await prisma.recurringTransaction.create({
      data: {
        userId: req.userId!,
        accountId,
        categoryId,
        amount,
        type,
        currency,
        description,
        frequency,
        interval: interval ?? 1,
        startDate: startDate ? new Date(startDate) : new Date(),
        nextDate: new Date(nextDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json({ ...r, amount: toNumber(r.amount) });
  } catch (err) { next(err); }
}

/** PUT /recurring/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Récurrence introuvable.", 404);

    const data: any = { ...req.body };
    if (data.nextDate) data.nextDate = new Date(data.nextDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.startDate) data.startDate = new Date(data.startDate);

    const r = await prisma.recurringTransaction.update({ where: { id: req.params.id }, data });
    res.json({ ...r, amount: toNumber(r.amount) });
  } catch (err) { next(err); }
}

/** DELETE /recurring/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Récurrence introuvable.", 404);

    await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ message: "Récurrence supprimée." });
  } catch (err) { next(err); }
}

/** POST /recurring/generate — generate pending recurring transactions */
export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const pending = await prisma.recurringTransaction.findMany({
      where: {
        userId: req.userId!,
        isActive: true,
        deletedAt: null,
        nextDate: { lte: now },
      },
    });

    let generated = 0;

    for (const r of pending) {
      let date = r.nextDate;

      // Generate all overdue occurrences
      while (date <= now) {
        // Check endDate
        if (r.endDate && date > r.endDate) break;

        await prisma.transaction.create({
          data: {
            userId: r.userId,
            accountId: r.accountId,
            categoryId: r.categoryId,
            amount: r.amount,
            type: r.type,
            currency: r.currency,
            date,
            description: r.description,
            recurringId: r.id,
          },
        });
        generated++;

        // Advance to next date
        date = computeNextDate(date, r.frequency, r.interval);
      }

      // Update nextDate and occurrences
      await prisma.recurringTransaction.update({
        where: { id: r.id },
        data: {
          nextDate: date,
          occurrences: { increment: generated },
          ...(r.endDate && date > r.endDate ? { isActive: false } : {}),
        },
      });
    }

    res.json({ generated, processed: pending.length });
  } catch (err) { next(err); }
}

/** POST /recurring/:id/skip — skip next occurrence */
export async function skip(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!r) throw new AppError("Récurrence introuvable.", 404);

    const nextDate = computeNextDate(r.nextDate, r.frequency, r.interval);

    await prisma.recurringTransaction.update({
      where: { id: r.id },
      data: { nextDate },
    });

    res.json({ nextDate });
  } catch (err) { next(err); }
}

function computeNextDate(current: Date, frequency: string, interval: number): Date {
  switch (frequency) {
    case "daily": return addDays(current, interval);
    case "weekly": return addWeeks(current, interval);
    case "biweekly": return addWeeks(current, 2 * interval);
    case "monthly": return addMonths(current, interval);
    case "quarterly": return addMonths(current, 3 * interval);
    case "yearly": return addYears(current, interval);
    default: return addMonths(current, interval);
  }
}
