import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const body = (await request.json()) as {
      status?: string;
      paymentStatus?: string;
      note?: string;
    };

    const update: Record<string, unknown> = {};
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      update.status = body.status;
      if (body.status === 'paid') update.paidAt = new Date();
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
