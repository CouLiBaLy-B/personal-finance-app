/**
 * Account controller — CRUD + balance computation.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /accounts */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId!, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    // Compute current balance for each account
    const result = await Promise.all(
      accounts.map(async (acc) => {
        const txs = await prisma.transaction.findMany({
          where: { accountId: acc.id, deletedAt: null },
          select: { amount: true, type: true },
        });
        const balance = txs.reduce((sum, t) => {
          const amt = toNumber(t.amount);
          return t.type === "income" ? sum + amt : sum - amt;
        }, toNumber(acc.initialBalance));

        return {
          ...acc,
          initialBalance: toNumber(acc.initialBalance),
          currentBalance: balance,
        };
      })
    );

    res.json(result);
  } catch (err) { next(err); }
}

/** GET /accounts/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!account) throw new AppError("Compte introuvable.", 404);
    res.json({ ...account, initialBalance: toNumber(account.initialBalance) });
  } catch (err) { next(err); }
}

/** POST /accounts */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, type, currency, initialBalance, color, icon } = req.body;
    const account = await prisma.account.create({
      data: {
        userId: req.userId!,
        name,
        type,
        currency,
        initialBalance: initialBalance ?? 0,
        currentBalance: initialBalance ?? 0,
        color,
        icon,
      },
    });
    res.status(201).json({ ...account, initialBalance: toNumber(account.initialBalance) });
  } catch (err) { next(err); }
}

/** PUT /accounts/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Compte introuvable.", 404);

    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ ...account, initialBalance: toNumber(account.initialBalance) });
  } catch (err) { next(err); }
}

/** DELETE /accounts/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Compte introuvable.", 404);

    // Soft delete
    await prisma.account.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ message: "Compte supprimé." });
  } catch (err) { next(err); }
}

/** GET /accounts/:id/balance */
export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!account) throw new AppError("Compte introuvable.", 404);

    const txs = await prisma.transaction.findMany({
      where: { accountId: account.id, deletedAt: null },
      select: { amount: true, type: true },
    });

    const balance = txs.reduce((sum, t) => {
      const amt = toNumber(t.amount);
      return t.type === "income" ? sum + amt : sum - amt;
    }, toNumber(account.initialBalance));

    res.json({
      accountId: account.id,
      name: account.name,
      currency: account.currency,
      initialBalance: toNumber(account.initialBalance),
      currentBalance: balance,
      transactionCount: txs.length,
    });
  } catch (err) { next(err); }
}
