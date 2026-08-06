import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

// GET /api/invoice/[id]/download — serve invoice HTML or PDF
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const format = request.nextUrl.searchParams.get('format') ?? 'html';

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: { order: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (!invoice.html) {
      return NextResponse.json(
        { success: false, error: 'Invoice HTML not available' },
        { status: 404 }
      );
    }

    if (format === 'pdf') {
      const pdf = await generateInvoicePdf(invoice.html);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(invoice.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to serve invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve invoice' },
      { status: 500 }
    );
  }
}
