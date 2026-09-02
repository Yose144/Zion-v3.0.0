/**
 * MarketPlace — client-side ZIS integration layer.
 *
 * Routes all ZIS calls through the local Next.js proxy (`/api/auth/*`) so
 * the `zion_session` SSO cookie (scoped to `.zionterranova.com`) is sent
 * same-origin — no CORS preflight needed.
 *
 * The catch-all proxy route is at `src/app/api/auth/[...zis]/route.ts`.
 *
 * Server-side auth helpers live in `src/lib/zis.ts` (uses next/headers).
 */

import {
  getCurrentUser as sharedGetCurrentUser,
  logout as sharedLogout,
  updateProfile as sharedUpdateProfile,
  type ZisUser,
  type ZisSession,
  type ZisChallenge,
  type ZisChainType,
} from '../../../shared/zis-client';

export type { ZisUser, ZisSession, ZisChallenge, ZisChainType };

// ── Client-side proxy base ────────────────────────────────────────────
const PROXY = '/api/auth';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ── Client-side wrappers ──────────────────────────────────────────────

/** Request a challenge nonce from ZIS (client-side, via local proxy). */
export async function getChallenge(
  address: string,
  chainType: ZisChainType = 'evm',
): Promise<ZisChallenge> {
  if (isBrowser()) {
    const res = await fetch(`${PROXY}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ address, chainType }),
    });
    if (!res.ok) throw new Error(`Challenge failed: ${res.status}`);
    return res.json();
  }
  // Server-side fallback (direct to ZIS)
  const { getChallenge: shared } = await import('../../../shared/zis-client');
  return shared(address, chainType);
}

/** Verify a SIWE signature with ZIS (client-side, via local proxy). */
export async function verifySiwe(
  address: string,
  message: string,
  signature: string,
  recoveredAddress?: string,
): Promise<ZisSession> {
  if (isBrowser()) {
    const res = await fetch(`${PROXY}/verify/siwe`, {
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
  const { verifySiwe: shared } = await import('../../../shared/zis-client');
  return shared(address, message, signature, recoveredAddress);
}

/** Get the current ZIS user (client-side, via local proxy). */
export async function getCurrentUser(
  options?: { cookieHeader?: string },
): Promise<ZisUser | null> {
  if (isBrowser()) {
    const res = await fetch(`${PROXY}/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
    return res.json();
  }
  return sharedGetCurrentUser({ cookieHeader: options?.cookieHeader });
}

/** Update the current user's profile (client-side, via local proxy). */
export async function updateProfile(
  profile: { displayName?: string; email?: string | null; avatar?: string | null; bio?: string | null },
): Promise<ZisUser> {
  if (isBrowser()) {
    const res = await fetch(`${PROXY}/me`, {
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

/** Log out from ZIS (client-side, via local proxy). */
export async function logout(): Promise<{ ok: boolean }> {
  if (isBrowser()) {
    const res = await fetch(`${PROXY}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return { ok: res.ok };
  }
  return sharedLogout();
}
