import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { orderId: string };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = context.params;
    const order = await prisma.shopOrder.findFirst({
      where: { orderId },
      include: { invoices: { select: { id: true, invoiceNumber: true, status: true, html: true } } },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const items = Array.isArray(order.items) ? (order.items as unknown[]) : [];
    const safeItems = items.map((it) => {
      const raw = it as Record<string, unknown>;
      return {
        name: String(raw.name ?? 'Produkt'),
        quantity: Math.max(1, Math.round((raw.quantity as number) || 1)),
        priceCzk: Math.round((raw.priceCzk as number) || 0),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalCzk: order.totalCzk,
        shippingCzk: order.shippingCzk,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shipping: order.shipping,
        payment: order.payment,
        addressStreet: order.addressStreet,
        addressCity: order.addressCity,
        addressZip: order.addressZip,
        pickupPoint: order.pickupPoint,
        note: order.note,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        items: safeItems,
        invoices: order.invoices,
      },
    });
  } catch (error) {
    console.error('Failed to get shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get order' },
      { status: 500 }
    );
  }
}
