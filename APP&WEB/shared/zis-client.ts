/**
 * ZIS Client — shared ZION Identity Service client library.
 *
 * Works both server-side (Node.js / Next.js server components / route handlers)
 * and client-side (browser / React hooks).
 *
 * ZIS URL resolution order:
 *   1. `ZIS_URL` env var (server-side)
 *   2. `NEXT_PUBLIC_ZIS_URL` env var (client-side exposed)
 *   3. Default: `https://auth.zionterranova.com`
 *
 * The ZIS sets a signed httpOnly cookie `zion_session` scoped to
 * `.zionterranova.com` for SSO across all ZION apps. Client-side calls
 * use `credentials: 'include'` so the cookie is sent cross-origin
 * (CORS is configured on the ZIS for the *.zionterranova.com origins).
 */

// ── Types ────────────────────────────────────────────────────────────

/** A linked wallet address on a ZION user account. */
export interface ZisLinkedAddress {
  id: string;
  userId: string;
  address: string;
  chainType: 'zion-l1' | 'evm' | 'bitcoin' | string;
  chainId?: string | null;
  verifiedAt: string;
}

/** OASIS player profile linked to a ZION user (optional relation). */
export interface ZisOasisPlayer {
  id: string;
  userId: string;
  address: string;
  totalXp: number;
  level: string;
  guildId?: string | null;
  blocksMined: number;
  zionEarned: string;
  titheTotal: string;
  challengesDone: number;
  dailyStreak: number;
  bestStreak: number;
  lastActive?: string | null;
  createdAt: string;
}

/** Full ZIS user record returned by GET /api/auth/me. */
export interface ZisUser {
  id: string;
  primaryAddress: string;
  displayName?: string | null;
  email?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role: string;
  createdAt: string;
  lastLogin?: string | null;
  loginCount: number;
  linkedAddresses?: ZisLinkedAddress[];
  oasisPlayer?: ZisOasisPlayer | null;
}

/** Session issued after successful verification. */
export interface ZisSession {
  token: string;
  user: {
    id: string;
    primaryAddress: string;
    displayName?: string | null;
  };
  expiresAt: string;
}

/** Active ZIS session returned by GET /api/session. */
export interface ZisActiveSession {
  id: string;
  userId: string;
  jwtJti: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  lastUsedAt?: string | null;
}

/** ZIS API key metadata (without the secret). */
export interface ZisApiKey {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
  lastUsed?: string | null;
}

/** Challenge nonce response from POST /api/auth/challenge. */
export interface ZisChallenge {
  challenge: string;
  chainType: 'zion-l1' | 'evm';
  expiresInMs: number;
}

/** Chain type for challenge requests. */
export type ZisChainType = 'zion-l1' | 'evm';

// ── Config ───────────────────────────────────────────────────────────

const DEFAULT_ZIS_URL = 'https://auth.zionterranova.com';
export const ZIS_SESSION_COOKIE = 'zion_session';

/**
 * Resolve the ZIS base URL.
 *
 * Server-side: reads `ZIS_URL` from process.env.
 * Client-side: reads `NEXT_PUBLIC_ZIS_URL` (exposed to the bundle).
 * Falls back to the default production URL.
 */
export function getZisUrl(): string {
  // Server-side env (never exposed to client bundle)
  if (typeof process !== 'undefined' && process.env) {
    const serverUrl = process.env.ZIS_URL;
    if (serverUrl) return stripTrailingSlash(serverUrl);
    // NEXT_PUBLIC_ vars are available on both server and client in Next.js
    const publicUrl = process.env.NEXT_PUBLIC_ZIS_URL;
    if (publicUrl) return stripTrailingSlash(publicUrl);
  }
  return DEFAULT_ZIS_URL;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Whether we are running in a browser context.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.fetch === 'function';
}

// ── Core fetch helper ────────────────────────────────────────────────

interface ZisFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Extra headers (e.g. cookie forwarding from server-side). */
  headers?: Record<string, string>;
  /** Override the base URL (e.g. to call through a local proxy). */
  baseUrl?: string;
  /** Fetch init passthrough (e.g. Next.js revalidate). */
  next?: { revalidate?: number; tags?: string[] };
}

