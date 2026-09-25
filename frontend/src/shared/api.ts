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
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }
  const firstKey = Object.keys(data).find((k) => {
    const val = data[k];
    return typeof val === 'string' || Array.isArray(val);
  });
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
  /** Skip short GET cache / in-flight dedupe */
  noCache?: boolean;
}

/** Dédoublonnage Strict Mode + cache court pour listes publiques (réduit les 429). */
const GET_CACHE_TTL_MS = 45_000;
const getInflight = new Map<string, Promise<unknown>>();
const getCache = new Map<string, { expires: number; data: unknown }>();

/** File d’attente globale après un 429 — évite la rafale de retries simultanés. */
let rateLimitUntil = 0;
let rateLimitWait: Promise<void> | null = null;

export function invalidateApiCache(match: string): void {
  for (const key of getCache.keys()) {
    if (key.includes(match)) getCache.delete(key);
  }
  for (const key of getInflight.keys()) {
    if (key.includes(match)) getInflight.delete(key);
  }
}

function getCacheKey(url: string, auth: boolean): string {
  const token = auth ? (getToken() || '') : '';
  return `${auth ? 'a' : 'n'}:${token.slice(-12)}:${url}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitIfRateLimited(): Promise<void> {
  const waitMs = rateLimitUntil - Date.now();
  if (waitMs <= 0) return;
  if (!rateLimitWait) {
    rateLimitWait = sleep(waitMs).finally(() => {
      rateLimitWait = null;
    });
  }
  await rateLimitWait;
}

function markRateLimited(retryAfterSec: number): void {
  const ms = Math.min(Math.max(retryAfterSec, 1), 12) * 1000;
  rateLimitUntil = Math.max(rateLimitUntil, Date.now() + ms);
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    body,
    auth = false,
    skipRefresh = false,
    noCache = false,
    headers: customHeaders,
    ...rest
  } = options;

  const method = String(rest.method || 'GET').toUpperCase();
  const url = path.startsWith('/api') ? path : `/api/v1/${path.replace(/^\//, '')}`;
  const canCacheGet = method === 'GET' && !noCache && body === undefined;

  if (canCacheGet) {
    const key = getCacheKey(url, auth);
    const hit = getCache.get(key);
    if (hit && hit.expires > Date.now()) {
      return hit.data as T;
    }
    const pending = getInflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const run = async (): Promise<T> => {
    await waitIfRateLimited();

    const headers: Record<string, string> = {
      ...(customHeaders as Record<string, string>),
    };

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (auth) {
      const token = getToken() || (headers.Authorization || '').replace(/^Bearer\s+/i, '') || null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (!headers.Authorization) {
        throw new ApiError('Session expirée. Veuillez vous reconnecter.', 401, {
          detail: 'Aucun jeton d\'accès disponible.',
        });
      }
    }

    const doFetch = async () =>
      fetch(url, {
        ...rest,
        method,
        headers,
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });

    let response = await doFetch();

    if (response.status === 401 && auth && !skipRefresh) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await doFetch();
      } else {
        clearAuthStorage();
        notifyAuthLogout();
      }
    }

    // Un seul retry après backoff partagé (évite stampede Strict Mode / navigation)
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') || '3');
      markRateLimited(retryAfter);
      await waitIfRateLimited();
      response = await doFetch();
    }

    if (response.status === 204) return null as T;

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const fallback =
        response.status === 429
          ? 'Trop de requêtes. Patientez quelques secondes puis réessayez.'
          : `Erreur HTTP ${response.status}`;
      throw new ApiError(extractErrorMessage(data, fallback), response.status, data);
    }

    if (canCacheGet) {
      getCache.set(getCacheKey(url, auth), {
        expires: Date.now() + GET_CACHE_TTL_MS,
        data,
      });
    }

    return data as T;
  };

  if (!canCacheGet) {
    return run();
  }

  const key = getCacheKey(url, auth);
  const promise = run().finally(() => {
    getInflight.delete(key);
  });
  getInflight.set(key, promise);
  return promise as Promise<T>;
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
