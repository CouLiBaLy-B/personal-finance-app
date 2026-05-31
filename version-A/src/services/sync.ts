/**
 * FinTrack — Synchronisation Frontend ↔ Backend.
 *
 * Stratégie :
 *   1. Le frontend fonctionne en local (IndexedDB) pour le offline-first.
 *   2. Quand l'utilisateur est en ligne, les données sont poussées vers le
 *      backend et/ou récupérées (sync bidirectionnelle).
 *   3. Les transactions créées en offline sont marquées d'un flag `synced`
 *      (dans une future évolution), ici on fait un simple "backup".
 *
 * Pour l'instant, on fournit les fonctions de synchronisation manuelles
 * qui peuvent être appelées par l'utilisateur ou par un service worker.
 */

import { db } from "../db/database";
import { api } from "./api";

/** Synchronise les comptes : pousse les comptes locaux vers le backend. */
export async function syncAccounts(userId: string): Promise<number> {
  const localAccounts = await db.accounts.where("userId").equals(userId).toArray();
  const remote = await api.getAccounts().catch(() => []);
  const remoteIds = new Set(remote.map((a: any) => a.id));
  let pushed = 0;
  for (const a of localAccounts) {
    if (!remoteIds.has(a.id)) {
      await api.createAccount({
        name: a.name,
        type: a.type,
        currency: a.currency,
        initialBalance: a.initialBalance,
      });
      pushed++;
    }
  }
  return pushed;
}

/** Synchronise les catégories. */
export async function syncCategories(userId: string): Promise<number> {
  const local = await db.categories.where("userId").equals(userId).toArray();
  const remote = await api.getCategories().catch(() => []);
  const remoteIds = new Set(remote.map((c: any) => c.id));
  let pushed = 0;
  for (const c of local) {
    if (!remoteIds.has(c.id)) {
      await api.createCategory({
        label: c.label,
        color: c.color,
        icon: c.icon,
        kind: c.kind,
        parentId: c.parentId ?? null,
      });
      pushed++;
    }
  }
  return pushed;
}

/** Synchronise les transactions : pousse les locales manquantes. */
export async function syncTransactions(userId: string): Promise<number> {
  const local = await db.transactions.where("userId").equals(userId).toArray();
  const remote = await api.getTransactions(500).catch(() => []);
  const remoteIds = new Set(remote.map((t: any) => t.id));
  let pushed = 0;
  for (const t of local) {
    if (!remoteIds.has(t.id)) {
      await api.createTransaction({
        accountId: t.accountId,
        categoryId: t.categoryId,
        amount: t.amount,
        type: t.type,
        currency: t.currency,
        date: new Date(t.date).toISOString(),
        description: t.description,
        recurringId: t.recurringId ?? null,
        goalId: t.goalId ?? null,
      });
      pushed++;
    }
  }
  return pushed;
}

/** Synchronise les budgets. */
export async function syncBudgets(userId: string): Promise<number> {
  const local = await db.budgets.where("userId").equals(userId).toArray();
  const remote = await api.getBudgets().catch(() => []);
  const remoteIds = new Set(remote.map((b: any) => b.id));
  let pushed = 0;
  for (const b of local) {
    if (!remoteIds.has(b.id)) {
      await api.createBudget({
        categoryId: b.categoryId,
        limit: b.limit,
        month: b.month,
        alertThreshold: b.alertThreshold,
      });
      pushed++;
    }
  }
  return pushed;
}

/** Synchronise les objectifs. */
export async function syncGoals(userId: string): Promise<number> {
  const local = await db.goals.where("userId").equals(userId).toArray();
  const remote = await api.getGoals().catch(() => []);
  const remoteIds = new Set(remote.map((g: any) => g.id));
  let pushed = 0;
  for (const g of local) {
    if (!remoteIds.has(g.id)) {
      await api.createGoal({
        label: g.label,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: new Date(g.targetDate).toISOString(),
        color: g.color,
        icon: g.icon,
      });
      pushed++;
    }
  }
  return pushed;
}

/** Synchronise les récurrences. */
export async function syncRecurring(userId: string): Promise<number> {
  const local = await db.recurring.where("userId").equals(userId).toArray();
  const remote = await api.getRecurring().catch(() => []);
  const remoteIds = new Set(remote.map((r: any) => r.id));
  let pushed = 0;
  for (const r of local) {
    if (!remoteIds.has(r.id)) {
      await api.createRecurring({
        accountId: r.accountId,
        categoryId: r.categoryId,
        amount: r.amount,
        type: r.type,
        currency: r.currency,
        description: r.description,
        frequency: r.frequency,
        nextDate: new Date(r.nextDate).toISOString(),
        endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
      });
      pushed++;
    }
  }
  return pushed;
}

/**
 * Synchronisation complète (one-shot).
 * Appelable depuis le bouton "Synchroniser" dans les paramètres.
 */
export async function syncAll(userId: string): Promise<{
  accounts: number;
  categories: number;
  transactions: number;
  budgets: number;
  goals: number;
  recurring: number;
}> {
  const results = {
    accounts: await syncAccounts(userId),
    categories: await syncCategories(userId),
    transactions: await syncTransactions(userId),
    budgets: await syncBudgets(userId),
    goals: await syncGoals(userId),
    recurring: await syncRecurring(userId),
  };
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  if (total > 0) console.info(`[Sync] ${total} entités poussées vers le backend.`);
  else console.info("[Sync] Aucune nouvelle entité à synchroniser.");
  return results;
}
