import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

// Archive Pass — B2B access gate for Zion Archive (Nirvana Hub).
// The operator issues pass codes (off-chain deals / invoices) by listing them
// in ARCHIVE_PASS_CODES (comma-separated) in the website env file.
// A valid code sets the `zion_archive_pass` httpOnly cookie which unlocks the
// whole /zion-archive tree for 90 days.

export const ARCHIVE_PASS_COOKIE = 'zion_archive_pass';
export const ARCHIVE_PASS_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

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

/** Server-component gate: does this request carry a valid archive pass? */
export async function hasArchiveAccess(): Promise<boolean> {
  const jar = await cookies();
  return isValidPassCode(jar.get(ARCHIVE_PASS_COOKIE)?.value);
}
