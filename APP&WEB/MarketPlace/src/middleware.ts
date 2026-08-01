import { NextRequest, NextResponse } from 'next/server';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

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

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';

  // Preflight
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(origin || '*');
    return new NextResponse(null, { status: 204, headers });
  }

  const isAdminRoute = request.nextUrl.pathname.startsWith('/api/admin/');

  // Admin API protection
  if (isAdminRoute) {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ADMIN_API_KEY not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const apiKey = request.headers.get('X-API-Key') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (bearer !== ADMIN_API_KEY && apiKey !== ADMIN_API_KEY) {
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
