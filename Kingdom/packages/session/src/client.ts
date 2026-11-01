/**
 * Klient ZIS.
 *
 * Jedna implementace pro celý ekosystém. Server i prohlížeč, žádná kopie
 * v appkách. Klíč nikdy neopouští prohlížeč — tady se jen posílá podpis.
 */
import type { ZisActiveSession, ZisChallenge, ZisSession, ZisUser } from './types';

const DEFAULT_ZIS_URL = 'https://auth.zionterranova.com';

/** Jméno cookie. Jediné místo, kde je napsané. */
export const SESSION_COOKIE = 'zion_session';

/**
 * Základní URL ZIS.
 *
 * Server: `ZIS_URL` (na EDGE2 typicky `http://127.0.0.1:8096`, ať se neobchází TLS).
 * Prohlížeč: `NEXT_PUBLIC_ZIS_URL`, jinak výchozí veřejná adresa.
 */
export function zisUrl(): string {
  if (typeof process !== 'undefined' && process.env) {
    const server = process.env.ZIS_URL;
    if (server) return server.replace(/\/+$/, '');
    const publicUrl = process.env.NEXT_PUBLIC_ZIS_URL;
    if (publicUrl) return publicUrl.replace(/\/+$/, '');
  }
  return DEFAULT_ZIS_URL;
}

export class ZisError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ZisError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Hodnota cookie `zion_session` — na serveru ji předáváme ZIS explicitně. */
  sessionCookie?: string | null;
  /** Přepsání základní URL (testy, víc prostředí). */
  baseUrl?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, sessionCookie, baseUrl, signal } = options;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (sessionCookie) headers.cookie = `${SESSION_COOKIE}=${sessionCookie}`;

  const response = await fetch(`${(baseUrl ?? zisUrl()).replace(/\/+$/, '')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    /* Server-side: cookies nikdy neposíláme automaticky, jen explicitně. */
    credentials: 'omit',
    cache: 'no-store',
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const payload = (parsed ?? {}) as { error?: string; message?: string };
    throw new ZisError(response.status, payload.error ?? `HTTP_${response.status}`, payload.message);
  }

  return parsed as T;
}

/**
 * Volitelné přepsání cíle.
 *
 * `baseUrl: ''` znamená **relativní** cestu — tedy same-origin proxy, kterou má
 * nirvana (`/api/auth/*`). Bez toho by klient z prohlížeče volal ZIS napřímo
 * a narazil na CORS.
 */
export interface CallOptions {
  baseUrl?: string;
}

/** Vytvoří výzvu k podpisu pro adresu. */
export function getChallenge(
  address: string,
  chainType: ZisChallenge['chainType'] = 'zion-l1',
  options?: CallOptions,
) {
  return request<ZisChallenge>('/api/auth/challenge', {
    method: 'POST',
    body: { address, chainType },
    baseUrl: options?.baseUrl,
  });
}

/** Ověří Ed25519 podpis a vrátí session (token). */
export function verifyEd25519(
  input: { address: string; publicKey: string; signature: string },
  options?: CallOptions,
) {
  return request<ZisSession>('/api/auth/verify/ed25519', {
    method: 'POST',
    body: input,
    baseUrl: options?.baseUrl,
  });
}

/** Přihlášený uživatel, nebo `null` (401 = nikdo není přihlášený). */
export async function getCurrentUser(
  sessionCookie?: string | null,
  options?: CallOptions,
): Promise<ZisUser | null> {
  if (!sessionCookie) return null;
  try {
    return await request<ZisUser>('/api/auth/me', { sessionCookie, baseUrl: options?.baseUrl });
  } catch (error) {
    if (error instanceof ZisError && error.status === 401) return null;
    throw error;
  }
}

/** Aktivní session daného zařízení. */
export function listSessions(sessionCookie: string, options?: CallOptions) {
  return request<{ sessions: ZisActiveSession[] }>('/api/session', {
    sessionCookie,
    baseUrl: options?.baseUrl,
  });
}

/** Odhlásí tuhle session. */
export function logout(sessionCookie?: string | null, options?: CallOptions) {
  return request<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    sessionCookie,
    baseUrl: options?.baseUrl,
  });
}
