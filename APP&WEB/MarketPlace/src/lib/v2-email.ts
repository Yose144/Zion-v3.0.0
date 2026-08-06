import type { OrderEmailData } from './email';
import type { ShopTheme } from './settings';

const COMPANY = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
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
  if (method === 'card' || method === 'stripe') return 'Platební karta';
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

function paymentStatusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return '#1c7b1c';
  if (s === 'pending') return '#FFD700';
  if (s === 'failed') return '#c01026';
  return '#666666';
}

function formatOrderDate(): string {
  return new Date().toLocaleDateString('cs-CZ');
}

function formatAddress(order: OrderEmailData): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

function formatItemsHtml(order: OrderEmailData): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return '<p style="color:#9af59a;text-align:center;padding:14px 0;">Žádné položky</p>';
  }

  const rows = items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      const total = qty * price;
      const name = String(raw.name ?? 'Produkt');
      return `
        <tr>
          <td style="color:#e5e7eb;font-size:15px;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;">
            <strong style="color:#fff;">${escapeHtml(name)}</strong>
          </td>
          <td style="color:#9af59a;font-size:15px;text-align:center;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;width:80px;">${qty}x</td>
          <td style="color:#FFD700;font-size:16px;text-align:right;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;width:120px;font-weight:700;">${formatPrice(total)}</td>
        </tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

function formatItemsText(order: OrderEmailData): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return 'Žádné položky';
  return items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      const total = qty * price;
      const name = String(raw.name ?? 'Produkt');
      return `- ${name} - ${qty}x - ${formatPrice(total)}`;
    })
    .join('\n');
}

function formatShippingHtml(order: OrderEmailData): string {
  if (order.shipping?.includes('virtualni')) {
    return '';
  }

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
  } else {
    address = escapeHtml(order.shipping);
  }

  return `
    <div style="background: linear-gradient(145deg, rgba(34,139,34,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(0,255,0,0.25); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(0,255,0,0.1);">
      <h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700;">🚚 Doprava</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600;">Jméno:</td>
          <td style="color: #fff; font-size: 16px; text-align: right;">${escapeHtml(order.customerName)}</td>
        </tr>
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">Adresa:</td>
          <td style="color: #fff; font-size: 16px; text-align: right; padding-top: 8px;">${address || '—'}</td>
        </tr>
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">Způsob dopravy:</td>
          <td style="color: #fff; font-size: 16px; text-align: right; padding-top: 8px;">${escapeHtml(shippingMethodText(order.shipping))}</td>
        </tr>
        ${order.shippingCzk > 0 ? `
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">Poštovné:</td>
          <td style="color: #FFD700; font-size: 16px; text-align: right; padding-top: 8px; font-weight: 700;">${formatPrice(order.shippingCzk)}</td>
        </tr>` : ''}
      </table>
    </div>
  `;
}

function formatShippingText(order: OrderEmailData): string {
  if (order.shipping?.includes('virtualni')) return '';

  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    address = pp?.name
      ? `Výdejní místo: ${String(pp.name)}, ${String(pp.city ?? '')}`
      : 'Zásilkovna - výdejní místo (bude upřesněno)';
  } else {
    address = order.shipping;
  }

  return `Doprava:
