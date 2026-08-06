import type { OrderEmailData } from './email';
import type { ShopTheme } from './settings';

const COMPANY = {
  name: 'Omnity.One s.r.o.',
  bankAccount: '2901809148 / 2010',
  iban: 'CZ63 2010 0000 0029 0180 9148',
  swift: 'FIOBCZPPXXX',
  bankName: 'Fio banka, a.s.',
  supportEmail: 'admin@newearth.cz',
  shopUrl: 'https://market.zionterranova.com',
};

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

function paymentMethodText(method: string): string {
  if (method === 'card' || method === 'stripe') return 'Platba kartou';
  if (method === 'transfer') return 'Bankovní převod';
  if (method === 'cash') return 'Hotově / Dobírka';
  if (method === 'crypto') return 'Kryptoměna';
  return method || 'Neuvedeno';
}

function shippingMethodText(method: string): string {
  if (method === 'zasilkovna-home') return 'Doručení domů (Zásilkovna)';
  if (method === 'zasilkovna') return 'Výdejní místo Zásilkovna';
  if (method?.includes('virtualni')) return 'Digitální doručení';
  return method || 'Neuvedeno';
}

function paymentStatusText(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return 'Zaplaceno';
  if (s === 'pending') return 'Čeká na platbu';
  if (s === 'failed') return 'Zrušeno';
  return status || 'Neuvedeno';
}

interface ThemePalette {
  bg: string;
  card: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
  border: string;
  borderSubtle: string;
  headerFallback: string;
  itemsBg: string;
  itemsBoxBg: string;
  itemsBorder: string;
  paymentBg: string;
  paymentBorder: string;
  nextBg: string;
  tokenBoxBg: string;
  orderBoxBg: string;
  innerBg: string;
  outerBg: string;
  subBoxBg: string;
  successIconBg: string;
  successIconText: string;
  footerBg: string;
}

function themePalette(theme: ShopTheme): ThemePalette {
  if (theme === 'zion') {
    return {
      bg: '#090a0f',
      card: '#0f111a',
      surface: 'rgba(255,255,255,0.04)',
      text: '#e5e7eb',
      muted: '#94a3b8',
      accent: '#fcd116',
      accent2: '#078930',
      accent3: '#e41e2b',
      border: 'rgba(255,255,255,0.12)',
      borderSubtle: 'rgba(255,255,255,0.08)',
      headerFallback: '#078930',
      itemsBg: '#0d1219',
      itemsBoxBg: '#1a0d10',
      itemsBorder: 'rgba(7,137,48,0.45)',
      paymentBg: '#0f172a',
      paymentBorder: 'rgba(252,209,22,0.40)',
      nextBg: '#0d1a10',
      tokenBoxBg: '#0d2a1a',
      orderBoxBg: '#0d1219',
      innerBg: '#080a10',
      outerBg: '#050608',
      subBoxBg: '#0f1219',
      successIconBg: '#078930',
      successIconText: '#000000',
      footerBg: '#0f172a',
    };
  }
  return {
    bg: '#0a0a0a',
    card: '#0f0f0f',
    surface: 'rgba(255,255,255,0.04)',
    text: '#e5e7eb',
    muted: '#9af59a',
    accent: '#fcd116',
    accent2: '#078930',
    accent3: '#e41e2b',
    border: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.08)',
    headerFallback: '#078930',
    itemsBg: '#0d1a0f',
    itemsBoxBg: '#1a0d10',
    itemsBorder: 'rgba(7,137,48,0.45)',
    paymentBg: '#1a160d',
    paymentBorder: 'rgba(252,209,22,0.40)',
    nextBg: '#0d1a10',
    tokenBoxBg: '#0d2a1a',
    orderBoxBg: '#0d1a0f',
    innerBg: '#080808',
    outerBg: '#050505',
    subBoxBg: '#161616',
    successIconBg: '#0a7a2a',
    successIconText: '#000000',
    footerBg: '#0d0d0d',
  };
}

function formatAddress(order: OrderEmailData): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

function formatItemsHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themePalette(theme);
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return `<tr><td style="color:${t.muted};font-size:15px;text-align:center;padding:14px 0;">Zadne polozky</td></tr>`;
  }

  const rows = items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const unitPrice = Math.round((raw.priceCzk as number) || 0);
      const total = qty * unitPrice;
      const name = String(raw.name ?? 'Produkt');
      const sku = raw.sku
        ? ` <span style="color:#999999;font-size:13px;">SKU: ${escapeHtml(String(raw.sku))}</span>`
        : '';
      return `
        <tr>
          <td style="color:${t.text};font-size:15px;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;">
            <strong style="color:${t.text};">${escapeHtml(name)}</strong>${sku}
          </td>
          <td style="color:${t.muted};font-size:15px;text-align:center;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;width:80px;">${qty}x</td>
          <td style="color:${t.accent};font-size:16px;text-align:right;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;width:120px;font-weight:600;">${formatPrice(total)}</td>
        </tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

function formatItemsText(order: OrderEmailData): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return 'Zadne polozky';
  return items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const unitPrice = Math.round((raw.priceCzk as number) || 0);
      const total = qty * unitPrice;
      const name = String(raw.name ?? 'Produkt');
      const sku = raw.sku ? ` (SKU: ${String(raw.sku)})` : '';
      return `- ${name}${sku} - ${qty}x - ${formatPrice(total)}`;
    })
    .join('\n');
}

function formatShippingHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themePalette(theme);
  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    if (pp?.name) {
      address = `Vydejni misto: ${escapeHtml(String(pp.name))}, ${escapeHtml(String(pp.city ?? ''))}`;
    } else {
      address = 'Zasilkovna - vydejni misto (bude upreseno)';
    }
  } else if (order.shipping?.includes('virtualni')) {
    address = 'Digitalni doruceni / online prevzeti';
  } else {
    address = escapeHtml(order.shipping);
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.paymentBg}" style="border-collapse:collapse;margin-bottom:32px;background-color:${t.paymentBg};border:1px solid ${t.paymentBorder};border-radius:12px;">
      <tr><td style="padding:24px 20px;">
        <h3 style="color:${t.accent};margin:0 0 16px 0;font-size:18px;text-align:center;letter-spacing:0.5px;font-weight:700;">Dodaci adresa</h3>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid ${t.borderSubtle};border-radius:8px;">
          <tr><td style="padding:16px;color:${t.text};font-size:14px;line-height:1.6;">
            ${escapeHtml(order.customerName)}<br>
            ${address}<br><br>
            <strong style="color:${t.muted};">Zpusob doruceni:</strong> ${escapeHtml(shippingMethodText(order.shipping))}<br>
            ${order.shippingCzk > 0 ? `<strong style="color:${t.accent};">Postovne:</strong> ${formatPrice(order.shippingCzk)}<br>` : ''}
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

function formatShippingText(order: OrderEmailData): string {
  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    address = pp?.name
      ? `Vydejni misto: ${String(pp.name)}, ${String(pp.city ?? '')}`
      : 'Zasilkovna - vydejni misto (bude upreseno)';
  } else if (order.shipping?.includes('virtualni')) {
    address = 'Digitalni doruceni / online prevzeti';
  } else {
    address = order.shipping;
  }

  return `Dodaci adresa:\n${order.customerName}\n${address}\nZpusob doruceni: ${shippingMethodText(order.shipping)}${
    order.shippingCzk > 0 ? `\nPostovne: ${formatPrice(order.shippingCzk)}` : ''
  }`;
}

async function paymentInstructionsHtml(order: OrderEmailData, theme: ShopTheme): Promise<string> {
  const t = themePalette(theme);
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') {
    return `<tr><td colspan="2" style="color:${t.accent3};font-size:14px;padding-top:12px;text-align:center;"><strong>Platba prijata</strong></td></tr>`;
  }

  if (order.payment === 'transfer') {
    const iban = COMPANY.iban.replace(/\s/g, '');
    const vs = order.orderId.replace(/\D/g, '').slice(0, 10);
    const spd = `SPD*1.0*ACC:${iban}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}${vs ? `*X-VS:${vs}` : ''}`;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(spd)}&size=180&margin=2`;

    return `
      <tr>
        <td colspan="2" style="padding-top:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid ${t.paymentBorder};border-radius:8px;">
            <tr><td style="padding:16px;">
              <p style="color:${t.accent};font-size:14px;margin:0 0 12px 0;font-weight:600;">Instrukce k plate:</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:top;padding-right:16px;color:${t.text};font-size:13px;line-height:1.8;" width="55%">
                    <strong>Cislo uctu:</strong> ${escapeHtml(COMPANY.bankAccount)}<br>
                    <strong>IBAN:</strong> ${escapeHtml(COMPANY.iban)}<br>
                    <strong>Variabilni symbol:</strong> ${escapeHtml(order.orderId)}<br>
                    <strong>Castka:</strong> ${formatPrice(order.totalCzk)}<br>
                    <strong>Zprava:</strong> Objednavka ${escapeHtml(order.orderId)}<br>
                  </td>
                  <td style="vertical-align:top;text-align:center;" width="45%">
                    <img src="${qrUrl}" alt="QR platba" width="150" height="150" style="border-radius:8px;background-color:#ffffff;padding:4px;display:block;margin:0 auto;" />
                    <p style="color:${t.muted};font-size:11px;margin:8px 0 0 0;">Naskenujte v bankovni aplikaci</p>
                  </td>
                </tr>
              </table>
              <p style="color:${t.muted};font-size:12px;margin:12px 0 0 0;text-align:center;">
                Platbu prosim uhaste do 7 dnu. Po prijeti platby Vas budeme kontaktovat.
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    `;
  }

  return '';
}

