import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getEntitlement } from '@/lib/archive-entitlements';
import {
  getCurrentUser,
  ZIS_SESSION_COOKIE,
  type ZisUser,
} from '@/lib/zis';

// Archive Pass — access gate for Zion Archive (Nirvana Hub).
// Three access paths, checked in order:
//   1. code    — operator-issued pass code (ARCHIVE_PASS_CODES env, B2B /
//                invoices); verified via the `zion_archive_pass` cookie.
//   2. zis-oasis — ZIS login with a linked OASIS player (OASIS bonus).
//   3. zis-entitlement — ZIS login with an entitlement record (claimed
//                code, admin grant, or future marketplace purchase).
// Revoking a code = remove it from env; revoking an entitlement =
// admin DELETE on /api/archive/entitlements.

export const ARCHIVE_PASS_COOKIE = 'zion_archive_pass';
export const ARCHIVE_PASS_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

export type ArchiveAccessVia =
  | 'code'
  | 'zis-oasis'
  | 'zis-entitlement'
  | null;

export interface ArchiveAccess {
  access: boolean;
  via: ArchiveAccessVia;
  user?: ZisUser;
}

function passCodes(): Set<string> {
  const raw = process.env.ARCHIVE_PASS_CODES ?? '';
  return new Set(
    raw
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length >= 8),
  );
}

// constant-time compare so code probing can't leak prefix matches via timing
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isValidPassCode(code: string | undefined): boolean {
  if (!code) return false;
  const codes = passCodes();
  if (codes.size === 0) return false;
  for (const valid of codes) {
    if (safeEqual(code.trim(), valid)) return true;
  }
  return false;
}

/** Resolve archive access for the current request (server components). */
export async function archiveAccess(): Promise<ArchiveAccess> {
  const jar = await cookies();
  if (isValidPassCode(jar.get(ARCHIVE_PASS_COOKIE)?.value)) {
    return { access: true, via: 'code' };
  }

  const session = jar.get(ZIS_SESSION_COOKIE)?.value;
  if (!session) return { access: false, via: null };

  let user: ZisUser | null = null;
  try {
    user = await getCurrentUser({
      cookieHeader: `${ZIS_SESSION_COOKIE}=${session}`,
    });
  } catch {
    return { access: false, via: null }; // ZIS unreachable → fail closed
  }
  if (!user) return { access: false, via: null };

  // OASIS bonus: a linked OASIS player unlocks the archive
  if (user.oasisPlayer) return { access: true, via: 'zis-oasis', user };
  // claimed code / admin grant / purchase
  if (getEntitlement(`zis:${user.id}`)) {
    return { access: true, via: 'zis-entitlement', user };
  }
  return { access: false, via: null, user };
}

/** Server-component gate: does this request carry archive access? */
export async function hasArchiveAccess(): Promise<boolean> {
  return (await archiveAccess()).access;
}
