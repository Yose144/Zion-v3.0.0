import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { parseItems, publicOrder } from '@/lib/order';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const search = request.nextUrl.searchParams;
  const status = search.get('status') ?? '';
  const q = search.get('q')?.trim() ?? '';
  const limit = Math.min(100, Math.max(1, Number(search.get('limit') ?? 50) || 50));
  const offset = Math.max(0, Number(search.get('offset') ?? 0) || 0);

  const where = {
    ...(status && status !== 'all' ? { status } : {}),
    ...(q
      ? {
          OR: [
            { orderId: { contains: q } },
            { customerEmail: { contains: q } },
            { customerName: { contains: q } },
            { invoiceNumber: { contains: q } },
          ],
        }
      : {}),
  };

  const [orders, total, pending, paid, shipped] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.order.count({ where }),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.order.count({ where: { paymentStatus: 'paid' } }),
    prisma.order.count({ where: { status: 'shipped' } }),
  ]);

  const revenue = await prisma.order.aggregate({
    where: { paymentStatus: 'paid' },
    _sum: { totalCzk: true },
  });

  return NextResponse.json({
    success: true,
    data: orders.map((order) => ({
      ...publicOrder(order),
      items: parseItems(order.items),
      invoiceNumber: order.invoiceNumber,
      companyName: order.companyName,
      buyerIco: order.buyerIco,
      buyerDic: order.buyerDic,
      fireConsentName: order.fireConsentName,
      fireConsentVersion: order.fireConsentVersion,
      newsletter: order.newsletter,
    })),
    meta: {
      total,
      limit,
      offset,
      pending,
      paid,
      shipped,
      revenueCzk: revenue._sum.totalCzk ?? 0,
    },
  });
}