function paymentInstructionsText(order: OrderEmailData): string {
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') return 'Platba prijata.';

  if (order.payment === 'transfer') {
    return `Instrukce k plate:\nCislo uctu: ${COMPANY.bankAccount}\nIBAN: ${COMPANY.iban}\nVariabilni symbol: ${order.orderId}\nCastka: ${formatPrice(order.totalCzk)}\nZprava: Objednavka ${order.orderId}\n\nPlatbu prosim uhaste do 7 dnu.`;
  }

  return '';
}

function digitalDownloadsHtml(_order: OrderEmailData): string {
  return '';
}

function zionTokenSectionHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themePalette(theme);
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.tokenBoxBg}" style="border-collapse:collapse;margin-bottom:32px;background-color:${t.tokenBoxBg};border:1px solid rgba(0,255,127,0.3);border-radius:12px;">
      <tr><td style="padding:24px 20px;">
        <h3 style="color:#00ff7f;margin:0 0 16px 0;font-size:20px;text-align:center;letter-spacing:0.5px;font-weight:700;">ZION token bonus</h3>
        <p style="color:${t.muted};font-size:15px;margin:0 0 20px 0;line-height:1.6;text-align:center;">
          Za vas nakup jste ziskali <strong style="color:#00ff7f;font-size:18px;">${tokens.toLocaleString('cs-CZ')} ZION</strong> jako podekovani.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border-radius:8px;">
          <tr><td style="padding:16px;color:#8a8f94;font-size:13px;line-height:1.6;">
            Tokeny budou pripisany po spusteni odmenovaciho programu. Pro dotazy kontaktujte ${escapeHtml(COMPANY.supportEmail)}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

function zionTokenSectionText(order: OrderEmailData): string {
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';
  return `ZION token bonus:\nZa vas nakup jste ziskali ${tokens.toLocaleString('cs-CZ')} ZION.\nTokeny budou pripisany po spusteni odmenovaciho programu.`;
}

export async function buildV2OrderConfirmationHtml(
  order: OrderEmailData,
  theme: ShopTheme = 'rasta'
): Promise<string> {
  return (await buildV2OrderConfirmationEmail(order, theme)).html;
}

