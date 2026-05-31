const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export interface ApiHealth {
  success?: boolean;
  status?: string;
  timestamp?: string;
  version?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: unknown
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `API error ${res.status}`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export function getApiBaseUrl() {
  return API_URL;
}

export async function checkApiHealth(): Promise<ApiHealth> {
  return apiRequest<ApiHealth>("/health");
}