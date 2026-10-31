import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import {
  buildV2OrderConfirmationEmail,
  buildRastaEmail,
  rastaCard,
  rastaRow,
  rastaMonoBox,
  rastaWarning,
} from './v2-email';
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
    adminEmail: process.env.ADMIN_EMAIL ?? 'shop@newearth.cz',
    shopEmail: process.env.SHOP_EMAIL ?? 'shop@newearth.cz',
    shopName: process.env.SHOP_NAME ?? 'ZION Market',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    resendFrom: process.env.RESEND_FROM ?? 'shop@newearth.cz',
  };
}

function isResendFromVerified(from: string): boolean {
  // Resend's onboarding/test domain only allows sending to a single verified
  // address and fails for normal recipients. Skip Resend when it is unverified.
  return !from.toLowerCase().endsWith('@resend.dev');
}

function defaultFrom(): string {
  const cfg = emailConfig();
  const from = cfg.resendApiKey && isResendFromVerified(cfg.resendFrom)
    ? cfg.resendFrom
    : cfg.shopEmail;
  return `${cfg.shopName} <${from}>`;
}

function isEnabled(): boolean {
  const cfg = emailConfig();
  if (cfg.resendApiKey && isResendFromVerified(cfg.resendFrom)) return true;
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
  // Only use Resend when the configured from address is on a verified (non-test) domain.
  const useResend = cfg.resendApiKey && isResendFromVerified(cfg.resendFrom);

  if (useResend) {
    try {
      return await sendWithResend(options);
    } catch (error) {
      console.warn('Resend failed, falling back to local SMTP:', error);
    }
  }

  const transporter = createTransporter();
  // Fallback to the configured shop email when Resend's default/onboarding from address is used
  const from = options.from.toLowerCase().includes('@resend.dev')
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

function shippingMethodLabel(method: string): string {
  if (method === 'zasilkovna-home') return 'Doručení domů (Zásilkovna)';
  if (method === 'zasilkovna') return 'Výdejní místo Zásilkovna';
  if (method?.includes('virtualni')) return 'Digitální doručení';
  return method || 'Neuvedeno';
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
  /** ZION L1 loyalty wallet (V2 bonus parity) */
  customerWalletAddress?: string | null;
  customerWalletId?: string | null;
  /** ZION Archive pass issued at paid transition (book purchases) */
  archivePass?: { code: string; url: string } | null;
}

export async function sendAdminOrderNotification(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();

  const pickupLabel = (() => {
    const pp = order.pickupPoint as { name?: string; label?: string; id?: string } | string | null;
    if (!pp) return '';
    if (typeof pp === 'string') return pp;
    return [pp.name, pp.label, pp.id].filter(Boolean).join(' — ');
  })();
  const shippingInfo = order.shipping === 'zasilkovna-home'
    ? `Doručovací adresa: ${formatAddress(order)}`
    : order.shipping === 'zasilkovna'
    ? `Zásilkovna — výdejní místo: ${pickupLabel || '(neuvedeno)'}`
    : 'Digitální doručení / online převzetí';

  const subject = `Nová objednávka #${order.orderId} - ${cfg.shopName}`;
  const itemsRows = (Array.isArray(order.items) ? order.items : [])
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      return `<tr>
        <td style="color:#e5e7eb;font-size:15px;padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);"><strong style="color:#fff;">${escapeHtml(String(raw.name ?? 'Produkt'))}</strong></td>
        <td style="color:#9af59a;font-size:15px;text-align:center;padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);width:70px;">${qty}x</td>
        <td style="color:#FFD700;font-size:15px;text-align:right;padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);width:110px;font-weight:700;">${formatPrice(price * qty)}</td>
      </tr>`;
    })
    .join('');
  const html = buildRastaEmail({
    title: subject,
    badge: '🛎️ ADMIN — NOVÁ OBJEDNÁVKA 🛎️',
    heroEmoji: '🛎️',
    headline: `Nová objednávka #${escapeHtml(order.orderId)}`,
    content:
      rastaCard({
        heading: '📋 Objednávka',
        body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('🔖 Číslo:', `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow('Status:', escapeHtml(order.status))}${rastaRow('Stav platby:', escapeHtml(order.paymentStatus))}</table>`,
      }) +
      rastaCard({
        heading: '👤 Zákazník',
        body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('Jméno:', escapeHtml(order.customerName))}${rastaRow('Email:', escapeHtml(order.customerEmail))}${rastaRow('Telefon:', escapeHtml(order.customerPhone))}</table>`,
        tone: 'gold',
      }) +
      rastaCard({
        heading: '🛒 Položky',
        body: `<table width="100%" cellpadding="0" cellspacing="0">${itemsRows || '<tr><td style="color:#9af59a;padding:10px;">Žádné položky</td></tr>'}</table>`,
        tone: 'red',
      }) +
      rastaCard({
        heading: '🚚 Doprava & 💳 Platba',
        body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('Doprava:', escapeHtml(shippingInfo))}${rastaRow('Způsob:', escapeHtml(order.payment === 'card' ? 'Platební karta (Stripe)' : order.payment === 'transfer' ? 'Bankovní převod' : order.payment))}${rastaRow('Variabilní symbol:', escapeHtml(order.orderId.replace(/\D/g, '').slice(0, 10)))}${rastaRow('💰 Celkem:', `<strong style="color:#FFD700;">${formatPrice(order.totalCzk)}</strong>`, { big: true })}${order.note ? rastaRow('Poznámka:', escapeHtml(order.note)) : ''}</table>`,
        tone: 'gold',
      }),
  });
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
      from: defaultFrom(),
      to: cfg.adminEmail,
      replyTo: order.customerEmail,
      subject,
      text: body,
      html,
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

    let attachments: AttachmentInput[] | undefined;
    if (invoiceHtml) {
      try {
        attachments = [
          {
            filename: `faktura-${order.orderId.replace(/\s+/g, '_')}.pdf`,
            content: await generateInvoicePdf(invoiceHtml),
            contentType: 'application/pdf',
          },
        ];
      } catch (error) {
        console.error(`Invoice PDF attachment skipped for ${order.orderId}:`, error);
      }
    }

    await sendMail({
      from: defaultFrom(),
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text,
      html,
      attachments,
    });
    console.log(
      `Customer order confirmation sent for ${order.orderId}${attachments ? ' (with invoice attachment)' : ''}`
    );
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
  const html = buildRastaEmail({
    title: subject,
    badge: '⚡ PLATBA PŘIJATA ⚡',
    heroEmoji: '💚',
    headline: 'Jah Bless! Platba dorazila',
    intro: `Děkujeme, ${escapeHtml(order.customerName)}! Vaše platba byla úspěšně přijata. ✨`,
    content:
      rastaCard({
        heading: '📋 Detaily platby',
        body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('🔖 Objednávka:', `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow('💰 Částka:', `<strong style="color:#FFD700;">${formatPrice(order.totalCzk)}</strong>`, { big: true })}${rastaRow('Stav:', '<span style="display:inline-block;padding:5px 14px;background:#1c7b1c;color:#fff;font-weight:700;border-radius:999px;font-size:13px;">✅ Zaplaceno</span>')}</table>`,
      }) +
      rastaCard({
        heading: '⚡ Co bude dál?',
        body: `<ul style="color: #a8ffb0; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 24px;">
          <li style="margin-bottom:8px;">📦 <strong>Zpracování:</strong> Vaši objednávku připravujeme k odeslání</li>
          <li style="margin-bottom:8px;">🎁 <strong>ZION bonus:</strong> Tokeny Vám budou připsány na peněženku</li>
          <li>💚 <strong>Podpora:</strong> ${escapeHtml(cfg.shopEmail)}</li>
        </ul>`,
        tone: 'gold',
      }) +
      (order.archivePass
        ? rastaCard({
            heading: '📚 ZION Archive Pass',
            body: `<p style="color:#a8ffb0;font-size:15px;margin:0 0 14px;">K této objednávce získáváte přístup do <strong style="color:#FFD700;">ZION Archivu</strong> — knihovny knih a korpusu. Váš osobní pass kód:</p>
            <div style="background:#0d0d0d;border:1px solid #1c7b1c;border-radius:8px;padding:16px;text-align:center;margin-bottom:14px;"><code style="color:#FFD700;font-size:20px;font-weight:700;letter-spacing:2px;">${escapeHtml(order.archivePass.code)}</code></div>
            <p style="color:#a8ffb0;font-size:14px;margin:0 0 12px;">Zadejte ho na stránce archivu — přístup zůstává v tomto prohlížeči 90 dní, přihlášením přes ZIS účet ho navážete natrvalo.</p>
            <p style="margin:0;text-align:center;"><a href="${escapeHtml(order.archivePass.url)}" style="display:inline-block;background:#1c7b1c;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">📖 Otevřít ZION Archiv</a></p>`,
          })
        : ''),
  });
  const body = `Dobrý den, ${order.customerName},

Vaše platba za objednávku #${order.orderId} byla úspěšně přijata.

Celková částka: ${formatPrice(order.totalCzk)}
${order.archivePass ? `
ZION Archive Pass: ${order.archivePass.code}
Aktivace: ${order.archivePass.url}
` : ''}
Vaše zboží bude co nejdříve odesláno.

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    await sendMail({
      from: defaultFrom(),
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html,
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
  const html = buildRastaEmail({
    title: subject,
    badge: '⚡ FAKTURA ⚡',
    heroEmoji: '📄',
    headline: 'Vaše faktura je připravena',
    intro: `Dobrý den ${escapeHtml(order.customerName)}, fakturu k objednávce najdete v příloze tohoto e-mailu (PDF).`,
    content: rastaCard({
      heading: '📄 Faktura',
      body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('🔖 Objednávka:', `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow('💰 Celková částka:', `<strong style="color:#FFD700;">${formatPrice(order.totalCzk)}</strong>`, { big: true })}${rastaRow('Příloha:', 'PDF faktura')}</table>`,
      tone: 'gold',
    }),
  });
  const body = `Dobrý den, ${order.customerName},

