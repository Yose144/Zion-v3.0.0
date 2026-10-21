import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAdminSession } from '@/lib/admin-session';
import { assertSameOrigin } from '@/lib/csrf';

function keyMatches(provided: string, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Require admin privileges. Accepts, in order:
 *   1. `x-api-key` / `Authorization: Bearer` == ADMIN_API_KEY (server-to-server)
 *   2. `zion_admin_session` httpOnly cookie (browser, set by /api/admin/login)
 * Cookie-authenticated mutations also pass through the same-origin check.
 * Returns null if authorized, otherwise a 401/403/500 response.
 */
export function requireAdminAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY;

  const provided =
    request.headers.get('x-api-key') ??
    (request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7)
      : '');

  if (expected && keyMatches(provided, expected)) return null;

  const session = getAdminSession(request);
  if (session) {
    const csrf = assertSameOrigin(request);
    if (csrf) return csrf;
    return null;
  }

  if (!expected) {
    console.error('ADMIN_API_KEY is not configured');
    return NextResponse.json(
      { success: false, error: 'Admin API key not configured' },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
