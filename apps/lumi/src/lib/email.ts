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

/* Paleta ZION Design Engine B — email-safe hex (žádné CSS proměnné). */
const C = {
  ink: '#101C2B',
  forest: '#344A36',
  parchment: '#F0E1BE',
  parchmentDeep: '#E6D3A8',
  card: '#F8EFD9',
  line: '#D8C5A0',
  amber: '#E7AA4B',
  amberDeep: '#C98A2E',
  amberInk: '#101C2B',
  rust: '#9D493D',
  muted: '#6E6650',
  inkSoft: '#33424B',
  success: '#066928',
} as const;

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Banner e-mailu — JPEG kvůli Outlooku (WebP neumí). 800×420, ~84 KB,
 *  aby Gmail nein clipoval zprávu (~102 KB limit). */
const BANNER_SRC = `${COMPANY.web}/images/lumi-b/email-header.jpg`;
const BANNER_ALT = 'Lumi — dřevěný lampion';

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
  paidBadge: { cs: 'Zaplaceno', en: 'Paid', de: 'Bezahlt' },
  pendingBadge: { cs: 'Čeká na platbu', en: 'Awaiting payment', de: 'Zahlung ausstehend' },
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
  trackOrder: { cs: 'Sledovat objednávku', en: 'Track your order', de: 'Bestellung verfolgen' },
  tagline: {
    cs: 'Dřevěné lampiony · malá série',
    en: 'Wooden lanterns · small batch',
    de: 'Holzlaternen · kleine Serie',
  },
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

/**
 * Základ layoutu v designu B: tmavě lesní hlavička s jantarovým wordmarkem,
 * banner, pergamenná karta s obsahem a patička s firmou. Layout je tabulkový
 * + inline styly — Outlook desktop nepodporuje flex/grid.
 */
