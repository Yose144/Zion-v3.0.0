/**
 * PATCH /api/auth/profile
 *
 * Update user profile (display name).
 * Requires authentication.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, AUTH_COOKIE, createSession } from '@/lib/auth';
import { updateUserName } from '@/lib/auth-storage';

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const { displayName } = await req.json();
    if (typeof displayName !== 'string' || displayName.length > 50) {
      return NextResponse.json({ error: 'Display name must be 1-50 characters' }, { status: 400 });
    }

    const user = await updateUserName(session.sub, displayName);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Re-issue JWT with updated name
    const jwt = await createSession(session.sub, user.displayName);
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        address: user.walletAddress,
        displayName: user.displayName,
      },
    });
    response.cookies.set(AUTH_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
