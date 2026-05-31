/**
 * Goal controller — CRUD + contributions + report.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /goals */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId!, deletedAt: null },
      include: { contributions: { orderBy: { date: "desc" }, take: 5 } },
      orderBy: { targetDate: "asc" },
    });

    const result = goals.map((g) => ({
      ...g,
      targetAmount: toNumber(g.targetAmount),
      currentAmount: toNumber(g.currentAmount),
      percentage: toNumber(g.targetAmount) > 0
        ? Math.round((toNumber(g.currentAmount) / toNumber(g.targetAmount)) * 100)
        : 0,
      contributions: g.contributions.map((c) => ({ ...c, amount: toNumber(c.amount) })),
    }));

    res.json(result);
  } catch (err) { next(err); }
}

/** GET /goals/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
      include: { contributions: { orderBy: { date: "desc" } } },
    });
    if (!goal) throw new AppError("Objectif introuvable.", 404);
    res.json({
      ...goal,
      targetAmount: toNumber(goal.targetAmount),
      currentAmount: toNumber(goal.currentAmount),
    });
  } catch (err) { next(err); }
}

/** POST /goals */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { label, description, targetAmount, currentAmount, targetDate, color, icon } = req.body;
    const goal = await prisma.goal.create({
      data: {
        userId: req.userId!,
        label,
        description,
        targetAmount,
        currentAmount: currentAmount ?? 0,
        targetDate: new Date(targetDate),
        color,
        icon,
      },
    });
    res.status(201).json({ ...goal, targetAmount: toNumber(goal.targetAmount), currentAmount: toNumber(goal.currentAmount) });
  } catch (err) { next(err); }
}

/** PUT /goals/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Objectif introuvable.", 404);

    const data: any = { ...req.body };
    if (data.targetDate) data.targetDate = new Date(data.targetDate);

    const goal = await prisma.goal.update({ where: { id: req.params.id }, data });
    res.json({ ...goal, targetAmount: toNumber(goal.targetAmount), currentAmount: toNumber(goal.currentAmount) });
  } catch (err) { next(err); }
}

/** DELETE /goals/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Objectif introuvable.", 404);

    await prisma.goal.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ message: "Objectif supprimé." });
  } catch (err) { next(err); }
}

/** POST /goals/:id/contribute */
export async function contribute(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, notes } = req.body;

    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!goal) throw new AppError("Objectif introuvable.", 404);

    const newAmount = toNumber(goal.currentAmount) + amount;
    const isCompleted = newAmount >= toNumber(goal.targetAmount);

    await prisma.$transaction([
      prisma.goalTransaction.create({
        data: { goalId: goal.id, amount, notes },
      }),
      prisma.goal.update({
        where: { id: goal.id },
        data: { currentAmount: newAmount, isCompleted },
      }),
    ]);

    res.json({
      currentAmount: newAmount,
      isCompleted,
      percentage: Math.round((newAmount / toNumber(goal.targetAmount)) * 100),
    });
  } catch (err) { next(err); }
}

/** PATCH /goals/:id/complete */
export async function markComplete(req: Request, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!goal) throw new AppError("Objectif introuvable.", 404);

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: { isCompleted: true },
    });
    res.json({ ...updated, targetAmount: toNumber(updated.targetAmount), currentAmount: toNumber(updated.currentAmount) });
  } catch (err) { next(err); }
}
