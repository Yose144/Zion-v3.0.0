import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  loadExpectation,
  markShopOrderPaid,
} from '@/lib/shop-zionpay';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shop/zion-confirm — internal endpoint called by the
 * zion-l1-watcher service after a SHOPPAY:<orderId> memo tx reaches
 * finality. Authenticated by a shared secret (SHOP_CONFIRM_SECRET env);
 * never exposed publicly.
 *
 * Body: { orderId, txHash, amountFlowers, height, sender }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SHOP_CONFIRM_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Confirm endpoint not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      orderId?: string;
      txHash?: string;
      amountFlowers?: string;
      height?: number;
      sender?: string;
    };

    if (!body.orderId || !body.txHash) {
      return NextResponse.json({ success: false, error: 'Missing orderId or txHash' }, { status: 400 });
    }

    const order = await prisma.shopOrder.findFirst({ where: { orderId: body.orderId } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.payment !== 'zion' && order.payment !== 'crypto') {
      return NextResponse.json({ success: false, error: 'Order is not a ZION payment' }, { status: 409 });
    }

    // Verify the paid amount against the stored expectation
    const exp = await loadExpectation(body.orderId);
    if (exp) {
      const paid = BigInt(String(body.amountFlowers ?? '0'));
      const expected = BigInt(exp.expectedFlowers);
      if (paid < expected) {
        // Underpayment — record it but do NOT mark paid; admin resolves manually.
        const hist = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
        hist.push({
          status: order.status,
          paymentStatus: 'underpaid',
          at: new Date().toISOString(),
          by: 'l1-watcher',
          tx: body.txHash,
          note: `paid ${paid} < expected ${expected} flowers`,
        });
        await prisma.shopOrder.update({
          where: { id: order.id },
          data: { paymentStatus: 'underpaid', statusHistory: hist },
        });
        return NextResponse.json({
          success: true,
          data: { state: 'underpaid', paid: paid.toString(), expected: expected.toString() },
        });
      }
    }

    const res = await markShopOrderPaid(body.orderId, {
      by: 'l1-watcher',
      txRef: body.txHash,
      note: `ZION L1 payment confirmed at height ${body.height ?? '?'} (from ${body.sender ?? '?'})`,
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: res.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { state: 'paid', already: res.already ?? false },
    });
  } catch (error) {
    console.error('zion-confirm error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
