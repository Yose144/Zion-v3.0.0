import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getZisUrl(): string {
  return (
    process.env.ZIS_URL ||
    process.env.NEXT_PUBLIC_ZIS_URL ||
    'https://auth.zionterranova.com'
  ).replace(/\/+$/, '');
}

function getSessionCookie(request: NextRequest): string | undefined {
  return request.cookies.get('zion_session')?.value;
}

function pruneRateLimitMap(now: number): void {
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetAt) rateLimitMap.delete(key);
  }
}

function isRateLimited(ip: string): { limited: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    if (entry) rateLimitMap.delete(ip);
    if (rateLimitMap.size > 1000 && Math.random() < 0.01) {
      pruneRateLimitMap(now);
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, remaining: 0 };
  }

  if (rateLimitMap.size > 1000 && Math.random() < 0.01) {
    pruneRateLimitMap(now);
  }

  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

function unauthorizedResponse(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ZION Admin"',
      'Cache-Control': 'no-store',
    },
  });
}

const PROTECTED_PATHS = [
  '/account',
  '/dashboard/private',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function requireAuthRedirect(request: NextRequest, pathname: string) {
  const token = getSessionCookie(request);
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const res = await fetch(`${getZisUrl()}/api/auth/me`, {
      headers: {
        Accept: 'application/json',
        Cookie: `zion_session=${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`ZIS session invalid: ${res.status}`);
    }
  } catch {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Protected pages (ZIS auth) ──────────────────────────────────
  if (isProtected(pathname)) {
    return requireAuthRedirect(request, pathname);
  }

  // ── API rate limiting ───────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const { limited, remaining } = isRateLimited(ip);

    if (limited) {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfterSeconds: 60 }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    return response;
  }

  // ── /admin protection (Basic Auth) ────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminUser = process.env.ADMIN_USER || 'admin';

    if (!adminPassword) {
      console.warn('[SECURITY] ADMIN_PASSWORD not set — /admin access DENIED');
      return new Response('Admin panel disabled: ADMIN_PASSWORD not configured', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return unauthorizedResponse();
    }

    try {
      const base64Credentials = authHeader.slice('Basic '.length);
      const decoded = atob(base64Credentials);
      const separatorIndex = decoded.indexOf(':');
      const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : '';
      const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

      if (username !== adminUser || password !== adminPassword) {
        return unauthorizedResponse();
      }

      return NextResponse.next();
    } catch {
      return unauthorizedResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/account/:path*',
    '/dashboard/private/:path*',
  ],
};
