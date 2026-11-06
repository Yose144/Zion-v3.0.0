import type { OrderEmailData } from './email';
import type { ShopTheme } from './settings';
import { emailLocale, resolveEmailLang, tl, type EmailLang } from './email-lang';
import { COMPANY as COMPANY_BASE, companySupportEmail } from './company';

const COMPANY = {
  ...COMPANY_BASE,
  get supportEmail() {
    return companySupportEmail();
  },
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

function formatPrice(amount: number, lang: EmailLang = 'cs'): string {
  return `${Math.round(amount).toLocaleString(emailLocale(lang))} Kč`;
}

function formatNumber(value: number, lang: EmailLang = 'cs'): string {
  return value.toLocaleString(emailLocale(lang));
}

function paymentMethodText(method: string, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  if (method === 'card' || method === 'stripe') return t('Platební karta', 'Card payment');
  if (method === 'transfer') return t('Bankovní převod', 'Bank transfer');
  if (method === 'cash') return t('Hotově / Dobírka', 'Cash / Cash on delivery');
  if (method === 'crypto') return t('Kryptoměna', 'Cryptocurrency');
  return method || t('Neuvedeno', 'Not specified');
}

function shippingMethodText(method: string, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  if (method === 'zasilkovna-home') return t('Doručení domů (Zásilkovna)', 'Home delivery (Zásilkovna)');
  if (method === 'zasilkovna') return t('Výdejní místo Zásilkovna', 'Zásilkovna pickup point');
  if (method?.includes('virtualni')) return t('Digitální doručení', 'Digital delivery');
  return method || t('Neuvedeno', 'Not specified');
}

function paymentStatusText(status: string, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const s = (status || '').toLowerCase();
  if (s === 'paid') return t('Zaplaceno', 'Paid');
  if (s === 'pending') return t('Čeká na platbu', 'Awaiting payment');
  if (s === 'failed') return t('Zrušeno', 'Cancelled');
  return status || t('Neuvedeno', 'Not specified');
}

function paymentStatusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return '#1c7b1c';
  if (s === 'pending') return '#FFD700';
  if (s === 'failed') return '#c01026';
  return '#666666';
}

function formatOrderDate(lang: EmailLang = 'cs'): string {
  return new Date().toLocaleDateString(emailLocale(lang));
}

function formatAddress(order: OrderEmailData): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

function formatItemsHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return `<p style="color:#9af59a;text-align:center;padding:14px 0;">${t('Žádné položky', 'No items')}</p>`;
  }

  const rows = items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      const total = qty * price;
      const name = String(raw.name ?? (lang === 'cs' ? 'Produkt' : 'Product'));
      return `
        <tr>
          <td style="color:#e5e7eb;font-size:15px;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;">
            <strong style="color:#fff;">${escapeHtml(name)}</strong>
          </td>
          <td style="color:#9af59a;font-size:15px;text-align:center;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;width:80px;">${qty}x</td>
          <td style="color:#FFD700;font-size:16px;text-align:right;padding:14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:middle;width:120px;font-weight:700;">${formatPrice(total, lang)}</td>
        </tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

function formatItemsText(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return tl(lang, 'Žádné položky', 'No items');
  return items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      const total = qty * price;
      const name = String(raw.name ?? tl(lang, 'Produkt', 'Product'));
      return `- ${name} - ${qty}x - ${formatPrice(total, lang)}`;
    })
    .join('\n');
}

function formatShippingHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  if (order.shipping?.includes('virtualni')) {
    return '';
  }

  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    if (pp?.name) {
      address = `${t('Výdejní místo', 'Pickup point')}: ${escapeHtml(String(pp.name))}, ${escapeHtml(String(pp.city ?? ''))}`;
    } else {
      address = t('Zásilkovna - výdejní místo (bude upřesněno)', 'Zásilkovna pickup point (to be specified)');
    }
  } else {
    address = escapeHtml(order.shipping);
  }

  return `
    <div style="background: linear-gradient(145deg, rgba(34,139,34,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(0,255,0,0.25); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(0,255,0,0.1);">
      <h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700;">🚚 ${t('Doprava', 'Shipping')}</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600;">${t('Jméno', 'Name')}:</td>
          <td style="color: #fff; font-size: 16px; text-align: right;">${escapeHtml(order.customerName)}</td>
        </tr>
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">${t('Adresa', 'Address')}:</td>
          <td style="color: #fff; font-size: 16px; text-align: right; padding-top: 8px;">${address || '—'}</td>
        </tr>
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">${t('Způsob dopravy', 'Delivery method')}:</td>
          <td style="color: #fff; font-size: 16px; text-align: right; padding-top: 8px;">${escapeHtml(shippingMethodText(order.shipping, lang))}</td>
        </tr>
        ${order.shippingCzk > 0 ? `
        <tr>
          <td style="color: #9af59a; font-size: 15px; font-weight: 600; padding-top: 8px;">${t('Poštovné', 'Shipping fee')}:</td>
          <td style="color: #FFD700; font-size: 16px; text-align: right; padding-top: 8px; font-weight: 700;">${formatPrice(order.shippingCzk, lang)}</td>
        </tr>` : ''}
      </table>
    </div>
  `;
}

function formatShippingText(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  if (order.shipping?.includes('virtualni')) return '';

  let address = '';
  if (order.shipping === 'zasilkovna-home') {
    address = formatAddress(order);
  } else if (order.shipping === 'zasilkovna') {
    const pp = order.pickupPoint as Record<string, unknown> | undefined;
    address = pp?.name
      ? `${t('Výdejní místo', 'Pickup point')}: ${String(pp.name)}, ${String(pp.city ?? '')}`
      : t('Zásilkovna - výdejní místo (bude upřesněno)', 'Zásilkovna pickup point (to be specified)');
  } else {
    address = order.shipping;
  }

  return `${t('Doprava', 'Shipping')}:
