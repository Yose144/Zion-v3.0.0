import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-guard';
import { trialBalance } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const period = parseInt(url.searchParams.get('period') ?? String(new Date().getFullYear()), 10);

  const rows = await trialBalance(period);
  const mdTotal = rows.reduce((s, r) => s + r.mdHal, 0);
  const dalTotal = rows.reduce((s, r) => s + r.dalHal, 0);

  return NextResponse.json({
    success: true,
    data: { period, rows, mdTotalHal: mdTotal, dalTotalHal: dalTotal, balanced: mdTotal === dalTotal },
  });
}
