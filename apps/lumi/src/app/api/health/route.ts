import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [products, orders] = await Promise.all([prisma.product.count(), prisma.order.count()]);
    return NextResponse.json({
      ok: true,
      service: 'lumi',
      db: 'ok',
      products,
      orders,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lumi health failed:', error);
    return NextResponse.json({ ok: false, db: 'error' }, { status: 500 });
  }
}
