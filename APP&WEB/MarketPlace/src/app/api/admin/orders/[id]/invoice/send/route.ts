import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: { invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const invoice = order.invoices[0];
    if (!invoice || !invoice.html) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    await sendInvoiceEmail(
      {
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shipping: order.shipping,
        payment: order.payment,
        totalCzk: order.totalCzk,
        shippingCzk: order.shippingCzk,
        items: order.items,
        addressStreet: order.addressStreet,
        addressCity: order.addressCity,
        addressZip: order.addressZip,
        pickupPoint: order.pickupPoint,
        note: order.note,
        zionTokens: order.zionTokens,
        trackingNumber: order.trackingNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      invoice.html
    );

    return NextResponse.json({ success: true, message: 'Invoice sent' });
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return NextResponse.json({ success: false, error: 'Failed to send invoice email' }, { status: 500 });
  }
}
