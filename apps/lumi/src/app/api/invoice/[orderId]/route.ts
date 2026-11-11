import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionValue, ADMIN_COOKIE } from '@/lib/admin';
import { renderInvoiceHtml } from '@/lib/invoice';
import { orderToLike } from '@/lib/order';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ orderId: string }>;
}

/**
 * Faktura jako HTML. Přístup má zákazník se správným e-mailem (odkaz
 * z potvrzení) nebo přihlášený admin. Bez jednoho z toho vracíme 404,
 * ne 401 — nechceme potvrzovat, že objednávka existuje.
 */
export async function GET(request: NextRequest, context: Ctx) {
  const { orderId } = await context.params;
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? '';
  const isAdmin = verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value);

  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) {
    return new NextResponse('Objednávka nenalezena.', { status: 404 });
  }
  if (!isAdmin && (!email || order.customerEmail.toLowerCase() !== email)) {
    return new NextResponse('Objednávka nenalezena.', { status: 404 });
  }

  return new NextResponse(renderInvoiceHtml(orderToLike(order)), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
