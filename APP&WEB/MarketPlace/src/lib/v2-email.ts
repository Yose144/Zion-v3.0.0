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

function paymentStatusText(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return 'Zaplaceno';
  if (s === 'pending') return 'Čeká na platbu';
  if (s === 'failed') return 'Zrušeno';
  return status || 'Neuvedeno';
}

function paymentStatusColor(status: string, theme: ShopTheme): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return theme === 'rasta' ? '#00ff7f' : '#06b6d4';
  if (s === 'pending') return '#FFD700';
  if (s === 'failed') return theme === 'rasta' ? '#c01026' : '#f43f5e';
  return '#FFD700';
}

function formatAddress(order: OrderEmailData): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

interface ThemeColors {
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
  headerGradient: string;
  successIcon: string;
  itemsBorder: string;
  itemsBox: string;
  paymentBorder: string;
  paymentBox: string;
  nextBox: string;
  footerGradient: string;
}

function themeColors(theme: ShopTheme): ThemeColors {
  if (theme === 'zion') {
    return {
      muted: '#94a3b8',
      accent: '#ffd700',
      accent2: '#06b6d4',
      accent3: '#9333ea',
      headerGradient: 'linear-gradient(135deg, #06b6d4 0%, #9333ea 50%, #ffd700 100%)',
      successIcon: 'linear-gradient(145deg, #06b6d4, #9333ea)',
      itemsBorder: 'rgba(147,51,234,0.35)',
      itemsBox: 'rgba(147,51,234,0.12)',
      paymentBorder: 'rgba(255,215,0,0.35)',
      paymentBox: 'rgba(255,215,0,0.08)',
      nextBox: 'rgba(6,182,212,0.12)',
      footerGradient: 'linear-gradient(135deg, #06b6d4 0%, #9333ea 50%, #ffd700 100%)',
    };
  }
  return {
    muted: '#9af59a',
    accent: '#FFD700',
    accent2: '#c01026',
    accent3: '#00ff7f',
    headerGradient: 'linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%)',
    successIcon: 'linear-gradient(145deg, #1f9b1f, #00ff7f)',
    itemsBorder: 'rgba(0,255,0,0.35)',
    itemsBox: 'rgba(34,139,34,0.2)',
    paymentBorder: 'rgba(255,215,0,0.35)',
    paymentBox: 'rgba(255,215,0,0.08)',
    nextBox: 'rgba(34,139,34,0.15)',
    footerGradient: 'linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%)',
  };
}

function formatItemsHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themeColors(theme);
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return `<p style="color:${t.muted};text-align:center;">Žádné položky</p>`;

  const rows = items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const unitPrice = Math.round((raw.priceCzk as number) || 0);
      const total = qty * unitPrice;
      const name = String(raw.name ?? 'Produkt');
      const sku = raw.sku ? ` <span style="color:#999;font-size:13px;">SKU: ${escapeHtml(String(raw.sku))}</span>` : '';
      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <td style="color:#fff;font-size:15px;padding:14px 0;">
            <strong>${escapeHtml(name)}</strong>${sku}
          </td>
          <td style="color:${t.muted};font-size:15px;text-align:center;padding:14px 0;">${qty}×</td>
          <td style="color:${t.accent};font-size:16px;text-align:right;padding:14px 0;font-weight:600;">${formatPrice(total)}</td>
        </tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="10" cellspacing="0">${rows}</table>`;
}

function formatShippingHtml(order: OrderEmailData, theme: ShopTheme): string {
  const t = themeColors(theme);
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
    <div style="background:linear-gradient(145deg, ${t.paymentBox}, rgba(0,0,0,0.35)); border:2px solid ${t.paymentBorder}; border-radius:18px; padding:32px; margin-bottom:36px; box-shadow:inset 0 2px 8px rgba(255,215,0,0.08);">
      <h3 style="color:${t.accent};margin:0 0 20px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;">📦 Dodací adresa</h3>
      <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.08);color:#fff;font-size:15px;line-height:1.7;">
        ${escapeHtml(order.customerName)}<br>
        ${address}<br><br>
        <strong style="color:${t.muted};">Způsob doručení:</strong> ${escapeHtml(paymentMethodText(order.shipping))}<br>
        ${order.shippingCzk > 0 ? `<strong style="color:${t.accent};">Poštovné:</strong> ${formatPrice(order.shippingCzk)}<br>` : ''}
      </div>
    </div>
  `;
}

