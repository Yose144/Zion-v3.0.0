import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createInvoiceForOrder } from '@/lib/invoice';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

async function findOrder(id: string) {
  return prisma.shopOrder.findFirst({
    where: { OR: [{ id }, { orderId: id }] },
    include: { invoices: true },
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const order = await findOrder(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const invoice = order.invoices[0];
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Failed to get invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invoice' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const order = await findOrder(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { dueDays?: number };
    const { invoice } = await createInvoiceForOrder({
      orderId: order.orderId,
      orderDatabaseId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerAddress: {
        street: order.addressStreet ?? undefined,
        city: order.addressCity ?? undefined,
        zip: order.addressZip ?? undefined,
      },
      payment: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: order.items,
      dueDays: body?.dueDays,
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
