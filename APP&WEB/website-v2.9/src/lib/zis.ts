/**
 * Web 2.9 (app.zionterranova.com) — ZIS integration layer.
 *
 * Re-exports the shared ZIS client and adds Next.js-app-specific helpers:
 *  - Server-side: cookie forwarding from NextRequest
 *  - Client-side: same-origin proxy base URL (`/api/auth`) so the SSO
 *    cookie travels via the local catch-all proxy route.
 *
 * The catch-all proxy route is at `src/app/api/auth/[...zis]/route.ts`.
 */

import type { NextRequest } from 'next/server';
import {
  getChallenge as sharedGetChallenge,
  verifyEd25519 as sharedVerifyEd25519,
  verifySiwe as sharedVerifySiwe,
  verifyGoogle as sharedVerifyGoogle,
  getCurrentUser as sharedGetCurrentUser,
  updateProfile as sharedUpdateProfile,
  logout as sharedLogout,
  getSessions as sharedGetSessions,
  revokeSession as sharedRevokeSession,
  revokeAllSessions as sharedRevokeAllSessions,
  getApiKeys as sharedGetApiKeys,
  createApiKey as sharedCreateApiKey,
  revokeApiKey as sharedRevokeApiKey,
  linkAddress as sharedLinkAddress,
  useZisAuth as sharedUseZisAuth,
  getZisUrl,
  ZIS_SESSION_COOKIE,
  type ZisUser,
  type ZisSession,
  type ZisChallenge,
  type ZisChainType,
  type ZisLinkedAddress,
  type ZisOasisPlayer,
  type ZisActiveSession,
  type ZisApiKey,
  type UseZisAuthResult,
} from '../../../shared/zis-client';

// ── Re-export shared types ───────────────────────────────────────────
export type {
  ZisUser,
  ZisSession,
  ZisChallenge,
  ZisChainType,
  ZisLinkedAddress,
  ZisOasisPlayer,
  ZisActiveSession,
  ZisApiKey,
  UseZisAuthResult,
};

export { ZIS_SESSION_COOKIE, getZisUrl };

// ── Client-side base URL ─────────────────────────────────────────────
//
// On the client we route through the local Next.js proxy (`/api/auth/*`)
// so the `zion_session` cookie (scoped to `.zionterranova.com`) is sent
// same-origin — no CORS preflight needed.
//
// On the server we talk to ZIS directly via ZIS_URL.
const CLIENT_PROXY_BASE = '/api/auth';
const CLIENT_PROXY_BASE_SESSION = '/api/session';
const CLIENT_PROXY_BASE_KEYS = '/api/keys';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ── Client-side wrappers (through local proxy) ───────────────────────

/**
 * Request a challenge nonce (client-side, via local proxy).
 */
export async function getChallenge(
  address: string,
  chainType: ZisChainType = 'zion-l1',
): Promise<ZisChallenge> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ address, chainType }),
    });
    if (!res.ok) throw new Error(`Challenge failed: ${res.status}`);
    return res.json();
  }
  return sharedGetChallenge(address, chainType);
}

/**
 * Verify an Ed25519 signature (client-side, via local proxy).
 */
export async function verifyEd25519(
  address: string,
  publicKey: string,
  signature: string,
): Promise<ZisSession> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/verify/ed25519`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ address, publicKey, signature }),
    });
    if (!res.ok) throw new Error(`Ed25519 verify failed: ${res.status}`);
    return res.json();
  }
  return sharedVerifyEd25519(address, publicKey, signature);
}

/**
 * Verify a SIWE signature (client-side, via local proxy).
 */
/**
 * Verify a Google Sign-In ID token (client-side, via local proxy).
 */
export async function verifyGoogle(idToken: string): Promise<ZisSession> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/verify/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error(`Google verify failed: ${res.status}`);
    return res.json();
  }
  return sharedVerifyGoogle(idToken);
}

export async function verifySiwe(
  address: string,
  message: string,
  signature: string,
  recoveredAddress?: string,
): Promise<ZisSession> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/verify/siwe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        address,
        message,
        signature,
        ...(recoveredAddress ? { recoveredAddress } : {}),
      }),
    });
    if (!res.ok) throw new Error(`SIWE verify failed: ${res.status}`);
    return res.json();
  }
  return sharedVerifySiwe(address, message, signature, recoveredAddress);
}

/**
 * Get the current user via `/api/auth/me` (the local proxy).
 *
 * Client-side: calls the same-origin proxy so the SSO cookie is included.
 * Server-side: forwards the cookie from the incoming NextRequest.
 */
export async function getCurrentUser(
  options?: { cookieHeader?: string },
): Promise<ZisUser | null> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
    return res.json();
  }
  return sharedGetCurrentUser({
    cookieHeader: options?.cookieHeader,
  });
}

/**
 * Update the current user's profile via the local proxy.
 */
export async function updateProfile(
  profile: { displayName?: string; email?: string | null; avatar?: string | null; bio?: string | null },
): Promise<ZisUser> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
    return res.json();
  }
  return sharedUpdateProfile(profile);
}

/**
 * Log out via the local proxy.
 */
export async function logout(): Promise<{ ok: boolean }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return { ok: res.ok };
  }
  return sharedLogout();
}

// ── Session management (client-side through local proxy) ─────────────

/**
 * List active sessions for the current user.
 */
export async function getSessions(
  options?: { cookieHeader?: string },
): Promise<{ sessions: ZisActiveSession[] }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_SESSION}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Sessions fetch failed: ${res.status}`);
    return res.json();
  }
  return sharedGetSessions({ cookieHeader: options?.cookieHeader });
}

