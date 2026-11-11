import nodemailer, { type Transporter } from 'nodemailer';
import { COMPANY, supportEmail } from '@/lib/company';
import type { Localized } from '@/lib/i18n';
import { pick } from '@/lib/i18n';
import type { OrderLike } from '@/lib/order-types';
import { SHIPPING_OPTIONS } from '@/types/shop';

type Lang = 'cs' | 'en' | 'de';

const FROM = process.env.LUMI_EMAIL_FROM || `Lumi <${supportEmail()}>`;
const REPLY_TO = process.env.LUMI_EMAIL_REPLY_TO || supportEmail();
const ADMIN = process.env.LUMI_ADMIN_EMAIL?.trim() || supportEmail();

let cached: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    cached = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587) || 587;
  const user = process.env.SMTP_USER?.trim();
  cached = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === '1' || port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASSWORD ?? '' } : undefined,
  });
  return cached;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

async function send(to: string, subject: string, html: string, text: string, replyTo = REPLY_TO): Promise<boolean> {
  const tx = transport();
  if (!tx) {
    console.info(`[lumi-email] SMTP není nastaveno — e-mail „${subject}“ pro ${to} se neodeslal.`);
    return false;
  }
  try {
    await tx.sendMail({ from: FROM, to, replyTo, subject, html, text });
    return true;
  } catch (error) {
    console.error(`[lumi-email] Odeslání „${subject}“ na ${to} selhalo:`, error);
    return false;
  }
}

function czk(value: number, lang: Lang): string {
  const locale = lang === 'cs' ? 'cs-CZ' : lang === 'de' ? 'de-DE' : 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
}

