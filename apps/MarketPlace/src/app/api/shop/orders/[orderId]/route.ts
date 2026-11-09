import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = await context.params;
    const order = await prisma.shopOrder.findUnique({
      where: { orderId },
      // An order number is not authentication. Only public receipt/status data
      // is available here; invoice and paid pass delivery stays in buyer email.
      select: {
        id: true, orderId: true, status: true, paymentStatus: true,
        totalCzk: true, shippingCzk: true, payment: true, createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalCzk: order.totalCzk,
        shippingCzk: order.shippingCzk,
        payment: order.payment,
        createdAt: order.createdAt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to get shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get order' },
      { status: 500 }
    );
  }
}
