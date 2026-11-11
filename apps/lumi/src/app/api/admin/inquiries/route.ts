import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const search = request.nextUrl.searchParams;
  const status = search.get('status') ?? '';
  const limit = Math.min(200, Math.max(1, Number(search.get('limit') ?? 100) || 100));

  const inquiries = await prisma.inquiry.findMany({
    where: status && status !== 'all' ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const counts = await prisma.inquiry.groupBy({ by: ['status'], _count: { _all: true } });

  return NextResponse.json({
    success: true,
    data: inquiries,
    meta: {
      counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  let body: { id?: string; status?: string; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ success: false, error: 'Chybí id.' }, { status: 400 });
  const allowed = new Set(['new', 'contacted', 'won', 'lost']);
  if (body.status && !allowed.has(body.status)) {
    return NextResponse.json({ success: false, error: 'Neplatný stav.' }, { status: 400 });
  }
  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.note !== undefined ? { note: body.note ? String(body.note).slice(0, 2000) : null } : {}),
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
