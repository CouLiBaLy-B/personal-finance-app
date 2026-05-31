/**
 * FinTrack — Client HTTP pour le backend Express (consolidé).
 * Fusionne : Version A (client complet) + Version B (health check).
 */

import { db } from "../db/database";

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
    await db.sessions.delete("current");
    throw new Error("Session expirée — veuillez vous reconnecter.");
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    const blob = await res.blob();
    return { __blob: blob } as unknown as T;
  }
  if (ct.includes("text/csv")) {
    const text = await res.text();
    return { __csv: text } as unknown as T;
  }

  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error ?? `Erreur ${res.status}`);
  return data as T;
}

// ============ API types ============
export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: { id: string; email: string; fullName: string; baseCurrency: string };
}

export interface ApiHealth {
  status: string;
  version: string;
  timestamp: string;
  uptime?: number;
}

// ============ API client ============
export const api = {
  // Health
  health: () => request<ApiHealth>("GET", "/../health"),

  // Auth
  register: (email: string, password: string, fullName: string, baseCurrency = "EUR") =>
    request<AuthResponse>("POST", "/auth/register", { email, password, fullName, baseCurrency }),
  login: (email: string, password: string) =>
    request<AuthResponse>("POST", "/auth/login", { email, password }),
  refresh: (refreshToken: string) =>
    request<{ token: string; refreshToken: string }>("POST", "/auth/refresh", { refreshToken }),
  me: () =>
    request<{ user: any }>("GET", "/auth/me"),

  // Accounts
  getAccounts: () => request<any[]>("GET", "/accounts"),
  createAccount: (data: any) => request<any>("POST", "/accounts", data),
  updateAccount: (id: string, data: any) => request<any>("PUT", `/accounts/${id}`, data),
  deleteAccount: (id: string) => request<any>("DELETE", `/accounts/${id}`),

  // Categories
  getCategories: () => request<any[]>("GET", "/categories"),
  createCategory: (data: any) => request<any>("POST", "/categories", data),
  deleteCategory: (id: string) => request<any>("DELETE", `/categories/${id}`),

  // Transactions
  getTransactions: (limit = 500) => request<any>("GET", `/transactions?limit=${limit}`),
  createTransaction: (data: any) => request<any>("POST", "/transactions", data),
  updateTransaction: (id: string, data: any) => request<any>("PUT", `/transactions/${id}`, data),
  deleteTransaction: (id: string) => request<any>("DELETE", `/transactions/${id}`),

  // Budgets
  getBudgets: () => request<any[]>("GET", "/budgets"),
  createBudget: (data: any) => request<any>("POST", "/budgets", data),
  updateBudget: (id: string, data: any) => request<any>("PUT", `/budgets/${id}`, data),
  deleteBudget: (id: string) => request<any>("DELETE", `/budgets/${id}`),

  // Goals
  getGoals: () => request<any[]>("GET", "/goals"),
  createGoal: (data: any) => request<any>("POST", "/goals", data),
  contributeGoal: (id: string, amount: number) =>
    request<any>("POST", `/goals/${id}/contribute`, { amount }),
  deleteGoal: (id: string) => request<any>("DELETE", `/goals/${id}`),

  // Recurring
  getRecurring: () => request<any[]>("GET", "/recurring"),
  createRecurring: (data: any) => request<any>("POST", "/recurring", data),
  deleteRecurring: (id: string) => request<any>("DELETE", `/recurring/${id}`),

  // Reports
  reportSummary: (params?: { from?: string; to?: string }) =>
    request<any>("GET", `/reports/summary${params?.from ? `?from=${params.from}&to=${params.to}` : ""}`),
  reportTrend: (months = 6) =>
    request<any[]>("GET", `/reports/trend?months=${months}`),

  // CSV Import
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ inserted: number }>("POST", "/transactions/import", fd, true);
  },

  // Sync
  syncPull: (since?: string) =>
    request<any>("GET", `/sync/pull${since ? `?since=${since}` : ""}`),
  syncPush: (entities: any[]) =>
    request<any>("POST", "/sync/push", { entities }),

  // FX
  getRates: (base: string) =>
    fetch(`https://open.er-api.com/v6/latest/${base}`).then((r) => r.json()),
};

export function getApiBaseUrl(): string {
  return API_BASE;
}

export async function checkApiHealth(): Promise<ApiHealth> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${API_BASE}/../health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}
