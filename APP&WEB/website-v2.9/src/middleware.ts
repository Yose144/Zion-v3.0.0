/**
 * Next.js middleware — protects /dashboard routes.
 *
 * Checks for the zion_session JWT cookie.
 * If missing or invalid, redirects to /login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/account'];
const LOGIN_PATH = '/login';

function getSecret(): Uint8Array {
  const secret = process.env.ZION_JWT_SECRET;
  if (!secret) {
    // Match the ephemeral secret behavior in auth.ts
    return new TextEncoder().encode('zion-dev-secret-ephemeral');
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if path is protected
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = req.cookies.get('zion_session')?.value;
  if (!token) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  try {
    const secret = getSecret();
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Invalid or expired token
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/account/:path*'],
};
