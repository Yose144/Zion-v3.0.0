import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      orderId: string;
      customerEmail?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!body.orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing orderId' },
        { status: 400 }
      );
    }

    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id: body.orderId }, { orderId: body.orderId }] },
      include: { invoices: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const items = Array.isArray(order.items) ? (order.items as unknown[]) : [];
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const raw of items) {
      const it = raw as Record<string, unknown>;
      const unitCzk = Math.round((it.priceCzk as number) || 0);
      const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
      lineItems.push({
        price_data: {
          currency: 'czk',
          product_data: {
            name: String(it.name ?? 'Produkt'),
            description: it.category ? String(it.category) : undefined,
          },
          unit_amount: unitCzk * 100,
        },
        quantity: qty,
      });
    }

    if ((order.shippingCzk ?? 0) > 0) {
      lineItems.push({
        price_data: {
          currency: 'czk',
          product_data: { name: 'Doprava' },
          unit_amount: (order.shippingCzk as number) * 100,
        },
        quantity: 1,
      });
    }

    // STRIPE_CRYPTO=1 → also offer Stripe's crypto (USDC stablecoin) payment
    // method on the hosted checkout page.
    const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      process.env.STRIPE_CRYPTO === '1' ? ['card', 'crypto'] : ['card'];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      line_items: lineItems,
      mode: 'payment',
      success_url:
        body.successUrl ??
        `${SITE_URL}/order-success?order=${order.orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl ?? `${SITE_URL}/cart?cancelled=1`,
      customer_email: body.customerEmail ?? order.customerEmail,
      metadata: {
        order_id: order.orderId,
      },
      locale: 'cs',
    });

    // Store session reference on the first open invoice if exists, or create a placeholder
    const openInvoice = order.invoices[0];
    if (openInvoice) {
      await prisma.invoice.update({
        where: { id: openInvoice.id },
        data: { stripeSession: session.id },
      });
    } else {
      // No invoice yet; store a reference in the order record is not available, so keep transient
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const message = error instanceof Error ? error.message : 'Stripe API error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
