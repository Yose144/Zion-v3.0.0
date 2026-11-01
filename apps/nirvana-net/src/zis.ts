/**
 * Resoluce identity hráče ze ZIS.
 *
 * Pravidlo: **identitu nikdy neposílá klient.** Server si vezme cookie
 * `zion_session` z WS handshaku, zeptá se ZIS na `/api/auth/me` a z odpovědi
 * si vytáhne jen to, co smí do hry (jméno, avatar, volitelný avatar z rosteru).
 * E-mail, roli účtu ani adresy klient nedostane.
 *
 * Když ZIS neodpoví (nebo session vypršela), hráč **hraje dál jako host** —
 * chat čte, ale nepsíše. Služba kvůli tomu nikdy nespadne.
 */

import type { NetIdentity } from '../../nirvana/src/core/net/protocol.js';

const ZIS_URL = (process.env.ZIS_URL ?? 'https://auth.zionterranova.com').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.ZIS_TIMEOUT_MS ?? 3000);
/** Jak dlouho si pamatovat ověřenou identitu (cookie → uživatel). */
const TTL_MS = 60_000;
const CACHE_LIMIT = 500;

interface ZisUser {
  id?: unknown;
  primaryAddress?: unknown;
  displayName?: unknown;
  avatar?: unknown;
  avatar3d?: unknown;
}

interface CacheEntry {
  at: number;
  identity: NetIdentity;
}

const cache = new Map<string, CacheEntry>();

/** `zion_session=…` z hlavičky Cookie (posílá se ZIS tak, jak přišla). */
export function sessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('zion_session=') && trimmed.length > 'zion_session='.length) {
      return trimmed;
    }
  }
  return null;
}

/** Jméno do hry: bez řídicích znaků a bez `<`/`>` (klient ho vykresluje jako text). */
function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : fallback;
}

/** Adresa zkrácená na `zion1abcd…wxyz` — když uživatel nemá jméno ani callsign. */
function shortAddress(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10) return 'poutník';
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function avatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (value.startsWith('/')) return `${ZIS_URL}${value}`;
  return null;
}

function avatarIdOf(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>).avatarId;
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 202) return null;
  return raw;
}

function callsignOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>).callsign;
  return typeof raw === 'string' && raw.trim().length > 0 ? cleanName(raw, 'poutník') : null;
}

/** `null` = session neplatná / ZIS nedostupný → hráč je host. */
export async function resolveIdentity(
  cookieHeader: string | undefined,
  guest: NetIdentity,
): Promise<NetIdentity> {
  const cookie = sessionCookie(cookieHeader);
  if (!cookie) return guest;

  const cached = cache.get(cookie);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.identity;

  let user: ZisUser | null = null;
  try {
    const response = await fetch(`${ZIS_URL}/api/auth/me`, {
      headers: { cookie, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) user = (await response.json()) as ZisUser;
  } catch {
    // timeout / DNS / 500 — host, žádná chyba hry
    return guest;
  }

  if (!user || typeof user.id !== 'string' || user.id.length === 0) return guest;

  const callsign = callsignOf(user.avatar3d);
  const identity: NetIdentity = {
    id: `u_${user.id}`,
    name: callsign ?? cleanName(user.displayName, shortAddress(user.primaryAddress)),
    role: 'zis',
    avatar: avatarUrl(user.avatar),
    avatarId: avatarIdOf(user.avatar3d),
    callsign,
  };

  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(cookie, { at: Date.now(), identity });
  return identity;
}

export function identityCacheSize(): number {
  return cache.size;
}
