import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import {
  getTokenDistribution,
  recordTokenDistribution,
} from '@/lib/tokens';
import { sendTokenBonusEmail } from '@/lib/email';
import { sendZionPayout } from '@/lib/zion-l1';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

function orderSelect() {
  return {
    id: true,
    orderId: true,
    zionTokens: true,
    customerEmail: true,
    customerName: true,
    customerWalletAddress: true,
    status: true,
    paymentStatus: true,
  } as const;
}

// GET /api/admin/tokens/distribute/[id] — status
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      select: orderSelect(),
    });

    if (!order) {
      return NextResponse.json({ found: false, error: 'Order not found' }, { status: 404 });
    }

    const dist = await getTokenDistribution(order.orderId);

    if (!dist) {
      return NextResponse.json({
        found: true,
        tokens: order.zionTokens,
        status: 'pending',
      });
    }

    return NextResponse.json({
      found: true,
      ...dist,
      tokens: order.zionTokens,
    });
  } catch (error) {
    console.error('Token status check failed:', error);
    return NextResponse.json({ found: false, error: 'Status check failed' }, { status: 500 });
  }
}

// POST /api/admin/tokens/distribute/[id] — distribute
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const body = (await request.json().catch(() => ({}))) as { txHash?: string };

    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      select: orderSelect(),
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.zionTokens <= 0) {
      return NextResponse.json({ success: false, error: 'No tokens to distribute' }, { status: 400 });
    }

    const existing = await getTokenDistribution(order.orderId);
    if (existing?.status === 'distributed') {
      return NextResponse.json({
        success: false,
        error: 'Tokens already distributed',
        data: existing,
      }, { status: 409 });
    }

    let txHash: string | undefined = body.txHash;

    // If the order has a customer L1 wallet, broadcast the ZION payout on-chain.
    if (!txHash && order.customerWalletAddress) {
      const memo = `BONUS:${order.orderId}`;
      const amountZion = order.zionTokens / 1_000_000; // tokens are flowers (6 decimals)
      const payout = await sendZionPayout(
        order.customerWalletAddress,
        amountZion,
        undefined,
        memo
      );
      if (!payout.success) {
        return NextResponse.json(
          { success: false, error: payout.error ?? 'On-chain payout failed' },
          { status: 502 }
        );
      }
      txHash = payout.txHash;
    }

    const distribution = await recordTokenDistribution(
      order.orderId,
      order.zionTokens,
      order.customerEmail,
      txHash
    );

    // Notify customer in the background
    sendTokenBonusEmail({
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      tokens: order.zionTokens,
      txHash: distribution.txHash,
    }).catch((err) => console.error('Failed to send token bonus email:', err));

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      tokens: order.zionTokens,
      status: 'distributed',
      txHash: distribution.txHash,
      distributedAt: distribution.distributedAt,
    });
  } catch (error) {
    console.error('Token distribution failed:', error);
    return NextResponse.json({ success: false, error: 'Distribution failed' }, { status: 500 });
  }
}
