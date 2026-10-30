import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { markShopOrderPaid } from '@/lib/shop-zionpay';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shop/commerce/webhook — Coinbase Commerce webhook receiver.
 * Verifies X-CC-Webhook-Signature (HMAC-SHA256 of the raw body with the
 * shared webhook secret) and marks the order paid on charge:confirmed.
 *
 * Env: COMMERCE_WEBHOOK_SECRET — the shared secret shown in Commerce
 * settings when registering this endpoint (fail-closed when unset).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.COMMERCE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-cc-webhook-signature') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: {
        id?: string;
        code?: string;
        metadata?: { order_id?: string };
        payments?: { value?: { local?: { amount?: string } } }[];
      };
    };

    if (event.type !== 'charge:confirmed' && event.type !== 'charge:resolved') {
      // Acknowledge non-payment events without action
      return NextResponse.json({ success: true, data: { ignored: event.type } });
    }

    const orderId = event.data?.metadata?.order_id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'No order_id in metadata' }, { status: 400 });
    }

    const res = await markShopOrderPaid(orderId, {
      by: 'commerce-webhook',
      txRef: event.data?.code ?? event.data?.id,
      note: `Coinbase Commerce ${event.type} (charge ${event.data?.code ?? '?'})`,
    });

    if (!res.ok) {
      // Return 200 even for unknown order — stops Coinbase retrying forever;
      // the charge stays paid on their side and admin reconciles manually.
      console.error(`Commerce webhook: order ${orderId} not found`);
      return NextResponse.json({ success: true, data: { state: 'unknown-order' } });
    }

    return NextResponse.json({ success: true, data: { state: 'paid', already: res.already } });
  } catch (error) {
    console.error('Commerce webhook error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
