import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildInvoiceHtml, generateInvoiceNumber } from '@/lib/invoice';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const BANK_ACCOUNT = 'CZ680600000000259251079';

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
    const dueDays = Math.max(1, body?.dueDays ?? 14);

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + dueDays);

    const invoiceNumber = await generateInvoiceNumber(issueDate);
    const vs = order.orderId.match(/(\d{10)/)?.[1] ?? order.orderId.replace(/\D/g, '').slice(0, 10);
    const qrData = `SPD*1.0*ACC:${BANK_ACCOUNT}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}*X-VS:${vs}`;
    const qrSvg = await QRCode.toString(qrData, { type: 'svg', margin: 2, width: 280 });
    const qrCodeData = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;

    const items = Array.isArray(order.items) ? (order.items as unknown[]) : [];
    const typedItems = items.map((it) => ({
      name: String((it as Record<string, unknown>).name ?? 'Produkt'),
      quantity: Math.max(1, Math.round((it as Record<string, unknown>).quantity as number) || 1),
      priceCzk: Math.round((it as Record<string, unknown>).priceCzk as number) || 0,
    }));

    const html = buildInvoiceHtml({
      invoiceNumber,
      orderId: order.orderId,
      issueDate,
      dueDate,
      customerName: order.customerName,
      customerAddress: {
        street: order.addressStreet ?? undefined,
        city: order.addressCity ?? undefined,
        zip: order.addressZip ?? undefined,
      },
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentMethod: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: typedItems,
      bankAccount: '259251079/0600',
      variableSymbol: vs,
      qrCodeData,
    });

    // Deactivate any previous draft invoices for this order
    await prisma.invoice.updateMany({
      where: { orderId: order.id, status: 'draft' },
      data: { status: 'cancelled' },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        status: 'issued',
        totalCzk: order.totalCzk,
        vatCzk: Math.round(order.totalCzk - order.totalCzk / 1.21),
        dueDate,
        issuedAt: issueDate,
        html,
      },
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
