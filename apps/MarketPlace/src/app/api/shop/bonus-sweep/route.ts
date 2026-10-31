import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { distributeOrderBonus } from '@/lib/bonus-payout';
import { getTokenDistribution } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 100;
const DEFAULT_BATCH = 25;

/**
 * POST /api/shop/bonus-sweep — internal automation endpoint called by the
 * zion-l1-watcher service. Finds paid orders with a ZION bonus that has not
 * been distributed yet and pays them from the canonical payout wallet.
 * Covers: backfill of orders paid before auto-payout existed, transient
 * payout failures, and orders that received a wallet only lazily.
 *
 * Auth: Bearer SHOP_CONFIRM_SECRET (same shared secret as zion-confirm).
 * Body: { limit?: number } — max orders per pass (default 25, cap 100).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SHOP_CONFIRM_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Sweep endpoint not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(
      MAX_BATCH,
      Math.max(1, Number.isInteger(body.limit) ? (body.limit as number) : DEFAULT_BATCH),
    );

    // Cancelled orders never receive a bonus (manual refund path instead).
    const candidates = await prisma.shopOrder.findMany({
      where: {
        paymentStatus: 'paid',
        zionTokens: { gt: 0 },
        status: { not: 'cancelled' },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { orderId: true, zionTokens: true },
    });

    const results: Array<{
      orderId: string;
      tokens: number;
      outcome: 'distributed' | 'already' | 'skipped' | 'failed';
      detail?: string;
      txHash?: string;
    }> = [];

    for (const order of candidates) {
      // Skip orders whose distribution record already says 'distributed'
      // (recordTokenDistribution is the source of truth, not the order row).
      const existing = await getTokenDistribution(order.orderId);
      if (existing?.status === 'distributed') {
        results.push({ orderId: order.orderId, tokens: order.zionTokens, outcome: 'already', txHash: existing.txHash });
        continue;
      }

      const res = await distributeOrderBonus(order.orderId);
      if (!res.ok) {
        results.push({ orderId: order.orderId, tokens: order.zionTokens, outcome: 'failed', detail: res.error });
      } else if (res.already) {
        results.push({ orderId: order.orderId, tokens: order.zionTokens, outcome: 'already', txHash: res.txHash });
      } else if (res.skipped) {
        results.push({ orderId: order.orderId, tokens: order.zionTokens, outcome: 'skipped', detail: res.skipped });
      } else {
        results.push({ orderId: order.orderId, tokens: order.zionTokens, outcome: 'distributed', txHash: res.txHash });
      }
    }

    const summary = {
      checked: results.length,
      distributed: results.filter((r) => r.outcome === 'distributed').length,
      already: results.filter((r) => r.outcome === 'already').length,
      skipped: results.filter((r) => r.outcome === 'skipped').length,
      failed: results.filter((r) => r.outcome === 'failed').length,
    };

    return NextResponse.json({ success: true, data: { summary, results } });
  } catch (error) {
    console.error('bonus-sweep error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