Jméno: ${order.customerName}
Adresa: ${address || '—'}
Způsob dopravy: ${shippingMethodText(order.shipping)}${
    order.shippingCzk > 0 ? `\nPoštovné: ${formatPrice(order.shippingCzk)}` : ''
  }`;
}

function formatPaymentInstructionsHtml(order: OrderEmailData): string {
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') {
    return '';
  }

  if (order.payment === 'transfer') {
    const iban = COMPANY.iban.replace(/\s/g, '');
    const vs = order.orderId.replace(/\D/g, '').slice(0, 10);
    const spd = `SPD*1.0*ACC:${iban}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}${vs ? `*X-VS:${vs}` : ''}`;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(spd)}&size=180&margin=2`;

    return `
      <tr>
        <td colspan="2" style="padding-top: 16px;">
          <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,215,0,0.2);">
            <p style="color: #FFD700; font-size: 15px; margin: 0 0 16px 0; font-weight: 700; text-align: center;">💳 Instrukce k platbě</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align: top; padding-right: 16px; color: #e5e7eb; font-size: 14px; line-height: 1.8;" width="55%">
                  <strong style="color:#9af59a;">Číslo účtu:</strong> ${escapeHtml(COMPANY.bankAccount)}<br>
                  <strong style="color:#9af59a;">IBAN:</strong> ${escapeHtml(COMPANY.iban)}<br>
                  <strong style="color:#9af59a;">Variabilní symbol:</strong> ${escapeHtml(order.orderId)}<br>
                  <strong style="color:#9af59a;">Částka:</strong> ${formatPrice(order.totalCzk)}<br>
                  <strong style="color:#9af59a;">Zpráva:</strong> Objednávka ${escapeHtml(order.orderId)}
                </td>
                <td style="vertical-align: top; text-align: center;" width="45%">
                  <img src="${qrUrl}" alt="QR platba" width="150" height="150" style="border-radius: 8px; background-color: #ffffff; padding: 4px; display: block; margin: 0 auto;" />
                  <p style="color: #8a8f94; font-size: 11px; margin: 8px 0 0 0;">Naskenujte v bankovní aplikaci</p>
                </td>
              </tr>
            </table>
            <p style="color: #8a8f94; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
              Platbu prosím uhraďte do 7 dnů. Po přijetí platby Vás budeme kontaktovat.
            </p>
          </div>
        </td>
      </tr>
    `;
  }

  return '';
}

function formatPaymentInstructionsText(order: OrderEmailData): string {
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') return '';

  if (order.payment === 'transfer') {
    return `Instrukce k platbě:
Číslo účtu: ${COMPANY.bankAccount}
IBAN: ${COMPANY.iban}
Variabilní symbol: ${order.orderId}
Částka: ${formatPrice(order.totalCzk)}
Zpráva: Objednávka ${order.orderId}

Platbu prosím uhraďte do 7 dnů.`;
  }

  return '';
}

function formatDigitalDownloadsHtml(_order: OrderEmailData): string {
  return '';
}

function formatZionTokenSectionHtml(order: OrderEmailData): string {
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';

  return `
    <div style="background: linear-gradient(145deg, rgba(0,255,127,0.2), rgba(0,0,0,0.5)); border: 3px solid rgba(0,255,127,0.5); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: 0 0 30px rgba(0,255,127,0.3), inset 0 2px 12px rgba(0,255,127,0.15);">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; padding: 8px 20px; background: linear-gradient(135deg, #00ff7f, #32cd32); border-radius: 999px; box-shadow: 0 4px 12px rgba(0,255,127,0.4);">
          <span style="font-size: 28px;">⚡</span>
        </div>
      </div>
      <h3 style="color: #00ff7f; margin: 0 0 20px 0; font-size: 24px; text-align: center; letter-spacing: 1.2px; font-weight: 700; text-shadow: 0 2px 8px rgba(0,255,127,0.5);">
        🎁 ZION TOKEN BONUS 🎁
      </h3>
      <p style="color: #9af59a; font-size: 16px; text-align: center; margin: 0 0 24px 0; line-height: 1.6;">
        Jah Bless! 🙏 Za váš nákup jste získali <strong style="color: #00ff7f; font-size: 20px;">${tokens.toLocaleString('cs-CZ')} ZION</strong> jako poděkování!
      </p>
      <div style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 20px; border: 1px solid rgba(0,255,127,0.2);">
        <p style="color: #8a8f94; font-size: 13px; line-height: 1.6; margin: 0;">
          Tokeny budou připsány po spuštění odměňovacího programu. Pro dotazy kontaktujte ${escapeHtml(COMPANY.supportEmail)}.
        </p>
      </div>
    </div>
  `;
}

