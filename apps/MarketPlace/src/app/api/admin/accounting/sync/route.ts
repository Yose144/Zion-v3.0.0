import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-guard';
import { syncOrdersToLedger } from '@/lib/accounting';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const result = await syncOrdersToLedger();
    return NextResponse.json({ success: result.errors.length === 0, data: result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Sync selhal' },
      { status: 500 }
    );
  }
}