async function zisFetch<T>(
  path: string,
  options: ZisFetchOptions = {},
): Promise<T> {
  const base = options.baseUrl ?? getZisUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
    // Browser: send credentials so the httpOnly SSO cookie is included.
    // Server: no-op (cookies must be forwarded manually via headers).
    credentials: isBrowser() ? 'include' : 'same-origin',
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  // Next.js fetch extension for caching/revalidation (ignored elsewhere).
  if (options.next && !isBrowser()) {
    (init as Record<string, unknown>).next = options.next;
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = { status: res.status, statusText: res.statusText };
    }
    const message =
      (detail as { message?: string })?.message ??
      `ZIS request failed: ${res.status} ${res.statusText}`;
    const err = new Error(message) as Error & {
      status: number;
      detail: unknown;
    };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  // Some endpoints (e.g. logout) may return empty body
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Auth API functions ───────────────────────────────────────────────

/**
 * Request a challenge nonce for a wallet address.
 * POST /api/auth/challenge
 */
export async function getChallenge(
  address: string,
  chainType: ZisChainType = 'zion-l1',
  options?: { baseUrl?: string },
): Promise<ZisChallenge> {
  return zisFetch<ZisChallenge>('/api/auth/challenge', {
    method: 'POST',
    body: { address, chainType },
    baseUrl: options?.baseUrl,
  });
}

/**
 * Verify an Ed25519 signature (ZION L1 native auth).
 * POST /api/auth/verify/ed25519
 */
export async function verifyEd25519(
  address: string,
  publicKey: string,
  signature: string,
  options?: { baseUrl?: string },
): Promise<ZisSession> {
  return zisFetch<ZisSession>('/api/auth/verify/ed25519', {
    method: 'POST',
    body: { address, publicKey, signature },
    baseUrl: options?.baseUrl,
  });
}

/**
 * Verify a Google Sign-In ID token.
 * POST /api/auth/verify/google
 */
export async function verifyGoogle(
  idToken: string,
  options?: { baseUrl?: string },
): Promise<ZisSession> {
  return zisFetch<ZisSession>('/api/auth/verify/google', {
    method: 'POST',
    body: { idToken },
    baseUrl: options?.baseUrl,
  });
}

/**
 * Verify a SIWE (Sign-In with Ethereum) signature.
 * POST /api/auth/verify/siwe
 *
 * `recoveredAddress` is the EVM address recovered from the signature
 * via ecrecover (EIP-191). The gateway/client must perform the recovery.
 */
export async function verifySiwe(
  address: string,
  message: string,
  signature: string,
  recoveredAddress?: string,
  options?: { baseUrl?: string },
): Promise<ZisSession> {
  return zisFetch<ZisSession>('/api/auth/verify/siwe', {
    method: 'POST',
    body: {
      address,
      message,
      signature,
      ...(recoveredAddress ? { recoveredAddress } : {}),
    },
    baseUrl: options?.baseUrl,
  });
}

/**
 * Get the currently authenticated user.
 * GET /api/auth/me  (requires zion_session cookie)
 *
 * Server-side callers must forward the cookie via `options.cookieHeader`.
 */
export async function getCurrentUser(
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<ZisUser | null> {
  try {
    return await zisFetch<ZisUser>('/api/auth/me', {
      method: 'GET',
      headers: options?.cookieHeader
        ? { Cookie: options.cookieHeader }
        : undefined,
      baseUrl: options?.baseUrl,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 401 || e.status === 403) return null;
    throw err;
  }
}

/**
 * Update the current user's profile.
 * PATCH /api/auth/me  (requires zion_session cookie)
 *
 * Server-side callers must forward the cookie via `options.cookieHeader`.
 */
export async function updateProfile(
  profile: { displayName?: string; email?: string | null; avatar?: string | null; bio?: string | null },
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<ZisUser> {
  return zisFetch<ZisUser>('/api/auth/me', {
    method: 'PATCH',
    body: profile,
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Link an additional address to the authenticated user's account.
 * POST /api/auth/link  (requires zion_session cookie)
 */
export async function linkAddress(
  body: {
    address: string;
    chainType: ZisChainType;
    chainId?: string;
    publicKey?: string;
    signature: string;
    message?: string;
  },
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ linked: ZisLinkedAddress; user: ZisUser }> {
  return zisFetch<{ linked: ZisLinkedAddress; user: ZisUser }>('/api/auth/link', {
    method: 'POST',
    body,
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Log out the current session (revokes the session on ZIS).
 * POST /api/auth/logout  (requires zion_session cookie)
 *
 * Server-side callers must forward the cookie via `options.cookieHeader`.
 */
export async function logout(
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ ok: boolean }> {
  try {
    return await zisFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      headers: options?.cookieHeader
        ? { Cookie: options.cookieHeader }
        : undefined,
      baseUrl: options?.baseUrl,
    });
  } catch {
    return { ok: false };
  }
}

/**
 * List active sessions for the current user.
 * GET /api/session  (requires zion_session cookie)
 */
export async function getSessions(
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ sessions: ZisActiveSession[] }> {
  return zisFetch<{ sessions: ZisActiveSession[] }>('/api/session', {
    method: 'GET',
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Revoke a specific session by its JWT JTI.
 * DELETE /api/session/:jti  (requires zion_session cookie)
 */
export async function revokeSession(
  jti: string,
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ ok: boolean }> {
  return zisFetch<{ ok: boolean }>(`/api/session/${encodeURIComponent(jti)}`, {
    method: 'DELETE',
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Revoke all active sessions for the current user (logout everywhere).
 * POST /api/session/revoke-all  (requires zion_session cookie)
 */
export async function revokeAllSessions(
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ ok: boolean }> {
  return zisFetch<{ ok: boolean }>('/api/session/revoke-all', {
    method: 'POST',
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * List API keys for the current user.
 * GET /api/keys  (requires zion_session cookie)
 */
export async function getApiKeys(
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ keys: ZisApiKey[] }> {
  return zisFetch<{ keys: ZisApiKey[] }>('/api/keys', {
    method: 'GET',
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Create a new API key for the current user.
 * POST /api/keys  (requires zion_session cookie)
 * Returns the raw key only once.
 */
export async function createApiKey(
  label: string,
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ apiKey: string; label: string }> {
  return zisFetch<{ apiKey: string; label: string }>('/api/keys', {
    method: 'POST',
    body: { label },
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Revoke an API key by id.
 * DELETE /api/keys/:id  (requires zion_session cookie)
 */
export async function revokeApiKey(
  id: string,
  options?: { cookieHeader?: string; baseUrl?: string },
): Promise<{ ok: boolean }> {
  return zisFetch<{ ok: boolean }>(`/api/keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: options?.cookieHeader ? { Cookie: options.cookieHeader } : undefined,
    baseUrl: options?.baseUrl,
  });
}

/**
 * Verify a ZIS API key and return its owner (service-to-service auth).
 * POST /api/keys/verify
 */
export async function verifyApiKey(
  apiKey: string,
  options?: { baseUrl?: string },
): Promise<{ valid: boolean; user: ZisUser }> {
  return zisFetch<{ valid: boolean; user: ZisUser }>('/api/keys/verify', {
    method: 'POST',
    body: { apiKey },
    baseUrl: options?.baseUrl,
  });
}

/**
 * Fetch the ZIS well-known discovery document.
 * GET /.well-known/zion-identity
 */
export async function getWellKnown(
  options?: { baseUrl?: string },
): Promise<{
  issuer: string;
  auth_endpoint: string;
  verify_endpoint: string;
  session_endpoint: string;
  keys_endpoint: string;
  supported_methods: string[];
  cookie_domain: string;
}> {
  return zisFetch('/.well-known/zion-identity', {
    baseUrl: options?.baseUrl,
  });
}

// ── React hook ───────────────────────────────────────────────────────
//
// The hook is client-only by nature (uses React state + effects).
//
// React is loaded lazily via a runtime resolver rather than a static
// `import` so that server-side / non-React consumers can import the core
// functions from this module without needing React installed in their
// `node_modules` resolution path. The hook itself is only callable inside
// a React component (browser / Next.js client bundle), where React is
// always available.

/* eslint-disable @typescript-eslint/no-require-imports */
let _react: {
  useState: <S>(initial: S | (() => S)) => [S, (value: S | ((prev: S) => S)) => void];
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void;
  useCallback: <T extends (...args: unknown[]) => unknown>(cb: T, deps?: unknown[]) => T;
} | null = null;

function react(): NonNullable<typeof _react> {
  if (!_react) {
    // webpack / Next.js bundles provide `require`; Node SSR has it natively.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: any = require('react');
    if (!mod || typeof mod.useState !== 'function') {
      throw new Error(
        'useZisAuth() requires React. This hook can only be called inside a React component.',
      );
    }
    _react = mod;
  }
  return _react!;
}
/* eslint-enable @typescript-eslint/no-require-imports */

export interface UseZisAuthResult {
  user: ZisUser | null;
  loading: boolean;
  error: string | null;
  authenticated: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

/**
 * React hook for ZIS authentication state.
 *
 * Calls `getCurrentUser()` on mount and exposes the auth state.
 * Client-side: relies on the `zion_session` SSO cookie (credentials: include).
 *
 * @param options.baseUrl - Override ZIS base URL (defaults to getZisUrl()).
 * @param options.pollMs  - Optional re-check interval (default: disabled).
 */
export function useZisAuth(
  options?: { baseUrl?: string; pollMs?: number },
): UseZisAuthResult {
  const { useState, useEffect, useCallback } = react();

  const [user, setUser] = useState<ZisUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getCurrentUser({ baseUrl: options?.baseUrl });
      setUser(u);
      setError(null);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [options?.baseUrl]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!options?.pollMs || options.pollMs <= 0) return;
    const id = window.setInterval(() => fetchUser(), options.pollMs);
    return () => window.clearInterval(id);
  }, [options?.pollMs, fetchUser]);

  const doLogout = useCallback(async () => {
    await logout({ baseUrl: options?.baseUrl });
    setUser(null);
  }, [options?.baseUrl]);

  return {
    user,
    loading,
    error,
    authenticated: user !== null,
    refresh: fetchUser,
    logout: doLogout,
  };
}
