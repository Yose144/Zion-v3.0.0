import type { PortalAuth } from '@zion/contract';

/**
 * @zion/session — jediný model přihlášení.
 *
 * Session drží hostitel okna (aplikace), ne portál. Cookie `zion_session`
 * vydává ZIS (auth.zionterranova.com). Tady jsou jen typy a čistá logika,
 * žádný fetch a žádný klíč — síť jde přes @zion/api.
 */

export const SESSION_COOKIE = 'zion_session';

export type Identity = {
  userId: string;
  displayName?: string;
  primaryAddress?: string;
};

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; identity: Identity; expiresAt?: string };

export const ANONYMOUS: SessionState = { status: 'anonymous' };

/** Umí portál s danou úrovní auth otevřít anonymní člověk? */
export function allows(session: SessionState, level: PortalAuth): boolean {
  if (level === 'none') return true;
  return session.status === 'authenticated';
}

/** Chybí k otevření portálu přihlášení? */
export function needsSignIn(session: SessionState, level: PortalAuth): boolean {
  return !allows(session, level);
}
