import QRCode from 'qrcode';
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
  headerGradient: string;
  headerFallback: string;
  successBg: string;
  itemsBg: string;
  itemsBorder: string;
  paymentBg: string;
  paymentBorder: string;
  nextBg: string;
  nextBorder: string;
  footerGradient: string;
  footerFallback: string;
  successIconText: string;
  // Gmail-safe solid colors (no gradients/shadows — Gmail strips those)
  successIconBg: string;
  orderBoxBg: string;
  itemsBoxBg: string;
  tokenBoxBg: string;
  tokenBadgeBg: string;
  paymentBoxBg: string;
  nextBoxBg: string;
  innerBg: string;
  outerBg: string;
  warningBg: string;
  subBoxBg: string;
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
      headerGradient: 'linear-gradient(135deg, #078930 0%, #e41e2b 50%, #fcd116 100%)',
      headerFallback: '#e41e2b',
      successBg: '#078930',
      itemsBg: 'rgba(7,137,48,0.10)',
      itemsBorder: 'rgba(7,137,48,0.45)',
      paymentBg: 'rgba(252,209,22,0.08)',
      paymentBorder: 'rgba(252,209,22,0.40)',
      nextBg: 'rgba(7,137,48,0.10)',
      nextBorder: 'rgba(7,137,48,0.35)',
      footerGradient: 'linear-gradient(135deg, #078930 0%, #e41e2b 50%, #fcd116 100%)',
      footerFallback: '#e41e2b',
      successIconText: '#000000',
      successIconBg: '#078930',
      orderBoxBg: '#0d1219',
      itemsBoxBg: '#1a0d10',
      tokenBoxBg: '#0d2a1a',
      tokenBadgeBg: '#078930',
      paymentBoxBg: '#1a160d',
      nextBoxBg: '#0d1a10',
      innerBg: '#0a0c12',
      outerBg: '#050608',
      warningBg: '#2a2008',
      subBoxBg: '#11141c',
    };
  }
  return {
    bg: '#0a0a0a',
    card: '#0f0f0f',
    surface: 'rgba(255,255,255,0.04)',
    text: '#e5e7eb',
    muted: '#9af59a',
    accent: '#fcd116',
    accent2: '#e41e2b',
    accent3: '#078930',
    border: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.08)',
    headerGradient: 'linear-gradient(135deg, #078930 0%, #fcd116 50%, #e41e2b 100%)',
    headerFallback: '#078930',
    successBg: '#078930',
    itemsBg: 'rgba(7,137,48,0.15)',
    itemsBorder: 'rgba(7,137,48,0.45)',
    paymentBg: 'rgba(252,209,22,0.08)',
    paymentBorder: 'rgba(252,209,22,0.40)',
    nextBg: 'rgba(7,137,48,0.12)',
    nextBorder: 'rgba(7,137,48,0.35)',
    footerGradient: 'linear-gradient(135deg, #078930 0%, #fcd116 50%, #e41e2b 100%)',
    footerFallback: '#078930',
    successIconText: '#000000',
    successIconBg: '#0a7a2a',
    orderBoxBg: '#0d1a0f',
    itemsBoxBg: '#1a0d10',
    tokenBoxBg: '#0d2a1a',
    tokenBadgeBg: '#00b34a',
    paymentBoxBg: '#1a160d',
    nextBoxBg: '#0d1a10',
    innerBg: '#080808',
    outerBg: '#050505',
    warningBg: '#2a2008',
    subBoxBg: '#161616',
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
    return `<tr><td style="color:${t.muted};font-size:15px;text-align:center;padding:14px 0;">Žádné položky</td></tr>`;
  }

  const rows = items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const unitPrice = Math.round((raw.priceCzk as number) || 0);
      const total = qty * unitPrice;
      const name = String(raw.name ?? 'Produkt');
      const sku = raw.sku ? ` <span style="color:#999999;font-size:13px;">SKU: ${escapeHtml(String(raw.sku))}</span>` : '';
      return `
        <tr>
          <td style="color:${t.text};font-size:15px;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;">
            <strong style="color:${t.text};">${escapeHtml(name)}</strong>${sku}
          </td>
          <td style="color:${t.muted};font-size:15px;text-align:center;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;width:80px;">${qty}×</td>
          <td style="color:${t.accent};font-size:16px;text-align:right;padding:14px 10px;border-bottom:1px solid ${t.borderSubtle};vertical-align:middle;width:120px;font-weight:600;">${formatPrice(total)}</td>
        </tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

function formatShippingHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themePalette(theme);
  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    if (pp?.name) {
      address = `Výdejní místo: ${escapeHtml(String(pp.name))}, ${escapeHtml(String(pp.city ?? ''))}`;
    } else {
      address = 'Zásilkovna - výdejní místo (bude upřesněno)';
    }
  } else if (order.shipping?.includes('virtualni')) {
    address = 'Digitální doručení / online převzetí';
  } else {
    address = escapeHtml(order.shipping);
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.paymentBoxBg}" style="border-collapse:collapse;margin-bottom:36px;background-color:${t.paymentBoxBg};border:2px solid ${t.paymentBorder};border-radius:18px;">
      <tr><td style="padding:32px 28px;">
        <h3 style="color:${t.accent};margin:0 0 20px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;">📦 Dodací adresa</h3>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid ${t.borderSubtle};border-radius:12px;">
          <tr><td style="padding:20px;color:${t.text};font-size:15px;line-height:1.7;">
            ${escapeHtml(order.customerName)}<br>
            ${address}<br><br>
            <span style="color:${t.muted};"><strong>Způsob doručení:</strong></span> ${escapeHtml(shippingMethodText(order.shipping))}<br>
            ${order.shippingCzk > 0 ? `<span style="color:${t.accent};"><strong>Poštovné:</strong></span> ${formatPrice(order.shippingCzk)}<br>` : ''}
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

async function paymentInstructionsHtml(order: OrderEmailData, theme: ShopTheme): Promise<string> {
  const t = themePalette(theme);
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') {
    return `<tr><td colspan="2" style="color:${t.accent3};font-size:14px;padding-top:12px;text-align:center;"><strong>✅ Platba přijata</strong></td></tr>`;
  }

  if (order.payment === 'transfer') {
    const iban = COMPANY.iban.replace(/\s/g, '');
    const vs = order.orderId.replace(/\D/g, '').slice(0, 10);
    const spd = `SPD*1.0*ACC:${iban}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}${vs ? `*X-VS:${vs}` : ''}`;
    const qrSvg = await QRCode.toString(spd, { type: 'svg', margin: 2, width: 200 });
    const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;

    return `
      <tr>
        <td colspan="2" style="padding-top:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid ${t.paymentBorder};border-radius:8px;">
            <tr><td style="padding:16px;">
              <p style="color:${t.accent};font-size:14px;margin:0 0 12px 0;font-weight:600;">💳 Instrukce k platbě:</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:top;padding-right:16px;color:${t.text};font-size:13px;line-height:1.8;" width="55%">
                    <strong>Číslo účtu:</strong> ${escapeHtml(COMPANY.bankAccount)}<br>
                    <strong>IBAN:</strong> ${escapeHtml(COMPANY.iban)}<br>
                    <strong>Variabilní symbol:</strong> ${escapeHtml(order.orderId)}<br>
                    <strong>Částka:</strong> ${formatPrice(order.totalCzk)}<br>
                    <strong>Zpráva:</strong> Objednávka ${escapeHtml(order.orderId)}<br>
                  </td>
                  <td style="vertical-align:top;text-align:center;" width="45%">
                    <img src="${qrDataUrl}" alt="QR platba" width="150" height="150" style="border-radius:8px;background-color:#ffffff;padding:4px;display:block;margin:0 auto;" />
                    <p style="color:${t.muted};font-size:11px;margin:8px 0 0 0;">Naskenujte v bankovní aplikaci</p>
                  </td>
                </tr>
              </table>
              <p style="color:${t.muted};font-size:12px;margin:12px 0 0 0;text-align:center;">
                Platbu prosím uhraďte do 7 dnů. Po přijetí platby Vás budeme kontaktovat.
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    `;
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
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.tokenBoxBg}" style="border-collapse:collapse;margin-bottom:36px;background-color:${t.tokenBoxBg};border:3px solid #00ff7f;border-radius:18px;">
      <tr><td style="padding:32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td style="text-align:center;padding-bottom:20px;">
            <table align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.tokenBadgeBg}" style="border-collapse:collapse;display:inline-table;background-color:${t.tokenBadgeBg};border-radius:999px;">
              <tr><td style="padding:8px 20px;">
                <span style="font-size:28px;">⚡</span>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="text-align:center;">
            <h3 style="color:#00ff7f;margin:0 0 20px 0;font-size:24px;letter-spacing:1.2px;font-weight:700;">
              🎁 ZION TOKEN BONUS 🎁
            </h3>
            <p style="color:#9af59a;font-size:16px;margin:0 0 24px 0;line-height:1.6;">
              Jah Bless! 🙏 Za váš nákup jste získali <strong style="color:#00ff7f;font-size:20px;">${tokens.toLocaleString('cs-CZ')} ZION tokenů</strong> jako poděkování!
            </p>
          </td></tr>
          <tr><td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border-radius:12px;border:2px solid rgba(0,255,127,0.3);">
              <tr><td style="padding:28px;">
                <table width="100%" cellpadding="10" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="color:#9af59a;font-size:16px;font-weight:600;">💎 Bonus tokeny:</td>
                    <td style="color:#00ff7f;font-size:26px;font-weight:700;text-align:right;">${tokens.toLocaleString('cs-CZ')} ZION ⚡</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:20px;border-top:1px solid rgba(0,255,127,0.2);padding-top:20px;">
                  <tr><td style="padding-top:20px;color:#8a8f94;font-size:13px;letter-spacing:0.5px;">💎 Tokeny budou připsány na vaši ZION peněženku po spuštění odměňovacího programu.</td></tr>
                </table>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding-top:24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.warningBg}" style="border-collapse:collapse;background-color:${t.warningBg};border-left:4px solid #FFD700;padding:16px;border-radius:8px;">
              <tr><td style="color:#FFD700;font-size:14px;line-height:1.6;">
                ⚠️ <strong>DŮLEŽITÉ:</strong> Uložte si Wallet ID na bezpečné místo! Po spuštění MainNetu budou tokeny zaslány na vaši ZION peněženku.
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding-top:24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border-radius:12px;border:1px solid rgba(0,255,127,0.2);">
              <tr><td style="padding:20px;">
                <h4 style="color:${t.accent};margin:0 0 14px 0;font-size:16px;text-align:center;">📖 Co s tokeny můžete dělat?</h4>
                <ul style="color:#a8ffb0;font-size:14px;line-height:1.8;margin:0;padding-left:24px;">
                  <li style="margin-bottom:8px;">💰 <strong>Platby:</strong> Používejte ZION pro nákupy v ekosystému</li>
                  <li style="margin-bottom:8px;">🔒 <strong>Staking:</strong> Stakujte tokeny a získávejte odměny</li>
                  <li style="margin-bottom:8px;">🗳️ <strong>Governance:</strong> Hlasujte o budoucnosti projektu</li>
                  <li>⚡ <strong>Consciousness Mining:</strong> Připojte se k těžbě a získávejte další ZION</li>
                </ul>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="text-align:center;padding-top:24px;">
            <table align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.tokenBadgeBg}" style="border-collapse:collapse;display:inline-table;background-color:${t.tokenBadgeBg};border-radius:999px;border:2px solid rgba(255,215,0,0.5);">
              <tr><td style="padding:14px 32px;">
                <a href="https://zionterranova.com/dashboard" style="color:#000000;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;">🎯 Zjistit více o ZION</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

export async function buildV2OrderConfirmationHtml(
  order: OrderEmailData,
  theme: ShopTheme = 'rasta'
): Promise<string> {
  const t = themePalette(theme);
  const orderDate = new Date().toLocaleDateString('cs-CZ');
  const itemsHtml = formatItemsHtml(order, theme);
  const shippingHtml = formatShippingHtml(order, theme);
  const paymentInstructions = await paymentInstructionsHtml(order, theme);
  const paymentStatus = paymentStatusText(order.paymentStatus);
  const statusColor = theme === 'zion' ? '#078930' : '#078930';
  const paymentMethod = paymentMethodText(order.payment);
  const processingInfo =
    order.paymentStatus.toLowerCase() === 'paid'
      ? 'Vaši objednávku nyní zpracováváme a připravujeme k odeslání'
      : 'Po obdržení platby začneme okamžitě zpracovávat Vaši objednávku';
  const deliveryInfo =
    order.paymentStatus.toLowerCase() === 'paid'
      ? 'Očekávaná dodací lhůta 3-5 pracovních dnů'
      : 'Po zaplacení očekávaná dodací lhůta 3-5 pracovních dnů';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZION - Potvrzení objednávky #${escapeHtml(order.orderId)}</title>
</head>
<body style="margin:0;padding:0;font-family:'Trebuchet MS','Verdana',sans-serif;background-color:${t.bg};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.outerBg}" style="background-color:${t.outerBg};padding:50px 20px;border-collapse:collapse;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.card}" style="background-color:${t.card};border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);max-width:680px;width:100%;border-collapse:collapse;">
        <tr>
          <td bgcolor="${t.headerFallback}" style="background-color:${t.headerFallback};padding:4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.card}" style="background-color:${t.card};border-collapse:collapse;">
              <tr><td style="padding:38px 32px;text-align:center;">
                <table align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-table;">
                  <tr><td style="padding:11px 22px;border-radius:999px;background-color:${t.subBoxBg};color:${t.accent};font-size:13px;letter-spacing:3.5px;border:1px solid rgba(255,215,0,0.5);text-transform:uppercase;font-weight:600;text-align:center;">
                    ⚡ ESHOP OBJEDNÁVKA ⚡
                  </td></tr>
                </table>
                <h1 style="color:${t.accent};margin:18px 0 8px 0;font-size:38px;font-weight:700;">ZION TERRA NOVA</h1>
                <p style="color:${t.muted};margin:0;font-size:16px;letter-spacing:1.5px;font-weight:500;">🌿 One Love • One Chain • One Future 🌿</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${t.innerBg}" style="background-color:${t.innerBg};padding:50px 40px 30px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr><td align="center" style="text-align:center;padding-bottom:36px;">
                <table align="center" width="96" height="96" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.successIconBg}" style="background-color:${t.successIconBg};border-radius:50%;border:3px solid rgba(255,215,0,0.4);border-collapse:collapse;">
                  <tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle;color:${t.successIconText};font-size:52px;font-weight:bold;">✓</td></tr>
                </table>
                <h2 style="color:${t.accent};margin:22px 0 0 0;font-size:30px;letter-spacing:0.8px;font-weight:700;">Jah Bless! 🙏 Objednávka přijata</h2>
                <p style="color:#a8ffb0;margin:16px 0 0 0;font-size:16px;line-height:1.6;">
                  Díky za důvěru! 💚 Vaše objednávka byla úspěšně zpracována.<br>
                  <span style="color:${t.accent};font-weight:600;">ZION rodina</span> se rozrůstá o dalšího strážce světla. ✨
                </p>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.orderBoxBg}" style="border-collapse:collapse;margin-bottom:36px;background-color:${t.orderBoxBg};border:2px solid rgba(0,255,0,0.35);border-radius:18px;">
              <tr><td style="padding:32px 28px;">
                <h3 style="color:${t.accent};margin:0 0 24px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;border-bottom:2px solid rgba(255,215,0,0.3);padding-bottom:16px;">📋 Detaily objednávky</h3>
                <table width="100%" cellpadding="12" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">🔖 Číslo objednávky:</td>
                    <td style="color:${t.accent};font-size:17px;text-align:right;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:700;letter-spacing:1px;">${escapeHtml(order.orderId)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">👤 Jméno:</td>
                    <td style="color:${t.text};font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};">${escapeHtml(order.customerName)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">📧 Email:</td>
                    <td style="color:${t.text};font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};">${escapeHtml(order.customerEmail)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};font-weight:600;">📅 Datum objednávky:</td>
                    <td style="color:${t.text};font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid ${t.borderSubtle};">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;font-weight:600;">💰 Celková cena:</td>
                    <td style="color:${t.accent};font-size:22px;text-align:right;padding:10px 0;font-weight:700;">${formatPrice(order.totalCzk)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.itemsBoxBg}" style="border-collapse:collapse;margin-bottom:36px;background-color:${t.itemsBoxBg};border:2px solid rgba(220,20,60,0.3);border-radius:18px;">
              <tr><td style="padding:32px 28px;">
                <h3 style="color:${t.accent};margin:0 0 24px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;border-bottom:2px solid rgba(255,215,0,0.3);padding-bottom:16px;">🛒 Položky objednávky</h3>
                ${itemsHtml}
              </td></tr>
            </table>

            ${zionTokenSectionHtml(order, theme)}
            ${digitalDownloadsHtml(order)}
            ${shippingHtml}

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.paymentBoxBg}" style="border-collapse:collapse;margin-bottom:36px;background-color:${t.paymentBoxBg};border:2px solid rgba(255,215,0,0.35);border-radius:18px;">
              <tr><td style="padding:32px 28px;">
                <h3 style="color:${t.accent};margin:0 0 20px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;">💳 Informace o platbě</h3>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.subBoxBg}" style="border-collapse:collapse;background-color:${t.subBoxBg};border:1px solid rgba(255,215,0,0.2);border-radius:12px;">
                  <tr><td style="padding:24px;">
                    <table width="100%" cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="color:${t.muted};font-size:15px;font-weight:600;">Způsob platby:</td>
                        <td style="color:${t.text};font-size:16px;text-align:right;">${escapeHtml(paymentMethod)}</td>
                      </tr>
                      <tr>
                        <td style="color:${t.muted};font-size:15px;font-weight:600;padding-top:8px;">Status platby:</td>
                        <td style="text-align:right;padding-top:8px;">
                          <span style="display:inline-block;padding:6px 16px;background-color:${statusColor};color:#000000;font-weight:700;border-radius:999px;font-size:14px;">${escapeHtml(paymentStatus)}</span>
                        </td>
                      </tr>
                      ${paymentInstructions}
                    </table>
                  </td></tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.nextBoxBg}" style="border-collapse:collapse;margin-bottom:24px;background-color:${t.nextBoxBg};border:2px solid rgba(0,255,0,0.25);border-radius:18px;">
              <tr><td style="padding:28px;">
                <h3 style="color:${t.accent};margin:0 0 18px 0;font-size:20px;text-align:center;letter-spacing:0.8px;font-weight:700;">⚡ Co bude dál?</h3>
                <ul style="color:#a8ffb0;font-size:15px;line-height:1.8;margin:0;padding-left:24px;">
                  <li style="margin-bottom:10px;">✅ <strong>Potvrzení:</strong> Tímto emailem potvrzujeme přijetí objednávky</li>
                  <li style="margin-bottom:10px;">📦 <strong>Zpracování:</strong> ${processingInfo}</li>
                  <li style="margin-bottom:10px;">🚚 <strong>Doručení:</strong> ${deliveryInfo}</li>
                  <li>💚 <strong>Podpora:</strong> Pro jakékoliv dotazy nás kontaktujte na ${escapeHtml(COMPANY.supportEmail)}</li>
                </ul>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${t.footerFallback}" style="background-color:${t.footerFallback};padding:3px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.bg}" style="background-color:${t.bg};border-collapse:collapse;">
              <tr><td style="padding:32px;text-align:center;">
                <p style="color:${t.muted};font-size:16px;margin:0 0 12px 0;font-weight:600;letter-spacing:0.5px;">☮️ Peace & One Love ☮️</p>
                <p style="color:#999999;font-size:13px;margin:0 0 8px 0;line-height:1.6;">
                  Tento email byl odeslán z <strong style="color:${t.accent};">ZION eShop</strong><br>
                  Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat
                </p>
                <table align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.successIconBg}" style="border-collapse:collapse;margin:16px 0;background-color:${t.successIconBg};border-radius:999px;text-align:center;border:2px solid rgba(255,215,0,0.4);">
                  <tr><td style="padding:12px 28px;">
                    <a href="${escapeHtml(COMPANY.shopUrl)}" style="color:#000000;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">🛒 Přejít do eshopu</a>
                  </td></tr>
                </table>
                <p style="color:#666666;font-size:12px;margin:16px 0 0 0;">© 2026 ZION Terra Nova • All Rights Reserved</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
