import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-guard';
import { documentsWithLinks } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const period = parseInt(url.searchParams.get('period') ?? String(new Date().getFullYear()), 10);

  const data = await documentsWithLinks(period);
  return NextResponse.json({ success: true, data });
}
