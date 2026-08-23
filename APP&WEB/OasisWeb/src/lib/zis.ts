/**
 * OASIS Web (oasis.zionterranova.com) — ZIS integration layer.
 *
 * The OASIS frontend is a static export served by nginx. ZIS auth endpoints
 * are routed through same-origin `/api/auth/*`, `/api/session/*` and
 * `/api/keys/*` paths; nginx proxies them to `auth.zionterranova.com`.
 * This lets the `zion_session` SSO cookie (domain `.zionterranova.com`)
 * travel without CORS preflight and be sent on to the OASIS L4 backend.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ZisLinkedAddress {
  id: string;
  userId: string;
  address: string;
  chainType: 'zion-l1' | 'evm' | 'bitcoin' | string;
  chainId?: string | null;
  verifiedAt: string;
}

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

export interface ZisSession {
  token: string;
  user: {
    id: string;
    primaryAddress: string;
    displayName?: string | null;
  };
  expiresAt: string;
}

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

export interface ZisApiKey {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
  lastUsed?: string | null;
}

export interface ZisChallenge {
  challenge: string;
  chainType: 'zion-l1' | 'evm';
  expiresInMs: number;
}

export type ZisChainType = 'zion-l1' | 'evm';

export interface UseZisAuthResult {
  user: ZisUser | null;
  loading: boolean;
  error: string | null;
  authenticated: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

// ── Config ───────────────────────────────────────────────────────────

export const ZIS_SESSION_COOKIE = 'zion_session';

const CLIENT_PROXY_BASE = '/api/auth';
const CLIENT_PROXY_BASE_SESSION = '/api/session';
const CLIENT_PROXY_BASE_KEYS = '/api/keys';

// ── Core fetch helpers ───────────────────────────────────────────────

async function zisFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

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
    const err = new Error(message) as Error & { status: number; detail: unknown };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Auth API functions ───────────────────────────────────────────────

/**
 * Request a challenge nonce for a wallet address.
 */
export async function getChallenge(
  address: string,
  chainType: ZisChainType = 'zion-l1',
): Promise<ZisChallenge> {
  return zisFetch<ZisChallenge>(`${CLIENT_PROXY_BASE}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainType }),
  });
}

/**
 * Verify an Ed25519 signature (ZION L1 native auth).
 */
export async function verifyEd25519(
  address: string,
  publicKey: string,
  signature: string,
): Promise<ZisSession> {
  return zisFetch<ZisSession>(`${CLIENT_PROXY_BASE}/verify/ed25519`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, publicKey, signature }),
  });
}

/**
 * Verify a SIWE (Sign-In with Ethereum) signature.
 */
export async function verifySiwe(
  address: string,
  message: string,
  signature: string,
  recoveredAddress?: string,
): Promise<ZisSession> {
  return zisFetch<ZisSession>(`${CLIENT_PROXY_BASE}/verify/siwe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      message,
      signature,
      ...(recoveredAddress ? { recoveredAddress } : {}),
    }),
  });
}

/**
 * Get the currently authenticated user.
 */
export async function getCurrentUser(): Promise<ZisUser | null> {
  try {
    return await zisFetch<ZisUser>(`${CLIENT_PROXY_BASE}/me`);
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 401 || e.status === 403) return null;
    throw err;
  }
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  profile: { displayName?: string; email?: string | null; avatar?: string | null; bio?: string | null },
): Promise<ZisUser> {
  return zisFetch<ZisUser>(`${CLIENT_PROXY_BASE}/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
}

/**
 * Log out the current session.
 */
export async function logout(): Promise<{ ok: boolean }> {
  try {
    await zisFetch(`${CLIENT_PROXY_BASE}/logout`, { method: 'POST' });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ── Session management ───────────────────────────────────────────────

export async function getSessions(): Promise<{ sessions: ZisActiveSession[] }> {
  return zisFetch<{ sessions: ZisActiveSession[] }>(CLIENT_PROXY_BASE_SESSION);
}

export async function revokeSession(jti: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${CLIENT_PROXY_BASE_SESSION}/${encodeURIComponent(jti)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return { ok: res.ok };
}

export async function revokeAllSessions(): Promise<{ ok: boolean }> {
  const res = await fetch(`${CLIENT_PROXY_BASE_SESSION}/revoke-all`, {
    method: 'POST',
    credentials: 'include',
  });
  return { ok: res.ok };
}

// ── API key management ───────────────────────────────────────────────

export async function getApiKeys(): Promise<{ keys: ZisApiKey[] }> {
  return zisFetch<{ keys: ZisApiKey[] }>(CLIENT_PROXY_BASE_KEYS);
}

export async function createApiKey(label: string): Promise<{ apiKey: string; label: string }> {
  return zisFetch<{ apiKey: string; label: string }>(CLIENT_PROXY_BASE_KEYS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
}

export async function revokeApiKey(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${CLIENT_PROXY_BASE_KEYS}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return { ok: res.ok };
}

// ── Legacy / diagnostic auth check ───────────────────────────────────

export interface OasisAuthState {
  authenticated: boolean;
  user: ZisUser | null;
  error: string | null;
}

export async function checkOasisAuth(): Promise<OasisAuthState> {
  try {
    const user = await getCurrentUser();
    return { authenticated: user !== null, user, error: null };
  } catch (e) {
    return { authenticated: false, user: null, error: e instanceof Error ? e.message : String(e) };
  }
}
