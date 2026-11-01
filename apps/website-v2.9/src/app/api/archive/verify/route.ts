import { NextRequest, NextResponse } from 'next/server';
import { isValidPassCode } from '@/lib/archive-access';

export const dynamic = 'force-dynamic';

// Public code-verify oracle for sibling ZION surfaces (nirvana portal,
// OASIS surfaces) — code is presented by the user on each surface; this
// endpoint only answers valid/invalid. Same per-IP throttle shape as
// /api/archive/access so brute-forcing codes stays impractical.
const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ valid: false, error: 'too_many_attempts' }, { status: 429 });
  }
  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body?.code === 'string' ? body.code : '';
  } catch {
    return NextResponse.json({ valid: false, error: 'bad_request' }, { status: 400 });
  }
  return NextResponse.json({ valid: isValidPassCode(code) });
}
