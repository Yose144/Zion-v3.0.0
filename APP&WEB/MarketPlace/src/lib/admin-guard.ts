import { NextRequest, NextResponse } from 'next/server';

/**
 * Timing-safe comparison for the admin API key.
 * Returns null if the key is valid, otherwise a 401/500 response.
 */
export function requireAdminAuth(
  request: NextRequest
): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    console.error('ADMIN_API_KEY is not configured');
    return NextResponse.json(
      { success: false, error: 'Admin API key not configured' },
      { status: 500 }
    );
  }

  const provided = request.headers.get('x-api-key') ?? '';
  if (provided.length !== expected.length) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  try {
    if (!require('crypto').timingSafeEqual(a, b)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null;
}