${t('Jméno', 'Name')}: ${order.customerName}
${t('Adresa', 'Address')}: ${address || '—'}
${t('Způsob dopravy', 'Delivery method')}: ${shippingMethodText(order.shipping, lang)}${
    order.shippingCzk > 0 ? `\n${t('Poštovné', 'Shipping fee')}: ${formatPrice(order.shippingCzk, lang)}` : ''
  }`;
}

function formatPaymentInstructionsHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
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
            <p style="color: #FFD700; font-size: 15px; margin: 0 0 16px 0; font-weight: 700; text-align: center;">💳 ${t('Instrukce k platbě', 'Payment instructions')}</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align: top; padding-right: 16px; color: #e5e7eb; font-size: 14px; line-height: 1.8;" width="55%">
                  <strong style="color:#9af59a;">${t('Příjemce', 'Beneficiary')}:</strong> ${escapeHtml(COMPANY.name)}<br>
                  <strong style="color:#9af59a;">IČO:</strong> ${escapeHtml(COMPANY.ico)} · ${t('DIČ', 'VAT')}: ${escapeHtml(COMPANY.dic)}<br>
                  <strong style="color:#9af59a;">${t('Číslo účtu', 'Account number')}:</strong> ${escapeHtml(COMPANY.bankAccount)} (${escapeHtml(COMPANY.bankName)})<br>
                  <strong style="color:#9af59a;">IBAN:</strong> ${escapeHtml(COMPANY.iban)}<br>
                  <strong style="color:#9af59a;">SWIFT:</strong> ${escapeHtml(COMPANY.swift)}<br>
                  <strong style="color:#9af59a;">${t('Variabilní symbol', 'Variable symbol')}:</strong> ${escapeHtml(order.orderId)}<br>
                  <strong style="color:#9af59a;">${t('Částka', 'Amount')}:</strong> ${formatPrice(order.totalCzk, lang)}<br>
                  <strong style="color:#9af59a;">${t('Zpráva', 'Message')}:</strong> ${t('Objednávka', 'Order')} ${escapeHtml(order.orderId)}
                </td>
                <td style="vertical-align: top; text-align: center;" width="45%">
                  <img src="${qrUrl}" alt="${t('QR platba', 'Payment QR')}" width="150" height="150" style="border-radius: 8px; background-color: #ffffff; padding: 4px; display: block; margin: 0 auto;" />
                  <p style="color: #8a8f94; font-size: 11px; margin: 8px 0 0 0;">${t('Naskenujte v bankovní aplikaci', 'Scan in your banking app')}</p>
                </td>
              </tr>
            </table>
            <p style="color: #8a8f94; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
              ${t('Platbu prosím uhraďte do 7 dnů. Po přijetí platby Vás budeme kontaktovat.', 'Please pay within 7 days. We will contact you once the payment is received.')}
            </p>
          </div>
        </td>
      </tr>
    `;
  }

  return '';
}

function formatPaymentInstructionsText(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const status = (order.paymentStatus || '').toLowerCase();
  if (status === 'paid') return '';

  if (order.payment === 'transfer') {
    return `${t('Instrukce k platbě', 'Payment instructions')}:
${t('Příjemce', 'Beneficiary')}: ${COMPANY.name}
IČO: ${COMPANY.ico} · ${t('DIČ', 'VAT')}: ${COMPANY.dic}
${t('Číslo účtu', 'Account number')}: ${COMPANY.bankAccount} (${COMPANY.bankName})
IBAN: ${COMPANY.iban}
SWIFT: ${COMPANY.swift}
${t('Variabilní symbol', 'Variable symbol')}: ${order.orderId}
${t('Částka', 'Amount')}: ${formatPrice(order.totalCzk, lang)}
${t('Zpráva', 'Message')}: ${t('Objednávka', 'Order')} ${order.orderId}

${t('Platbu prosím uhraďte do 7 dnů.', 'Please pay within 7 days.')}`;
  }

  return '';
}

