import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { sendPaymentConfirmation, sendShippingNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const body = (await request.json()) as {
      status?: string;
      paymentStatus?: string;
      note?: string;
    };

    const before = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
    });
    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = {};
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      update.status = body.status;
      if (body.status === 'paid') {
        update.paymentStatus = 'paid';
        update.paidAt = new Date();
      }
      if (body.status === 'shipped' && !('shippedAt' in update)) {
        update.shippedAt = new Date();
      }
    }
    if (body.paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid paymentStatus: ${body.paymentStatus}` },
          { status: 400 }
        );
      }
      update.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'paid') update.paidAt = new Date();
    }
    if (body.note !== undefined) update.note = body.note;

    // Audit trail (V2 parity): append the transition to statusHistory.
    const prevHist = Array.isArray(before.statusHistory) ? before.statusHistory : [];
    update.statusHistory = [
      ...prevHist,
      {
        status: (update.status as string) ?? before.status,
        paymentStatus: (update.paymentStatus as string) ?? before.paymentStatus,
        note: body.note ?? null,
        at: new Date().toISOString(),
        by: 'admin',
      },
    ];

    const order = await prisma.shopOrder.updateMany({
      where: { OR: [{ id }, { orderId: id }] },
      data: update,
    });

    if (order.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: { invoices: true },
    });

    // Bank-transfer soft-launch: admin "mark paid" must notify customer (V2 parity).
    const becamePaid =
      updated &&
      updated.paymentStatus === 'paid' &&
      before.paymentStatus !== 'paid';
    if (becamePaid) {
      void sendPaymentConfirmation({
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
        customerWalletAddress: updated.customerWalletAddress,
        customerWalletId: updated.orderId,
      }).catch((err) => console.error('mark-paid email failed:', err));
    }

    // Status → shipped without separate shipping API still notifies when possible.
    const becameShipped =
      updated &&
      updated.status === 'shipped' &&
      before.status !== 'shipped' &&
      Boolean(updated.trackingNumber);
    if (becameShipped && updated) {
      void sendShippingNotification({
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
      }).catch((err) => console.error('shipped email failed:', err));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
