import { NextRequest, NextResponse } from 'next/server';

// Keep in sync with ADMIN_SESSION_COOKIE in src/lib/admin-session.ts —
// imported literally because the session module needs node:crypto which
// is unavailable in the Edge runtime middleware bundle.
const ADMIN_SESSION_COOKIE = 'zion_admin_session';

const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) return true;
  if (origin.endsWith('zionterranova.com') || origin.includes('.zionterranova.com')) return true;
  return false;
};

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Allow-Credentials': 'true',
});

/**
 * Coarse pre-filter for /api/admin/*. The authoritative check lives in
 * each route handler via requireAdminAuth (Node runtime — verifies the
 * HMAC session signature or the API key). Middleware runs in the Edge
 * runtime where node:crypto is unavailable, so it only checks presence.
 */
export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';

  // Preflight
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(origin || '*');
    return new NextResponse(null, { status: 204, headers });
  }

  const isAdminRoute = request.nextUrl.pathname.startsWith('/api/admin/');
  const isPublicAdminRoute =
    request.nextUrl.pathname === '/api/admin/login' ||
    request.nextUrl.pathname === '/api/admin/logout';

  if (isAdminRoute && !isPublicAdminRoute) {
    const authHeader = request.headers.get('Authorization') || '';
    const apiKey = request.headers.get('X-API-Key') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const hasSession = request.cookies.has(ADMIN_SESSION_COOKIE);
    const configured = process.env.ADMIN_API_KEY;

    const keyOk = configured && (bearer === configured || apiKey === configured);
    if (!keyOk && !hasSession) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.next();

  if (isAllowedOrigin(origin)) {
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/shop/:path*', '/api/stripe/:path*'],
};
