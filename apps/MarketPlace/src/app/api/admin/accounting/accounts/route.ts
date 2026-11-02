import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { seedChartOfAccounts } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const accounts = await prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
  return NextResponse.json({ success: true, data: accounts });
}

// POST = seed směrné účtové osnovy (idempotentní)
export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const result = await seedChartOfAccounts();
  return NextResponse.json({ success: true, data: result });
}
