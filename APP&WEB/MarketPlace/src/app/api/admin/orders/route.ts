import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

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

    // Compute stats from ALL orders (not just current page) using DB aggregation
    const [statusCounts, paymentCounts, totals, pendingPayment, paid] = await Promise.all([
      prisma.shopOrder.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.shopOrder.groupBy({
        by: ['payment'],
        _count: { payment: true },
      }),
      prisma.shopOrder.aggregate({
        _count: { id: true },
        _sum: { totalCzk: true, zionTokens: true },
      }),
      prisma.shopOrder.count({ where: { paymentStatus: 'pending' } }),
      prisma.shopOrder.count({ where: { paymentStatus: 'paid' } }),
    ]);

    const byStatus = statusCounts.reduce((acc, s) => {
      acc[s.status] = s._count.status;
      return acc;
    }, {} as Record<string, number>);

    const byPayment = paymentCounts.reduce((acc, p) => {
      acc[p.payment] = p._count.payment;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalOrders: totals._count.id,
      totalRevenue: totals._sum.totalCzk ?? 0,
      totalTokens: totals._sum.zionTokens ?? 0,
      pendingPayment,
      paid,
      byStatus,
      byPayment,
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