function shell(title: string, body: string, opts: { lang?: Lang; banner?: boolean; cta?: { label: string; href: string } } = {}): string {
  const lang = opts.lang ?? 'cs';
  const banner = opts.banner === false ? '' : bannerBlock();
  const preheader = title.includes('Lumi') ? title : `${title} — Lumi`;
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px;"><tr>
        <td align="center" style="border-radius:999px;background:${C.amber};">
          <a href="${esc(opts.cta.href)}" style="display:inline-block;padding:13px 34px;font-family:${SANS};font-size:14px;font-weight:700;color:${C.amberInk};text-decoration:none;border-radius:999px;">${esc(opts.cta.label)}</a>
        </td>
      </tr></table>`
    : '';

  return `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:${C.parchmentDeep};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.parchmentDeep};">
    <tr><td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
        <tr><td style="background:${C.forest};border-radius:18px 18px 0 0;padding:30px 32px 26px;text-align:center;">
          <div style="font-family:${SERIF};font-size:34px;letter-spacing:.16em;color:${C.amber};line-height:1;">LUMI</div>
          <div style="font-family:${SANS};font-size:10px;color:${C.parchment};opacity:.72;letter-spacing:.22em;text-transform:uppercase;margin-top:8px;">${esc(s('tagline', lang))}</div>
        </td></tr>
        ${banner}
        <tr><td style="background:${C.card};border-left:1px solid ${C.line};border-right:1px solid ${C.line};padding:30px 32px 34px;">
          <h1 style="font-family:${SERIF};font-size:23px;line-height:1.25;margin:0 0 18px;color:${C.ink};">${title}</h1>
          ${body}
          ${cta}
        </td></tr>
        <tr><td style="background:${C.parchment};border:1px solid ${C.line};border-top:0;border-radius:0 0 18px 18px;padding:22px 32px 26px;text-align:center;">
          <div style="font-family:${SANS};font-size:11px;line-height:1.8;color:${C.muted};">
            <strong style="color:${C.inkSoft};">${esc(COMPANY.name)}</strong> · ${esc(COMPANY.address)} · ${esc(COMPANY.city)}<br/>
            IČO ${esc(COMPANY.ico)} · <a href="mailto:${esc(COMPANY.email)}" style="color:${C.amberDeep};text-decoration:none;">${esc(COMPANY.email)}</a> ·
            <a href="${esc(COMPANY.web)}" style="color:${C.amberDeep};text-decoration:none;">${esc(COMPANY.web.replace(/^https?:\/\//, ''))}</a>
          </div>
          <div style="font-family:${SANS};font-size:10px;color:${C.muted};opacity:.75;margin-top:10px;">
            <a href="${esc(COMPANY.web)}/obchodni-podminky" style="color:${C.muted};text-decoration:underline;">${lang === 'cs' ? 'Obchodní podmínky' : lang === 'de' ? 'AGB' : 'Terms'}</a>
            &nbsp;·&nbsp;
            <a href="${esc(COMPANY.web)}/ochrana-osobnich-udaju" style="color:${C.muted};text-decoration:underline;">${lang === 'cs' ? 'Ochrana údajů' : lang === 'de' ? 'Datenschutz' : 'Privacy'}</a>
            &nbsp;·&nbsp;
            <a href="${esc(COMPANY.web)}/bezpecnost-produktu" style="color:${C.muted};text-decoration:underline;">${lang === 'cs' ? 'Bezpečnost' : lang === 'de' ? 'Sicherheit' : 'Safety'}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function bannerBlock(): string {
  return `<tr><td>
    <img src="${BANNER_SRC}" alt="${BANNER_ALT}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-left:1px solid ${C.line};border-right:1px solid ${C.line};" />
  </td></tr>`;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemsTable(order: OrderLike, lang: Lang): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:${SANS};font-size:13px;margin:6px 0 4px;">
    <thead><tr>
      <th align="left" style="padding:8px 0;border-bottom:1px solid ${C.line};font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${C.muted};font-weight:600;">${esc(s('items', lang))}</th>
      <th align="right" style="padding:8px 0;border-bottom:1px solid ${C.line};font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${C.muted};font-weight:600;">${esc(s('total', lang))}</th>
    </tr></thead>
    <tbody>
      ${(order.items ?? [])
        .map(
          (item) => `<tr>
            <td style="padding:9px 0;border-bottom:1px solid ${C.parchmentDeep};color:${C.ink};">${esc(pick(item.name, lang))} <span style="color:${C.muted};">× ${item.quantity}</span></td>
            <td align="right" style="padding:9px 0;border-bottom:1px solid ${C.parchmentDeep};color:${C.ink};white-space:nowrap;font-weight:600;">${esc(czk(item.lineTotalCzk, lang))}</td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>`;
}

function moneyRows(order: OrderLike, lang: Lang): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:${SANS};font-size:13px;margin-top:8px;">
    <tr><td style="padding:3px 0;color:${C.inkSoft};">${esc(s('shipping', lang))}</td><td align="right" style="padding:3px 0;color:${C.ink};">${order.shippingCzk === 0 ? esc(s('free', lang)) : esc(czk(order.shippingCzk, lang))}</td></tr>
    ${order.codCzk > 0 ? `<tr><td style="padding:3px 0;color:${C.inkSoft};">${esc(s('cod', lang))}</td><td align="right" style="padding:3px 0;color:${C.ink};">${esc(czk(order.codCzk, lang))}</td></tr>` : ''}
    <tr><td style="padding:10px 0 0;border-top:2px solid ${C.ink};font-size:16px;font-weight:700;color:${C.ink};">${esc(s('total', lang))}</td><td align="right" style="padding:10px 0 0;border-top:2px solid ${C.ink};font-size:16px;font-weight:700;color:${C.ink};white-space:nowrap;">${esc(czk(order.totalCzk, lang))}</td></tr>
  </table>`;
}

/** "Jízdenka" s číslem objednávky + stavem platby. */
function orderStub(order: OrderLike, lang: Lang, paid: boolean): string {
  const badgeColor = paid ? C.success : C.amberDeep;
  const badgeBg = paid ? '#E4F2E8' : '#F6E7C8';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border:1px dashed ${C.line};border-radius:12px;background:${C.parchment};">
    <tr>
      <td style="padding:14px 18px;">
        <div style="font-family:${SANS};font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:${C.muted};">${esc(s('orderNumber', lang))}</div>
        <div style="font-family:${SERIF};font-size:24px;font-weight:600;color:${C.ink};margin-top:2px;">${esc(order.orderId)}</div>
      </td>
      <td align="right" valign="middle" style="padding:14px 18px;">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">${esc(s(paid ? 'paidBadge' : 'pendingBadge', lang))}</span>
      </td>
    </tr>
  </table>`;
}

function bankBlock(order: OrderLike, lang: Lang): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0 4px;border:1px solid ${C.line};border-left:4px solid ${C.forest};border-radius:10px;background:${C.parchment};">
    <tr><td style="padding:16px 18px;font-family:${SANS};font-size:13px;line-height:1.9;color:${C.ink};">
      <strong style="color:${C.forest};">${esc(s('payTransfer', lang))}</strong><br/>
      ${esc(s('account', lang))}: <strong>${esc(COMPANY.bankAccount)}</strong><br/>
      IBAN: <strong>${esc(COMPANY.iban)}</strong><br/>
      ${esc(s('variableSymbol', lang))}: <strong style="color:${C.amberDeep};">${esc(order.variableSymbol ?? order.orderId)}</strong><br/>
      ${esc(s('amount', lang))}: <strong>${esc(czk(order.totalCzk, lang))}</strong>
    </td></tr>
  </table>`;
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
  return `<p style="font-family:${SANS};font-size:13px;margin:14px 0 0;color:${C.inkSoft};"><strong style="color:${C.ink};">${esc(s('shipping', lang))}:</strong> ${esc(label)}${destination ? ` — ${esc(destination)}` : ''}</p>`;
}

function signature(order: OrderLike, lang: Lang): string {
  return `<p style="font-family:${SERIF};font-size:15px;margin:22px 0 0;color:${C.ink};">${esc(s('close', lang))}<br/><strong>Lumi · ${esc(COMPANY.name)}</strong></p>`;
}

function fireNote(lang: Lang): string {
  return `<p style="font-family:${SANS};font-size:12px;line-height:1.7;color:${C.rust};margin:16px 0 0;padding:12px 14px;border:1px solid ${C.rust};border-radius:10px;background:#FBF1EA;">${esc(s('fire', lang))}</p>`;
}

export async function sendOrderConfirmation(order: OrderLike, opts: { paid?: boolean } = {}): Promise<boolean> {
  const lang: Lang = order.lang === 'en' || order.lang === 'de' ? order.lang : 'cs';
  const subject = opts.paid ? subjectPaid(lang, order.orderId) : subjectNew(lang, order.orderId);
  const body = `
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;margin:0 0 10px;color:${C.ink};">${esc(s('hello', lang))} ${esc(order.customerName)},</p>
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;margin:0 0 14px;color:${C.inkSoft};">${esc(s('thanksOrder', lang))}</p>
    ${orderStub(order, lang, Boolean(opts.paid))}
    ${itemsTable(order, lang)}
    ${moneyRows(order, lang)}
    ${opts.paid ? `<p style="font-family:${SANS};font-size:14px;line-height:1.8;margin:14px 0;color:${C.success};font-weight:600;">${esc(s('paid', lang))}</p>` : order.payment === 'transfer' ? bankBlock(order, lang) : ''}
    ${shippingLine(order, lang)}
    <p style="font-family:${SANS};font-size:12px;line-height:1.7;color:${C.inkSoft};margin:14px 0 0;">${esc(s('lead', lang))}</p>
    ${fireNote(lang)}
    <p style="font-family:${SANS};font-size:13px;line-height:1.8;margin:18px 0 0;color:${C.inkSoft};">${esc(s('contact', lang))} <a href="mailto:${esc(COMPANY.email)}" style="color:${C.amberDeep};text-decoration:none;">${esc(COMPANY.email)}</a></p>
    ${signature(order, lang)}
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

  return send(
    order.customerEmail,
    subject,
    shell(subject, body, {
      lang,
      cta: { label: s('trackOrder', lang), href: `${COMPANY.web}/objednavka/${encodeURIComponent(order.orderId)}` },
    }),
    plain,
  );
}

export async function sendAdminOrderNotification(order: OrderLike): Promise<boolean> {
  const subject = `Nová objednávka ${order.orderId} — ${czk(order.totalCzk, 'cs')}`;
  const body = `
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.ink};">Nová objednávka z Lumi.</p>
    <p style="font-family:${SANS};font-size:13px;line-height:1.9;color:${C.inkSoft};">
      <strong>${esc(order.customerName)}</strong><br/>
      ${esc(order.customerEmail)} · ${esc(order.customerPhone)}<br/>
      ${order.companyName ? `${esc(order.companyName)} · IČO ${esc(order.buyerIco)} · DIČ ${esc(order.buyerDic ?? '—')}<br/>` : ''}
      ${order.addressStreet ? `${esc(order.addressStreet)}, ${esc(order.addressZip)} ${esc(order.addressCity)}<br/>` : ''}
      ${order.pickupPoint ? `Výdejní místo: ${esc(order.pickupPoint)}<br/>` : ''}
      Platba: ${esc(order.payment)} · Doprava: ${esc(order.shipping)}
    </p>
    ${itemsTable(order, 'cs')}
    ${moneyRows(order, 'cs')}
    ${order.note ? `<p style="font-family:${SANS};font-size:13px;background:${C.parchment};border:1px solid ${C.line};border-radius:8px;padding:10px 12px;color:${C.inkSoft};">Poznámka: ${esc(order.note)}</p>` : ''}
  `;
  return send(ADMIN, subject, shell(subject, body, { lang: 'cs' }), `Nová objednávka ${order.orderId} — ${czk(order.totalCzk, 'cs')}`);
}

export async function sendShippingNotification(order: OrderLike): Promise<boolean> {
  const lang: Lang = order.lang === 'en' || order.lang === 'de' ? order.lang : 'cs';
  const subject = `${s('shippedSubject', lang)} — ${order.orderId}`;
  const body = `
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;margin:0 0 10px;color:${C.ink};">${esc(s('hello', lang))} ${esc(order.customerName)},</p>
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;margin:0 0 14px;color:${C.inkSoft};">${esc(s('shipped', lang))}</p>
    ${orderStub(order, lang, order.paymentStatus === 'paid')}
    ${order.trackingNumber ? `<p style="font-family:${SANS};font-size:14px;margin:0 0 8px;color:${C.ink};"><strong>${esc(s('tracking', lang))}:</strong> <span style="font-family:${SERIF};font-size:17px;letter-spacing:.04em;">${esc(order.trackingNumber)}</span></p>` : ''}
    ${fireNote(lang)}
    ${signature(order, lang)}
  `;
  return send(
    order.customerEmail,
    subject,
    shell(subject, body, {
      lang,
      cta: { label: s('trackOrder', lang), href: `${COMPANY.web}/objednavka/${encodeURIComponent(order.orderId)}` },
    }),
    `${subject}\n${order.trackingNumber ?? ''}`,
  );
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
    <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.ink};">Nová poptávka z webu Lumi.</p>
    <p style="font-family:${SANS};font-size:13px;line-height:1.9;color:${C.inkSoft};">
      <strong>${esc(inquiry.name)}</strong><br/>
      ${esc(inquiry.email)}${inquiry.phone ? ` · ${esc(inquiry.phone)}` : ''}<br/>
      ${inquiry.company ? `Firma/místo: ${esc(inquiry.company)}<br/>` : ''}
      ${inquiry.eventDate ? `Datum akce: ${esc(inquiry.eventDate)}<br/>` : ''}
      ${inquiry.quantity ? `Počet kusů: ${esc(inquiry.quantity)}<br/>` : ''}
      Typ: ${esc(inquiry.type)}
    </p>
    <p style="font-family:${SANS};font-size:13px;background:${C.parchment};border:1px solid ${C.line};border-radius:10px;padding:12px 14px;line-height:1.7;color:${C.ink};">${esc(inquiry.message).replace(/\n/g, '<br/>')}</p>
  `;
  const ok = await send(ADMIN, subject, shell(subject, body, { lang: 'cs' }), `${inquiry.name} (${inquiry.email})\n${inquiry.message}`);
  if (inquiry.email) {
    const thanks =
      'Děkujeme za poptávku. Ozveme se do jednoho pracovního dne.\n\nThank you for your enquiry. We will get back to you within one working day.';
    await send(
      inquiry.email,
      'Lumi — poptávka přijata / enquiry received',
      shell(
        'Děkujeme',
        `<p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.ink};">Děkujeme za poptávku. Ozveme se do jednoho pracovního dne.</p>
         <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.inkSoft};">Thank you for your enquiry. We will get back to you within one working day.</p>`,
        { lang: 'cs' },
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
  return send(
    email,
    subject,
    shell(subject, `<p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.ink};">${esc(text)}</p>`, { lang, banner: true }),
    text,
  );
}
