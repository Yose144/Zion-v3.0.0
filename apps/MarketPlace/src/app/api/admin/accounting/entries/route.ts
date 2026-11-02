import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { postEntry, type PostingLine } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const period = parseInt(url.searchParams.get('period') ?? '', 10);
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10) || 100);

  const entries = await prisma.ledgerEntry.findMany({
    where: Number.isFinite(period) ? { period } : {},
    include: { lines: true },
    orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
    take: limit,
  });
  return NextResponse.json({ success: true, data: entries });
}

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const lines: PostingLine[] = (body.lines ?? []).map((l: Record<string, unknown>) => ({
      accountCode: String(l.accountCode ?? ''),
      side: l.side === 'DAL' ? 'DAL' : 'MD',
      amountHal: Math.round(Number(l.amountHal) || 0),
    }));

    const result = await postEntry({
      date: body.date ? new Date(body.date) : new Date(),
      description: String(body.description ?? ''),
      documentRef: body.documentRef ?? null,
      sourceType: 'manual',
      lines,
      postedBy: body.postedBy ?? 'admin',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Neplatný doklad' },
      { status: 400 }
    );
  }
}
