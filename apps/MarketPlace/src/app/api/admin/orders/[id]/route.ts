import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { revokeArchivePass } from '@/lib/archive-pass';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

async function findOrder(id: string) {
  const order = await prisma.shopOrder.findFirst({
    where: {
      OR: [{ id }, { orderId: id }],
    },
    include: {
      invoices: true,
    },
  });
  return order;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const order = await findOrder(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Failed to get admin order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get order' },
      { status: 500 }
    );
  }
}

/**
 * Permanent delete — only orders already in trash (Shopify parity:
 * soft-delete first via POST /api/admin/orders/bulk action=trash,
 * then hard delete here or via bulk action=delete). Removes invoices
 * and payout settings; revokes the archive pass.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }
    if (!order.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Order must be in trash before permanent delete' },
        { status: 409 }
      );
    }

    try {
      revokeArchivePass(order.orderId);
    } catch (err) {
      console.error('Archive pass revoke failed:', err);
    }

    await prisma.$transaction([
      prisma.invoice.deleteMany({ where: { orderId: order.id } }),
      prisma.shopSetting.deleteMany({
        where: { key: { in: [`tokens:${order.orderId}`, `zionpay:${order.orderId}`] } },
      }),
      prisma.shopOrder.delete({ where: { id: order.id } }),
    ]);

    return NextResponse.json({ success: true, data: { orderId: order.orderId } });
  } catch (error) {
    console.error('Failed to delete order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
