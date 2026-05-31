/**
 * FinTrack — Service d'authentification hybride.
 *
 * Mode ONLINE  : Appelle l'API backend (/api/v1/auth/*) → vrai JWT signé.
 * Mode OFFLINE : Fallback local IndexedDB + bcrypt (mode dégradé).
 *
 * Détection du mode : si fetch("/api/v1/health") répond en < 2s → ONLINE.
 */

import bcrypt from "bcryptjs";
import { db, uid } from "../db/database";
import { seedDefaultCategories } from "./seed";
import { api } from "./api";

const SALT_ROUNDS = 10;

// Vérifie si l'API backend est accessible
let _online: boolean | null = null;
export async function isBackendOnline(): Promise<boolean> {
  if (_online !== null) return _online;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1"}/../health`, { signal: ctrl.signal });
    clearTimeout(t);
    _online = res.ok;
  } catch {
    _online = false;
  }
  return _online;
}

/** Inscription : tente backend d'abord, sinon fallback local */
export async function registerHybrid(
  email: string,
  password: string,
  fullName: string,
  baseCurrency = "EUR"
): Promise<{
  token: string;
  user: { id: string; email: string; fullName: string; baseCurrency: string };
  mode: "online" | "offline";
}> {
  const online = await isBackendOnline();
  if (online) {
    const res = await api.register(email, password, fullName, baseCurrency);
    await storeSession(res.token, res.user.id);
    return { ...res, mode: "online" };
  }
  return await registerLocal(email, password, fullName, baseCurrency);
}

/** Connexion : tente backend d'abord, sinon fallback local */
export async function loginHybrid(
  email: string,
  password: string
): Promise<{
  token: string;
  user: { id: string; email: string; fullName: string; baseCurrency: string };
  mode: "online" | "offline";
}> {
  const online = await isBackendOnline();
  if (online) {
    const res = await api.login(email, password);
    await storeSession(res.token, res.user.id);
    return { ...res, mode: "online" };
  }
  return await loginLocal(email, password);
}

// ========== Fallback local (IndexedDB) ==========
function makeLocalToken(userId: string): string {
  return btoa(JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
}

async function registerLocal(email: string, password: string, fullName: string, baseCurrency: string) {
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
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency }, mode: "offline" as const };
}

async function loginLocal(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = await db.users.where("email").equals(normalized).first();
  if (!user) throw new Error("Identifiants invalides.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Identifiants invalides.");
  const token = makeLocalToken(user.id);
  await storeSession(token, user.id);
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency }, mode: "offline" as const };
}

async function storeSession(token: string, userId: string) {
  await db.sessions.put({ id: "current", userId, token, createdAt: Date.now() });
}

export async function logoutHybrid(): Promise<void> {
  await db.sessions.delete("current");
}

export async function getCurrentUserHybrid() {
  const session = await db.sessions.get("current");
  if (!session) return null;
  // Si online et le token est un JWT backend, valider via /me
  const online = await isBackendOnline();
  if (online && !session.token.startsWith("ey")) {
    // Token local (base64), on retourne l'utilisateur local
    const user = await db.users.get(session.userId);
    return user ?? null;
  }
  const user = await db.users.get(session.userId);
  return user ?? null;
}
