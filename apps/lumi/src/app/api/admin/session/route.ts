import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminConfigured, verifySessionValue } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authenticated = verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json(
    { success: true, data: { authenticated, configured: adminConfigured() } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