export function formatDigitalDownloadsText(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
  const digi = items.filter((it) => {
    if (it.digital === true) return true;
    /**
     * **Fyzické zboží sem nepatří.** Dřevěné stíhačky jsou vypalované kity —
     * `digital: false` — ale mají `modelUrl` (3D náhled) a `instructionsUrl`
     * (plány u autora), takže se dřív objevily v sekci „Digitální stažení"
     * a zákazník si mohl myslet, že si koupil soubory. `false` je rozhodnutí,
     * ne „nevím" — respektuje se.
     */
    if (it.digital === false) return false;
    return Boolean(it.filesUrl || it.instructionsUrl || it.modelUrl);
  });
  if (digi.length === 0) return '';

  const rows = digi.map((it) => {
    const name = String(it.name ?? t('Digitální produkt', 'Digital product'));
    const links: string[] = [];
    if (typeof it.filesUrl === 'string' && it.filesUrl) links.push(it.filesUrl);
    if (typeof it.instructionsUrl === 'string' && it.instructionsUrl) links.push(it.instructionsUrl);
    if (typeof it.modelUrl === 'string' && it.modelUrl) links.push(it.modelUrl);
    if (links.length === 0) {
      return `- ${name}: ${t('odkazy pošleme po potvrzení platby', 'we will send the links once payment is confirmed')}`;
    }
    return `- ${name}:\n  ${links.join('\n  ')}`;
  });

  return `${t('Digitální stažení', 'Digital downloads')}:
${rows.join('\n')}

${t('Uložte si odkazy pro pozdější použití.', 'Save the links for later.')}`;
}

export function formatDigitalDownloadsHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
  const digi = items.filter((it) => {
    if (it.digital === true) return true;
    // fyzické zboží (vypalované kity) nemá digitální dodávku — viz text varianta
    if (it.digital === false) return false;
    return Boolean(it.filesUrl || it.instructionsUrl || it.modelUrl);
  });
  if (digi.length === 0) return '';

  const rows = digi
    .map((it) => {
      const name = escapeHtml(String(it.name ?? t('Digitální produkt', 'Digital product')));
      const links: string[] = [];
      if (typeof it.filesUrl === 'string' && it.filesUrl) {
        links.push(
          `<a href="${escapeHtml(it.filesUrl)}" style="color:#FFD700;font-weight:700;">${t('Soubory / download', 'Files / download')}</a>`,
        );
      }
      if (typeof it.instructionsUrl === 'string' && it.instructionsUrl) {
        links.push(
          `<a href="${escapeHtml(it.instructionsUrl)}" style="color:#9af59a;">${t('Instrukce (PDF)', 'Instructions (PDF)')}</a>`,
        );
      }
      if (typeof it.modelUrl === 'string' && it.modelUrl) {
        links.push(
          `<a href="${escapeHtml(it.modelUrl)}" style="color:#9af59a;">${t('3D model', '3D model')}</a>`,
        );
      }
      if (links.length === 0) {
        links.push(`<span style="color:#8a8f94;">${t('Odkazy pošleme po potvrzení platby.', 'We will send the links once the payment is confirmed.')}</span>`);
      }
      return `<li style="margin:0 0 12px 0;"><strong style="color:#00ff7f;">${name}</strong><br>${links.join(' · ')}</li>`;
    })
    .join('');

  return `
    <div style="background: linear-gradient(145deg, rgba(255,215,0,0.12), rgba(0,0,0,0.5)); border: 2px solid rgba(255,215,0,0.35); border-radius: 18px; padding: 28px; margin-bottom: 36px;">
      <h3 style="color:#FFD700;margin:0 0 16px 0;font-size:20px;text-align:center;">📥 ${t('Digitální stažení', 'Digital downloads')}</h3>
      <ul style="color:#9af59a;font-size:14px;line-height:1.6;margin:0;padding-left:18px;">${rows}</ul>
      <p style="color:#8a8f94;font-size:12px;margin:16px 0 0 0;text-align:center;">
        ${t('Uložte si odkazy.', 'Save the links for later.')} ${t('Podpora', 'Support')}: ${escapeHtml(COMPANY.supportEmail)}
      </p>
    </div>
  `;
}

function formatZionTokenSectionHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';

  const walletAddress = order.customerWalletAddress?.trim() || '';
  const walletId = order.customerWalletId?.trim() || order.orderId;
  const walletQr = walletAddress
    ? `https://quickchart.io/qr?text=${encodeURIComponent(walletAddress)}&size=160&margin=2`
    : '';

  const walletBlock = walletAddress
    ? `
      <div style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 28px; border: 2px solid rgba(0,255,127,0.3); margin-bottom: 20px;">
        <table width="100%" cellpadding="10" cellspacing="0">
          <tr>
            <td style="color: #9af59a; font-size: 16px; font-weight: 600;">💎 ${t('Bonus tokeny', 'Bonus tokens')}:</td>
            <td style="color: #00ff7f; font-size: 26px; font-weight: 700; text-align: right;">${formatNumber(tokens, lang)} ZION ⚡</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 16px;">
              <p style="color: #8a8f94; font-size: 13px; margin: 0 0 10px 0;">🔐 ${t('Wallet ID / objednávka', 'Wallet ID / order')}:</p>
              <p style="color: #00ff7f; font-size: 15px; font-family: monospace; word-break: break-all; margin: 0; font-weight: 700; background: rgba(0,255,127,0.1); padding: 12px; border-radius: 8px;">${escapeHtml(walletId)}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 16px;">
              <p style="color: #8a8f94; font-size: 13px; margin: 0 0 10px 0;">📍 ${t('ZION L1 adresa', 'ZION L1 address')}:</p>
              <p style="color: #00ff7f; font-size: 14px; font-family: monospace; word-break: break-all; margin: 0; font-weight: 600; background: rgba(0,255,127,0.08); padding: 12px; border-radius: 8px;">${escapeHtml(walletAddress)}</p>
            </td>
          </tr>
        </table>
        ${
          walletQr
            ? `<div style="text-align:center;margin-top:18px;">
                <img src="${walletQr}" alt="${t('QR adresa peněženky', 'Wallet QR')}" width="140" height="140" style="border-radius:8px;background:#fff;padding:4px;" />
                <p style="color:#8a8f94;font-size:11px;margin:8px 0 0 0;">${t('QR adresa peněženky', 'Wallet address QR')}</p>
              </div>`
            : ''
        }
      </div>
      <div style="background: rgba(255,215,0,0.1); border-left: 4px solid #FFD700; padding: 16px; border-radius: 8px;">
        <p style="color: #FFD700; font-size: 14px; margin: 0; line-height: 1.6;">
          ⚠️ <strong>${t('DŮLEŽITÉ', 'IMPORTANT')}:</strong>
          ${t(
            'Seed phrase jsme poslali samostatným e-mailem — uložte ji offline. Bonus ZION se připíše na tuto peněženku po uhrazení objednávky (admin / payout).',
            'We sent the seed phrase in a separate e-mail — store it offline. The ZION bonus is credited to this wallet once the order is paid (admin / payout).',
          )}
        </p>
      </div>
      <div style="margin-top: 20px; padding: 18px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(0,255,127,0.2);">
        <h4 style="color: #FFD700; margin: 0 0 12px 0; font-size: 15px; text-align: center;">📖 ${t('Co s tokeny můžete dělat?', 'What can you do with the tokens?')}</h4>
        <ul style="color: #a8ffb0; font-size: 14px; line-height: 1.7; margin: 0; padding-left: 22px;">
          <li>💰 ${t('Platby v ekosystému ZION', 'Payments in the ZION ecosystem')}</li>
          <li>🔒 ${t('Staking a odměny', 'Staking and rewards')}</li>
          <li>🗳️ ${t('Governance / DAO', 'Governance / DAO')}</li>
          <li>⚡ ${t('Consciousness mining', 'Consciousness mining')}</li>
        </ul>
      </div>`
    : `
      <div style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 20px; border: 1px solid rgba(0,255,127,0.2);">
        <p style="color: #9af59a; font-size: 16px; text-align: center; margin: 0 0 12px 0;">
          <strong style="color:#00ff7f;font-size:22px;">${formatNumber(tokens, lang)} ZION</strong>
        </p>
        <p style="color: #8a8f94; font-size: 13px; line-height: 1.6; margin: 0; text-align:center;">
          ${t(
            'Bonus evidujeme k objednávce. Po zaplacení připravíme / připíšeme tokeny na ZION L1.',
            'We track the bonus against your order. After payment we prepare / credit the tokens on ZION L1.',
          )}
          ${t('Dotazy', 'Questions')}: ${escapeHtml(COMPANY.supportEmail)}.
        </p>
      </div>`;

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
        ${t(
          'Jah Bless! 🙏 Za váš nákup jste získali <strong style="color: #00ff7f; font-size: 20px;">ZION tokeny</strong> jako poděkování!',
          'Jah Bless! 🙏 Your purchase earned you <strong style="color: #00ff7f; font-size: 20px;">ZION tokens</strong> as a thank-you!',
        )}
      </p>
      ${walletBlock}
    </div>
  `;
}

function formatZionTokenSectionText(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const tokens = order.zionTokens || 0;
  if (tokens === 0) return '';
  const parts = [
    `🎁 ZION TOKEN BONUS 🎁`,
    t(
      `Jah Bless! Za váš nákup jste získali ${formatNumber(tokens, lang)} ZION.`,
      `Jah Bless! Your purchase earned you ${formatNumber(tokens, lang)} ZION.`,
    ),
  ];
  if (order.customerWalletAddress) {
    parts.push(`Wallet ID: ${order.customerWalletId || order.orderId}`);
    parts.push(`${t('ZION adresa', 'ZION address')}: ${order.customerWalletAddress}`);
    parts.push(t('Seed phrase je v samostatném e-mailu — uložte offline.', 'The seed phrase is in a separate e-mail — store it offline.'));
    parts.push(t('Bonus se připíše po uhrazení objednávky.', 'The bonus is credited once the order is paid.'));
  } else {
    parts.push(t(
      'Bonus evidujeme k objednávce; po zaplacení připíšeme na ZION L1.',
      'We track the bonus against your order; once paid we credit it on ZION L1.',
    ));
  }
  return parts.join('\n');
}

function formatQrCodeSectionHtml(order: OrderEmailData, lang: EmailLang = 'cs'): string {
  const t = (cs: string, en: string) => tl(lang, cs, en);
  if (order.payment !== 'transfer') return '';
  const iban = COMPANY.iban.replace(/\s/g, '');
  const vs = order.orderId.replace(/\D/g, '').slice(0, 10);
  const spd = `SPD*1.0*ACC:${iban}*AM:${order.totalCzk}.00*CC:CZK*MSG:Objednavka ${order.orderId}${vs ? `*X-VS:${vs}` : ''}`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(spd)}&size=280&margin=2`;

  return `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background: #0a0a0a; border-radius: 16px; border: 2px solid rgba(255,215,0,0.3);">
      <p style="color: #FFD700; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">
        📱 ${t('QR kód pro platbu', 'Payment QR code')}
      </p>
      <img src="${qrUrl}" alt="${t('QR platba', 'Payment QR')}" style="width: 280px; max-width: 100%; height: auto; border-radius: 12px; border: 3px solid #FFD700; background: #fff;" />
      <p style="color: #00ff7f; font-size: 13px; margin: 15px 0 5px 0;">
        ✅ ${t('Naskenujte v bankovní aplikaci', 'Scan in your banking app')}
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
  const lang = resolveEmailLang(order);
  const t = (cs: string, en: string) => tl(lang, cs, en);

  const orderDate = formatOrderDate(lang);
  const paymentMethod = paymentMethodText(order.payment, lang);
  const paymentStatus = paymentStatusText(order.paymentStatus, lang);
  const statusColor = paymentStatusColor(order.paymentStatus);
  const itemsHtml = formatItemsHtml(order, lang);
  const shippingHtml = formatShippingHtml(order, lang);
  const paymentInstructions = formatPaymentInstructionsHtml(order, lang);
  const qrSection = formatQrCodeSectionHtml(order, lang);
  const zionTokenSection = formatZionTokenSectionHtml(order, lang);
  const digitalDownloads = formatDigitalDownloadsHtml(order, lang);
  const isPaid = order.paymentStatus.toLowerCase() === 'paid';
  const processingInfo = isPaid
    ? t('Vaši objednávku nyní zpracováváme a připravujeme k odeslání', 'We are processing your order and preparing it for dispatch')
    : t('Po obdržení platby začneme okamžitě zpracovávat Vaši objednávku', 'We will start processing your order as soon as the payment arrives');
  const deliveryInfo = isPaid
    ? t('Očekávaná dodací lhůta 3-5 pracovních dnů', 'Expected delivery within 3-5 business days')
    : t('Po zaplacení očekávaná dodací lhůta 3-5 pracovních dnů', 'Once paid, expected delivery within 3-5 business days');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZION - ${t('Potvrzení objednávky', 'Order confirmation')} #${escapeHtml(order.orderId)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Trebuchet MS', 'Verdana', sans-serif; background: radial-gradient(circle at 20% 20%, rgba(0,255,0,0.15), transparent 40%), radial-gradient(circle at 80% 15%, rgba(255,215,0,0.15), transparent 45%), radial-gradient(circle at 50% 90%, rgba(220,20,60,0.18), transparent 40%), #0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, rgba(0,0,0,0.85), rgba(0,0,0,0.96)); padding: 50px 20px;">
        <tr>
            <td align="center">
                <table width="680" cellpadding="0" cellspacing="0" style="background: #0f0f0f; border-radius: 24px; overflow: hidden; box-shadow: 0 28px 72px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.06);">

                    <tr>
                        <td style="background: linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); padding: 4px;">
                            <div style="background: #0f0f0f; padding: 32px 28px; text-align: center;">
                                <img src="${escapeHtml(COMPANY.logoUrl)}" alt="${escapeHtml(COMPANY.name)}" width="88" height="88" style="border-radius: 50%; display: block; margin: 0 auto 14px auto; background: #111;" />
                                <div style="color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">
                                    ${escapeHtml(COMPANY.name)}
                                </div>
                                <div style="color: #9af59a; font-size: 12px; margin-bottom: 16px;">
                                    ${t('IČO', 'Company ID')} ${escapeHtml(COMPANY.ico)} · ${t('DIČ', 'VAT')} ${escapeHtml(COMPANY.dic)}
                                </div>
                                <div style="display: inline-block; padding: 11px 22px; border-radius: 999px; background: rgba(0,0,0,0.4); color: #FFD700; font-size: 13px; letter-spacing: 3.5px; border: 1px solid rgba(255,215,0,0.5); text-transform: uppercase; font-weight: 600;">
                                    ⚡ ${t('ESHOP OBJEDNÁVKA', 'ESHOP ORDER')} ⚡
                                </div>
                                <h1 style="color: #FFD700; margin: 18px 0 8px 0; font-size: 32px; text-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.3); font-weight: 700;">
                                    ZION TERRA NOVA
                                </h1>
                                <p style="color: #9af59a; margin: 0; font-size: 15px; letter-spacing: 1.5px; font-weight: 500;">
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
                                    ${t('Jah Bless! 🙏 Objednávka přijata', 'Jah Bless! 🙏 Order received')}
                                </h2>
                                <p style="color: #a8ffb0; margin: 16px 0 0 0; font-size: 16px; line-height: 1.6;">
                                    ${t('Díky za důvěru! 💚 Vaše objednávka byla úspěšně zpracována.', 'Thank you for your trust! 💚 Your order has been processed successfully.')}<br>
                                    ${t(
                                      '<span style="color: #FFD700; font-weight: 600;">ZION rodina</span> se rozrůstá o dalšího strážce světla. ✨',
                                      'The <span style="color: #FFD700; font-weight: 600;">ZION family</span> gains another keeper of the light. ✨',
                                    )}
                                </p>
                            </div>

                            <div style="background: linear-gradient(145deg, rgba(34,139,34,0.2), rgba(0,0,0,0.4)); border: 2px solid rgba(0,255,0,0.35); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(0,255,0,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 24px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid rgba(255,215,0,0.3); padding-bottom: 16px;">
                                    📋 ${t('Detaily objednávky', 'Order details')}
                                </h3>

                                <table width="100%" cellpadding="12" cellspacing="0">
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            🔖 ${t('Číslo objednávky', 'Order number')}:
                                        </td>
                                        <td style="color: #FFD700; font-size: 17px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700; letter-spacing: 1px;">
                                            ${escapeHtml(order.orderId)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">
                                            👤 ${t('Jméno', 'Name')}:
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
                                            📅 ${t('Datum objednávky', 'Order date')}:
                                        </td>
                                        <td style="color: #fff; font-size: 16px; text-align: right; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            ${orderDate}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #9af59a; font-size: 15px; padding: 10px 0; font-weight: 600;">
                                            💰 ${t('Celková cena', 'Total price')}:
                                        </td>
                                        <td style="color: #FFD700; font-size: 22px; text-align: right; padding: 10px 0; font-weight: 700;">
                                            ${formatPrice(order.totalCzk, lang)}
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <div style="background: linear-gradient(145deg, rgba(220,20,60,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(220,20,60,0.3); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(220,20,60,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 24px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid rgba(255,215,0,0.3); padding-bottom: 16px;">
                                    🛒 ${t('Položky objednávky', 'Order items')}
                                </h3>

                                ${itemsHtml}
                            </div>

                            ${zionTokenSection}

                            ${digitalDownloads}

                            ${shippingHtml}

                            <div style="background: linear-gradient(145deg, rgba(255,215,0,0.15), rgba(0,0,0,0.4)); border: 2px solid rgba(255,215,0,0.35); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(255,215,0,0.1);">
                                <h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700;">
                                    💳 ${t('Informace o platbě', 'Payment information')}
                                </h3>

                                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,215,0,0.2);">
                                    <table width="100%" cellpadding="8" cellspacing="0">
                                        <tr>
                                            <td style="color: #9af59a; font-size: 15px; font-weight: 600;">${t('Způsob platby', 'Payment method')}:</td>
                                            <td style="color: #fff; font-size: 16px; text-align: right;">${escapeHtml(paymentMethod)}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #9af59a; font-size: 15px; font-weight: 600;">${t('Status platby', 'Payment status')}:</td>
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
                                    ⚡ ${t('Co bude dál?', 'What happens next?')}
                                </h3>
                                <ul style="color: #a8ffb0; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 24px;">
                                    <li style="margin-bottom: 10px;">✅ <strong>${t('Potvrzení', 'Confirmation')}:</strong> ${t('Tímto emailem potvrzujeme přijetí objednávky', 'This e-mail confirms we have received your order')}</li>
                                    <li style="margin-bottom: 10px;">📦 <strong>${t('Zpracování', 'Processing')}:</strong> ${processingInfo}</li>
                                    <li style="margin-bottom: 10px;">🚚 <strong>${t('Doručení', 'Delivery')}:</strong> ${deliveryInfo}</li>
                                    <li>💚 <strong>${t('Podpora', 'Support')}:</strong> ${t('Pro jakékoliv dotazy nás kontaktujte na', 'For any questions contact us at')} ${escapeHtml(COMPANY.supportEmail)}</li>
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
                                    ${t('Tento email byl odeslán z', 'This e-mail was sent from')} <strong style="color: #FFD700;">ZION eShop</strong><br>
                                    ZION TerraNova ® | <strong style="color:#fff;">${escapeHtml(COMPANY.name)}</strong><br>
                                    ${t('IČO', 'Company ID')} ${escapeHtml(COMPANY.ico)} · ${t('DIČ', 'VAT')} ${escapeHtml(COMPANY.dic)} · ${escapeHtml(COMPANY.address)}, ${escapeHtml(COMPANY.city)}
                                </p>
                                <div style="margin: 16px 0;">
                                    <a href="${escapeHtml(COMPANY.shopUrl)}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #1f9b1f, #00ff7f); color: #000; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 20px rgba(0,255,0,0.3); border: 2px solid rgba(255,215,0,0.4); letter-spacing: 0.5px;">
                                        🛒 ${t('Přejít do eshopu', 'Go to the e-shop')}
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">
                                    © 2026 ZION Terra Nova • All Rights Reserved<br>
                                    ${t('Podpora', 'Support')}: <a href="mailto:${escapeHtml(COMPANY.supportEmail)}" style="color:#9af59a;">${escapeHtml(COMPANY.supportEmail)}</a>
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

  const paymentInstructionsText = formatPaymentInstructionsText(order, lang);
  const shippingText = formatShippingText(order, lang);
  const zionText = formatZionTokenSectionText(order, lang);
  const digitalText = formatDigitalDownloadsText(order, lang);

  const text = `ZION TERRA NOVA - ${t('Potvrzení objednávky', 'Order confirmation')} #${order.orderId}