async function paymentInstructionsHtml(order: OrderEmailData, theme: ShopTheme): Promise<string> {
  const t = themeColors(theme);
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
          <div style="background:${t.paymentBox};border-radius:8px;padding:16px;border:1px solid ${t.paymentBorder};">
            <p style="color:${t.accent};font-size:14px;margin:0 0 12px 0;font-weight:600;">💳 Instrukce k platbě:</p>
            <table style="width:100%;">
              <tr>
                <td style="vertical-align:top;padding-right:16px;">
                  <p style="color:#fff;font-size:13px;margin:0;line-height:1.8;">
                    <strong>Číslo účtu:</strong> ${escapeHtml(COMPANY.bankAccount)}<br>
                    <strong>IBAN:</strong> ${escapeHtml(COMPANY.iban)}<br>
                    <strong>Variabilní symbol:</strong> ${escapeHtml(order.orderId)}<br>
                    <strong>Částka:</strong> ${formatPrice(order.totalCzk)}<br>
                    <strong>Zpráva:</strong> Objednávka ${escapeHtml(order.orderId)}<br>
                  </p>
                </td>
                <td style="vertical-align:top;text-align:center;">
                  <img src="${qrDataUrl}" alt="QR platba" style="width:150px;height:150px;border-radius:8px;background:#fff;padding:4px;" />
                  <p style="color:${t.muted};font-size:11px;margin:8px 0 0 0;">Naskenujte v bankovní aplikaci</p>
                </td>
              </tr>
            </table>
            <p style="color:${t.muted};font-size:12px;margin:12px 0 0 0;text-align:center;">
              Platbu prosím uhraďte do 7 dnů. Po přijetí platby Vás budeme kontaktovat.
            </p>
          </div>
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
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';

  const accent3 = theme === 'zion' ? '#06b6d4' : '#00ff7f';
  const muted = theme === 'zion' ? '#94a3b8' : '#9af59a';

  return `
    <div style="background:linear-gradient(145deg, rgba(0,255,127,0.12), rgba(0,0,0,0.5)); border:3px solid rgba(0,255,127,0.4); border-radius:18px; padding:32px; margin-bottom:36px; box-shadow:0 0 30px rgba(0,255,127,0.2), inset 0 2px 12px rgba(0,255,127,0.1);">
      <h3 style="color:${accent3};margin:0 0 20px 0;font-size:24px;text-align:center;letter-spacing:1.2px;font-weight:700;text-shadow:0 2px 8px rgba(0,255,127,0.3);">
        🎁 ZION TOKEN BONUS 🎁
      </h3>
      <p style="color:${muted};font-size:16px;text-align:center;margin:0 0 24px 0;line-height:1.6;">
        Jah Bless! 🙏 Za váš nákup jste získali <strong style="color:${accent3};font-size:20px;">${tokens.toLocaleString('cs-CZ')} ZION tokenů</strong> jako poděkování!
      </p>
      <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;border:1px solid rgba(0,255,127,0.2);text-align:center;">
        <p style="color:#8a8f94;font-size:13px;margin:0;">💎 Tokeny budou připsány na vaši ZION peněženku po spuštění odměňovacího programu.</p>
      </div>
    </div>
  `;
}

