import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { buildV2OrderConfirmationEmail } from './v2-email';
import { getActiveTheme } from './settings';
import { generateInvoicePdf } from './invoice-pdf';

interface AttachmentInput {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface SendMailOptions {
  from: string;
  to: string | string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: AttachmentInput[];
}

function emailConfig() {
  const host = process.env.SMTP_HOST ?? '127.0.0.1';
  const port = parseInt(process.env.SMTP_PORT ?? '25', 10);
  const isLocal = host === '127.0.0.1' || host === 'localhost';
  return {
    host,
    port,
    user: process.env.SMTP_USER ?? 'shop@newearth.cz',
    password: process.env.SMTP_PASSWORD ?? '',
    isLocal,
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@newearth.cz',
    shopEmail: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
    shopName: process.env.SHOP_NAME ?? 'ZION eShop',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    resendFrom: process.env.RESEND_FROM ?? 'onboarding@resend.dev',
  };
}

function isEnabled(): boolean {
  const cfg = emailConfig();
  if (cfg.resendApiKey) return true;
  // Local Postfix doesn't need auth — just need a sender address
  if (cfg.isLocal) return Boolean(cfg.shopEmail);
  return Boolean(cfg.user && cfg.password);
}

function createTransporter() {
  const cfg = emailConfig();
  const transportOpts: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
  };
  if (cfg.isLocal) {
    // Local Postfix — no auth, no TLS needed (localhost is trusted)
    transportOpts.ignoreTLS = true;
  } else {
    // External SMTP — require auth
    transportOpts.auth = {
      user: cfg.user,
      pass: cfg.password,
    };
  }
  return nodemailer.createTransport(transportOpts as nodemailer.TransportOptions);
}

async function sendWithResend(options: SendMailOptions): Promise<{ messageId?: string }> {
  const cfg = emailConfig();
  if (!cfg.resendApiKey) throw new Error('RESEND_API_KEY not configured');
  const resend = new Resend(cfg.resendApiKey);

  const result = await resend.emails.send({
    from: options.from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString('base64'),
      contentType: a.contentType,
    })),
  });

  if (result.error) throw new Error(result.error.message);
  return { messageId: result.data?.id };
}

