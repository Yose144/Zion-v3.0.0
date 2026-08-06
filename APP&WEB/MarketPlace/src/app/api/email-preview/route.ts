import { NextResponse } from 'next/server';
import { buildV2OrderConfirmationHtml } from '@/lib/v2-email';
import { getActiveTheme } from '@/lib/settings';
import type { OrderEmailData } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  const theme = await getActiveTheme();
  const testOrder: OrderEmailData = {
    orderId: 'ORD-PREVIEW-001',
    customerName: 'Yosef Hubalek',
    customerEmail: 'yosef.hubalek@gmail.com',
    customerPhone: '+420777123456',
    shipping: 'virtualni-nakup',
    payment: 'transfer',
    totalCzk: 1000,
    shippingCzk: 0,
    items: [
      { id: '1', name: 'ZION Artifact NFT', priceCzk: 500, quantity: 2, category: 'digital' },
    ],
    addressStreet: 'Test 1',
    addressCity: 'Praha',
    addressZip: '11000',
    pickupPoint: null,
    note: 'Preview test',
    zionTokens: 100,
    trackingNumber: null,
    status: 'pending',
    paymentStatus: 'pending',
  };
  const html = await buildV2OrderConfirmationHtml(testOrder, theme);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
