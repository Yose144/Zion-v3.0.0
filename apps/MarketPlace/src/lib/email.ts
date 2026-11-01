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
import { emailLocale, resolveEmailLang, tl, type EmailLang } from './email-lang';

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

function formatPriceLang(amount: number, lang: EmailLang): string {
  return `${Math.round(amount).toLocaleString(emailLocale(lang))} Kč`;
}

function formatNumberLang(value: number, lang: EmailLang): string {
  return value.toLocaleString(emailLocale(lang));
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

function shippingMethodLabelLang(method: string, lang: EmailLang): string {
  if (method === 'zasilkovna-home') return tl(lang, 'Doručení domů (Zásilkovna)', 'Home delivery (Zásilkovna)');
  if (method === 'zasilkovna') return tl(lang, 'Výdejní místo Zásilkovna', 'Zásilkovna pickup point');
  if (method?.includes('virtualni')) return tl(lang, 'Digitální doručení', 'Digital delivery');
  return method || tl(lang, 'Neuvedeno', 'Not specified');
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
  /** Customer language for outgoing e-mail (defaults to SHOP_EMAIL_LANG / cs) */
  lang?: EmailLang;
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
  const lang = resolveEmailLang(order);

  const subject = tl(
    lang,
    `Potvrzení objednávky #${order.orderId} - ${cfg.shopName}`,
    `Order confirmation #${order.orderId} - ${cfg.shopName}`,
  );

  try {
    const theme = await getActiveTheme();
    const { html, text } = await buildV2OrderConfirmationEmail(order, theme);

    let attachments: AttachmentInput[] | undefined;
    if (invoiceHtml) {
      try {
        attachments = [
          {
            filename: `${lang === 'cs' ? 'faktura' : 'invoice'}-${order.orderId.replace(/\s+/g, '_')}.pdf`,
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
  const lang = resolveEmailLang(order);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const subject = t(
    `Platba přijata - objednávka #${order.orderId} - ${cfg.shopName}`,
    `Payment received - order #${order.orderId} - ${cfg.shopName}`,
  );
  const html = buildRastaEmail({
    lang,
    title: subject,
    badge: t('⚡ PLATBA PŘIJATA ⚡', '⚡ PAYMENT RECEIVED ⚡'),
    heroEmoji: '💚',
    headline: t('Jah Bless! Platba dorazila', 'Jah Bless! Your payment arrived'),
    intro: t(
      `Děkujeme, ${escapeHtml(order.customerName)}! Vaše platba byla úspěšně přijata. ✨`,
      `Thank you, ${escapeHtml(order.customerName)}! Your payment has been received successfully. ✨`,
    ),
    content:
      rastaCard({
        heading: t('📋 Detaily platby', '📋 Payment details'),
        body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow(t('🔖 Objednávka:', '🔖 Order:'), `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow(t('💰 Částka:', '💰 Amount:'), `<strong style="color:#FFD700;">${formatPriceLang(order.totalCzk, lang)}</strong>`, { big: true })}${rastaRow(t('Stav:', 'Status:'), `<span style="display:inline-block;padding:5px 14px;background:#1c7b1c;color:#fff;font-weight:700;border-radius:999px;font-size:13px;">✅ ${t('Zaplaceno', 'Paid')}</span>`)}</table>`,
      }) +
      rastaCard({
        heading: t('⚡ Co bude dál?', '⚡ What happens next?'),
        body: `<ul style="color: #a8ffb0; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 24px;">
          <li style="margin-bottom:8px;">📦 <strong>${t('Zpracování:', 'Processing:')}</strong> ${t('Vaši objednávku připravujeme k odeslání', 'we are preparing your order for dispatch')}</li>
          <li style="margin-bottom:8px;">🎁 <strong>${t('ZION bonus:', 'ZION bonus:')}</strong> ${t('Tokeny Vám budou připsány na peněženku', 'the tokens will be credited to your wallet')}</li>
          <li>💚 <strong>${t('Podpora:', 'Support:')}</strong> ${escapeHtml(cfg.shopEmail)}</li>
        </ul>`,
        tone: 'gold',
      }) +
      (order.archivePass
        ? rastaCard({
            heading: '📚 ZION Archive Pass',
            body: `<p style="color:#a8ffb0;font-size:15px;margin:0 0 14px;">${t(
              'K této objednávce získáváte přístup do <strong style="color:#FFD700;">ZION Archivu</strong> — knihovny knih a korpusu. Váš osobní pass kód:',
              'This order unlocks access to the <strong style="color:#FFD700;">ZION Archive</strong> — the library of books and the corpus. Your personal pass code:',
            )}</p>
            <div style="background:#0d0d0d;border:1px solid #1c7b1c;border-radius:8px;padding:16px;text-align:center;margin-bottom:14px;"><code style="color:#FFD700;font-size:20px;font-weight:700;letter-spacing:2px;">${escapeHtml(order.archivePass.code)}</code></div>
            <p style="color:#a8ffb0;font-size:14px;margin:0 0 12px;">${t(
              'Zadejte ho na stránce archivu — přístup zůstává v tomto prohlížeči 90 dní, přihlášením přes ZIS účet ho navážete natrvalo.',
              'Enter it on the archive page — access stays in this browser for 90 days; signing in with a ZIS account links it permanently.',
            )}</p>
            <p style="margin:0;text-align:center;"><a href="${escapeHtml(order.archivePass.url)}" style="display:inline-block;background:#1c7b1c;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">📖 ${t('Otevřít ZION Archiv', 'Open the ZION Archive')}</a></p>`,
          })
        : ''),
  });
  const body = t(
    `Dobrý den, ${order.customerName},

Vaše platba za objednávku #${order.orderId} byla úspěšně přijata.

Celková částka: ${formatPriceLang(order.totalCzk, lang)}
${order.archivePass ? `
ZION Archive Pass: ${order.archivePass.code}
Aktivace: ${order.archivePass.url}
` : ''}
Vaše zboží bude co nejdříve odesláno.

S pozdravem,
Tým ZION Terra Nova
`,
    `Hello ${order.customerName},

your payment for order #${order.orderId} has been received successfully.

Total amount: ${formatPriceLang(order.totalCzk, lang)}
${order.archivePass ? `
ZION Archive Pass: ${order.archivePass.code}
Activation: ${order.archivePass.url}
` : ''}
Your goods will be dispatched as soon as possible.

Best regards,
The ZION Terra Nova team
`,
  );

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
  const lang = resolveEmailLang(order);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const subject = t(
    `Faktura k objednávce #${order.orderId} - ${cfg.shopName}`,
    `Invoice for order #${order.orderId} - ${cfg.shopName}`,
  );
  const html = buildRastaEmail({
    lang,
    title: subject,
    badge: t('⚡ FAKTURA ⚡', '⚡ INVOICE ⚡'),
    heroEmoji: '📄',
    headline: t('Vaše faktura je připravena', 'Your invoice is ready'),
    intro: t(
      `Dobrý den ${escapeHtml(order.customerName)}, fakturu k objednávce najdete v příloze tohoto e-mailu (PDF).`,
      `Hello ${escapeHtml(order.customerName)}, the invoice for your order is attached to this e-mail (PDF).`,
    ),
    content: rastaCard({
      heading: t('📄 Faktura', '📄 Invoice'),
      body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow(t('🔖 Objednávka:', '🔖 Order:'), `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow(t('💰 Celková částka:', '💰 Total amount:'), `<strong style="color:#FFD700;">${formatPriceLang(order.totalCzk, lang)}</strong>`, { big: true })}${rastaRow(t('Příloha:', 'Attachment:'), t('PDF faktura', 'PDF invoice'))}</table>`,
      tone: 'gold',
    }),
  });
  const body = t(
    `Dobrý den, ${order.customerName},

v příloze Vám zasíláme fakturu k objednávce #${order.orderId}.

Celková částka: ${formatPriceLang(order.totalCzk, lang)}

S pozdravem,
Tým ZION Terra Nova
`,
    `Hello ${order.customerName},

please find the invoice for order #${order.orderId} attached.

Total amount: ${formatPriceLang(order.totalCzk, lang)}

Best regards,
The ZION Terra Nova team
`,
  );

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
          filename: `${lang === 'cs' ? 'faktura' : 'invoice'}-${order.orderId.replace(/\s+/g, '_')}.pdf`,
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
  lang?: EmailLang;
}

export async function sendTokenBonusEmail(input: TokenBonusInput): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();
  const lang = resolveEmailLang(input);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const subject = t(
    `ZION token bonus - objednávka #${input.orderId}`,
    `ZION token bonus - order #${input.orderId}`,
  );
  const txInfo = input.txHash && input.txHash !== 'pending'
    ? `Tx hash: ${input.txHash}`
    : t('Tx hash bude doplněn po zapsání on-chain.', 'The tx hash will be added once recorded on-chain.');

  const txBlock = input.txHash && input.txHash !== 'pending'
    ? rastaMonoBox(t('🔗 Transakce (on-chain):', '🔗 Transaction (on-chain):'), input.txHash)
    : `<p style="color:#8a8f94;font-size:13px;text-align:center;margin:16px 0 0 0;">${t('Tx hash bude doplněn po zapsání on-chain.', 'The tx hash will be added once recorded on-chain.')}</p>`;

  const html = buildRastaEmail({
    lang,
    title: subject,
    badge: '🎁 ZION TOKEN BONUS 🎁',
    heroEmoji: '🎁',
    headline: t('Jah Bless! Bonus připsán', 'Jah Bless! Bonus credited'),
    intro: t(
      `Děkujeme za objednávku <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong>, ${escapeHtml(input.customerName)}! 🙏`,
      `Thank you for your order <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong>, ${escapeHtml(input.customerName)}! 🙏`,
    ),
    content: rastaCard({
      heading: t('⚡ Váš ZION bonus', '⚡ Your ZION bonus'),
      body: `<p style="color:#9af59a;font-size:15px;text-align:center;margin:0 0 8px 0;">${t('Připsáno na Vaši peněženku:', 'Credited to your wallet:')}</p>
        <p style="color:#00ff7f;font-size:34px;font-weight:700;text-align:center;margin:0 0 20px 0;text-shadow:0 0 24px rgba(0,255,127,0.4);">${formatNumberLang(input.tokens, lang)} ZION ⚡</p>
        ${txBlock}`,
    }),
  });

  const body = t(
    `Dobrý den, ${input.customerName},

děkujeme za Vaši objednávku #${input.orderId}.

Jako bonus Vám bylo připsáno ${formatNumberLang(input.tokens, lang)} ZION tokenů.

${txInfo}

S pozdravem,
Tým ZION Terra Nova
`,
    `Hello ${input.customerName},

thank you for your order #${input.orderId}.

As a bonus you have been credited with ${formatNumberLang(input.tokens, lang)} ZION tokens.

${txInfo}

Best regards,
The ZION Terra Nova team
`,
  );

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
  const lang = resolveEmailLang(order);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const trackingInfo = order.trackingNumber
    ? t(`Sledovací číslo: ${order.trackingNumber}`, `Tracking number: ${order.trackingNumber}`)
    : t('Sledovací číslo bude doplněno.', 'The tracking number will be added shortly.');

  const trackingBlock = order.trackingNumber
    ? rastaMonoBox(t('📦 Sledovací číslo:', '📦 Tracking number:'), order.trackingNumber)
    : `<p style="color:#8a8f94;font-size:13px;text-align:center;margin:16px 0 0 0;">${t('Sledovací číslo bude doplněno.', 'The tracking number will be added shortly.')}</p>`;

  const subject = t(
    `Zásilka odeslána - objednávka #${order.orderId} - ${cfg.shopName}`,
    `Order dispatched - order #${order.orderId} - ${cfg.shopName}`,
  );
  const html = buildRastaEmail({
    lang,
    title: subject,
    badge: t('⚡ ZÁSILKA ODESLÁNA ⚡', '⚡ ORDER DISPATCHED ⚡'),
    heroEmoji: '🚚',
    headline: t('Vaše zásilka je na cestě', 'Your parcel is on its way'),
    intro: t(
      `Dobrý den ${escapeHtml(order.customerName)}, objednávka <strong style="color:#FFD700;">#${escapeHtml(order.orderId)}</strong> byla právě odeslána. 🌿`,
      `Hello ${escapeHtml(order.customerName)}, order <strong style="color:#FFD700;">#${escapeHtml(order.orderId)}</strong> has just been dispatched. 🌿`,
    ),
    content: rastaCard({
      heading: t('🚚 Odeslání', '🚚 Dispatch'),
      body: `<table width="100%" cellpadding="0" cellspacing="0">${rastaRow(t('🔖 Objednávka:', '🔖 Order:'), `<strong style="color:#FFD700;">${escapeHtml(order.orderId)}</strong>`)}${rastaRow(t('Doprava:', 'Delivery:'), escapeHtml(shippingMethodLabelLang(order.shipping, lang)))}</table>${trackingBlock}`,
    }),
  });
  const body = t(
    `Dobrý den, ${order.customerName},

Vaše objednávka #${order.orderId} byla odeslána.

${trackingInfo}

S pozdravem,
Tým ZION Terra Nova
`,
    `Hello ${order.customerName},

your order #${order.orderId} has been dispatched.

${trackingInfo}

Best regards,
The ZION Terra Nova team
`,
  );

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
  lang?: EmailLang;
}

export async function sendCustomerWalletEmail(input: CustomerWalletInput): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const cfg = emailConfig();
  const lang = resolveEmailLang(input);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const subject = t(
    `Vaše ZION peněženka - objednávka #${input.orderId}`,
    `Your ZION wallet - order #${input.orderId}`,
  );

  const html = buildRastaEmail({
    lang,
    title: subject,
    badge: t('🔐 ZION PENĚŽENKA 🔐', '🔐 ZION WALLET 🔐'),
    heroEmoji: '🔐',
    headline: t('Vaše ZION peněženka', 'Your ZION wallet'),
    intro: t(
      `K objednávce <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong> jsme Vám vytvořili ZION L1 peněženku — po zaplacení na ni připíšeme Váš bonus. ⚡`,
      `We created a ZION L1 wallet for your order <strong style="color:#FFD700;">#${escapeHtml(input.orderId)}</strong> — your bonus is credited to it once paid. ⚡`,
    ),
    content:
      rastaCard({
        heading: t('📍 Adresa peněženky', '📍 Wallet address'),
        body: rastaMonoBox(t('ZION L1 adresa:', 'ZION L1 address:'), input.address),
      }) +
      rastaCard({
        heading: t('🌱 Seed phrase (12 slov)', '🌱 Seed phrase (12 words)'),
        body: rastaMonoBox(t('Seed phrase — uchovejte offline:', 'Seed phrase — keep it offline:'), input.seed) +
          rastaWarning(
            t(
              '⚠️ <strong>DŮLEŽITÉ:</strong> Seed phrase si uložte na bezpečném místu — je to jediný způsob, jak získat plný přístup k Vašim tokenům. Nikomu ji neukazujte.',
              '⚠️ <strong>IMPORTANT:</strong> store the seed phrase in a safe place — it is the only way to gain full access to your tokens. Never show it to anyone.',
            ),
          ),
        tone: 'gold',
      }),
  });

  const body = t(
    `Dobrý den, ${input.customerName},

k objednávce #${input.orderId} jsme pro Vás automaticky vytvořili ZION L1 peněženku,
na kterou Vám bude po zaplacení odeslán bonus v ZION tokenech.

Vaše adresa: ${input.address}
Seed phrase (12 slov): ${input.seed}

⚠️ DŮLEŽITÉ: Uložte si seed phrase na bezpečném místu. Toto je jediný způsob,
jak získat plný přístup k Vašim tokenům v budoucnu. Nikomu jej neukazujte.

S pozdravem,
Tým ZION Terra Nova
`,
    `Hello ${input.customerName},

we automatically created a ZION L1 wallet for your order #${input.orderId},
to which your ZION token bonus will be sent once the order is paid.

Your address: ${input.address}
Seed phrase (12 words): ${input.seed}

⚠️ IMPORTANT: store the seed phrase in a safe place. It is the only way
to gain full access to your tokens in the future. Never show it to anyone.

Best regards,
The ZION Terra Nova team
`,
  );

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
