import nodemailer from 'nodemailer';
import { buildV2OrderConfirmationHtml } from './v2-email';
import { getActiveTheme } from './settings';

function emailConfig() {
  return {
    host: process.env.SMTP_HOST ?? 'smtp.forpsi.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? 'shop@newearth.cz',
    password: process.env.SMTP_PASSWORD ?? '',
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@newearth.cz',
    shopEmail: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
    shopName: process.env.SHOP_NAME ?? 'ZION eShop',
  };
}

function isEnabled(): boolean {
  const cfg = emailConfig();
  return Boolean(cfg.user && cfg.password);
}

function createTransporter() {
  const cfg = emailConfig();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.password,
    },
  });
}

function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      return `- ${raw.name ?? 'Produkt'} (x${qty}) - ${formatPrice(price * qty)}`;
    })
    .join('\n');
}

function formatAddress(order: {
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
}): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipping: string;
  payment: string;
  totalCzk: number;
  shippingCzk: number;
  items: unknown;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  pickupPoint: unknown;
  note: string | null;
  zionTokens: number;
  trackingNumber: string | null;
  status: string;
  paymentStatus: string;
}

export async function sendAdminOrderNotification(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const shippingInfo = order.shipping === 'zasilkovna-home'
    ? `Doručovací adresa: ${formatAddress(order)}`
    : order.shipping === 'zasilkovna'
    ? 'Zásilkovna - výdejní místo (bude upřesněno)'
    : 'Digitální doručení / online převzetí';

  const subject = `🛒 Nová objednávka #${order.orderId} - ${cfg.shopName}`;
  const body = `=======================================
NOVÁ OBJEDNÁVKA - ${cfg.shopName}
=======================================

Číslo objednávky: ${order.orderId}
Status: ${order.status}
Stav platby: ${order.paymentStatus}

----------------------------------------
ZÁKAZNÍK
----------------------------------------
Jméno: ${order.customerName}
Email: ${order.customerEmail}
Telefon: ${order.customerPhone}

----------------------------------------
POLOŽKY
----------------------------------------
${formatItems(order.items)}

----------------------------------------
DOPRAVA
----------------------------------------
${shippingInfo}
Doprava: ${order.shipping}

----------------------------------------
PLATBA
----------------------------------------
Způsob: ${order.payment === 'card' ? 'Platební karta (Stripe)' : order.payment === 'transfer' ? 'Bankovní převod' : order.payment}
Variabilní symbol: ${order.orderId.replace(/\D/g, '').slice(0, 10)}

----------------------------------------
CELKEM: ${formatPrice(order.totalCzk)}
----------------------------------------

Poznámka: ${order.note || '—'}
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${cfg.shopName} <${cfg.shopEmail}>`,
      to: cfg.adminEmail,
      replyTo: order.customerEmail,
      subject,
      text: body,
    });
    console.log(`Admin order notification sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send admin order notification:', error);
  }
}

export async function sendCustomerOrderConfirmation(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const subject = `✅ Potvrzení objednávky #${order.orderId} - ${cfg.shopName}`;
  const plainText = `Dobrý den, ${order.customerName}!

Děkujeme za Vaši objednávku v ${cfg.shopName}.

Číslo objednávky: ${order.orderId}
Celková částka: ${formatPrice(order.totalCzk)}

O průběhu objednávky Vás budeme informovat emailem.

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const theme = await getActiveTheme();
    const html = await buildV2OrderConfirmationHtml(order, theme);
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${cfg.shopName} <${cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: plainText,
      html,
    });
    console.log(`Customer order confirmation sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send customer order confirmation:', error);
  }
}

export async function sendPaymentConfirmation(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const subject = `Platba přijata - objednávka #${order.orderId} - ${cfg.shopName}`;
  const body = `Dobrý den, ${order.customerName},

Vaše platba za objednávku #${order.orderId} byla úspěšně přijata.

Celková částka: ${formatPrice(order.totalCzk)}

Vaše zboží bude co nejdříve odesláno.

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${cfg.shopName} <${cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
    });
    console.log(`Payment confirmation sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send payment confirmation:', error);
  }
}

export async function sendInvoiceEmail(order: OrderEmailData, invoiceHtml: string): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const subject = `📄 Faktura k objednávce #${order.orderId} - ${cfg.shopName}`;
  const body = `Dobrý den, ${order.customerName},

v příloze Vám zasíláme fakturu k objednávce #${order.orderId}.

Celková částka: ${formatPrice(order.totalCzk)}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${cfg.shopName} <${cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html: `<p>Dobrý den ${escapeHtml(order.customerName)},</p><p>v příloze Vám zasíláme fakturu k objednávce <strong>#${escapeHtml(order.orderId)}</strong>.</p><p>Celková částka: <strong>${formatPrice(order.totalCzk)}</strong></p><p>S pozdravem,<br>Tým ZION Terra Nova</p>`,
      attachments: [
        {
          filename: `faktura-${order.orderId.replace(/\s+/g, '_')}.html`,
          content: invoiceHtml,
          contentType: 'text/html',
        },
      ],
    });
    console.log(`Invoice email sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send invoice email:', error);
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendShippingNotification(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const trackingInfo = order.trackingNumber
    ? `Sledovací číslo: ${order.trackingNumber}`
    : 'Sledovací číslo bude doplněno.';

  const subject = `Zásilka odeslána - objednávka #${order.orderId} - ${cfg.shopName}`;
  const body = `Dobrý den, ${order.customerName},

Vaše objednávka #${order.orderId} byla odeslana.

${trackingInfo}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${cfg.shopName} <${cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
    });
    console.log(`Shipping notification sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send shipping notification:', error);
  }
}
