/**
 * FinTrack — Hybrid authentication service (from Version A, enhanced).
 * Mode ONLINE  : API backend → real JWT
 * Mode OFFLINE : IndexedDB + bcrypt (fallback)
 */

import bcrypt from "bcryptjs";
import { db, uid } from "../db/database";
import { seedDefaultCategories } from "./seed";
import { api } from "./api";

const SALT_ROUNDS = 10;

let _online: boolean | null = null;

/** Check if backend is reachable */
export async function isBackendOnline(): Promise<boolean> {
  if (_online !== null) return _online;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
    const res = await fetch(`${base}/../health`, { signal: ctrl.signal });
    clearTimeout(t);
    _online = res.ok;
  } catch {
    _online = false;
  }
  return _online;
}

/** Reset the online cache (e.g., on network change) */
export function resetOnlineCache(): void {
  _online = null;
}

export type AuthMode = "online" | "offline";

interface AuthResult {
  token: string;
  user: { id: string; email: string; fullName: string; baseCurrency: string };
  mode: AuthMode;
}

/** Register: tries backend first, falls back to local */
export async function registerHybrid(
  email: string,
  password: string,
  fullName: string,
  baseCurrency = "EUR"
): Promise<AuthResult> {
  const online = await isBackendOnline();
  if (online) {
    try {
      const res = await api.register(email, password, fullName, baseCurrency);
      await storeSession(res.token, res.user.id);
      // Mirror to local DB for offline access
      await mirrorUserLocal(res.user, password);
      return { ...res, mode: "online" };
    } catch (err) {
      // If backend fails, fallback to local
      console.warn("Backend register failed, falling back to local:", err);
    }
  }
  return registerLocal(email, password, fullName, baseCurrency);
}

/** Login: tries backend first, falls back to local */
export async function loginHybrid(
  email: string,
  password: string
): Promise<AuthResult> {
  const online = await isBackendOnline();
  if (online) {
    try {
      const res = await api.login(email, password);
      await storeSession(res.token, res.user.id);
      await mirrorUserLocal(res.user, password);
      return { ...res, mode: "online" };
    } catch (err) {
      console.warn("Backend login failed, falling back to local:", err);
    }
  }
  return loginLocal(email, password);
}

export async function logoutHybrid(): Promise<void> {
  await db.sessions.delete("current");
}

export async function getCurrentUserHybrid() {
  const session = await db.sessions.get("current");
  if (!session) return null;
  const user = await db.users.get(session.userId);
  return user ?? null;
}

// ============ Local fallback ============
function makeLocalToken(userId: string): string {
  return btoa(JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
}

async function registerLocal(email: string, password: string, fullName: string, baseCurrency: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.users.where("email").equals(normalized).first();
  if (existing) throw new Error("Un compte existe déjà avec cet email.");
  if (password.length < 6) throw new Error("Mot de passe trop court (min. 6 caractères).");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    id: uid(),
    email: normalized,
    passwordHash,
    fullName: fullName.trim() || normalized,
    baseCurrency,
    createdAt: Date.now(),
  };
  await db.users.add(user);
  await seedDefaultCategories(user.id, baseCurrency);

  const token = makeLocalToken(user.id);
  await storeSession(token, user.id);
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency }, mode: "offline" };
}

async function loginLocal(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const user = await db.users.where("email").equals(normalized).first();
  if (!user) throw new Error("Identifiants invalides.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Identifiants invalides.");

  const token = makeLocalToken(user.id);
  await storeSession(token, user.id);
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency }, mode: "offline" };
}

async function storeSession(token: string, userId: string) {
  await db.sessions.put({ id: "current", userId, token, createdAt: Date.now() });
}

/** Mirror a backend user into local IndexedDB for offline access */
async function mirrorUserLocal(user: { id: string; email: string; fullName: string; baseCurrency: string }, password: string) {
  const existing = await db.users.get(user.id);
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.users.add({
      id: user.id,
      email: user.email,
      passwordHash,
      fullName: user.fullName,
      baseCurrency: user.baseCurrency,
      createdAt: Date.now(),
    });
  }
}
