import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publicOrder } from '@/lib/order';
import { bankPaymentData } from '@/lib/qr';
import { variableSymbolFor } from '@/lib/settings';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ orderId: string }>;
}

export async function GET(request: NextRequest, context: Ctx) {
  const rl = rateLimit(`track:${clientIp(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Příliš mnoho pokusů.' }, { status: 429 });
  }

  const { orderId } = await context.params;
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? '';
  if (!email) {
    return NextResponse.json({ success: false, error: 'Zadejte e-mail.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order || order.customerEmail.toLowerCase() !== email) {
    return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });
  }

  const bank =
    order.payment === 'transfer' && order.paymentStatus !== 'paid'
      ? await bankPaymentData(order.totalCzk, order.variableSymbol ?? variableSymbolFor(order.orderId), order.orderId)
      : null;

  return NextResponse.json(
    { success: true, data: { order: publicOrder(order), bank } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
