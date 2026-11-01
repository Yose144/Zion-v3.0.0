import { NextResponse } from 'next/server';
import { buildV2OrderConfirmationHtml } from '@/lib/v2-email';
import { getActiveTheme } from '@/lib/settings';
import { normalizeEmailLang } from '@/lib/email-lang';
import type { OrderEmailData } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Preview must not depend on the database — fall back to the default theme.
  const theme = await getActiveTheme().catch(() => 'rasta' as const);
  const lang = normalizeEmailLang(new URL(req.url).searchParams.get('lang'));
  const testOrder: OrderEmailData = {
    orderId: 'ORD-PREVIEW-001',
    customerName: 'Yosef Hubalek',
    customerEmail: 'yosef.hubalek@gmail.com',
    customerPhone: '+420777123456',
    shipping: 'zasilkovna-home',
    payment: 'transfer',
    totalCzk: 1000,
    shippingCzk: 119,
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
    lang,
  };
  const html = await buildV2OrderConfirmationHtml(testOrder, theme);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
