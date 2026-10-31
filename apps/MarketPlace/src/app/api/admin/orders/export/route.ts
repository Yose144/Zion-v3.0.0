import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * CSV export of the current admin orders filter (same params as the list
 * endpoint). WooCommerce cleanup parity — admins export before deleting.
 * Caps at 5 000 rows.
 */

const COLUMNS = [
  'orderId', 'status', 'paymentStatus', 'payment', 'shipping',
  'customerName', 'customerEmail', 'customerPhone',
  'addressStreet', 'addressCity', 'addressZip',
  'totalCzk', 'shippingCzk', 'zionTokens', 'trackingNumber',
  'items', 'note', 'createdAt', 'paidAt', 'shippedAt',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const paymentStatus = searchParams.get('paymentStatus') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const view = searchParams.get('view') ?? 'active';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (view === 'active') {
      where.deletedAt = null;
      where.archivedAt = null;
    } else if (view === 'archived') {
      where.deletedAt = null;
      where.archivedAt = { not: null };
    } else if (view === 'trash') {
      where.deletedAt = { not: null };
    }
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const lines = [
      COLUMNS.join(';'),
      ...orders.map((o) =>
        COLUMNS.map((c) => {
          const v = o[c as keyof typeof o];
          return csvCell(v instanceof Date ? v.toISOString() : v);
        }).join(';')
      ),
    ];

    const csv = '﻿' + lines.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="zion-orders-${view}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Order export failed:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}
