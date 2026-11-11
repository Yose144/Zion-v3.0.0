import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { markOrderPaid } from '@/lib/orders-server';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook. Bez `STRIPE_WEBHOOK_SECRET` se endpoint chová jako vypnutý —
 * nikdy neoznačí objednávku zaplacenou bez ověřeného podpisu.
 */
export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!key || !secret) {
    return NextResponse.json({ received: false, error: 'Stripe není nakonfigurován.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ received: false, error: 'Chybí podpis.' }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = new Stripe(key);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('Stripe webhook signature failed:', error);
    return NextResponse.json({ received: false, error: 'Neplatný podpis.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (orderId) await markOrderPaid(orderId, 'stripe');
  }

  return NextResponse.json({ received: true });
}
