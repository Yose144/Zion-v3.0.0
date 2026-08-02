import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }, { order: { orderId: id } }] },
      include: { order: true },
    });

    if (!invoice || !invoice.html) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Content-Disposition', `inline; filename="faktura-${invoice.invoiceNumber}.html"`);

    return new NextResponse(invoice.html, { status: 200, headers });
  } catch (error) {
    console.error('Failed to load invoice:', error);
    return NextResponse.json({ success: false, error: 'Failed to load invoice' }, { status: 500 });
  }
}
