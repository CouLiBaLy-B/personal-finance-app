/**
 * FinTrack — Bidirectional Delta Sync Engine.
 *
 * Fixes from audit:
 *  - Delta sync: only pushes entities with syncStatus != "synced"
 *  - SyncQueue: offline operations queued and retried
 *  - Conflict detection: compares updatedAt timestamps
 */

import { db, uid } from "../db/database";
import { api } from "./api";
import { isBackendOnline } from "./auth-hybrid";

const LAST_SYNC_KEY = "fintrack-last-sync";

function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

function setLastSync(iso: string): void {
  localStorage.setItem(LAST_SYNC_KEY, iso);
}

// ============ Sync Queue (offline operations) ============

/** Enqueue an operation for later sync when offline */
export async function enqueueSync(
  table: string,
  entityId: string,
  action: "upsert" | "delete",
  payload: Record<string, unknown> = {}
): Promise<void> {
  // Deduplicate: if same entity already queued, update the existing entry
  const existing = await db.syncQueue
    .where("[table+entityId]")
    .equals([table, entityId])
    .first()
    .catch(() => undefined); // index may not exist on first run

  if (existing) {
    await db.syncQueue.update(existing.id, { action, payload, createdAt: Date.now(), retries: 0 });
  } else {
    await db.syncQueue.add({
      id: uid(),
      table,
      entityId,
      action,
      payload,
      createdAt: Date.now(),
      retries: 0,
    });
  }
}

/** Process the offline queue — push all pending operations */
async function flushQueue(): Promise<number> {
  const items = await db.syncQueue.orderBy("createdAt").toArray();
  if (items.length === 0) return 0;

  const entities = items.map((item) => ({
    table: item.table,
    id: item.entityId,
    action: item.action,
    data: item.payload,
    updatedAt: new Date(item.createdAt).toISOString(),
  }));

  try {
    await api.syncPush(entities);
    // Clear processed items
    await db.syncQueue.bulkDelete(items.map((i) => i.id));
    return items.length;
  } catch (err) {
    // Increment retry count for failed items
    for (const item of items) {
      await db.syncQueue.update(item.id, { retries: item.retries + 1 });
    }
    throw err;
  }
}

// ============ Delta Push (only changed entities) ============

async function deltaPush(userId: string): Promise<number> {
  const tables = [
    { name: "accounts", store: db.accounts },
    { name: "categories", store: db.categories },
    { name: "transactions", store: db.transactions },
    { name: "budgets", store: db.budgets },
    { name: "goals", store: db.goals },
    { name: "recurring", store: db.recurring },
  ] as const;

  const entities: any[] = [];

  for (const { name, store } of tables) {
    // Only sync entities not yet synced
    const pending = await (store as any)
      .where("userId").equals(userId)
      .filter((r: any) => r.syncStatus !== "synced")
      .toArray();

    for (const item of pending) {
      const { syncStatus, updatedAt, ...data } = item;
      entities.push({
        table: name,
        id: item.id,
        action: "upsert" as const,
        data,
        updatedAt: new Date(updatedAt ?? item.createdAt).toISOString(),
      });
    }
  }

  if (entities.length === 0) return 0;

  await api.syncPush(entities);

  // Mark pushed entities as synced
  for (const { name, store } of tables) {
    const ids = entities.filter((e) => e.table === name).map((e) => e.id);
    for (const id of ids) {
      await (store as any).update(id, { syncStatus: "synced", updatedAt: Date.now() });
    }
  }

  return entities.length;
}

// ============ Pull with conflict detection ============

async function deltaPull(userId: string): Promise<{ merged: number; conflicts: number }> {
  const since = getLastSync();
  const res = await api.syncPull(since ?? undefined);
  let merged = 0;
  let conflicts = 0;

  const tableMap = [
    { key: "accounts", store: db.accounts, adapt: (a: any) => ({ id: a.id, userId, name: a.name, type: a.type, currency: a.currency, initialBalance: a.initialBalance, createdAt: new Date(a.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
    { key: "categories", store: db.categories, adapt: (c: any) => ({ id: c.id, userId, label: c.label, kind: c.kind, color: c.color, icon: c.icon, parentId: c.parentId, createdAt: new Date(c.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
    { key: "transactions", store: db.transactions, adapt: (t: any) => ({ id: t.id, userId, accountId: t.accountId, categoryId: t.categoryId, amount: t.amount, type: t.type, currency: t.currency, date: new Date(t.date).getTime(), description: t.description ?? "", recurringId: t.recurringId, goalId: t.goalId, createdAt: new Date(t.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
    { key: "budgets", store: db.budgets, adapt: (b: any) => ({ id: b.id, userId, categoryId: b.categoryId, month: b.month, limit: b.limit, alertThreshold: b.alertThreshold, createdAt: new Date(b.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
    { key: "goals", store: db.goals, adapt: (g: any) => ({ id: g.id, userId, label: g.label, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: new Date(g.targetDate).getTime(), color: g.color, icon: g.icon, createdAt: new Date(g.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
    { key: "recurring", store: db.recurring, adapt: (r: any) => ({ id: r.id, userId, accountId: r.accountId, categoryId: r.categoryId, amount: r.amount, type: r.type, currency: r.currency, description: r.description, frequency: r.frequency, nextDate: new Date(r.nextDate).getTime(), endDate: r.endDate ? new Date(r.endDate).getTime() : null, createdAt: new Date(r.createdAt).getTime(), updatedAt: Date.now(), syncStatus: "synced" as const }) },
  ] as const;

  for (const { key, store, adapt } of tableMap) {
    const remoteItems = res[key] ?? [];
    for (const remote of remoteItems) {
      if (remote.deletedAt) {
        await (store as any).delete(remote.id);
        merged++;
        continue;
      }

      const local = await (store as any).get(remote.id);
      if (!local) {
        // New from server — just insert
        await (store as any).put(adapt(remote));
        merged++;
      } else if (local.syncStatus === "pending" || local.syncStatus === "local") {
        // Local has unsaved changes — conflict!
        // Strategy: server wins for now, but mark as conflict for review
        const serverTime = new Date(remote.updatedAt ?? remote.createdAt).getTime();
        const localTime = local.updatedAt ?? local.createdAt;

        if (serverTime > localTime) {
          // Server is newer — overwrite local
          await (store as any).put(adapt(remote));
          merged++;
        } else {
          // Local is newer — keep local, mark as pending for next push
          await (store as any).update(remote.id, { syncStatus: "pending" });
          conflicts++;
        }
      } else {
        // Local is synced — safe to overwrite
        await (store as any).put(adapt(remote));
        merged++;
      }
    }
  }

  setLastSync(res.serverTime);
  return { merged, conflicts };
}

// ============ Public API ============

/** Full bidirectional sync */
export async function syncAll(userId: string): Promise<{
  pushed: number;
  pulled: number;
  conflicts: number;
  queueFlushed: number;
}> {
  const online = await isBackendOnline();
  if (!online) throw new Error("Backend hors-ligne. Impossible de synchroniser.");

  // 1. Flush offline queue first
  const queueFlushed = await flushQueue().catch(() => 0);

  // 2. Push local deltas
  const pushed = await deltaPush(userId);

  // 3. Pull remote changes with conflict detection
  const { merged: pulled, conflicts } = await deltaPull(userId);

  return { pushed, pulled, conflicts, queueFlushed };
}

/** Mark an entity as modified (call after any local write) */
export async function markDirty(table: string, id: string): Promise<void> {
  const store = (db as any)[table];
  if (store) {
    await store.update(id, { updatedAt: Date.now(), syncStatus: "pending" }).catch(() => {});
  }
}
