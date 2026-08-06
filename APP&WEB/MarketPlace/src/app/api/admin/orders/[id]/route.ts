import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

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
