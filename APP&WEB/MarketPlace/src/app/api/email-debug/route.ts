import { NextResponse } from 'next/server';
import { buildV2OrderConfirmationEmail, buildV2OrderConfirmationHtml } from '@/lib/v2-email';
import { getActiveTheme } from '@/lib/settings';
import { sendMail, type OrderEmailData } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const testEmail = body.email || 'yosef.hubalek@gmail.com';

  const testOrder: OrderEmailData = {
    orderId: 'ORD-DEBUG-' + Date.now(),
    customerName: 'Yosef Hubalek',
    customerEmail: testEmail,
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
    note: 'Debug test',
    zionTokens: 100,
    trackingNumber: null,
    status: 'pending',
    paymentStatus: 'pending',
  };

  const theme = await getActiveTheme();
  const { html, text } = await buildV2OrderConfirmationEmail(testOrder, theme);

  // Log HTML size and first 500 chars
  console.log('DEBUG: HTML length:', html.length);
  console.log('DEBUG: HTML starts with:', html.substring(0, 200));
  console.log('DEBUG: Theme:', theme);

  try {
    await sendMail({
      from: `${process.env.SHOP_NAME ?? 'ZION eShop'} <${process.env.RESEND_FROM ?? process.env.SHOP_EMAIL ?? 'shop@newearth.cz'}>`,
      to: testEmail,
      replyTo: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
      subject: `DEBUG TEST - Potvrzeni objednavky #${testOrder.orderId}`,
      text,
      html,
    });

    const previewHtml = await buildV2OrderConfirmationHtml(testOrder, theme);
    return NextResponse.json({
      success: true,
      htmlLength: previewHtml.length,
      htmlPreview: previewHtml.substring(0, 500),
      theme,
      env: {
        SMTP_HOST: process.env.SMTP_HOST ?? '127.0.0.1',
        SMTP_PORT: process.env.SMTP_PORT ?? '25',
        SHOP_EMAIL: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
        RESEND_FROM: process.env.RESEND_FROM,
        hasResendKey: Boolean(process.env.RESEND_API_KEY),
      },
    });
  } catch (error) {
    const previewHtml = await buildV2OrderConfirmationHtml(testOrder, theme);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      htmlLength: previewHtml.length,
      htmlPreview: previewHtml.substring(0, 500),
      theme,
    }, { status: 500 });
  }
}
