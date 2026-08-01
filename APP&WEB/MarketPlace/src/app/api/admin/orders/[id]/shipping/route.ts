import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];

export async function POST(request: NextRequest, context: RouteContext) {
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update shipping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shipping' },
      { status: 500 }
    );
  }
}
