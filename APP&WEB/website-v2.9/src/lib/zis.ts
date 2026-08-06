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
  getCurrentUser as sharedGetCurrentUser,
  logout as sharedLogout,
  useZisAuth as sharedUseZisAuth,
  getZisUrl,
  ZIS_SESSION_COOKIE,
  type ZisUser,
  type ZisSession,
  type ZisChallenge,
  type ZisChainType,
  type ZisLinkedAddress,
  type ZisOasisPlayer,
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
