import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const client = stripe();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Platba kartou není dostupná.' }, { status: 503 });
  }
  const rl = rateLimit(`stripe:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false, error: 'Příliš mnoho pokusů.' }, { status: 429 });

  let body: { orderId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const orderId = String(body.orderId ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!orderId || !email) {
    return NextResponse.json({ success: false, error: 'Chybí objednávka nebo e-mail.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order || order.customerEmail.toLowerCase() !== email) {
    return NextResponse.json({ success: false, error: 'Objednávka nenalezena.' }, { status: 404 });
  }
  if (order.paymentStatus === 'paid') {
    return NextResponse.json({ success: false, error: 'Objednávka je už zaplacená.' }, { status: 409 });
  }
  if (order.payment !== 'card') {
    return NextResponse.json({ success: false, error: 'Objednávka není určena pro platbu kartou.' }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumi.zionterranova.com';
  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.customerEmail,
      client_reference_id: order.orderId,
      metadata: { orderId: order.orderId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'czk',
            unit_amount: order.totalCzk * 100,
            product_data: {
              name: `Lumi — objednávka ${order.orderId}`,
              description: 'Dřevěný lampion Lumi',
            },
          },
        },
      ],
      success_url: `${site}/objednavka/${encodeURIComponent(order.orderId)}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/kosik`,
    });
    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error('Stripe checkout failed:', error);
    return NextResponse.json({ success: false, error: 'Platební bránu se nepodařilo otevřít.' }, { status: 502 });
  }
}
