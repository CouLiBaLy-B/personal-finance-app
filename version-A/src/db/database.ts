/**
 * FinTrack — Couche de persistance locale (IndexedDB via Dexie)
 *
 * Conformément à l'architecture proposée, nous simulons côté client :
 *   - Le schéma PostgreSQL/Prisma (mêmes entités, mêmes contraintes)
 *   - Le mode hors-ligne natif (toute la donnée est en IndexedDB)
 *   - L'isolation par utilisateur (chaque row porte un `userId`)
 *
 * En production, un service de synchronisation enverrait ces objets
 * vers l'API REST Node/Express + Prisma + PostgreSQL.
 */

import Dexie, { type Table } from "dexie";

// ---------- Types métier ----------
export type AccountType = "checking" | "saving" | "cash" | "card";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  baseCurrency: string; // ISO-4217 (EUR par défaut)
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
}

export interface Category {
  id: string;
  userId: string;
  label: string;
  color: string; // hex
  icon: string; // emoji
  kind: "expense" | "income";
  parentId?: string | null; // null = catégorie racine, sinon sous-catégorie
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number; // toujours positif
  type: "expense" | "income" | "transfer";
  currency: string;
  date: number; // timestamp
  description: string;
  recurringId?: string | null;
  goalId?: string | null;
  createdAt: number;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  limit: number;
  month: string; // format YYYY-MM
  alertThreshold: number; // pourcentage (ex: 80 = alerte à 80%)
  createdAt: number;
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
}

export interface Session {
  id: string; // toujours "current"
  userId: string;
  token: string; // JWT simulé
  createdAt: number;
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

  constructor() {
    super("fintrack-db");
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
  }
}

export const db = new FinTrackDB();

// Helper UUID léger (suffisant pour usage local).
export const uid = (): string =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
