import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { getTokenDistribution } from '@/lib/tokens';
import { distributeOrderBonus } from '@/lib/bonus-payout';

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

    if (!dist || dist.status === 'sending') {
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

// POST /api/admin/tokens/distribute/[id] — manual retry of the same paid-only payout
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const body = (await request.json().catch(() => ({}))) as { txHash?: string };
    const result = await distributeOrderBonus(id, { txHash: body.txHash });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    if (result.skipped === 'unpaid') {
      return NextResponse.json(
        { success: false, error: 'Order is not paid' },
        { status: 409 }
      );
    }
    if (result.skipped === 'no-tokens') {
      return NextResponse.json(
        { success: false, error: 'No tokens to distribute' },
        { status: 400 }
      );
    }
    if (result.skipped === 'no-wallet') {
      return NextResponse.json(
        { success: false, error: 'Order has no customer wallet' },
        { status: 400 }
      );
    }
    if (result.already) {
      return NextResponse.json(
        { success: false, error: 'Tokens already distributed', txHash: result.txHash },
        { status: 409 }
      );
    }
    if (result.skipped === 'busy') {
      return NextResponse.json(
        { success: false, error: 'Payout already in progress' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      tokens: result.tokens,
      status: 'distributed',
      txHash: result.txHash,
    });
  } catch (error) {
    console.error('Token distribution failed:', error);
    return NextResponse.json({ success: false, error: 'Distribution failed' }, { status: 500 });
  }
}
