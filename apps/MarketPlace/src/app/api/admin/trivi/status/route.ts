import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;

    // Find order by id or orderId
    const order = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      select: { orderId: true },
    });

    if (!order) {
      return NextResponse.json({ synced: false }, { status: 404 });
    }

    // Check Trivi sync status from ShopSetting
    const setting = await prisma.shopSetting.findUnique({
      where: { key: `trivi:${order.orderId}` },
    });

    if (!setting) {
      return NextResponse.json({ synced: false });
    }

    const data = JSON.parse(setting.value);
    return NextResponse.json({
      synced: true,
      status: data.status ?? 'pending',
      trivi_id: data.triviId,
      document_number: data.documentNumber,
      error_message: data.error,
      can_retry: data.canRetry ?? false,
      created_at: data.createdAt,
    });
  } catch (error) {
    console.error('Trivi status check failed:', error);
    return NextResponse.json(
      { synced: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}
