import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { adminSessionCookieValue, ADMIN_SESSION_TTL_S } from '@/lib/admin-session';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * ADMIN_USERS format: username:password[,...]
 * Password may be plaintext or `sha256:<hex>` (recommended for prod —
 * avoids storing raw passwords in env).
 */
function parseUsers(env: string): Map<string, string> {
  const users = new Map<string, string>();
  for (const entry of env.split(',')) {
    const idx = entry.indexOf(':');
    if (idx > 0) {
      users.set(entry.slice(0, idx).trim(), entry.slice(idx + 1).trim());
    }
  }
  return users;
}

function passwordMatches(expected: string, provided: string): boolean {
  let a: Buffer;
  let b: Buffer;
  if (expected.startsWith('sha256:')) {
    a = Buffer.from(expected.slice(7));
    b = Buffer.from(createHash('sha256').update(provided).digest('hex'));
  } else {
    // plaintext fallback — constant-time compare
    a = Buffer.from(expected);
    b = Buffer.from(provided);
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`admin-login:${clientIp(request)}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const body = (await request.json()) as { username?: string; password?: string };
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 400 });
    }

    const users = parseUsers(process.env.ADMIN_USERS ?? '');
    const expected = users.get(username.trim());

    if (!expected || !passwordMatches(expected, password)) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const cookie = adminSessionCookieValue(username.trim());
    const res = NextResponse.json({ success: true, user: username.trim() });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    // Non-httpOnly marker so client code can gate the UI; the real
    // credential stays httpOnly and is verified server-side.
    res.cookies.set('zion_admin_ui', '1', {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_S,
    });
    return res;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