export async function sendMail(options: SendMailOptions): Promise<{ messageId?: string }> {
  const cfg = emailConfig();
  if (cfg.resendApiKey) {
    try {
      return await sendWithResend(options);
    } catch (error) {
      console.warn('Resend failed, falling back to local SMTP:', error);
    }
  }
  const transporter = createTransporter();
  // Fallback to the configured shop email when Resend's default/onboarding from address is used
  const from = options.from.includes('@resend.dev')
    ? `${cfg.shopName} <${cfg.shopEmail}>`
    : options.from;
  const info = await transporter.sendMail({
    from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  });
  return { messageId: info.messageId };
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

  const subject = `Nová objednávka #${order.orderId} - ${cfg.shopName}`;
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
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
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

export async function sendCustomerOrderConfirmation(
  order: OrderEmailData,
  invoiceHtml?: string | null
): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const subject = `Potvrzení objednávky #${order.orderId} - ${cfg.shopName}`;

  try {
    const theme = await getActiveTheme();
    const { html, text } = await buildV2OrderConfirmationEmail(order, theme);

    const attachments: AttachmentInput[] | undefined = invoiceHtml
      ? [
          {
            filename: `faktura-${order.orderId.replace(/\s+/g, '_')}.pdf`,
            content: await generateInvoicePdf(invoiceHtml),
            contentType: 'application/pdf',
          },
        ]
      : undefined;

    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text,
      html,
      attachments,
    });
    console.log(`Customer order confirmation sent for ${order.orderId}${invoiceHtml ? ' (with invoice attachment)' : ''}`);
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
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
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

  const subject = `Faktura k objednávce #${order.orderId} - ${cfg.shopName}`;
  const body = `Dobrý den, ${order.customerName},

v příloze Vám zasíláme fakturu k objednávce #${order.orderId}.

Celková částka: ${formatPrice(order.totalCzk)}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const pdf = await generateInvoicePdf(invoiceHtml);
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html: `<p>Dobrý den ${escapeHtml(order.customerName)},</p><p>v příloze Vám zasíláme fakturu k objednávce <strong>#${escapeHtml(order.orderId)}</strong>.</p><p>Celková částka: <strong>${formatPrice(order.totalCzk)}</strong></p><p>S pozdravem,<br>Tým ZION Terra Nova</p>`,
      attachments: [
        {
          filename: `faktura-${order.orderId.replace(/\s+/g, '_')}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
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

interface TokenBonusInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  tokens: number;
  txHash?: string;
}

export async function sendTokenBonusEmail(input: TokenBonusInput): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();
  const subject = `ZION token bonus - objednávka #${input.orderId}`;
  const txInfo = input.txHash && input.txHash !== 'pending'
    ? `Tx hash: ${input.txHash}`
    : 'Tx hash bude doplněn po zapsání on-chain.';

  const body = `Dobrý den, ${input.customerName},

děkujeme za Vaši objednávku #${input.orderId}.

Jako bonus Vám bylo připsáno ${input.tokens.toLocaleString('cs-CZ')} ZION tokenů.

${txInfo}

S pozdravem,
Tým ZION Terra Nova
`;

  const html = `<p>Dobrý den ${escapeHtml(input.customerName)},</p>
<p>jako bonus za objednávku <strong>#${escapeHtml(input.orderId)}</strong> Vám bylo připsáno <strong>${input.tokens.toLocaleString('cs-CZ')} ZION tokenů</strong>.</p>
<p>${escapeHtml(txInfo)}</p>
<p>S pozdravem,<br>Tým ZION Terra Nova</p>`;

  try {
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
      to: input.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html,
    });
    console.log(`Token bonus email sent for ${input.orderId}`);
  } catch (error) {
    console.error('Failed to send token bonus email:', error);
  }
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
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
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

interface CustomerWalletInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  address: string;
  seed: string;
}

export async function sendCustomerWalletEmail(input: CustomerWalletInput): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();
  const subject = `Vaše ZION peněženka - objednávka #${input.orderId}`;

  const body = `Dobrý den, ${input.customerName},

k objednávce #${input.orderId} jsme pro Vás automaticky vytvořili ZION L1 peněženku,
na kterou Vám bude po zaplacení odeslán bonus v ZION tokenech.

Vaše adresa: ${input.address}
Seed phrase (12 slov): ${input.seed}

⚠️ DŮLEŽITÉ: Uložte si seed phrase na bezpečném místu. Toto je jediný způsob,
jak získat plný přístup k Vašim tokenům v budoucnu. Nikomu jej neukazujte.

S pozdravem,
Tým ZION Terra Nova
`;

  const html = `<p>Dobrý den ${escapeHtml(input.customerName)},</p>
<p>k objednávce <strong>#${escapeHtml(input.orderId)}</strong> jsme pro Vás vytvořili ZION L1 peněženku, na kterou Vám bude po zaplacení odeslán bonus v ZION tokenech.</p>
<p><strong>Vaše adresa:</strong> <code>${escapeHtml(input.address)}</code></p>
<p><strong>Seed phrase (12 slov):</strong></p>
<p style="font-size:1.1em; background:#f5f5f5; padding:12px; border-radius:6px; word-break:break-all;">${escapeHtml(input.seed)}</p>
<p style="color:#b91c1c;"><strong>DŮLEŽITÉ:</strong> Uložte si seed phrase na bezpečném místu. Toto je jediný způsob, jak získat plný přístup k Vašim tokenům v budoucnu. Nikomu jej neukazujte.</p>
<p>S pozdravem,<br>Tým ZION Terra Nova</p>`;

  try {
    await sendMail({
      from: `${cfg.shopName} <${cfg.resendApiKey ? cfg.resendFrom : cfg.shopEmail}>`,
      to: input.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html,
    });
    console.log(`Customer wallet email sent for ${input.orderId}`);
  } catch (error) {
    console.error('Failed to send customer wallet email:', error);
  }
}