=======================================

${t('Jah Bless! Objednávka přijata.', 'Jah Bless! Order received.')}

${t('Díky za důvěru. Vaše objednávka byla úspěšně zpracována.', 'Thank you for your trust. Your order has been processed successfully.')}

${t('Detaily objednávky', 'Order details')}:
  ${t('Číslo objednávky', 'Order number')}: ${order.orderId}
  ${t('Jméno', 'Name')}: ${order.customerName}
  Email: ${order.customerEmail}
  ${t('Datum', 'Date')}: ${orderDate}
  ${t('Celková cena', 'Total price')}: ${formatPrice(order.totalCzk, lang)}

${t('Položky', 'Items')}:
${formatItemsText(order, lang)}

${digitalText ? digitalText + '\n' : ''}${zionText}

${shippingText}

${t('Informace o platbě', 'Payment information')}:
  ${t('Způsob platby', 'Payment method')}: ${paymentMethod}
  ${t('Status', 'Status')}: ${paymentStatus}
  ${paymentInstructionsText.replace(/\n/g, '\n  ')}

${t('Co bude dál', 'What happens next')}:
- ${t('Potvrzení', 'Confirmation')}: ${t('Tímto emailem potvrzujeme přijetí objednávky', 'This e-mail confirms we have received your order')}
- ${t('Zpracování', 'Processing')}: ${processingInfo}
- ${t('Doručení', 'Delivery')}: ${deliveryInfo}
- ${t('Podpora', 'Support')}: ${t('Pro dotazy kontaktujte', 'For questions contact')} ${COMPANY.supportEmail}

