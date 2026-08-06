import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { buildV2OrderConfirmationHtml } from '@/lib/v2-email';
import { getActiveTheme } from '@/lib/settings';
import type { OrderEmailData } from '@/lib/email';

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
  const html = await buildV2OrderConfirmationHtml(testOrder, theme);

  // Log HTML size and first 500 chars
  console.log('DEBUG: HTML length:', html.length);
  console.log('DEBUG: HTML starts with:', html.substring(0, 200));
  console.log('DEBUG: Theme:', theme);

  const cfg = {
    host: process.env.SMTP_HOST ?? '127.0.0.1',
    port: parseInt(process.env.SMTP_PORT ?? '25', 10),
    user: process.env.SMTP_USER ?? 'shop@newearth.cz',
    password: process.env.SMTP_PASSWORD ?? '',
    isLocal: (process.env.SMTP_HOST ?? '127.0.0.1') === '127.0.0.1' || (process.env.SMTP_HOST ?? '127.0.0.1') === 'localhost',
  };

  const transportOpts: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
  };
  if (cfg.isLocal) {
    transportOpts.ignoreTLS = true;
  } else {
    transportOpts.auth = { user: cfg.user, pass: cfg.password };
  }
  const transporter = nodemailer.createTransport(transportOpts as nodemailer.TransportOptions);

  try {
    const info = await transporter.sendMail({
      from: `ZION eShop <${process.env.SHOP_EMAIL ?? 'shop@newearth.cz'}>`,
      to: testEmail,
      replyTo: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
      subject: `✅ DEBUG TEST - Potvrzení objednávky #${testOrder.orderId}`,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      htmlLength: html.length,
      htmlPreview: html.substring(0, 500),
      theme,
      env: {
        SMTP_HOST: cfg.host,
        SMTP_PORT: cfg.port,
        SMTP_USER: cfg.user,
        hasPassword: Boolean(cfg.password),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      htmlLength: html.length,
      htmlPreview: html.substring(0, 500),
      theme,
    }, { status: 500 });
  }
}
