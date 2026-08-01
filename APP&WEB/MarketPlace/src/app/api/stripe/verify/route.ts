import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const orderId = session.metadata?.order_id;
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID not found in session metadata' },
        { status: 400 }
      );
    }

    const now = new Date();
    const paymentStatus = session.payment_status;

    if (paymentStatus === 'paid') {
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
    } else if (paymentStatus === 'unpaid' && session.status === 'open') {
      // still pending
    } else {
      await prisma.shopOrder.updateMany({
        where: { orderId },
        data: { paymentStatus: 'failed' },
      });
    }

    const order = await prisma.shopOrder.findFirst({
      where: { orderId },
      include: { invoices: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        order,
        stripe: {
          status: session.status,
          paymentStatus,
          amountTotal: (session.amount_total ?? 0) / 100,
          currency: session.currency,
        },
      },
    });
  } catch (error) {
    console.error('Stripe verify error:', error);
    const message = error instanceof Error ? error.message : 'Stripe verify error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
