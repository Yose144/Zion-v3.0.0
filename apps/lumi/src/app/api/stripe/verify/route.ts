import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { markOrderPaid } from '@/lib/orders-server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Ověření po návratu ze Stripe (kdyby webhook dorazil později). */
export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return NextResponse.json({ success: false, error: 'Stripe není nakonfigurován.' }, { status: 503 });

  const rl = rateLimit(`stripe-verify:${clientIp(request)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false, error: 'Příliš mnoho pokusů.' }, { status: 429 });

  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? '').trim();
  if (!sessionId) return NextResponse.json({ success: false, error: 'Chybí session.' }, { status: 400 });

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });

    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order) return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (paid) await markOrderPaid(orderId, 'stripe-verify');

    return NextResponse.json({ success: true, data: { orderId, paid } });
  } catch (error) {
    console.error('Stripe verify failed:', error);
    return NextResponse.json({ success: false, error: 'Ověření platby selhalo.' }, { status: 502 });
  }
}
