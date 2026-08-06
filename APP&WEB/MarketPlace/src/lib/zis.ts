// ZIS — ZION Identity Service client wrapper for the MarketPlace.
//
// All functions are server-side only (they read the zion_session cookie
// and forward it to ZIS at auth.zionterranova.com for verification).
// The cookie is scoped to .zionterranova.com so it flows automatically
// between app / market / oasis / dashboard sub-domains (SSO).
//
// Endpoints used:
//   GET  /api/auth/me   — current user (requires zion_session cookie)
//   POST /api/keys      — create API key (requires auth)

import { cookies as nextCookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ── Config ──────────────────────────────────────────────────────────────

/**
 * Base URL of the ZIS server.
 * Override via ZIS_URL env var for local development.
 */
export const ZIS_URL =
  process.env.ZIS_URL ?? 'https://auth.zionterranova.com';

/** Cookie name issued by ZIS (signed JWT, httpOnly, domain=.zionterranova.com). */
export const ZIS_SESSION_COOKIE = 'zion_session';

// ── Types ───────────────────────────────────────────────────────────────

export interface ZisUser {
  id: string;
  primaryAddress: string;
  displayName: string | null;
  loginCount?: number;
  lastLogin?: string | null;
  linkedAddresses?: Array<{
    id: string;
    address: string;
    chainType: string;
  }>;
  oasisPlayer?: unknown;
}

export interface ZisApiKey {
  apiKey: string;
  label: string;
}

interface ZisMeResponse {
  id: string;
  primaryAddress: string;
  displayName: string | null;
  loginCount?: number;
  lastLogin?: string | null;
  linkedAddresses?: ZisUser['linkedAddresses'];
  oasisPlayer?: unknown;
  error?: string;
}

interface ZisApiKeyResponse {
  apiKey: string;
  label: string;
}

// ── Internal helpers ────────────────────────────────────────────────────

/**
 * Read the zion_session cookie from the current Next.js request context.
 * Returns null when the cookie is absent (user not signed in).
 */
async function getSessionToken(): Promise<string | null> {
  const cookieStore = await nextCookies();
  return cookieStore.get(ZIS_SESSION_COOKIE)?.value ?? null;
}

/**
 * Forward the zion_session cookie to a ZIS endpoint and return parsed JSON.
 * Throws on network failure or non-2xx response.
 */
async function zisFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getSessionToken();
  if (!token) {
    throw new ZisAuthError('UNAUTHORIZED', 'No zion_session cookie');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Cookie: `${ZIS_SESSION_COOKIE}=${token}`,
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${ZIS_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401) {
    throw new ZisAuthError('UNAUTHORIZED', 'Session expired or invalid');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ZisAuthError(
      'ZIS_ERROR',
      `ZIS returned ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  return res.json() as Promise<T>;
}

// ── Error ───────────────────────────────────────────────────────────────

export class ZisAuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ZisAuthError';
    this.code = code;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get the currently authenticated market user via the ZIS session cookie.
 * Returns null when the user is not signed in (no cookie / expired session).
 */
export async function getMarketUser(): Promise<ZisUser | null> {
  try {
    const data = await zisFetch<ZisMeResponse>('/api/auth/me');
    if (data.error === 'NOT_FOUND') return null;
    return {
      id: data.id,
      primaryAddress: data.primaryAddress,
      displayName: data.displayName,
      loginCount: data.loginCount,
      lastLogin: data.lastLogin,
      linkedAddresses: data.linkedAddresses,
      oasisPlayer: data.oasisPlayer,
    };
  } catch (err) {
    if (err instanceof ZisAuthError && err.code === 'UNAUTHORIZED') {
      return null;
    }
    // Unexpected errors propagate so callers can decide how to handle them
    throw err;
  }
}

/**
 * Require an authenticated ZIS session. Returns the user or a 401 NextResponse
 * suitable for returning directly from a route handler / server action.
 *
 * @example
 *   const userOrResponse = await requireMarketAuth();
 *   if (userOrResponse instanceof NextResponse) return userOrResponse;
 *   // userOrResponse is now ZisUser
 */
export async function requireMarketAuth(): Promise<ZisUser | NextResponse> {
  const user = await getMarketUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'ZIS authentication required' },
      { status: 401 },
    );
  }
  return user;
}

/**
 * Create a ZIS API key for the current market user.
 * The raw key is returned only once — store it securely.
 *
 * @param label  Human-readable label for the key (1–64 chars)
 */
export async function createMarketApiKey(
  label: string,
): Promise<ZisApiKey> {
  if (!label || label.length < 1 || label.length > 64) {
    throw new ZisAuthError('BAD_REQUEST', 'label must be 1–64 characters');
  }

  return zisFetch<ZisApiKeyResponse>('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
}

/**
 * Type guard: check whether a value returned by `requireMarketAuth` is a
 * NextResponse (i.e. auth failed) or the resolved ZisUser.
 */
export function isAuthDenied(
  value: ZisUser | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
