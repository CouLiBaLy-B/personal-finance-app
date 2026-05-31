/**
 * FinTrack — Client HTTP pour le backend Express.
 *
 * Gère :
 *  - Inscription & connexion JWT + OAuth Google
 *  - CRUD complet sur comptes/catégories/transactions/budgets/goals/recurring
 *  - Upload CSV (preview + import)
 *  - Rapports (summary JSON + PDF)
 *  - Export / suppression RGPD
 *  - Taux de change (cache côté backend via l'API publique)
 *
 * Chaque appel attache le token JWT dans Authorization: Bearer.
 * Le token est stocké dans IndexedDB (table "sessions") via le
 * service auth local.
 */

import { db } from "../db/database";

// ============ Configuration ============
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

// ============ Helper fetch ============
async function getToken(): Promise<string | null> {
  const session = await db.sessions.get("current");
  return session?.token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Forcer la déconnexion si le token est expiré
    await db.sessions.delete("current");
    throw new Error("Session expirée — veuillez vous reconnecter.");
  }

  // Gestion du PDF (binary)
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    const blob = await res.blob();
    return { __blob: blob } as unknown as T;
  }

  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error ?? `Erreur ${res.status}`);
  return data as T;
}

// ============ Auth ============
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    baseCurrency: string;
  };
}

export const api = {
  // ---------- Auth ----------
  register: (email: string, password: string, fullName: string, baseCurrency = "EUR") =>
    request<AuthResponse>("POST", "/auth/register", { email, password, fullName, baseCurrency }),

  login: (email: string, password: string) =>
    request<AuthResponse>("POST", "/auth/login", { email, password }),

  oauthGoogle: (idToken: string) =>
    request<AuthResponse>("POST", "/auth/oauth/google", { idToken }),

  getGoogleOAuthUrl: () =>
    request<{ url: string; configured: boolean }>("GET", "/auth/oauth/google/url"),

  me: () =>
    request<{ user: { id: string; email: string; fullName: string; baseCurrency: string } }>("GET", "/auth/me"),

  // ---------- CRUD Accounts ----------
  getAccounts: () => request<any[]>("GET", "/accounts"),
  createAccount: (data: any) => request<any>("POST", "/accounts", data),
  updateAccount: (id: string, data: any) => request<any>("PUT", `/accounts/${id}`, data),
  deleteAccount: (id: string) => request<any>("DELETE", `/accounts/${id}`),

  // ---------- CRUD Categories ----------
  getCategories: () => request<any[]>("GET", "/categories"),
  createCategory: (data: any) => request<any>("POST", "/categories", data),
  deleteCategory: (id: string) => request<any>("DELETE", `/categories/${id}`),

  // ---------- CRUD Transactions ----------
  getTransactions: (limit = 500) => request<any[]>("GET", `/transactions?limit=${limit}`),
  createTransaction: (data: any) => request<any>("POST", "/transactions", data),
  updateTransaction: (id: string, data: any) => request<any>("PUT", `/transactions/${id}`, data),
  deleteTransaction: (id: string) => request<any>("DELETE", `/transactions/${id}`),

  // ---------- CRUD Budgets ----------
  getBudgets: () => request<any[]>("GET", "/budgets"),
  createBudget: (data: any) => request<any>("POST", "/budgets", data),
  updateBudget: (id: string, data: any) => request<any>("PUT", `/budgets/${id}`, data),
  deleteBudget: (id: string) => request<any>("DELETE", `/budgets/${id}`),

  // ---------- CRUD Goals ----------
  getGoals: () => request<any[]>("GET", "/goals"),
  createGoal: (data: any) => request<any>("POST", "/goals", data),
  contributeGoal: (id: string, amount: number) => request<any>("POST", `/goals/${id}/contribute`, { amount }),
  deleteGoal: (id: string) => request<any>("DELETE", `/goals/${id}`),

  // ---------- CRUD Recurring ----------
  getRecurring: () => request<any[]>("GET", "/recurring"),
  createRecurring: (data: any) => request<any>("POST", "/recurring", data),
  deleteRecurring: (id: string) => request<any>("DELETE", `/recurring/${id}`),

  // ---------- CSV Import ----------
  importPreview: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("POST", "/import/preview", fd, true);
  },
  importCsv: (file: File, mapping: Record<string, string>) => {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(mapping)) fd.append(k, v);
    return request<{ inserted: number }>("POST", "/import/import", fd, true);
  },

  // ---------- Reports ----------
  reportSummary: (period: any) =>
    request<any>("POST", "/reports/summary", period),
  reportPdf: (period: any) =>
    request<{ __blob: Blob }>("POST", "/reports/pdf", period),

  // ---------- FX ----------
  getRates: (base: string) =>
    fetch(`https://open.er-api.com/v6/latest/${base}`).then((r) => r.json()),
};