export async function buildV2OrderConfirmationEmail(
  order: OrderEmailData,
  theme: ShopTheme = 'rasta'
): Promise<{ html: string; text: string }> {
  const t = themePalette(theme);
  const orderDate = new Date().toLocaleDateString('cs-CZ');
  const itemsHtml = formatItemsHtml(order, theme);
  const shippingHtml = formatShippingHtml(order, theme);
  const paymentInstructions = await paymentInstructionsHtml(order, theme);
  const paymentStatus = paymentStatusText(order.paymentStatus);
  const statusColor = '#078930';
  const paymentMethod = paymentMethodText(order.payment);
  const processingInfo =
    order.paymentStatus.toLowerCase() === 'paid'
      ? 'Vasi objednavku nyni zpracovavame a pripravujeme k odeslani'
      : 'Po obdrzeni platby zacneme okamzite zpracovavat vasi objednavku';
  const deliveryInfo =
    order.paymentStatus.toLowerCase() === 'paid'
      ? 'Ocekavana dodaci lhuta 3-5 pracovnich dnu'
      : 'Po zaplaceni ocekavana dodaci lhuta 3-5 pracovnich dnu';

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZION - Potvrzeni objednavky #${escapeHtml(order.orderId)}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:${t.bg};color:${t.text};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.outerBg}" style="background-color:${t.outerBg};padding:32px 12px;border-collapse:collapse;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.card}" style="background-color:${t.card};border-radius:16px;overflow:hidden;border:1px solid ${t.border};max-width:600px;width:100%;border-collapse:collapse;">
        <tr>
          <td bgcolor="${t.headerFallback}" style="background-color:${t.headerFallback};padding:28px 20px;text-align:center;">
            <h1 style="color:${t.accent};margin:0 0 8px 0;font-size:28px;font-weight:700;letter-spacing:0.5px;">ZION TERRA NOVA</h1>
            <p style="color:${t.muted};margin:0;font-size:14px;">Potvrzeni objednavky</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="${t.innerBg}" style="background-color:${t.innerBg};padding:32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr><td align="center" style="text-align:center;padding-bottom:24px;">
                <table align="center" width="64" height="64" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.successIconBg}" style="background-color:${t.successIconBg};border-radius:50%;border-collapse:collapse;">
                  <tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle;color:${t.successIconText};font-size:32px;font-weight:bold;">OK</td></tr>
                </table>
                <h2 style="color:${t.accent};margin:16px 0 0 0;font-size:24px;font-weight:700;">Objednavka prijata</h2>
                <p style="color:${t.muted};margin:12px 0 0 0;font-size:15px;line-height:1.5;">
                  Dekujeme za duveru. Vase objednavka byla uspesne zpracovana.
                </p>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.orderBoxBg}" style="border-collapse:collapse;margin-bottom:28px;background-color:${t.orderBoxBg};border:1px solid rgba(0,255,0,0.35);border-radius:12px;">
              <tr><td style="padding:24px 20px;">
                <h3 style="color:${t.accent};margin:0 0 18px 0;font-size:18px;text-align:center;font-weight:700;border-bottom:1px solid ${t.borderSubtle};padding-bottom:12px;">Detaily objednavky</h3>
                <table width="100%" cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="color:${t.muted};font-size:14px;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">Cislo objednavky:</td>
                    <td style="color:${t.accent};font-size:15px;text-align:right;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:700;">${escapeHtml(order.orderId)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:14px;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">Jmeno:</td>
                    <td style="color:${t.text};font-size:15px;text-align:right;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};">${escapeHtml(order.customerName)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:14px;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">Email:</td>
                    <td style="color:${t.text};font-size:15px;text-align:right;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};">${escapeHtml(order.customerEmail)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:14px;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">Datum objednavky:</td>
                    <td style="color:${t.text};font-size:15px;text-align:right;padding:8px 0;border-bottom:1px solid ${t.borderSubtle};">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:14px;padding:8px 0;font-weight:600;">Celkova cena:</td>
                    <td style="color:${t.accent};font-size:20px;text-align:right;padding:8px 0;font-weight:700;">${formatPrice(order.totalCzk)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.itemsBoxBg}" style="border-collapse:collapse;margin-bottom:28px;background-color:${t.itemsBoxBg};border:1px solid rgba(220,20,60,0.3);border-radius:12px;">
              <tr><td style="padding:24px 20px;">
                <h3 style="color:${t.accent};margin:0 0 18px 0;font-size:18px;text-align:center;font-weight:700;border-bottom:1px solid ${t.borderSubtle};padding-bottom:12px;">Polozky objednavky</h3>
                ${itemsHtml}
              </td></tr>
            </table>

            ${zionTokenSectionHtml(order, theme)}
            ${digitalDownloadsHtml(order)}
            ${shippingHtml}

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.paymentBg}" style="border-collapse:collapse;margin-bottom:28px;background-color:${t.paymentBg};border:1px solid ${t.paymentBorder};border-radius:12px;">
              <tr><td style="padding:24px 20px;">
                <h3 style="color:${t.accent};margin:0 0 18px 0;font-size:18px;text-align:center;font-weight:700;">Informace o plate</h3>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid rgba(255,215,0,0.2);border-radius:8px;">
                  <tr><td style="padding:20px;">
                    <table width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="color:${t.muted};font-size:14px;font-weight:600;">Zpusob platby:</td>
                        <td style="color:${t.text};font-size:15px;text-align:right;">${escapeHtml(paymentMethod)}</td>
                      </tr>
                      <tr>
                        <td style="color:${t.muted};font-size:14px;font-weight:600;padding-top:6px;">Status platby:</td>
                        <td style="text-align:right;padding-top:6px;">
                          <span style="display:inline-block;padding:5px 14px;background-color:${statusColor};color:#000000;font-weight:700;border-radius:6px;font-size:13px;">${escapeHtml(paymentStatus)}</span>
                        </td>
                      </tr>
                      ${paymentInstructions}
                    </table>
                  </td></tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.nextBg}" style="border-collapse:collapse;margin-bottom:20px;background-color:${t.nextBg};border:1px solid rgba(0,255,0,0.25);border-radius:12px;">
              <tr><td style="padding:20px;">
                <h3 style="color:${t.accent};margin:0 0 14px 0;font-size:17px;text-align:center;font-weight:700;">Co bude dal?</h3>
                <ul style="color:${t.muted};font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
                  <li style="margin-bottom:8px;"><strong>Potvrzeni:</strong> Tymto emailem potvrzujeme prijeti objednavky</li>
                  <li style="margin-bottom:8px;"><strong>Zpracovani:</strong> ${processingInfo}</li>
                  <li style="margin-bottom:8px;"><strong>Doruceni:</strong> ${deliveryInfo}</li>
                  <li><strong>Podpora:</strong> Pro dotazy kontaktujte ${escapeHtml(COMPANY.supportEmail)}</li>
                </ul>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${t.footerBg}" style="background-color:${t.footerBg};padding:24px 20px;text-align:center;border-top:1px solid ${t.border};">
            <p style="color:${t.muted};font-size:14px;margin:0 0 8px 0;font-weight:600;">Peace & One Love</p>
            <p style="color:#888888;font-size:12px;margin:0 0 8px 0;line-height:1.5;">
              Tento email byl odeslan z <strong style="color:${t.accent};">ZION eShop</strong><br>
              Pro dotazy kontaktujte ${escapeHtml(COMPANY.supportEmail)}
            </p>
            <table align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.successIconBg}" style="border-collapse:collapse;margin:12px 0;background-color:${t.successIconBg};border-radius:6px;text-align:center;">
              <tr><td style="padding:10px 22px;">
                <a href="${escapeHtml(COMPANY.shopUrl)}" style="color:#000000;text-decoration:none;font-weight:700;font-size:14px;">Prejit do eshopu</a>
              </td></tr>
            </table>
            <p style="color:#666666;font-size:11px;margin:8px 0 0 0;">&copy; 2026 ZION Terra Nova. All Rights Reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `ZION TERRA NOVA - Potvrzeni objednavky
=====================================

Objednavka prijata.

Dekujeme za duveru. Vase objednavka byla uspesne zpracovana.

Detaily objednavky:
  Cislo objednavky: ${order.orderId}
  Jmeno: ${order.customerName}
  Email: ${order.customerEmail}
  Datum: ${orderDate}
  Celkova cena: ${formatPrice(order.totalCzk)}

Polozky:
${formatItemsText(order)}

${zionTokenSectionText(order)}

${formatShippingText(order)}

Informace o plate:
  Zpusob platby: ${paymentMethod}
  Status: ${paymentStatus}
  ${paymentInstructionsText(order).replace(/\n/g, '\n  ')}

Co bude dal:
- Potvrzeni: Tymto emailem potvrzujeme prijeti objednavky
- Zpracovani: ${processingInfo}
- Doruceni: ${deliveryInfo}
- Podpora: Pro dotazy kontaktujte ${COMPANY.supportEmail}

Prejit do eshopu: ${COMPANY.shopUrl}

Peace & One Love
ZION Terra Nova
`;

  return { html, text };
}
