import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

/**
 * POST /api/shop/commerce/checkout — create a Coinbase Commerce charge
 * for an existing order. Returns the hosted checkout URL (QR code page
 * where the customer pays with any wallet/exchange — no MetaMask needed).
 *
 * Env: COMMERCE_API_KEY — Coinbase Commerce API key (fail-closed).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`commerce-co:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const apiKey = process.env.COMMERCE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Crypto checkout not configured' },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as { orderId?: string; email?: string };
    if (!body.orderId || body.orderId.length > 64) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const order = await prisma.shopOrder.findFirst({ where: { orderId: body.orderId } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ success: false, error: 'Order already paid' }, { status: 409 });
    }

    const res = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify({
        name: `ZION Market — objednávka ${order.orderId}`,
        description: `E-shop objednávka ${order.orderId}`,
        pricing_type: 'fixed_price',
        local_price: { amount: String(order.totalCzk), currency: 'CZK' },
        metadata: { order_id: order.orderId },
        redirect_url: `${SITE_URL}/order-success?order=${encodeURIComponent(order.orderId)}`,
        cancel_url: `${SITE_URL}/cart`,
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      data?: { id?: string; code?: string; hosted_url?: string };
      error?: { message?: string };
    } | null;

    if (!res.ok || !json?.data?.hosted_url) {
      console.error('Commerce charge failed:', res.status, json?.error?.message);
      return NextResponse.json(
        { success: false, error: json?.error?.message ?? 'Charge creation failed' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        chargeId: json.data.id,
        code: json.data.code,
        hostedUrl: json.data.hosted_url,
      },
    });
  } catch (error) {
    console.error('Commerce checkout error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
