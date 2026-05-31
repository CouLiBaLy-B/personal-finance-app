/**
 * Service d'authentification.
 *
 * Pour cette démo offline-first, on hash le mot de passe avec bcryptjs
 * (équivalent à ce qui serait fait côté serveur Node) et on crée un
 * "JWT-like" en base64 stocké dans IndexedDB. En production ce token
 * serait délivré par l'API Express + stocké dans un cookie HttpOnly.
 */

import bcrypt from "bcryptjs";
import { db, uid, type User } from "../db/database";
import { seedDefaultCategories } from "./seed";

const SALT_ROUNDS = 10;

function makeToken(userId: string): string {
  const payload = { sub: userId, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  return btoa(JSON.stringify(payload));
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  baseCurrency = "EUR"
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.users.where("email").equals(normalized).first();
  if (existing) throw new Error("Un compte existe déjà avec cet email.");
  if (password.length < 6) throw new Error("Mot de passe trop court (min. 6 caractères).");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user: User = {
    id: uid(),
    email: normalized,
    passwordHash,
    fullName: fullName.trim() || normalized,
    baseCurrency,
    createdAt: Date.now(),
  };
  await db.users.add(user);

  // Seed des catégories par défaut + compte courant
  await seedDefaultCategories(user.id, baseCurrency);

  await db.sessions.put({
    id: "current",
    userId: user.id,
    token: makeToken(user.id),
    createdAt: Date.now(),
  });
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const user = await db.users.where("email").equals(normalized).first();
  if (!user) throw new Error("Identifiants invalides.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Identifiants invalides.");
  await db.sessions.put({
    id: "current",
    userId: user.id,
    token: makeToken(user.id),
    createdAt: Date.now(),
  });
  return user;
}

export async function logout(): Promise<void> {
  await db.sessions.delete("current");
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await db.sessions.get("current");
  if (!session) return null;
  const user = await db.users.get(session.userId);
  return user ?? null;
}

/**
 * Conformité RGPD : suppression totale du compte et de toutes ses données.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.users, db.accounts, db.categories, db.transactions, db.budgets, db.goals, db.recurring, db.sessions],
    async () => {
      await db.transactions.where("userId").equals(userId).delete();
      await db.budgets.where("userId").equals(userId).delete();
      await db.goals.where("userId").equals(userId).delete();
      await db.recurring.where("userId").equals(userId).delete();
      await db.categories.where("userId").equals(userId).delete();
      await db.accounts.where("userId").equals(userId).delete();
      await db.users.delete(userId);
      await db.sessions.delete("current");
    }
  );
}
