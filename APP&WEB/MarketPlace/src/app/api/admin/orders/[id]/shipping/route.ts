import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendShippingNotification } from '@/lib/email';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const body = (await request.json()) as {
      trackingNumber?: string;
      status?: string;
      shippedAt?: string;
    };

    const update: Record<string, unknown> = {};
    if (body.trackingNumber !== undefined) update.trackingNumber = body.trackingNumber || null;
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      update.status = body.status;
    }
    if (body.shippedAt) {
      update.shippedAt = new Date(body.shippedAt);
    } else if (body.status === 'shipped' || (!body.status && body.trackingNumber)) {
      update.shippedAt = new Date();
    }

    const updatedCount = await prisma.shopOrder.updateMany({
      where: { OR: [{ id }, { orderId: id }] },
      data: update,
    });

    if (updatedCount.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: { invoices: true },
    });

    if (updated && body.trackingNumber) {
      sendShippingNotification({
        orderId: updated.orderId,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        shipping: updated.shipping,
        payment: updated.payment,
        totalCzk: updated.totalCzk,
        shippingCzk: updated.shippingCzk,
        items: updated.items,
        addressStreet: updated.addressStreet,
        addressCity: updated.addressCity,
        addressZip: updated.addressZip,
        pickupPoint: updated.pickupPoint,
        note: updated.note,
        zionTokens: updated.zionTokens,
        trackingNumber: updated.trackingNumber,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update shipping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shipping' },
      { status: 500 }
    );
  }
}
