/**
 * Client API centralisé — Isoko Hub
 * Gestion JWT, refresh automatique et erreurs uniformes.
 */

const TOKEN_KEY = 'isoko_hub_token';
const REFRESH_KEY = 'isoko_hub_refresh_token';
const USER_KEY = 'isoko_hub_user';

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const storageKeys = {
  token: TOKEN_KEY,
  refresh: REFRESH_KEY,
  user: USER_KEY,
};

let refreshPromise: Promise<string | null> | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Événements pour synchroniser AuthContext après refresh / logout côté api.ts */
export const AUTH_EVENTS = {
  tokenRefreshed: 'isoko-auth-token-refreshed',
  logout: 'isoko-auth-logout',
} as const;

function notifyTokenRefreshed(access: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.tokenRefreshed, { detail: { access } }));
}

function notifyAuthLogout(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.logout));
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/accounts/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearAuthStorage();
        notifyAuthLogout();
        return null;
      }
      const data = await res.json();
      setToken(data.access);
      // ROTATE_REFRESH_TOKENS : sauvegarder le nouveau refresh sinon le suivant échoue
      if (data.refresh) setRefreshToken(data.refresh);
      notifyTokenRefreshed(data.access as string);
      return data.access as string;
    } catch {
      clearAuthStorage();
      notifyAuthLogout();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function extractErrorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
    if (typeof val === 'string') return val;
  }
  return fallback;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, auth = false, skipRefresh = false, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('/api') ? path : `/api/v1/${path.replace(/^\//, '')}`;

  let response = await fetch(url, {
    ...rest,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...rest,
        headers,
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } else {
      // Pas de refresh / refresh échoué : déconnexion explicite
      clearAuthStorage();
      notifyAuthLogout();
    }
  }

  if (response.status === 204) return null as T;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, `Erreur HTTP ${response.status}`),
      response.status,
      data
    );
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/** Formate date + heure locale pour l'API (sans décalage UTC) */
export function toLocalDateTimeISO(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export default api;