function formatZionTokenSectionText(order: OrderEmailData): string {
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';
  return `🎁 ZION TOKEN BONUS 🎁\nJah Bless! Za váš nákup jste získali ${tokens.toLocaleString('cs-CZ')} ZION jako poděkování.\nTokeny budou připsány po spuštění odměňovacího programu.`;
}

function formatQrCodeSectionHtml(order: OrderEmailData): string {
  if (order.payment !== 'transfer') return '';
  const iban = COMPANY.iban.replace(/\s/g, '');
  const vs = order.orderId.replace(/\D/g, '').slice(0, 10);
  const spd = `SPD*1.0*ACC:${iban}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}${vs ? `*X-VS:${vs}` : ''}`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(spd)}&size=280&margin=2`;

  return `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background: #0a0a0a; border-radius: 16px; border: 2px solid rgba(255,215,0,0.3);">
      <p style="color: #FFD700; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">
        📱 QR kód pro platbu
      </p>
      <img src="${qrUrl}" alt="QR platba" style="width: 280px; max-width: 100%; height: auto; border-radius: 12px; border: 3px solid #FFD700; background: #fff;" />
      <p style="color: #00ff7f; font-size: 13px; margin: 15px 0 5px 0;">
        ✅ Naskenujte v bankovní aplikaci
      </p>
    </div>
  `;
}

export async function buildV2OrderConfirmationHtml(
  order: OrderEmailData,
  _theme: ShopTheme = 'rasta'
): Promise<string> {
  return (await buildV2OrderConfirmationEmail(order, _theme)).html;
}

export async function buildV2OrderConfirmationEmail(
  order: OrderEmailData,
  _theme: ShopTheme = 'rasta'
): Promise<{ html: string; text: string }> {
  const orderDate = formatOrderDate();
  const paymentMethod = paymentMethodText(order.payment);
  const paymentStatus = paymentStatusText(order.paymentStatus);
  const statusColor = paymentStatusColor(order.paymentStatus);
  const itemsHtml = formatItemsHtml(order);
  const shippingHtml = formatShippingHtml(order);
  const paymentInstructions = formatPaymentInstructionsHtml(order);
  const qrSection = formatQrCodeSectionHtml(order);
  const zionTokenSection = formatZionTokenSectionHtml(order);
  const digitalDownloads = formatDigitalDownloadsHtml(order);
  const isPaid = order.paymentStatus.toLowerCase() === 'paid';
  const processingInfo = isPaid
    ? 'Vaši objednávku nyní zpracováváme a připravujeme k odeslání'
    : 'Po obdržení platby začneme okamžitě zpracovávat Vaši objednávku';
  const deliveryInfo = isPaid
    ? 'Očekávaná dodací lhůta 3-5 pracovních dnů'
    : 'Po zaplacení očekávaná dodací lhůta 3-5 pracovních dnů';

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZION - Potvrzení objednávky #${escapeHtml(order.orderId)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Trebuchet MS', 'Verdana', sans-serif; background: radial-gradient(circle at 20% 20%, rgba(0,255,0,0.15), transparent 40%), radial-gradient(circle at 80% 15%, rgba(255,215,0,0.15), transparent 45%), radial-gradient(circle at 50% 90%, rgba(220,20,60,0.18), transparent 40%), #0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, rgba(0,0,0,0.85), rgba(0,0,0,0.96)); padding: 50px 20px;">
        <tr>
            <td align="center">
                <table width="680" cellpadding="0" cellspacing="0" style="background: #0f0f0f; border-radius: 24px; overflow: hidden; box-shadow: 0 28px 72px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.06);">

                    <tr>
                        <td style="background: linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); padding: 4px;">
                            <div style="background: #0f0f0f; padding: 38px 32px; text-align: center;">
                                <div style="display: inline-block; padding: 11px 22px; border-radius: 999px; background: rgba(0,0,0,0.4); color: #FFD700; font-size: 13px; letter-spacing: 3.5px; border: 1px solid rgba(255,215,0,0.5); text-transform: uppercase; font-weight: 600;">
                                    ⚡ ESHOP OBJEDNÁVKA ⚡
                                </div>
                                <h1 style="color: #FFD700; margin: 18px 0 8px 0; font-size: 38px; text-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.3); font-weight: 700;">
                                    ZION TERRA NOVA
                                </h1>
                                <p style="color: #9af59a; margin: 0; font-size: 16px; letter-spacing: 1.5px; font-weight: 500;">
                                    🌿 One Love • One Chain • One Future 🌿
                                </p>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 50px 40px 30px 40px; background: linear-gradient(180deg, #0a0a0a 0%, #050505 100%);">
                            <div style="text-align: center; margin-bottom: 36px;">
                                <div style="background: linear-gradient(145deg, #1f9b1f, #00ff7f); width: 96px; height: 96px; border-radius: 50%; margin: 0 auto 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 50px rgba(0,255,0,0.45), 0 12px 32px rgba(0,0,0,0.4); border: 3px solid rgba(255,215,0,0.4); position: relative;">
                                    <span style="font-size: 52px; color: #000; font-weight: bold;">✓</span>
                                    <div style="position: absolute; width: 110px; height: 110px; border-radius: 50%; border: 2px dashed rgba(255,215,0,0.3); animation: spin 20s linear infinite;"></div>
                                </div>
                                <h2 style="color: #FFD700; margin: 0; font-size: 30px; letter-spacing: 0.8px; font-weight: 700; text-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                                    Jah Bless! 🙏 Objednávka přijata
                                </h2>
                                <p style="color: #a8ffb0; margin: 16px 0 0 0; font-size: 16px; line-height: 1.6;">
                                    Díky za důvěru! 💚 Vaše objednávka byla úspěšně zpracována.<br>
                                    <span style="color: #FFD700; font-weight: 600;">ZION rodina</span> se rozrůstá o dalšího strážce světla. ✨
                                </p>
                            </div>

                            <div style="background: linear-gradient(145deg, rgba(34,139,34,0.2), rgba(0,0,0,0.4)); border: 2px solid rgba(0,255,0,0.35); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(0,255,0,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 24px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid rgba(255,215,0,0.3); padding-bottom: 16px;">
                                    📋 Detaily objednávky
                                </h3>

                                <table width="100%" cellpadding="12" cellspacing="0">
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            🔖 Číslo objednávky:
                                        </td>
                                        <td style="color: #FFD700; font-size: 17px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700; letter-spacing: 1px;">
                                            ${escapeHtml(order.orderId)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            👤 Jméno:
                                        </td>
                                        <td style="color: #fff; font-size: 16px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            ${escapeHtml(order.customerName)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            📧 Email:
                                        </td>
                                        <td style="color: #fff; font-size: 16px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            ${escapeHtml(order.customerEmail)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            📅 Datum objednávky:
                                        </td>
                                        <td style="color: #fff; font-size: 16px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            ${orderDate}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; font-weight: 600;">
                                            💰 Celková cena:
                                        </td>
                                        <td style="color: #FFD700; font-size: 22px; text-align: right; padding: 10px 0; font-weight: 700;">
                                            ${formatPrice(order.totalCzk)}
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <div style="background: linear-gradient(145deg, rgba(220,20,60,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(220,20,60,0.3); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(220,20,60,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 24px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid rgba(255,215,0,0.3); padding-bottom: 16px;">
                                    🛒 Položky objednávky
                                </h3>

                                ${itemsHtml}
                            </div>

                            ${zionTokenSection}

                            ${digitalDownloads}

                            ${shippingHtml}

                            <div style="background: linear-gradient(145deg, rgba(255,215,0,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(255,215,0,0.35); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(255,215,0,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700;">
                                    💳 Informace o platbě
                                </h3>

                                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,215,0,0.2);">
                                    <table width="100%" cellpadding="8" cellspacing="0">
                                        <tr>
                                            <td style="color: #9af59a; font-size: 15px; font-weight: 600;">Způsob platby:</td>
                                            <td style="color: #fff; font-size: 16px; text-align: right;">${escapeHtml(paymentMethod)}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #9af59a; font-size: 15px; font-weight: 600;">Status platby:</td>
                                            <td style="text-align: right;">
                                                <span style="display: inline-block; padding: 6px 16px; background: ${statusColor}; color: #000; font-weight: 700; border-radius: 999px; font-size: 14px;">
                                                    ${escapeHtml(paymentStatus)}
                                                </span>
                                            </td>
                                        </tr>
                                        ${paymentInstructions}
                                    </table>

                                    ${qrSection}
                                </div>
                            </div>

                            <div style="background: linear-gradient(145deg, rgba(34,139,34,0.15), rgba(0,0,0,0.3)); border: 2px solid rgba(0,255,0,0.25); border-radius: 18px; padding: 28px; margin-bottom: 24px;">
                                <h3 style="color: #FFD700; margin: 0 0 18px 0; font-size: 20px; text-align: center; letter-spacing: 0.8px; font-weight: 700;">
                                    ⚡ Co bude dál?
                                </h3>
                                <ul style="color: #a8ffb0; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 24px;">
                                    <li style="margin-bottom: 10px;">✅ <strong>Potvrzení:</strong> Tímto emailem potvrzujeme přijetí objednávky</li>
                                    <li style="margin-bottom: 10px;">📦 <strong>Zpracování:</strong> ${processingInfo}</li>
                                    <li style="margin-bottom: 10px;">🚚 <strong>Doručení:</strong> ${deliveryInfo}</li>
                                    <li>💚 <strong>Podpora:</strong> Pro jakékoliv dotazy nás kontaktujte na ${escapeHtml(COMPANY.supportEmail)}</li>
                                </ul>
                            </div>

                        </td>
                    </tr>

                    <tr>
                        <td style="background: linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); padding: 3px;">
                            <div style="background: #0a0a0a; padding: 32px; text-align: center;">
                                <p style="color: #9af59a; font-size: 16px; margin: 0 0 12px 0; font-weight: 600; letter-spacing: 0.5px;">
                                    ☮️ Peace & One Love ☮️
                                </p>
                                <p style="color: #999; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6;">
                                    Tento email byl odeslán z <strong style="color: #FFD700;">ZION eShop</strong><br>
                                    Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat
                                </p>
                                <div style="margin: 16px 0;">
                                    <a href="${escapeHtml(COMPANY.shopUrl)}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #1f9b1f, #00ff7f); color: #000; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 20px rgba(0,255,0,0.3); border: 2px solid rgba(255,215,0,0.4); letter-spacing: 0.5px;">
                                        🛒 Přejít do eshopu
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">
                                    © 2026 ZION Terra Nova • All Rights Reserved
                                </p>
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  const paymentInstructionsText = formatPaymentInstructionsText(order);
  const shippingText = formatShippingText(order);
  const zionText = formatZionTokenSectionText(order);

  const text = `ZION TERRA NOVA - Potvrzení objednávky #${order.orderId}
=======================================

Jah Bless! Objednávka přijata.

Díky za důvěru. Vaše objednávka byla úspěšně zpracována.

Detaily objednávky:
  Číslo objednávky: ${order.orderId}
  Jméno: ${order.customerName}
  Email: ${order.customerEmail}
  Datum: ${orderDate}
  Celková cena: ${formatPrice(order.totalCzk)}

Položky:
${formatItemsText(order)}

${zionText}

${shippingText}

Informace o platbě:
  Způsob platby: ${paymentMethod}
  Status: ${paymentStatus}
  ${paymentInstructionsText.replace(/\n/g, '\n  ')}

Co bude dál:
- Potvrzení: Tímto emailem potvrzujeme přijetí objednávky
- Zpracování: ${processingInfo}
- Doručení: ${deliveryInfo}
- Podpora: Pro dotazy kontaktujte ${COMPANY.supportEmail}

Přejít do eshopu: ${COMPANY.shopUrl}

Peace & One Love
ZION Terra Nova
`;

  return { html, text };
}
