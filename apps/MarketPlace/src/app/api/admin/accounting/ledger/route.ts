import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-guard';
import { generalLedger } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const account = (url.searchParams.get('account') ?? '').trim();
  const period = parseInt(url.searchParams.get('period') ?? String(new Date().getFullYear()), 10);

  if (!account) {
    return NextResponse.json(
      { success: false, error: 'Chybí parametr account (číslo účtu)' },
      { status: 400 }
    );
  }

  const data = await generalLedger(account, period);
  if (!data) {
    return NextResponse.json(
      { success: false, error: `Účet ${account} není v účtovém rozvrhu` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