/**
 * Revoke a specific session by its JWT JTI.
 */
export async function revokeSession(jti: string): Promise<{ ok: boolean }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_SESSION}/${encodeURIComponent(jti)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return { ok: res.ok };
  }
  return sharedRevokeSession(jti);
}

/**
 * Revoke all active sessions for the current user (logout everywhere).
 */
export async function revokeAllSessions(): Promise<{ ok: boolean }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_SESSION}/revoke-all`, {
      method: 'POST',
      credentials: 'include',
    });
    return { ok: res.ok };
  }
  return sharedRevokeAllSessions();
}

// ── API key management (client-side through local proxy) ─────────────

/**
 * List API keys for the current user.
 */
export async function getApiKeys(
  options?: { cookieHeader?: string },
): Promise<{ keys: ZisApiKey[] }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_KEYS}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`API keys fetch failed: ${res.status}`);
    return res.json();
  }
  return sharedGetApiKeys({ cookieHeader: options?.cookieHeader });
}

/**
 * Create a new API key. The raw key is returned only once.
 */
export async function createApiKey(label: string): Promise<{ apiKey: string; label: string }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_KEYS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error(`API key creation failed: ${res.status}`);
    return res.json();
  }
  return sharedCreateApiKey(label);
}

/**
 * Revoke an API key by id.
 */
export async function revokeApiKey(id: string): Promise<{ ok: boolean }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE_KEYS}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return { ok: res.ok };
  }
  return sharedRevokeApiKey(id);
}

/**
 * Link an additional address to the authenticated user's account.
 */
export async function linkAddress(body: {
  address: string;
  chainType: ZisChainType;
  chainId?: string;
  publicKey?: string;
  signature: string;
  message?: string;
}): Promise<{ linked: ZisLinkedAddress; user: ZisUser }> {
  if (isBrowser()) {
    const res = await fetch(`${CLIENT_PROXY_BASE}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Link address failed: ${res.status}`);
    return res.json();
  }
  return sharedLinkAddress(body);
}

// ── Server-side helper: extract cookie from NextRequest ──────────────

/**
 * Extract the `zion_session` cookie value from a NextRequest.
 * Useful in server components / route handlers to forward to ZIS.
 */
export function getSessionCookie(req: NextRequest): string | undefined {
  return req.cookies.get(ZIS_SESSION_COOKIE)?.value;
}

/**
 * Build a `Cookie` header string from a NextRequest for forwarding to ZIS.
 */
export function getCookieHeader(req: NextRequest): string | undefined {
  const value = getSessionCookie(req);
  return value ? `${ZIS_SESSION_COOKIE}=${value}` : undefined;
}

/**
 * Server-side: get current user from a NextRequest (for server components).
 * Forwards the session cookie to ZIS directly.
 */
export async function getCurrentUserFromRequest(
  req: NextRequest,
): Promise<ZisUser | null> {
  const cookieHeader = getCookieHeader(req);
  if (!cookieHeader) return null;
  return sharedGetCurrentUser({ cookieHeader });
}

// ── Re-export the shared React hook (client-side) ────────────────────
//
// `useZisAuth` calls ZIS directly (credentials: include). For same-origin
// proxy usage, use the `useAuth` hook in `src/hooks/useAuth.ts` instead.
export const useZisAuth = sharedUseZisAuth;
