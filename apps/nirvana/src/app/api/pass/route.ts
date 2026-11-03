import { NextRequest, NextResponse } from 'next/server';
import { PASS_COOKIE, PASS_COOKIE_MAX_AGE, verifyPassCode } from '@/lib/pass';

export const dynamic = 'force-dynamic';

// Mirror of the website's /api/archive/access contract: POST redeems a
// ZAP-… code into an httpOnly cookie, GET reports current access state
// (cookie value re-validated every call → revocation propagates),
// DELETE clears it. Per-IP throttle matches the website gate.
//
// The cookie is ONLY deleted when the oracle says the code is invalid.
// A transient failure (timeout / 429 / 5xx / EDGE2 restart) reports
// `reason: 'unreachable'` and leaves the cookie in place — otherwise a
// five-second hiccup would permanently erase a pass the user paid for.
const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function throttled(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 1024) {
    for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  }
  const e = attempts.get(ip);
  if (!e || e.reset < now) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > MAX_ATTEMPTS;
}

const cookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: PASS_COOKIE_MAX_AGE,
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ access: false, error: 'too_many_attempts' }, { status: 429 });
  }
  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body?.code === 'string' ? body.code : '';
  } catch {
    return NextResponse.json({ access: false, error: 'bad_request' }, { status: 400 });
  }
  const verdict = await verifyPassCode(code);
  if (verdict === 'unreachable') {
    // Cannot decide right now — do not claim the code is invalid.
    return NextResponse.json(
      { access: false, error: 'verify_unavailable' },
      { status: 503 },
    );
  }
  if (verdict === 'invalid') {
    return NextResponse.json({ access: false, error: 'invalid_code' }, { status: 401 });
  }
  const res = NextResponse.json({ access: true });
  res.cookies.set(PASS_COOKIE, code.trim(), cookieOpts);
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.cookies.get(PASS_COOKIE)?.value;
  if (!code) return NextResponse.json({ access: false });

  const verdict = await verifyPassCode(code);
  if (verdict === 'invalid') {
    const res = NextResponse.json({ access: false });
    res.cookies.delete(PASS_COOKIE);
    return res;
  }
  if (verdict === 'unreachable') {
    // Keep the cookie: the pass was already proven valid when it was set and
    // the failure is on our side. The portal shows a retry, not "expired".
    return NextResponse.json({ access: false, reason: 'unreachable' });
  }
  return NextResponse.json({ access: true });
}

export async function DELETE() {
  const res = NextResponse.json({ access: false });
  res.cookies.delete(PASS_COOKIE);
  return res;
}