v příloze Vám zasíláme fakturu k objednávce #${order.orderId}.

Celková částka: ${formatPrice(order.totalCzk)}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const pdf = await generateInvoicePdf(invoiceHtml);
    await sendMail({
      from: defaultFrom(),
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html,
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

  const txBlock = input.txHash && input.txHash !== 'pending'
    ? rastaMonoBox('🔗 Transakce (on-chain):', input.txHash)
    : `<p style="color:#8a8f94;font-size:13px;text-align:center;margin:16px 0 0 0;">Tx hash bude doplněn po zapsání on-chain.</p>`;

  const html = buildRastaEmail({
    title: subject,
    badge: '🎁 ZION TOKEN BONUS 🎁',
    heroEmoji: '🎁',
    headline: 'Jah Bless! Bonus připsán',
    intro: `Děkujeme za objednávku <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong>, ${escapeHtml(input.customerName)}! 🙏`,
    content: rastaCard({
      heading: '⚡ Váš ZION bonus',
      body: `<p style="color:#9af59a;font-size:15px;text-align:center;margin:0 0 8px 0;">Připsáno na Vaši peněženku:</p>
        <p style="color:#00ff7f;font-size:34px;font-weight:700;text-align:center;margin:0 0 20px 0;text-shadow:0 0 24px rgba(0,255,127,0.4);">${input.tokens.toLocaleString('cs-CZ')} ZION ⚡</p>
        ${txBlock}`,
    }),
  });

  const body = `Dobrý den, ${input.customerName},

děkujeme za Vaši objednávku #${input.orderId}.

Jako bonus Vám bylo připsáno ${input.tokens.toLocaleString('cs-CZ')} ZION tokenů.

${txInfo}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    await sendMail({
      from: defaultFrom(),
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

  const trackingBlock = order.trackingNumber
    ? rastaMonoBox('📦 Sledovací číslo:', order.trackingNumber)
    : `<p style="color:#8a8f94;font-size:13px;text-align:center;margin:16px 0 0 0;">Sledovací číslo bude doplněno.</p>`;

  const subject = `Zásilka odeslána - objednávka #${order.orderId} - ${cfg.shopName}`;
  const html = buildRastaEmail({
    title: subject,
    badge: '⚡ ZÁSILKA ODESLÁNA ⚡',
    heroEmoji: '🚚',
    headline: 'Vaše zásilka je na cestě',
    intro: `Dobrý den ${escapeHtml(order.customerName)}, objednávka <strong style="color:#FFD700;">#${escapeHtml(order.orderId)}</strong> byla právě odeslána. 🌿`,
    content: rastaCard({
      heading: '🚚 Odeslání',
      body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow('🔖 Objednávka:', `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow('Doprava:', escapeHtml(shippingMethodLabel(order.shipping)))}</table>${trackingBlock}`,
    }),
  });
  const body = `Dobrý den, ${order.customerName},

Vaše objednávka #${order.orderId} byla odeslana.

${trackingInfo}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    await sendMail({
      from: defaultFrom(),
      to: order.customerEmail,
      replyTo: cfg.shopEmail,
      subject,
      text: body,
      html,
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

  const html = buildRastaEmail({
    title: subject,
    badge: '🔐 ZION PENĚŽENKA 🔐',
    heroEmoji: '🔐',
    headline: 'Vaše ZION peněženka',
    intro: `K objednávce <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong> jsme Vám vytvořili ZION L1 peněženku — po zaplacení na ni připíšeme Váš bonus. ⚡`,
    content:
      rastaCard({
        heading: '📍 Adresa peněženky',
        body: rastaMonoBox('ZION L1 adresa:', input.address),
      }) +
      rastaCard({
        heading: '🌱 Seed phrase (12 slov)',
        body: rastaMonoBox('Seed phrase — uchovejte offline:', input.seed) +
          rastaWarning('⚠️ <strong>DŮLEŽITÉ:</strong> Seed phrase si uložte na bezpečném místu — je to jediný způsob, jak získat plný přístup k Vašim tokenům. Nikomu ji neukazujte.'),
        tone: 'gold',
      }),
  });

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

  try {
    await sendMail({
      from: defaultFrom(),
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
