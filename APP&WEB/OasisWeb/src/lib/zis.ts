/**
 * OASIS Web (oasis.zionterranova.com) — ZIS integration layer.
 *
 * Re-exports the shared ZIS client and provides `checkOasisAuth()` which
 * calls ZIS `/api/auth/me` directly. The `zion_session` SSO cookie is
 * scoped to `.zionterranova.com`, so on `oasis.zionterranova.com` it is
 * available cross-origin with `credentials: 'include'` (CORS is configured
 * on the ZIS for the oasis origin).
 */

import {
  getCurrentUser as sharedGetCurrentUser,
  getChallenge as sharedGetChallenge,
  verifyEd25519 as sharedVerifyEd25519,
  verifySiwe as sharedVerifySiwe,
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

// ── Re-export shared types & functions ───────────────────────────────
export type {
  ZisUser,
  ZisSession,
  ZisChallenge,
  ZisChainType,
  ZisLinkedAddress,
  ZisOasisPlayer,
  UseZisAuthResult,
};

export {
  ZIS_SESSION_COOKIE,
  getZisUrl,
  sharedGetChallenge as getChallenge,
  sharedVerifyEd25519 as verifyEd25519,
  sharedVerifySiwe as verifySiwe,
  sharedLogout as logout,
  sharedUseZisAuth as useZisAuth,
};

// ── OASIS-specific auth check ────────────────────────────────────────

/**
 * Result of `checkOasisAuth()`.
 */
export interface OasisAuthState {
  authenticated: boolean;
  user: ZisUser | null;
  error: string | null;
}

/**
 * Check whether the current visitor is authenticated via ZIS SSO.
 *
 * Calls ZIS `/api/auth/me` directly with `credentials: 'include'` so the
 * `zion_session` cookie (scoped to `.zionterranova.com`) is sent.
 *
 * Safe to call client-side or server-side.
 */
export async function checkOasisAuth(
  options?: { cookieHeader?: string },
): Promise<OasisAuthState> {
  try {
    const user = await sharedGetCurrentUser({
      cookieHeader: options?.cookieHeader,
    });
    return {
      authenticated: user !== null,
      user,
      error: null,
    };
  } catch (e) {
    return {
      authenticated: false,
      user: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
