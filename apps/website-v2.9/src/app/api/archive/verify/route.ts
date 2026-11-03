import { NextRequest, NextResponse } from 'next/server';
import { isValidPassCode } from '@/lib/archive-access';

export const dynamic = 'force-dynamic';

// Public code-verify oracle for sibling ZION surfaces (nirvana portal,
// OASIS surfaces) — code is presented by the user on each surface; this
// endpoint only answers valid/invalid.
//
// Two client classes, two budgets:
//   • browser  — real user IP, 20 attempts/min (brute-force noise control)
//   • sibling  — server-to-server callers (nirvana on EDGE) share one egress
//                IP, so the browser budget locked EVERY nirvana user out at
//                once (real bug 2026-11-03). Sibling budget is separate and
//                generous; it is not a security boundary (ZAP codes are
//                16 hex chars = 2^64, brute force is impossible either way).
const WINDOW_MS = 60_000;
const MAX_BROWSER = 20;
const MAX_SERVER = 600;

const attempts = new Map<string, { count: number; reset: number; max: number }>();

function clientKey(req: NextRequest): string {
  // nginx sets both; `x-real-ip` survives even when XFF is absent.
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return xff || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Browsers send Sec-Fetch-* / Origin; server-to-server siblings do not. */
function isBrowser(req: NextRequest): boolean {
  return Boolean(
    req.headers.get('sec-fetch-site') || req.headers.get('origin'),
  );
}

function throttled(key: string, max: number): boolean {
  const now = Date.now();
  if (attempts.size > 1024) {
    for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  }
  const e = attempts.get(key);
  if (!e || e.reset < now) {
    attempts.set(key, { count: 1, reset: now + WINDOW_MS, max });
    return false;
  }
  e.count += 1;
  return e.count > e.max;
}

export async function POST(req: NextRequest) {
  const browser = isBrowser(req);
  const max = browser ? MAX_BROWSER : MAX_SERVER;
  const key = `${browser ? 'b' : 's'}:${clientKey(req)}`;
  if (throttled(key, max)) {
    return NextResponse.json(
      { valid: false, error: 'too_many_attempts' },
      { status: 429 },
    );
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
