import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const paymentStatus = searchParams.get('paymentStatus') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.shopOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoices: {
            select: { id: true, invoiceNumber: true, status: true, pdfUrl: true, totalCzk: true, issuedAt: true },
          },
        },
      }),
      prisma.shopOrder.count({ where }),
    ]);

    // Compute stats from ALL orders (not just current page)
    const allOrders = await prisma.shopOrder.findMany({
      select: {
        status: true,
        paymentStatus: true,
        totalCzk: true,
        zionTokens: true,
        payment: true,
      },
    });

    const stats = {
      totalOrders: allOrders.length,
      totalRevenue: allOrders.reduce((sum, o) => sum + o.totalCzk, 0),
      totalTokens: allOrders.reduce((sum, o) => sum + (o.zionTokens || 0), 0),
      pendingPayment: allOrders.filter((o) => o.paymentStatus === 'pending').length,
      paid: allOrders.filter((o) => o.paymentStatus === 'paid').length,
      byStatus: allOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPayment: allOrders.reduce((acc, o) => {
        acc[o.payment] = (acc[o.payment] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      data: {
        orders,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        stats,
      },
    });
  } catch (error) {
    console.error('Failed to list admin orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list orders' },
      { status: 500 }
    );
  }
}
