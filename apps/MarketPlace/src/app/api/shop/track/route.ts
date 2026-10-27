import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET /api/shop/track?order=<orderId>&email=<email>
// Public order tracking. Requires BOTH the order id and the customer email —
// the order id alone must not be enough to read order details (PII).
// Returns a redacted subset only: no name, address, phone, pickup point or note.
export async function GET(request: NextRequest) {
  const rl = rateLimit(`shop-track:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const orderId = request.nextUrl.searchParams.get('order')?.trim() ?? '';
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? '';

    if (!orderId || orderId.length > 64 || !email || email.length > 254) {
      return NextResponse.json(
        { success: false, error: 'Missing order or email' },
        { status: 400 }
      );
    }

    const order = await prisma.shopOrder.findFirst({
      where: { orderId },
      include: { invoices: { select: { id: true, invoiceNumber: true, status: true } } },
    });

    // Identical response for unknown order and email mismatch — don't leak
    // which part failed (order-id enumeration must reveal nothing).
    if (!order || order.customerEmail.trim().toLowerCase() !== email) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const items = Array.isArray(order.items) ? (order.items as unknown[]) : [];
    const safeItems = items.map((it) => {
      const raw = it as Record<string, unknown>;
      return {
        name: String(raw.name ?? 'Produkt'),
        quantity: Math.max(1, Math.round((raw.quantity as number) || 1)),
        priceCzk: Math.round((raw.priceCzk as number) || 0),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalCzk: order.totalCzk,
        shippingCzk: order.shippingCzk,
        shipping: order.shipping,
        payment: order.payment,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        items: safeItems,
        invoices: order.invoices,
      },
    });
  } catch (error) {
    console.error('Failed to track shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track order' },
      { status: 500 }
    );
  }
}
