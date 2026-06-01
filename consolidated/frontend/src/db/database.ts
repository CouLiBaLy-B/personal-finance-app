/**
 * FinTrack — Couche de persistance locale (IndexedDB via Dexie)
 *
 * v1 : schéma initial
 * v2 : ajout updatedAt + syncStatus pour sync bidirectionnelle
 */

import Dexie, { type Table } from "dexie";

// ---------- Types métier ----------
export type AccountType = "checking" | "saving" | "cash" | "card";
export type SyncStatus = "local" | "synced" | "pending" | "conflict";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  baseCurrency: string;
  createdAt: number;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface Category {
  id: string;
  userId: string;
  label: string;
  color: string;
  icon: string;
  kind: "expense" | "income";
  parentId?: string | null;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  currency: string;
  date: number;
  description: string;
  recurringId?: string | null;
  goalId?: string | null;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  limit: number;
  month: string;
  alertThreshold: number;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface Goal {
  id: string;
  userId: string;
  label: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: number;
  color: string;
  icon: string;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: "expense" | "income";
  currency: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  nextDate: number;
  endDate?: number | null;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncStatus;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
}

/** Pending sync operations for offline queue */
export interface SyncQueueItem {
  id: string;
  table: string;
  entityId: string;
  action: "upsert" | "delete";
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

// ---------- Base Dexie ----------
class FinTrackDB extends Dexie {
  users!: Table<User, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  recurring!: Table<RecurringTransaction, string>;
  sessions!: Table<Session, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("fintrack-db");

    // v1 — original schema
    this.version(1).stores({
      users: "id, &email",
      accounts: "id, userId, type",
      categories: "id, userId, parentId, kind",
      transactions: "id, userId, accountId, categoryId, date, type",
      budgets: "id, userId, categoryId, month",
      goals: "id, userId",
      recurring: "id, userId, nextDate",
      sessions: "id, userId",
    });

    // v2 — add sync support: updatedAt index + syncQueue table
    this.version(2).stores({
      users: "id, &email",
      accounts: "id, userId, type, updatedAt, syncStatus",
      categories: "id, userId, parentId, kind, updatedAt, syncStatus",
      transactions: "id, userId, accountId, categoryId, date, type, updatedAt, syncStatus",
      budgets: "id, userId, categoryId, month, updatedAt, syncStatus",
      goals: "id, userId, updatedAt, syncStatus",
      recurring: "id, userId, nextDate, updatedAt, syncStatus",
      sessions: "id, userId",
      syncQueue: "id, table, entityId, createdAt",
    }).upgrade((tx) => {
      // Backfill updatedAt & syncStatus on existing records
      const now = Date.now();
      const tables = ["accounts", "categories", "transactions", "budgets", "goals", "recurring"] as const;
      return Promise.all(
        tables.map((t) =>
          (tx.table(t) as any).toCollection().modify((record: any) => {
            if (!record.updatedAt) record.updatedAt = record.createdAt ?? now;
            if (!record.syncStatus) record.syncStatus = "local";
          })
        )
      );
    });
  }
}

export const db = new FinTrackDB();

// Helper UUID léger (suffisant pour usage local).
export const uid = (): string =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
