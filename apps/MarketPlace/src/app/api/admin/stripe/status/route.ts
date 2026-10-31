import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const orders = await prisma.shopOrder.findMany({
    where: { payment: 'card' },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      orderId: true,
      paymentStatus: true,
      totalCzk: true,
      createdAt: true,
      invoices: {
        select: { stripeSession: true, invoiceNumber: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      stripeKeySet: Boolean(process.env.STRIPE_SECRET_KEY),
      webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      orders: orders.map((order) => ({
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        totalCzk: order.totalCzk,
        createdAt: order.createdAt,
        invoiceNumber: order.invoices[0]?.invoiceNumber ?? null,
        invoiceStatus: order.invoices[0]?.status ?? null,
        stripeSession: order.invoices[0]?.stripeSession ?? null,
      })),
    },
  });
}
