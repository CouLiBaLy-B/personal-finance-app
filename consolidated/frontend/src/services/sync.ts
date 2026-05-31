/**
 * FinTrack — Bidirectional Sync Engine (enhanced from Version A).
 * Supports: push local → backend, pull backend → local.
 */

import { db } from "../db/database";
import { api } from "./api";
import { isBackendOnline } from "./auth-hybrid";

const LAST_SYNC_KEY = "fintrack-last-sync";

function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

function setLastSync(iso: string): void {
  localStorage.setItem(LAST_SYNC_KEY, iso);
}

/** Push local entities to backend */
export async function syncPush(userId: string): Promise<{
  accounts: number;
  categories: number;
  transactions: number;
  budgets: number;
  goals: number;
  recurring: number;
}> {
  const results = { accounts: 0, categories: 0, transactions: 0, budgets: 0, goals: 0, recurring: 0 };

  const entities: any[] = [];

  // Collect all local entities
  const localAccounts = await db.accounts.where("userId").equals(userId).toArray();
  for (const a of localAccounts) {
    entities.push({
      table: "accounts",
      id: a.id,
      action: "upsert",
      data: { name: a.name, type: a.type, currency: a.currency, initialBalance: a.initialBalance },
      updatedAt: new Date(a.createdAt).toISOString(),
    });
    results.accounts++;
  }

  const localCategories = await db.categories.where("userId").equals(userId).toArray();
  for (const c of localCategories) {
    entities.push({
      table: "categories",
      id: c.id,
      action: "upsert",
      data: { label: c.label, kind: c.kind, color: c.color, icon: c.icon, parentId: c.parentId },
      updatedAt: new Date(c.createdAt).toISOString(),
    });
    results.categories++;
  }

  const localTxs = await db.transactions.where("userId").equals(userId).toArray();
  for (const t of localTxs) {
    entities.push({
      table: "transactions",
      id: t.id,
      action: "upsert",
      data: {
        accountId: t.accountId, categoryId: t.categoryId, amount: t.amount,
        type: t.type, currency: t.currency, date: new Date(t.date).toISOString(),
        description: t.description, recurringId: t.recurringId, goalId: t.goalId,
      },
      updatedAt: new Date(t.createdAt).toISOString(),
    });
    results.transactions++;
  }

  const localBudgets = await db.budgets.where("userId").equals(userId).toArray();
  for (const b of localBudgets) {
    entities.push({
      table: "budgets",
      id: b.id,
      action: "upsert",
      data: { categoryId: b.categoryId, month: b.month, limit: b.limit, alertThreshold: b.alertThreshold },
      updatedAt: new Date(b.createdAt).toISOString(),
    });
    results.budgets++;
  }

  const localGoals = await db.goals.where("userId").equals(userId).toArray();
  for (const g of localGoals) {
    entities.push({
      table: "goals",
      id: g.id,
      action: "upsert",
      data: {
        label: g.label, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
        targetDate: new Date(g.targetDate).toISOString(), color: g.color, icon: g.icon,
      },
      updatedAt: new Date(g.createdAt).toISOString(),
    });
    results.goals++;
  }

  const localRecurring = await db.recurring.where("userId").equals(userId).toArray();
  for (const r of localRecurring) {
    entities.push({
      table: "recurring",
      id: r.id,
      action: "upsert",
      data: {
        accountId: r.accountId, categoryId: r.categoryId, amount: r.amount,
        type: r.type, currency: r.currency, description: r.description,
        frequency: r.frequency, nextDate: new Date(r.nextDate).toISOString(),
        endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
      },
      updatedAt: new Date(r.createdAt).toISOString(),
    });
    results.recurring++;
  }

  if (entities.length > 0) {
    const res = await api.syncPush(entities);
    setLastSync(res.serverTime);
  }

  return results;
}

/** Pull remote changes to local */
export async function syncPull(userId: string): Promise<number> {
  const since = getLastSync();
  const res = await api.syncPull(since ?? undefined);
  let count = 0;

  // Merge accounts
  for (const a of res.accounts ?? []) {
    if (a.deletedAt) {
      await db.accounts.delete(a.id);
    } else {
      await db.accounts.put({
        id: a.id, userId, name: a.name, type: a.type,
        currency: a.currency, initialBalance: a.initialBalance, createdAt: new Date(a.createdAt).getTime(),
      });
    }
    count++;
  }

  // Merge categories
  for (const c of res.categories ?? []) {
    if (c.deletedAt) {
      await db.categories.delete(c.id);
    } else {
      await db.categories.put({
        id: c.id, userId, label: c.label, kind: c.kind, color: c.color,
        icon: c.icon, parentId: c.parentId, createdAt: new Date(c.createdAt).getTime(),
      });
    }
    count++;
  }

  // Merge transactions
  for (const t of res.transactions ?? []) {
    if (t.deletedAt) {
      await db.transactions.delete(t.id);
    } else {
      await db.transactions.put({
        id: t.id, userId, accountId: t.accountId, categoryId: t.categoryId,
        amount: t.amount, type: t.type, currency: t.currency,
        date: new Date(t.date).getTime(), description: t.description ?? "",
        recurringId: t.recurringId, goalId: t.goalId, createdAt: new Date(t.createdAt).getTime(),
      });
    }
    count++;
  }

  // Merge budgets
  for (const b of res.budgets ?? []) {
    if (b.deletedAt) {
      await db.budgets.delete(b.id);
    } else {
      await db.budgets.put({
        id: b.id, userId, categoryId: b.categoryId, month: b.month,
        limit: b.limit, alertThreshold: b.alertThreshold, createdAt: new Date(b.createdAt).getTime(),
      });
    }
    count++;
  }

  // Merge goals
  for (const g of res.goals ?? []) {
    if (g.deletedAt) {
      await db.goals.delete(g.id);
    } else {
      await db.goals.put({
        id: g.id, userId, label: g.label, targetAmount: g.targetAmount,
        currentAmount: g.currentAmount, targetDate: new Date(g.targetDate).getTime(),
        color: g.color, icon: g.icon, createdAt: new Date(g.createdAt).getTime(),
      });
    }
    count++;
  }

  // Merge recurring
  for (const r of res.recurring ?? []) {
    if (r.deletedAt) {
      await db.recurring.delete(r.id);
    } else {
      await db.recurring.put({
        id: r.id, userId, accountId: r.accountId, categoryId: r.categoryId,
        amount: r.amount, type: r.type, currency: r.currency,
        description: r.description, frequency: r.frequency,
        nextDate: new Date(r.nextDate).getTime(),
        endDate: r.endDate ? new Date(r.endDate).getTime() : null,
        createdAt: new Date(r.createdAt).getTime(),
      });
    }
    count++;
  }

  setLastSync(res.serverTime);
  return count;
}

/** Full bidirectional sync */
export async function syncAll(userId: string): Promise<{
  pushed: { accounts: number; categories: number; transactions: number; budgets: number; goals: number; recurring: number };
  pulled: number;
}> {
  const online = await isBackendOnline();
  if (!online) throw new Error("Backend hors-ligne. Impossible de synchroniser.");

  const pushed = await syncPush(userId);
  const pulled = await syncPull(userId);

  return { pushed, pulled };
}
