// WebAuthn / passkey ceremony state for ZIS.
//
// Two ceremonies are supported:
//   register — an authenticated user adds a passkey to their account
//   login    — an anonymous caller authenticates with a discoverable passkey
//
// Each ceremony is bound to a server-generated challenge and a one-shot
// ceremonyId. Ceremonies expire after 5 minutes and are consumed on read.

import { randomUUID } from 'node:crypto';

const CEREMONY_TTL_MS = 5 * 60 * 1000; // 5 min

const DEFAULT_ORIGINS = [
  'https://zionterranova.com',
  'https://app.zionterranova.com',
  'https://market.zionterranova.com',
  'https://oasis.zionterranova.com',
  'https://dashboard.zionterranova.com',
  'https://freeworld.zionterranova.com',
];

export interface WebAuthnConfig {
  rpId: string;
  rpName: string;
  origins: string[];
}

/**
 * Resolve WebAuthn relying-party config from the environment.
 * Read at call time so tests / deploys can override per request.
 *
 *   WEBAUTHN_RP_ID    — relying party ID (default: zionterranova.com)
 *   WEBAUTHN_RP_NAME  — display name (default: ZION)
 *   WEBAUTHN_ORIGINS  — comma-separated allowed origins
 *                       (default: the CORS origin list in server.ts)
 */
export function getWebAuthnConfig(): WebAuthnConfig {
  const originsEnv = process.env.WEBAUTHN_ORIGINS;
  return {
    rpId: process.env.WEBAUTHN_RP_ID ?? 'zionterranova.com',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'ZION',
    origins: originsEnv
      ? originsEnv.split(',').map((o) => o.trim()).filter(Boolean)
      : [...DEFAULT_ORIGINS],
  };
}

export interface WebAuthnCeremony {
  kind: 'register' | 'login';
  challenge: string;
  userId?: string;
  expires: number;
}

const ceremonies = new Map<string, WebAuthnCeremony>();

// Injectable clock for tests.
let nowFn: () => number = () => Date.now();

export function setWebAuthnClock(fn: () => number): void {
  nowFn = fn;
}

// Periodic cleanup
setInterval(() => {
  const now = nowFn();
  for (const [k, v] of ceremonies) {
    if (v.expires < now) ceremonies.delete(k);
  }
}, 60_000).unref();

export function createCeremony(
  kind: 'register' | 'login',
  challenge: string,
  userId?: string,
): string {
  const ceremonyId = randomUUID();
  ceremonies.set(ceremonyId, {
    kind,
    challenge,
    userId,
    expires: nowFn() + CEREMONY_TTL_MS,
  });
  return ceremonyId;
}

/**
 * One-shot ceremony read: returns the ceremony and deletes it, or null if
 * the id is unknown, expired, or of the wrong kind.
 */
export function takeCeremony(
  ceremonyId: string,
  kind: 'register' | 'login',
): WebAuthnCeremony | null {
  const entry = ceremonies.get(ceremonyId);
  ceremonies.delete(ceremonyId);
  if (!entry || entry.kind !== kind || entry.expires < nowFn()) {
    return null;
  }
  return entry;
}
