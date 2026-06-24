/**
 * POST /api/auth/logout
 *
 * Clears the session cookie.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
