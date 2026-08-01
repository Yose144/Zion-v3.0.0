import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    if (stripe && webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } else if (stripe) {
      // Fallback without signature verification (dev / missing secret)
      event = JSON.parse(payload) as Stripe.Event;
    } else {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Stripe webhook signature error:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          const now = new Date();
          await prisma.shopOrder.updateMany({
            where: { orderId },
            data: {
              status: 'paid',
              paymentStatus: 'paid',
              paidAt: now,
            },
          });
          await prisma.invoice.updateMany({
            where: { order: { orderId } },
            data: { status: 'paid', paidAt: now },
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await prisma.shopOrder.updateMany({
            where: { orderId },
            data: { paymentStatus: 'failed' },
          });
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
