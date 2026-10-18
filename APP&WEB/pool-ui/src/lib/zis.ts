// ZIS — ZION Identity Service client (pool-ui subset).
//
// pool-ui is a STATIC export, but the pool nginx vhost proxies
// /api/auth/* and /api/session/* to the ZIS backend — same pattern as
// MarketPlace/Oasis. Same-origin means zero CORS and the shared
// `zion_session` cookie (Domain=.zionterranova.com) just works.
// Direct calls to auth.zionterranova.com remain as an opt-in override
// (NEXT_PUBLIC_ZIS_URL) for local dev; the pool origin is also in the
// ZIS CORS + WebAuthn allowlists.
//
// API surface used (see APP&WEB/identity/src/routes/*):
//   GET  /api/auth/me                        — current user
//   POST /api/auth/logout                    — revoke session
//   POST /api/auth/challenge                 — SIWE nonce (chainType evm)
//   POST /api/auth/verify/siwe               — EIP-4361 login
//   POST /api/auth/webauthn/login/options    — passkey ceremony begin
//   POST /api/auth/webauthn/login/verify     — passkey ceremony finish
//   GET  /api/auth/avatar/:seed.svg          — deterministic avatar

export const ZIS_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ZIS_URL
    ? process.env.NEXT_PUBLIC_ZIS_URL
    : '';

export const ZIS_SESSION_COOKIE = 'zion_session';
export const ZION_APP_LOGIN = 'https://app.zionterranova.com/login';

// ── Types ─────────────────────────────────────────────────────────────

export interface ZisLinkedAddress {
  id: string;
  userId: string;
  address: string;
  chainType: 'zion-l1' | 'evm' | 'bitcoin' | string;
  chainId?: string | null;
  verifiedAt: string;
}

export interface ZisUser {
  id: string;
  primaryAddress: string;
  displayName?: string | null;
  email?: string | null;
  avatar?: string | null;
  role?: string;
  createdAt?: string;
  lastLogin?: string | null;
  loginCount?: number;
  linkedAddresses?: ZisLinkedAddress[];
  oasisPlayer?: {
    totalXp?: number;
    level?: string;
    blocksMined?: number;
  } | null;
}

interface ZisPasskeyCeremony {
  ceremonyId: string;
  options: Record<string, unknown>;
}

// ── Fetch helper ──────────────────────────────────────────────────────

async function zisFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${ZIS_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = `ZIS ${res.status}`;
    try {
      const detail = (await res.json()) as { message?: string };
      if (detail.message) message = detail.message;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ── Public API ────────────────────────────────────────────────────────

/** Current ZIS session user, or null when not authenticated. */
export async function getCurrentUser(): Promise<ZisUser | null> {
  try {
    const data = await zisFetch<ZisUser | { error: string }>('/api/auth/me');
    if ((data as { error?: string }).error) return null;
    return data as ZisUser;
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 401 || e.status === 403) return null;
    throw err;
  }
}

export async function logout(): Promise<{ ok: boolean }> {
  try {
    await zisFetch('/api/auth/logout', { method: 'POST' });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ── Passkey (WebAuthn) login ──────────────────────────────────────────

export function passkeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  );
}

export async function getPasskeyLoginOptions(): Promise<ZisPasskeyCeremony> {
  return zisFetch<ZisPasskeyCeremony>('/api/auth/webauthn/login/options', {
    method: 'POST',
  });
}

export async function verifyPasskeyLogin(body: {
  ceremonyId: string;
  response: unknown;
}): Promise<unknown> {
  return zisFetch('/api/auth/webauthn/login/verify', {
    method: 'POST',
    body,
  });
}

// ── SIWE (MetaMask / EIP-191) login ───────────────────────────────────

export async function getChallenge(
  address: string,
  chainType: 'evm' | 'zion-l1' = 'evm',
): Promise<{ challenge: string }> {
  return zisFetch<{ challenge: string }>('/api/auth/challenge', {
    method: 'POST',
    body: { address, chainType },
  });
}

export async function verifySiwe(
  address: string,
  message: string,
  signature: string,
): Promise<unknown> {
  return zisFetch('/api/auth/verify/siwe', {
    method: 'POST',
    body: { address, message, signature },
  });
}

// ── Avatar ────────────────────────────────────────────────────────────

/** Absolute URL to the deterministic ZIS avatar for any identity seed. */
export function zisAvatarUrl(
  seed: string,
  opts?: { t?: 'sigil' | 'rings' | 'prism'; sz?: number },
): string {
  const params = new URLSearchParams();
  if (opts?.t) params.set('t', opts.t);
  if (opts?.sz) params.set('sz', String(opts.sz));
  const qs = params.toString();
  return `${ZIS_URL}/api/auth/avatar/${encodeURIComponent(seed)}.svg${qs ? `?${qs}` : ''}`;
}
