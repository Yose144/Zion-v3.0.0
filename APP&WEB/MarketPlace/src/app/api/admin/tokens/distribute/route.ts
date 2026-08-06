import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * Token distribution endpoint.
 * Marks bonus ZION tokens as "distributed" for a specific order or all pending orders.
 *
 * In the current marketplace, ZION bonus tokens are tracked per-order (zionTokens field).
 * This endpoint manages the distribution status — when MainNet is ready, tokens are sent
 * to customer wallets. Until then, we track distribution status.
 */

interface RouteContext {
  params: { id: string };
}

// Mark a single order's tokens as distributed
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const body = await request.json().catch(() => ({}));
    const txHash = body.txHash as string | undefined;

    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      select: { id: true, orderId: true, zionTokens: true, customerEmail: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.zionTokens <= 0) {
      return NextResponse.json({ success: false, error: 'No tokens to distribute' }, { status: 400 });
    }

    // Store distribution status
    await prisma.shopSetting.upsert({
      where: { key: `tokens:${order.orderId}` },
      update: {
        value: JSON.stringify({
          status: 'distributed',
          tokens: order.zionTokens,
          txHash: txHash ?? 'pending',
          distributedAt: new Date().toISOString(),
          customerEmail: order.customerEmail,
        }),
      },
      create: {
        key: `tokens:${order.orderId}`,
        value: JSON.stringify({
          status: 'distributed',
          tokens: order.zionTokens,
          txHash: txHash ?? 'pending',
          distributedAt: new Date().toISOString(),
          customerEmail: order.customerEmail,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      tokens: order.zionTokens,
      status: 'distributed',
    });
  } catch (error) {
    console.error('Token distribution failed:', error);
    return NextResponse.json({ success: false, error: 'Distribution failed' }, { status: 500 });
  }
}

// Get distribution status for an order
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;

    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      select: { orderId: true, zionTokens: true },
    });

    if (!order) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const setting = await prisma.shopSetting.findUnique({
      where: { key: `tokens:${order.orderId}` },
    });

    if (!setting) {
      return NextResponse.json({
        found: true,
        tokens: order.zionTokens,
        status: 'pending',
      });
    }

    const data = JSON.parse(setting.value);
    return NextResponse.json({
      found: true,
      tokens: order.zionTokens,
      ...data,
    });
  } catch (error) {
    console.error('Token status check failed:', error);
    return NextResponse.json({ found: false, error: 'Status check failed' }, { status: 500 });
  }
}
