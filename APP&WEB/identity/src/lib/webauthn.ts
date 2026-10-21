// WebAuthn / passkey ceremony state for ZIS.
//
// Two ceremonies are supported:
//   register — an authenticated user adds a passkey to their account
//   login    — an anonymous caller authenticates with a discoverable passkey
//
// Each ceremony is a row in the WebAuthnCeremony table, bound to a
// server-generated challenge and a one-shot ceremonyId. Ceremonies expire
// after 5 minutes and are consumed on read — they survive restarts and can
// be shared across instances (unlike the previous in-memory map).

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const CEREMONY_TTL_MS = 5 * 60 * 1000; // 5 min

const DEFAULT_ORIGINS = [
  'https://zionterranova.com',
  'https://app.zionterranova.com',
  'https://market.zionterranova.com',
  'https://oasis.zionterranova.com',
  'https://dashboard.zionterranova.com',
  'https://freeworld.zionterranova.com',
  'https://pool.zionterranova.com',
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

/** Narrow store interface — real PrismaClient or the in-memory test fake. */
export interface CeremonyStore {
  create(args: {
    data: { id: string; kind: string; challenge: string; userId: string | null; expiresAt: Date };
  }): Promise<unknown>;
  delete(args: {
    where: { id: string };
  }): Promise<{ id: string; kind: string; challenge: string; userId: string | null; expiresAt: Date }>;
  deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<{ count: number }>;
}

function store(prisma: PrismaClient): CeremonyStore {
  return prisma.webAuthnCeremony as unknown as CeremonyStore;
}

// Injectable clock for tests.
let nowFn: () => number = () => Date.now();

export function setWebAuthnClock(fn: () => number): void {
  nowFn = fn;
}

export async function createCeremony(
  prisma: PrismaClient,
  kind: 'register' | 'login',
  challenge: string,
  userId?: string,
): Promise<string> {
  const ceremonyId = randomUUID();
  await store(prisma).create({
    data: {
      id: ceremonyId,
      kind,
      challenge,
      userId: userId ?? null,
      expiresAt: new Date(nowFn() + CEREMONY_TTL_MS),
    },
  });
  return ceremonyId;
}

/**
 * One-shot ceremony read: deletes the row and returns it, or null if the
 * id is unknown, expired, or of the wrong kind.
 */
export async function takeCeremony(
  prisma: PrismaClient,
  ceremonyId: string,
  kind: 'register' | 'login',
): Promise<WebAuthnCeremony | null> {
  let row;
  try {
    row = await store(prisma).delete({ where: { id: ceremonyId } });
  } catch {
    return null; // unknown id
  }
  if (!row || row.kind !== kind || row.expiresAt.getTime() < nowFn()) {
    return null;
  }
  return {
    kind: row.kind as 'register' | 'login',
    challenge: row.challenge,
    userId: row.userId ?? undefined,
    expires: row.expiresAt.getTime(),
  };
}

/** Delete expired ceremonies — called by the periodic prune job. */
export async function pruneCeremonies(prisma: PrismaClient): Promise<number> {
  const res = await store(prisma).deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}