export async function buildV2OrderConfirmationHtml(
  order: OrderEmailData,
  theme: ShopTheme = 'rasta'
): Promise<string> {
  const t = themeColors(theme);
  const orderDate = new Date().toLocaleDateString('cs-CZ');
  const itemsHtml = formatItemsHtml(order, theme);
  const shippingHtml = formatShippingHtml(order, theme);
  const paymentInstructions = await paymentInstructionsHtml(order, theme);
  const paymentStatus = paymentStatusText(order.paymentStatus);
  const statusColor = paymentStatusColor(order.paymentStatus, theme);
  const paymentMethod = paymentMethodText(order.payment);
  const accent3 = theme === 'zion' ? '#06b6d4' : '#00ff7f';
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
<body style="margin:0;padding:0;font-family:'Trebuchet MS','Verdana',sans-serif;background:radial-gradient(circle at 20% 20%,${theme === 'zion' ? 'rgba(147,51,234,0.15)' : 'rgba(0,255,0,0.15)'},transparent 40%),radial-gradient(circle at 80% 15%,rgba(255,215,0,0.15),transparent 45%),radial-gradient(circle at 50% 90%,${theme === 'zion' ? 'rgba(6,182,212,0.18)' : 'rgba(220,20,60,0.18)'},transparent 40%),#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg, rgba(0,0,0,0.85), rgba(0,0,0,0.96));padding:50px 20px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border-radius:24px;overflow:hidden;box-shadow:0 28px 72px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="background:${t.headerGradient};padding:4px;">
              <div style="background:#0f0f0f;padding:38px 32px;text-align:center;">
                <div style="display:inline-block;padding:11px 22px;border-radius:999px;background:rgba(0,0,0,0.4);color:${t.accent};font-size:13px;letter-spacing:3.5px;border:1px solid rgba(255,215,0,0.5);text-transform:uppercase;font-weight:600;">
                  ⚡ ESHOP OBJEDNÁVKA ⚡
                </div>
                <h1 style="color:${t.accent};margin:18px 0 8px 0;font-size:38px;text-shadow:0 8px 24px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.3);font-weight:700;">ZION TERRA NOVA</h1>
                <p style="color:${t.muted};margin:0;font-size:16px;letter-spacing:1.5px;font-weight:500;">🌿 One Love • One Chain • One Future 🌿</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px 30px 40px;background:linear-gradient(180deg, #0a0a0a 0%, #050505 100%);">
              <div style="text-align:center;margin-bottom:36px;">
                <div style="background:${t.successIcon};width:96px;height:96px;border-radius:50%;margin:0 auto 22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 50px rgba(0,255,0,0.35), 0 12px 32px rgba(0,0,0,0.4);border:3px solid rgba(255,215,0,0.4);position:relative;">
                  <span style="font-size:52px;color:#000;font-weight:bold;">✓</span>
                </div>
                <h2 style="color:${t.accent};margin:0;font-size:30px;letter-spacing:0.8px;font-weight:700;text-shadow:0 4px 16px rgba(0,0,0,0.5);">Jah Bless! 🙏 Objednávka přijata</h2>
                <p style="color:${t.muted};margin:16px 0 0 0;font-size:16px;line-height:1.6;">
                  Díky za důvěru! 💚 Vaše objednávka byla úspěšně zpracována.<br>
                  <span style="color:${t.accent};font-weight:600;">ZION rodina</span> se rozrůstá o dalšího strážce světla. ✨
                </p>
              </div>

              <div style="background:linear-gradient(145deg, ${t.itemsBox}, rgba(0,0,0,0.4)); border:2px solid ${t.itemsBorder}; border-radius:18px; padding:32px; margin-bottom:36px; box-shadow:inset 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="color:${t.accent};margin:0 0 24px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;border-bottom:2px solid rgba(255,215,0,0.3);padding-bottom:16px;">📋 Detaily objednávky</h3>
                <table width="100%" cellpadding="12" cellspacing="0">
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">🔖 Číslo objednávky:</td>
                    <td style="color:${t.accent};font-size:17px;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:700;letter-spacing:1px;">${escapeHtml(order.orderId)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">👤 Jméno:</td>
                    <td style="color:#fff;font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(order.customerName)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">📧 Email:</td>
                    <td style="color:#fff;font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(order.customerEmail)}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">📅 Datum objednávky:</td>
                    <td style="color:#fff;font-size:16px;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="color:${t.muted};font-size:15px;padding:10px 0;font-weight:600;">💰 Celková cena:</td>
                    <td style="color:${t.accent};font-size:22px;text-align:right;padding:10px 0;font-weight:700;">${formatPrice(order.totalCzk)}</td>
                  </tr>
                </table>
              </div>

              <div style="background:linear-gradient(145deg, rgba(220,20,60,0.15), rgba(0,0,0,0.4)); border:2px solid rgba(220,20,60,0.3); border-radius:18px; padding:32px; margin-bottom:36px; box-shadow:inset 0 2px 8px rgba(220,20,60,0.1);">
                <h3 style="color:${t.accent};margin:0 0 24px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;border-bottom:2px solid rgba(255,215,0,0.3);padding-bottom:16px;">🛒 Položky objednávky</h3>
                ${itemsHtml}
              </div>

              ${zionTokenSectionHtml(order, theme)}
              ${digitalDownloadsHtml(order)}
              ${shippingHtml}

              <div style="background:linear-gradient(145deg, ${t.paymentBox}, rgba(0,0,0,0.4)); border:2px solid ${t.paymentBorder}; border-radius:18px; padding:32px; margin-bottom:36px; box-shadow:inset 0 2px 8px rgba(255,215,0,0.1);">
                <h3 style="color:${t.accent};margin:0 0 20px 0;font-size:22px;text-align:center;letter-spacing:1px;font-weight:700;">💳 Informace o platbě</h3>
                <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:24px;border:1px solid rgba(255,255,255,0.08);">
                  <table width="100%" cellpadding="8" cellspacing="0">
                    <tr>
                      <td style="color:${t.muted};font-size:15px;font-weight:600;">Způsob platby:</td>
                      <td style="color:#fff;font-size:16px;text-align:right;">${escapeHtml(paymentMethod)}</td>
                    </tr>
                    <tr>
                      <td style="color:${t.muted};font-size:15px;font-weight:600;">Status platby:</td>
                      <td style="text-align:right;">
                        <span style="display:inline-block;padding:6px 16px;background:${statusColor};color:#000;font-weight:700;border-radius:999px;font-size:14px;">${escapeHtml(paymentStatus)}</span>
                      </td>
                    </tr>
                    ${paymentInstructions}
                  </table>
                </div>
              </div>

              <div style="background:linear-gradient(145deg, ${t.nextBox}, rgba(0,0,0,0.3)); border:2px solid ${theme === 'zion' ? 'rgba(6,182,212,0.25)' : 'rgba(0,255,0,0.25)'}; border-radius:18px; padding:28px; margin-bottom:24px;">
                <h3 style="color:${t.accent};margin:0 0 18px 0;font-size:20px;text-align:center;letter-spacing:0.8px;font-weight:700;">⚡ Co bude dál?</h3>
                <ul style="color:${t.muted};font-size:15px;line-height:1.8;margin:0;padding-left:24px;">
                  <li style="margin-bottom:10px;">✅ <strong>Potvrzení:</strong> Tímto emailem potvrzujeme přijetí objednávky</li>
                  <li style="margin-bottom:10px;">📦 <strong>Zpracování:</strong> ${processingInfo}</li>
                  <li style="margin-bottom:10px;">🚚 <strong>Doručení:</strong> ${deliveryInfo}</li>
                  <li>💚 <strong>Podpora:</strong> Pro jakékoliv dotazy nás kontaktujte na ${escapeHtml(COMPANY.supportEmail)}</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:${t.footerGradient};padding:3px;">
              <div style="background:#0a0a0a;padding:32px;text-align:center;">
                <p style="color:${t.muted};font-size:16px;margin:0 0 12px 0;font-weight:600;letter-spacing:0.5px;">☮️ Peace & One Love ☮️</p>
                <p style="color:#999;font-size:13px;margin:0 0 8px 0;line-height:1.6;">
                  Tento email byl odeslán z <strong style="color:${t.accent};">ZION eShop</strong><br>
                  Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat
                </p>
                <div style="margin:16px 0;">
                  <a href="${escapeHtml(COMPANY.shopUrl)}" style="display:inline-block;padding:12px 28px;background:${t.successIcon};color:#000;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;box-shadow:0 6px 20px rgba(0,255,0,0.3);border:2px solid rgba(255,215,0,0.4);letter-spacing:0.5px;">🛒 Přejít do eshopu</a>
                </div>
                <p style="color:#666;font-size:12px;margin:16px 0 0 0;">© 2026 ZION Terra Nova • All Rights Reserved</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