const STR = {
  hello: { cs: 'Dobrý den', en: 'Hello', de: 'Guten Tag' },
  thanksOrder: {
    cs: 'děkujeme za objednávku v dílně Lumi.',
    en: 'thank you for your order at the Lumi workshop.',
    de: 'danke für Ihre Bestellung in der Lumi-Werkstatt.',
  },
  orderNumber: { cs: 'Číslo objednávky', en: 'Order number', de: 'Bestellnummer' },
  items: { cs: 'Objednávka', en: 'Your order', de: 'Ihre Bestellung' },
  total: { cs: 'Celkem', en: 'Total', de: 'Gesamt' },
  shipping: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
  cod: { cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' },
  free: { cs: 'zdarma', en: 'free', de: 'kostenlos' },
  payTransfer: {
    cs: 'Zaplaťte prosím převodem na účet níže. Jako variabilní symbol použijte číslo objednávky.',
    en: 'Please pay by transfer to the account below. Use the order number as the payment reference.',
    de: 'Bitte überweisen Sie auf das untenstehende Konto. Verwenden Sie die Bestellnummer als Verwendungszweck.',
  },
  account: { cs: 'Účet', en: 'Account', de: 'Konto' },
  variableSymbol: { cs: 'Variabilní symbol', en: 'Payment reference', de: 'Verwendungszweck' },
  amount: { cs: 'Částka', en: 'Amount', de: 'Betrag' },
  paid: {
    cs: 'Platba dorazila, objednávku jsme zařadili do výroby.',
    en: 'Payment received — your order is in production.',
    de: 'Zahlung eingegangen — Ihre Bestellung ist in Produktion.',
  },
  fire: {
    cs: 'Připomínáme bezpečnost: svíčku vždy do sklenice, na nehořlavý podklad, pod dohledem a mimo dosah dětí. Lampion je ze dřeva.',
    en: 'A safety reminder: always use the candle in a glass, on a non-flammable base, attended and out of reach of children. The lantern is made of wood.',
    de: 'Sicherheitshinweis: Kerze immer im Glas, auf nicht brennbarer Unterlage, beaufsichtigt und außerhalb der Reichweite von Kindern. Die Laterne ist aus Holz.',
  },
  lead: {
    cs: 'Vyrábíme na zakázku, obvykle odesíláme do 5 pracovních dnů.',
    en: 'We make to order and usually ship within 5 working days.',
    de: 'Wir fertigen auf Bestellung und versenden meist innerhalb von 5 Werktagen.',
  },
  contact: { cs: 'Dotazy? Napište nám na', en: 'Questions? Write to us at', de: 'Fragen? Schreiben Sie uns an' },
  close: { cs: 'Světlo na váš stůl přeje', en: 'A light for your table,', de: 'Ein Licht für Ihren Tisch,' },
  shipped: { cs: 'Váš lampion je na cestě.', en: 'Your lantern is on its way.', de: 'Ihre Laterne ist unterwegs.' },
  tracking: { cs: 'Sledovací číslo', en: 'Tracking number', de: 'Sendungsnummer' },
  shippedSubject: { cs: 'Vaše objednávka byla odeslána', en: 'Your order has been shipped', de: 'Ihre Bestellung wurde versendet' },
} as const satisfies Record<string, Localized>;

function s<K extends keyof typeof STR>(key: K, lang: Lang): string {
  return STR[key][lang] || STR[key].cs;
}

function subjectNew(lang: Lang, orderNumber: string): string {
  return lang === 'cs'
    ? `Objednávka ${orderNumber} — Lumi`
    : lang === 'de'
      ? `Bestellung ${orderNumber} — Lumi`
      : `Order ${orderNumber} — Lumi`;
}

function subjectPaid(lang: Lang, orderNumber: string): string {
  return lang === 'cs'
    ? `Platba dorazila — objednávka ${orderNumber}`
    : lang === 'de'
      ? `Zahlung eingegangen — Bestellung ${orderNumber}`
      : `Payment received — order ${orderNumber}`;
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F0E1BE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#101C2B;">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px;">
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-family:Georgia,serif;font-size:30px;letter-spacing:.08em;">LUMI</div>
      <div style="font-size:11px;color:#6E6650;letter-spacing:.12em;text-transform:uppercase;margin-top:2px;">Dřevěné lampiony</div>
    </div>
    <div style="background:#F8EFD9;border:1px solid #D8C5A0;border-radius:14px;padding:26px;">
      <h1 style="font-family:Georgia,serif;font-size:21px;margin:0 0 14px;">${title}</h1>
      ${body}
    </div>
    <p style="text-align:center;font-size:11px;color:#6E6650;line-height:1.7;margin-top:20px;">
      ${COMPANY.name} · ${COMPANY.address} · ${COMPANY.city}<br/>
      IČO ${COMPANY.ico} · ${COMPANY.email}
    </p>
  </div>
</body></html>`;
}

function itemsTable(order: OrderLike, lang: Lang): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:14px 0;">
    <thead><tr>
      <th style="text-align:left;padding:6px 0;border-bottom:1px solid #D8C5A0;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6E6650;">${s('items', lang)}</th>
      <th style="text-align:right;padding:6px 0;border-bottom:1px solid #D8C5A0;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6E6650;">${s('total', lang)}</th>
    </tr></thead>
    <tbody>
      ${(order.items ?? [])
        .map(
          (item) => `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #E6D3A8;">${pick(item.name, lang)} × ${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #E6D3A8;text-align:right;white-space:nowrap;">${czk(item.lineTotalCzk, lang)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>`;
}

function moneyRows(order: OrderLike, lang: Lang): string {
  return `<div style="font-size:13px;line-height:1.9;">
    <div style="display:flex;justify-content:space-between;"><span>${s('shipping', lang)}</span><span>${order.shippingCzk === 0 ? s('free', lang) : czk(order.shippingCzk, lang)}</span></div>
    ${order.codCzk > 0 ? `<div style="display:flex;justify-content:space-between;"><span>${s('cod', lang)}</span><span>${czk(order.codCzk, lang)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;border-top:1px solid #D8C5A0;margin-top:6px;padding-top:8px;font-size:16px;font-weight:700;"><span>${s('total', lang)}</span><span>${czk(order.totalCzk, lang)}</span></div>
  </div>`;
}

function bankBlock(order: OrderLike, lang: Lang): string {
  return `<div style="background:#F0E1BE;border:1px solid #D8C5A0;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.9;margin:16px 0;">
    <strong>${s('payTransfer', lang)}</strong><br/>
    ${s('account', lang)}: ${COMPANY.bankAccount}<br/>
    IBAN: ${COMPANY.iban}<br/>
    ${s('variableSymbol', lang)}: <strong>${order.variableSymbol ?? order.orderId}</strong><br/>
    ${s('amount', lang)}: <strong>${czk(order.totalCzk, lang)}</strong>
  </div>`;
}

function shippingLine(order: OrderLike, lang: Lang): string {
  const option = SHIPPING_OPTIONS.find((entry) => entry.value === order.shipping);
  const label = option ? pick(option.label, lang) : order.shipping;
  const destination =
    order.shipping === 'zasilkovna'
      ? order.pickupPoint
      : order.shipping === 'zasilkovna-home'
        ? [order.addressStreet, order.addressZip, order.addressCity].filter(Boolean).join(', ')
        : 'Osobní odběr po domluvě';
  return `<p style="font-size:13px;margin:0 0 6px;"><strong>${s('shipping', lang)}:</strong> ${label}${destination ? ` — ${destination}` : ''}</p>`;
}

export async function sendOrderConfirmation(order: OrderLike, opts: { paid?: boolean } = {}): Promise<boolean> {
  const lang: Lang = order.lang === 'en' || order.lang === 'de' ? order.lang : 'cs';
  const subject = opts.paid ? subjectPaid(lang, order.orderId) : subjectNew(lang, order.orderId);
  const body = `
    <p style="font-size:14px;line-height:1.8;margin:0 0 10px;">${s('hello', lang)} ${order.customerName},</p>
    <p style="font-size:14px;line-height:1.8;margin:0 0 10px;">${s('thanksOrder', lang)}</p>
    <p style="font-size:13px;margin:0 0 4px;color:#33424B;">${s('orderNumber', lang)}: <strong style="color:#101C2B;">${order.orderId}</strong></p>
    ${itemsTable(order, lang)}
    ${moneyRows(order, lang)}
    ${opts.paid ? `<p style="font-size:14px;line-height:1.8;margin:14px 0;">${s('paid', lang)}</p>` : order.payment === 'transfer' ? bankBlock(order, lang) : ''}
    ${shippingLine(order, lang)}
    <p style="font-size:12px;line-height:1.7;color:#33424B;margin:12px 0 0;">${s('lead', lang)}</p>
    <p style="font-size:12px;line-height:1.7;color:#9D493D;margin:12px 0 0;">${s('fire', lang)}</p>
    <p style="font-size:13px;line-height:1.8;margin:18px 0 0;">${s('contact', lang)} <a href="mailto:${COMPANY.email}" style="color:#C98A2E;">${COMPANY.email}</a></p>
    <p style="font-size:14px;margin:16px 0 0;">${s('close', lang)}<br/><strong>Lumi · ${COMPANY.name}</strong></p>
  `;
  const plain = [
    `${s('hello', lang)} ${order.customerName},`,
    s('thanksOrder', lang),
    `${s('orderNumber', lang)}: ${order.orderId}`,
    ...(order.items ?? []).map((item) => `${pick(item.name, lang)} x${item.quantity} — ${czk(item.lineTotalCzk, lang)}`),
    `${s('total', lang)}: ${czk(order.totalCzk, lang)}`,
    order.payment === 'transfer' && !opts.paid
      ? `${s('payTransfer', lang)}\n${COMPANY.bankAccount} · IBAN ${COMPANY.iban} · VS ${order.variableSymbol ?? order.orderId}`
      : '',
    s('fire', lang),
  ]
    .filter(Boolean)
    .join('\n');

  return send(order.customerEmail, subject, shell(subject, body), plain);
}

export async function sendAdminOrderNotification(order: OrderLike): Promise<boolean> {
  const subject = `Nová objednávka ${order.orderId} — ${czk(order.totalCzk, 'cs')}`;
  const body = `
    <p style="font-size:14px;line-height:1.8;">Nová objednávka z Lumi.</p>
    <p style="font-size:13px;line-height:1.9;">
      <strong>${order.customerName}</strong><br/>
      ${order.customerEmail} · ${order.customerPhone}<br/>
      ${order.companyName ? `${order.companyName} · IČO ${order.buyerIco} · DIČ ${order.buyerDic ?? '—'}<br/>` : ''}
      ${order.addressStreet ? `${order.addressStreet}, ${order.addressZip} ${order.addressCity}<br/>` : ''}
      ${order.pickupPoint ? `Výdejní místo: ${order.pickupPoint}<br/>` : ''}
      Platba: ${order.payment} · Doprava: ${order.shipping}
    </p>
    ${itemsTable(order, 'cs')}
    ${moneyRows(order, 'cs')}
    ${order.note ? `<p style="font-size:13px;background:#F0E1BE;border-radius:8px;padding:10px;">Poznámka: ${order.note}</p>` : ''}
  `;
  return send(ADMIN, subject, shell(subject, body), `Nová objednávka ${order.orderId} — ${czk(order.totalCzk, 'cs')}`);
}

export async function sendShippingNotification(order: OrderLike): Promise<boolean> {
  const lang: Lang = order.lang === 'en' || order.lang === 'de' ? order.lang : 'cs';
  const subject = `${s('shippedSubject', lang)} — ${order.orderId}`;
  const body = `
    <p style="font-size:14px;line-height:1.8;">${s('hello', lang)} ${order.customerName},</p>
    <p style="font-size:14px;line-height:1.8;">${s('shipped', lang)}</p>
    ${order.trackingNumber ? `<p style="font-size:14px;"><strong>${s('tracking', lang)}:</strong> ${order.trackingNumber}</p>` : ''}
    <p style="font-size:12px;line-height:1.7;color:#9D493D;margin-top:16px;">${s('fire', lang)}</p>
  `;
  return send(order.customerEmail, subject, shell(subject, body), `${subject}\n${order.trackingNumber ?? ''}`);
}

export interface InquiryEmailData {
  type: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  eventDate?: string | null;
  quantity?: number | null;
  message: string;
}

export async function sendInquiryNotification(inquiry: InquiryEmailData): Promise<boolean> {
  const subject = `Nová poptávka (${inquiry.type}) — ${inquiry.name}`;
  const body = `
    <p style="font-size:14px;line-height:1.8;">Nová poptávka z webu Lumi.</p>
    <p style="font-size:13px;line-height:1.9;">
      <strong>${inquiry.name}</strong><br/>
      ${inquiry.email}${inquiry.phone ? ` · ${inquiry.phone}` : ''}<br/>
      ${inquiry.company ? `Firma/místo: ${inquiry.company}<br/>` : ''}
      ${inquiry.eventDate ? `Datum akce: ${inquiry.eventDate}<br/>` : ''}
      ${inquiry.quantity ? `Počet kusů: ${inquiry.quantity}<br/>` : ''}
      Typ: ${inquiry.type}
    </p>
    <p style="font-size:13px;background:#F0E1BE;border-radius:8px;padding:12px;line-height:1.7;">${inquiry.message
      .replace(/</g, '&lt;')
      .replace(/\n/g, '<br/>')}</p>
  `;
  const ok = await send(ADMIN, subject, shell(subject, body), `${inquiry.name} (${inquiry.email})\n${inquiry.message}`);
  if (inquiry.email) {
    const thanks =
      'Děkujeme za poptávku. Ozveme se do jednoho pracovního dne.\n\nThank you for your enquiry. We will get back to you within one working day.';
    await send(
      inquiry.email,
      'Lumi — poptávka přijata / enquiry received',
      shell(
        'Děkujeme',
        `<p style="font-size:14px;line-height:1.8;">Děkujeme za poptávku. Ozveme se do jednoho pracovního dne.</p>
         <p style="font-size:14px;line-height:1.8;color:#33424B;">Thank you for your enquiry. We will get back to you within one working day.</p>`,
      ),
      thanks,
      ADMIN,
    );
  }
  return ok;
}

export async function sendNewsletterWelcome(email: string, lang: Lang): Promise<boolean> {
  const subject = pick({ cs: 'Lumi — jsme tu pro vás', en: 'Lumi — we are here', de: 'Lumi — wir sind da' }, lang);
  const text = pick(
    {
      cs: 'Děkujeme za odběr. Ozveme se, až bude co ukázat — nové motivy, termíny a fotky z dílny.',
      en: 'Thank you for subscribing. We will write when there is something to show — new motifs, dates and photos from the workshop.',
      de: 'Danke für Ihr Abonnement. Wir melden uns, wenn es etwas zu zeigen gibt — neue Motive, Termine und Fotos aus der Werkstatt.',
    },
    lang,
  );
  return send(email, subject, shell(subject, `<p style="font-size:14px;line-height:1.8;">${text}</p>`), text);
}