${t('Přejít do eshopu', 'Go to the e-shop')}: ${COMPANY.shopUrl}

Peace & One Love
ZION Terra Nova
`;

  return { html, text };
}

/* ------------------------------------------------------------------ */
/* Shared rasta shell — all transactional emails use the same design   */
/* as the V2 order confirmation (dark bg, rasta stripes, gold/green).  */
/* ------------------------------------------------------------------ */

export interface RastaEmailOpts {
  /** <title> + envelope subject context */
  title: string;
  /** pill badge under company block, e.g. '⚡ ESHOP OBJEDNÁVKA ⚡' */
  badge?: string;
  /** big emoji inside the green hero circle (e.g. '💚', '🚚', '🎁') */
  heroEmoji: string;
  /** main gold headline under the hero circle */
  headline: string;
  /** intro paragraph (already-escaped or plain text — escaped internally? NO: pass html) */
  intro?: string;
  /** one or more rastaCard()/custom blocks, joined in order */
  content: string;
  /** cs | en — controls the footer strings and <html lang> */
  lang?: EmailLang;
}

/** A rounded section card in rasta palette. */
export function rastaCard(opts: {
  heading?: string;
  body: string;
  tone?: 'green' | 'gold' | 'red';
}): string {
  const tones = {
    green: 'rgba(34,139,34,0.2)|rgba(0,255,0,0.35)|inset 0 2px 8px rgba(0,255,0,0.1)',
    gold: 'rgba(255,215,0,0.15)|rgba(255,215,0,0.35)|inset 0 2px 8px rgba(255,215,0,0.1)',
    red: 'rgba(220,20,60,0.15)|rgba(220,20,60,0.3)|inset 0 2px 8px rgba(220,20,60,0.1)',
  };
  const [bg, border, shadow] = tones[opts.tone ?? 'green'].split('|');
  const h = opts.heading
    ? `<h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid rgba(255,215,0,0.3); padding-bottom: 14px;">${opts.heading}</h3>`
    : '';
  return `<div style="background: linear-gradient(145deg, ${bg}, rgba(0,0,0,0.4)); border: 2px solid ${border}; border-radius: 18px; padding: 28px; margin-bottom: 32px; box-shadow: ${shadow};">${h}${opts.body}</div>`;
}

