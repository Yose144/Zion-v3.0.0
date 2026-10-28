import { NextRequest, NextResponse } from 'next/server';
import {
  ARCHIVE_PASS_COOKIE,
  ARCHIVE_PASS_MAX_AGE,
  archiveAccess,
  isValidPassCode,
} from '@/lib/archive-access';
import { grantEntitlement } from '@/lib/archive-entitlements';
import { getCurrentUserFromRequest } from '@/lib/zis';

export const dynamic = 'force-dynamic';

// naive per-IP throttle: 10 code attempts / minute (in-memory; resets on deploy)
const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function throttled(ip: string): boolean {
  const now = Date.now();
  // sweep stale windows so a flood of unique IPs can't grow the map forever
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

/** Current access status for the requesting client. */
export async function GET() {
  const { access, via, user } = await archiveAccess();
  return NextResponse.json({
    access,
    via,
    user: user
      ? { id: user.id, displayName: user.displayName ?? null }
      : undefined,
  });
}

/** Redeem an Archive Pass code → sets the access cookie (and binds to ZIS). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ ok: false, error: 'too_many_attempts' }, { status: 429 });
  }

  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body?.code === 'string' ? body.code : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  if (!isValidPassCode(code)) {
    return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 401 });
  }

  // If the redeemer is logged in via ZIS, bind the pass to their identity:
  // the entitlement survives code rotation and unlocks via session alone.
  let bound = false;
  try {
    const user = await getCurrentUserFromRequest(req);
    if (user) {
      grantEntitlement({
        subject: `zis:${user.id}`,
        type: 'b2b',
        claimedVia: 'code',
      });
      bound = true;
    }
  } catch {
    // binding is best-effort — the cookie still grants access
  }

  const res = NextResponse.json({ ok: true, bound });
  res.cookies.set(ARCHIVE_PASS_COOKIE, code.trim(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ARCHIVE_PASS_MAX_AGE,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ARCHIVE_PASS_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
