// ZION Archive Pass — server-side verify for the Nirvana portal.
// The canonical code store lives on EDGE2 (Marketplace writes it, the
// website reads it); this host (EDGE) cannot read that file, so every
// check goes through the public oracle /api/archive/verify on
// app.zionterranova.com.
//
// The verdict is tri-state on purpose: a transient oracle problem
// (timeout, 429 from the shared throttle, 5xx, network blip, EDGE2
// deploy) must NOT be reported as "invalid" — the caller would otherwise
// throw away a pass that was already proven valid (real bug 2026-11-03:
// users saw "pass expired" after a brief outage).

const VERIFY_URL =
  process.env.ARCHIVE_VERIFY_URL ??
  'https://app.zionterranova.com/api/archive/verify';

export const PASS_COOKIE = 'zion_nirvana_pass';
export const PASS_COOKIE_MAX_AGE = 90 * 24 * 3600; // 90 d, same as archive cookie

export type PassVerdict = 'valid' | 'invalid' | 'unreachable';

export async function verifyPassCode(code: string): Promise<PassVerdict> {
  const trimmed = code.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return 'invalid';
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: trimmed }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    // Throttled / server-side failure / unknown status: we could not decide.
    // Only an explicit 200 + {valid:false} means the code is really dead.
    if (!res.ok) return 'unreachable';
    const json = (await res.json()) as { valid?: boolean };
    return json.valid === true ? 'valid' : 'invalid';
  } catch {
    return 'unreachable';
  }
}
