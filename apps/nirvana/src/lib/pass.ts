// ZION Archive Pass — server-side verify for the Nirvana portal.
// The canonical code store lives on EDGE2 (Marketplace writes it, the
// website reads it); this host (EDGE) cannot read that file, so every
// check goes through the public oracle /api/archive/verify on
// app.zionterranova.com. Fail-closed: any transport/parse error = no access.

const VERIFY_URL =
  process.env.ARCHIVE_VERIFY_URL ??
  'https://app.zionterranova.com/api/archive/verify';

export const PASS_COOKIE = 'zion_nirvana_pass';
export const PASS_COOKIE_MAX_AGE = 90 * 24 * 3600; // 90 d, same as archive cookie

export async function verifyPassCode(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: trimmed }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { valid?: boolean };
    return json.valid === true;
  } catch {
    return false;
  }
}
