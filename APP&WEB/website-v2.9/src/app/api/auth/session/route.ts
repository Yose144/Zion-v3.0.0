/**
 * GET /api/auth/session
 *
 * Returns the current session if the user is authenticated.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, AUTH_COOKIE } from '@/lib/auth';
import { getUserByAddress } from '@/lib/auth-storage';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Get fresh user data
  const user = await getUserByAddress(session.sub);

  return NextResponse.json({
    authenticated: true,
    user: user ? {
      id: user.id,
      address: user.walletAddress,
      displayName: user.displayName,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
    } : {
      address: session.sub,
      displayName: session.name,
    },
  });
}
