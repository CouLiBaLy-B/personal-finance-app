/**
 * Sync controller — push/pull for offline-first sync.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber } from "../utils/index.js";

interface SyncEntity {
  table: string;
  id: string;
  action: "upsert" | "delete";
  data: Record<string, any>;
  updatedAt: string;
}

/** GET /sync/pull?since=ISO8601 — pull all changes since timestamp */
export async function pull(req: Request, res: Response, next: NextFunction) {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);
    const userId = req.userId!;

    const [accounts, categories, transactions, budgets, goals, recurring] = await Promise.all([
      prisma.account.findMany({ where: { userId, updatedAt: { gte: since } } }),
      prisma.category.findMany({ where: { userId, updatedAt: { gte: since } } }),
      prisma.transaction.findMany({ where: { userId, updatedAt: { gte: since } } }),
      prisma.budget.findMany({ where: { userId, updatedAt: { gte: since } } }),
      prisma.goal.findMany({ where: { userId, updatedAt: { gte: since } } }),
      prisma.recurringTransaction.findMany({ where: { userId, updatedAt: { gte: since } } }),
    ]);

    res.json({
      serverTime: new Date().toISOString(),
      accounts: accounts.map((a) => ({ ...a, initialBalance: toNumber(a.initialBalance), currentBalance: toNumber(a.currentBalance) })),
      categories,
      transactions: transactions.map((t) => ({ ...t, amount: toNumber(t.amount) })),
      budgets: budgets.map((b) => ({ ...b, limit: toNumber(b.limit), currentAmount: toNumber(b.currentAmount) })),
      goals: goals.map((g) => ({ ...g, targetAmount: toNumber(g.targetAmount), currentAmount: toNumber(g.currentAmount) })),
      recurring: recurring.map((r) => ({ ...r, amount: toNumber(r.amount) })),
    });
  } catch (err) { next(err); }
}

/** POST /sync/push — push local changes to server */
export async function push(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const entities: SyncEntity[] = req.body.entities ?? [];

    const results = { created: 0, updated: 0, deleted: 0, conflicts: 0, errors: [] as string[] };

    for (const entity of entities) {
      try {
        const d = entity.data as Record<string, any>;

        switch (entity.table) {
          case "accounts":
            if (entity.action === "delete") {
              await prisma.account.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              await prisma.account.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  name: d.name ?? "Compte",
                  type: d.type ?? "checking",
                  currency: d.currency ?? "EUR",
                  initialBalance: d.initialBalance ?? 0,
                  currentBalance: d.currentBalance ?? 0,
                  color: d.color,
                  icon: d.icon,
                },
                update: {
                  name: d.name,
                  type: d.type,
                  currency: d.currency,
                  initialBalance: d.initialBalance,
                  color: d.color,
                  icon: d.icon,
                },
              });
              results.created++;
            }
            break;

          case "categories":
            if (entity.action === "delete") {
              await prisma.category.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              await prisma.category.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  label: d.label ?? "Catégorie",
                  kind: d.kind ?? "expense",
                  color: d.color ?? "#64748b",
                  icon: d.icon,
                  parentId: d.parentId,
                },
                update: {
                  label: d.label,
                  kind: d.kind,
                  color: d.color,
                  icon: d.icon,
                  parentId: d.parentId,
                },
              });
              results.created++;
            }
            break;

          case "transactions":
            if (entity.action === "delete") {
              await prisma.transaction.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              await prisma.transaction.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  accountId: d.accountId,
                  categoryId: d.categoryId ?? null,
                  amount: d.amount ?? 0,
                  type: d.type ?? "expense",
                  currency: d.currency ?? "EUR",
                  date: new Date(d.date),
                  description: d.description,
                  notes: d.notes,
                  recurringId: d.recurringId,
                  goalId: d.goalId,
                },
                update: {
                  accountId: d.accountId,
                  categoryId: d.categoryId,
                  amount: d.amount,
                  type: d.type,
                  date: new Date(d.date),
                  description: d.description,
                  notes: d.notes,
                },
              });
              results.created++;
            }
            break;

          case "budgets":
            if (entity.action === "delete") {
              await prisma.budget.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              const month = d.month ?? "";
              const [yearStr] = month.split("-");
              await prisma.budget.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  categoryId: d.categoryId,
                  month,
                  year: parseInt(yearStr) || new Date().getFullYear(),
                  limit: d.limit ?? 0,
                  alertThreshold: d.alertThreshold ?? 80,
                },
                update: {
                  limit: d.limit,
                  alertThreshold: d.alertThreshold,
                },
              });
              results.created++;
            }
            break;

          case "goals":
            if (entity.action === "delete") {
              await prisma.goal.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              await prisma.goal.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  label: d.label ?? "Objectif",
                  targetAmount: d.targetAmount ?? 0,
                  currentAmount: d.currentAmount ?? 0,
                  targetDate: new Date(d.targetDate),
                  color: d.color ?? "#0ea5e9",
                  icon: d.icon,
                },
                update: {
                  label: d.label,
                  targetAmount: d.targetAmount,
                  currentAmount: d.currentAmount,
                  color: d.color,
                  icon: d.icon,
                },
              });
              results.created++;
            }
            break;

          case "recurring":
            if (entity.action === "delete") {
              await prisma.recurringTransaction.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
              results.deleted++;
            } else {
              await prisma.recurringTransaction.upsert({
                where: { id: entity.id },
                create: {
                  id: entity.id,
                  userId,
                  accountId: d.accountId,
                  categoryId: d.categoryId,
                  amount: d.amount ?? 0,
                  type: d.type ?? "expense",
                  currency: d.currency ?? "EUR",
                  description: d.description ?? "",
                  frequency: d.frequency ?? "monthly",
                  nextDate: new Date(d.nextDate),
                  endDate: d.endDate ? new Date(d.endDate) : null,
                },
                update: {
                  amount: d.amount,
                  description: d.description,
                  nextDate: new Date(d.nextDate),
                  endDate: d.endDate ? new Date(d.endDate) : null,
                  isActive: d.isActive ?? true,
                },
              });
              results.created++;
            }
            break;

          default:
            results.errors.push(`Table inconnue: ${entity.table}`);
        }
      } catch (err) {
        results.errors.push(`${entity.table}/${entity.id}: ${(err as Error).message}`);
      }
    }

    res.json({ ...results, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
}
