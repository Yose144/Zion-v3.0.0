import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { orderToLike, publicOrder } from '@/lib/order';
import { appendHistory, markOrderPaid } from '@/lib/orders-server';
import { sendShippingNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

async function findOrder(id: string) {
  return prisma.order.findFirst({ where: { OR: [{ id }, { orderId: id }] } });
}

export async function GET(request: NextRequest, context: Ctx) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const { id } = await context.params;
  const order = await findOrder(id);
  if (!order) return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...order, items: JSON.parse(order.items) } });
}

const STATUSES = new Set(['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled']);

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const { id } = await context.params;

  let body: {
    status?: string;
    paymentStatus?: string;
    trackingNumber?: string | null;
    note?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const existing = await findOrder(id);
  if (!existing) return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });

  if (body.paymentStatus === 'paid') {
    await markOrderPaid(existing.orderId, 'admin');
  }

  const data: Record<string, unknown> = {};
  if (body.note !== undefined) data.note = body.note ? String(body.note).slice(0, 2000) : null;
  if (body.trackingNumber !== undefined) {
    data.trackingNumber = body.trackingNumber ? String(body.trackingNumber).slice(0, 80) : null;
  }

  let shouldNotifyShipping = false;
  if (body.status) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ success: false, error: 'Neplatný stav.' }, { status: 400 });
    }
    data.status = body.status;
    data.statusHistory = appendHistory(existing.statusHistory, {
      status: body.status,
      at: new Date().toISOString(),
      by: 'admin',
    });
    if (body.status === 'shipped') {
      data.shippedAt = new Date();
      shouldNotifyShipping = existing.status !== 'shipped';
    }
  }

  const updated = await prisma.order.update({ where: { id: existing.id }, data });
  if (shouldNotifyShipping) {
    void sendShippingNotification(orderToLike(updated)).catch((error) => console.error(error));
  }

  return NextResponse.json({
    success: true,
    data: { ...publicOrder(updated), fireConsentName: updated.fireConsentName },
  });
}