/** Label/value row for detail tables inside cards. */
export function rastaRow(label: string, valueHtml: string, opts?: { big?: boolean }): string {
  const size = opts?.big ? '20px' : '16px';
  return `<tr>
    <td style="color: #9af59a; font-size: 15px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;">${label}</td>
    <td style="color: #fff; font-size: ${size}; text-align: right; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">${valueHtml}</td>
  </tr>`;
}

/** Gold mono box for hashes / seeds / addresses. */
export function rastaMonoBox(label: string, value: string): string {
  return `<p style="color: #8a8f94; font-size: 13px; margin: 0 0 10px 0;">${label}</p>
  <p style="color: #00ff7f; font-size: 14px; font-family: monospace; word-break: break-all; margin: 0; font-weight: 600; background: rgba(0,255,127,0.08); padding: 14px; border-radius: 8px;">${escapeHtml(value)}</p>`;
}

/** Warning strip (gold left border). */
export function rastaWarning(text: string): string {
  return `<div style="background: rgba(255,215,0,0.1); border-left: 4px solid #FFD700; padding: 16px; border-radius: 8px; margin-top: 18px;">
    <p style="color: #FFD700; font-size: 14px; margin: 0; line-height: 1.6;">${text}</p>
  </div>`;
}

export function buildRastaEmail(opts: RastaEmailOpts): string {
  const lang: EmailLang = opts.lang ?? 'cs';
  const t = (cs: string, en: string) => tl(lang, cs, en);
  const badge = opts.badge ?? '⚡ ZION ESHOP ⚡';
  const intro = opts.intro
    ? `<p style="color: #a8ffb0; margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">${opts.intro}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Trebuchet MS', 'Verdana', sans-serif; background: radial-gradient(circle at 20% 20%, rgba(0,255,0,0.15), transparent 40%), radial-gradient(circle at 80% 15%, rgba(255,215,0,0.15), transparent 45%), radial-gradient(circle at 50% 90%, rgba(220,20,60,0.18), transparent 40%), #0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, rgba(0,0,0,0.85), rgba(0,0,0,0.96)); padding: 50px 20px;">
        <tr>
            <td align="center">
                <table width="680" cellpadding="0" cellspacing="0" style="background: #0f0f0f; border-radius: 24px; overflow: hidden; box-shadow: 0 28px 72px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.06);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); padding: 4px;">
                            <div style="background: #0f0f0f; padding: 32px 28px; text-align: center;">
                                <img src="${escapeHtml(COMPANY.logoUrl)}" alt="${escapeHtml(COMPANY.name)}" width="88" height="88" style="border-radius: 50%; display: block; margin: 0 auto 14px auto; background: #111;" />
                                <div style="color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">
                                    ${escapeHtml(COMPANY.name)}
                                </div>
                                <div style="color: #9af59a; font-size: 12px; margin-bottom: 16px;">
                                    ${t('IČO', 'Company ID')} ${escapeHtml(COMPANY.ico)} · ${t('DIČ', 'VAT')} ${escapeHtml(COMPANY.dic)}
                                </div>
                                <div style="display: inline-block; padding: 11px 22px; border-radius: 999px; background: rgba(0,0,0,0.4); color: #FFD700; font-size: 13px; letter-spacing: 3.5px; border: 1px solid rgba(255,215,0,0.5); text-transform: uppercase; font-weight: 600;">
                                    ${badge}
                                </div>
                                <h1 style="color: #FFD700; margin: 18px 0 8px 0; font-size: 32px; text-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.3); font-weight: 700;">
                                    ZION TERRA NOVA
                                </h1>
                                <p style="color: #9af59a; margin: 0; font-size: 15px; letter-spacing: 1.5px; font-weight: 500;">
                                    🌿 One Love • One Chain • One Future 🌿
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 44px 40px 30px 40px; background: linear-gradient(180deg, #0a0a0a 0%, #050505 100%);">
                            <div style="text-align: center; margin-bottom: 32px;">
                                <div style="background: linear-gradient(145deg, #1f9b1f, #00ff7f); width: 96px; height: 96px; border-radius: 50%; margin: 0 auto 22px; box-shadow: 0 0 50px rgba(0,255,0,0.45), 0 12px 32px rgba(0,0,0,0.4); border: 3px solid rgba(255,215,0,0.4); text-align:center;">
                                    <span style="font-size: 48px; line-height: 96px;">${opts.heroEmoji}</span>
                                </div>
                                <h2 style="color: #FFD700; margin: 0; font-size: 28px; letter-spacing: 0.8px; font-weight: 700; text-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                                    ${opts.headline}
                                </h2>
                                ${intro}
                            </div>
                            ${opts.content}
                        </td>
                    </tr>
                    <tr>
                        <td style="background: linear-gradient(135deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); padding: 3px;">
                            <div style="background: #0a0a0a; padding: 32px; text-align: center;">
                                <p style="color: #9af59a; font-size: 16px; margin: 0 0 12px 0; font-weight: 600; letter-spacing: 0.5px;">
                                    ☮️ Peace &amp; One Love ☮️
                                </p>
                                <p style="color: #999; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6;">
                                    ${t('Tento email byl odeslán z', 'This e-mail was sent from')} <strong style="color: #FFD700;">ZION eShop</strong><br>
                                    ZION TerraNova ® | <strong style="color:#fff;">${escapeHtml(COMPANY.name)}</strong><br>
                                    ${t('IČO', 'Company ID')} ${escapeHtml(COMPANY.ico)} · ${t('DIČ', 'VAT')} ${escapeHtml(COMPANY.dic)} · ${escapeHtml(COMPANY.address)}, ${escapeHtml(COMPANY.city)}
                                </p>
                                <div style="margin: 16px 0;">
                                    <a href="${escapeHtml(COMPANY.shopUrl)}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #1f9b1f, #00ff7f); color: #000; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 20px rgba(0,255,0,0.3); border: 2px solid rgba(255,215,0,0.4); letter-spacing: 0.5px;">
                                        🛒 ${t('Přejít do eshopu', 'Go to the e-shop')}
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">
                                    © 2026 ZION Terra Nova • All Rights Reserved<br>
                                    ${t('Podpora', 'Support')}: <a href="mailto:${escapeHtml(COMPANY.supportEmail)}" style="color:#9af59a;">${escapeHtml(COMPANY.supportEmail)}</a>
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
}
