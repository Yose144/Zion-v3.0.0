import { COMPANY, SELLER } from '@/lib/company';
import type { OrderLike, StoredOrderItem } from '@/lib/order-types';
import { pick } from '@/lib/i18n';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function czk(value: number): string {
  return `${new Intl.NumberFormat('cs-CZ').format(value)} Kč`;
}

function date(value: Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

const DUE_DAYS = Number(process.env.LUMI_INVOICE_DUE_DAYS ?? 7) || 7;

/**
 * Faktura jako tisknutelné HTML. Záměrně bez knihovny na PDF — pro zákazníka
 * je přirozenější otevřít stránku a uložit/ vytisknout; server tak nemusí
 * držet Chrome.
 */
export function renderInvoiceHtml(order: OrderLike): string {
  const issued = order.createdAt;
  const due = new Date(issued.getTime() + DUE_DAYS * 24 * 60 * 60 * 1000);
  const isPaid = order.paymentStatus === 'paid';
  const title = isPaid ? 'Faktura' : 'Zálohová faktura';
  const items = order.items ?? [];
  const address = [order.addressStreet, [order.addressZip, order.addressCity].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const rows = items
    .map(
      (item: StoredOrderItem) => `
      <tr>
        <td>${esc(pick(item.name, 'cs'))}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${czk(item.unitPriceCzk)}</td>
        <td class="num">${czk(item.lineTotalCzk)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} ${esc(order.invoiceNumber ?? order.orderId)} — Lumi</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #F0E1BE; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #101C2B; }
  .sheet { max-width: 820px; margin: 24px auto; background: #F8EFD9; padding: 40px 44px; box-shadow: 0 18px 60px -30px rgba(60,35,10,.4); }
  .top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #101C2B; padding-bottom: 18px; }
  .brand { font-family: Georgia, serif; font-size: 32px; letter-spacing: .06em; margin: 0; }
  .muted { color: #33424B; font-size: 12px; line-height: 1.6; }
  h1 { font-family: Georgia, serif; font-size: 24px; margin: 28px 0 4px; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 18px 0 26px; }
  .meta div span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6E6650; margin-bottom: 2px; }
  .meta div strong { font-size: 14px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 26px; }
  .parties h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #6E6650; margin: 0 0 6px; }
  .parties p { margin: 0; font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6E6650; border-bottom: 1px solid #D8C5A0; padding: 8px 6px; }
  td { padding: 10px 6px; border-bottom: 1px solid #E6D3A8; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 300px; margin-top: 18px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #101C2B; margin-top: 6px; padding-top: 10px; font-size: 17px; font-weight: 700; }
  .pay { margin-top: 30px; padding: 16px 18px; background: #F0E1BE; border: 1px solid #D8C5A0; font-size: 13px; line-height: 1.7; }
  .pay strong { font-size: 14px; }
  .foot { margin-top: 28px; font-size: 11px; color: #6E6650; line-height: 1.6; }
  .actions { max-width: 820px; margin: 0 auto 12px; text-align: right; }
  .actions button { background: #101C2B; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-size: 13px; cursor: pointer; }
  @media print { body { background: #fff; } .sheet { box-shadow: none; margin: 0; max-width: none; } .actions { display: none; } }
</style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Vytisknout / uložit PDF</button></div>
  <div class="sheet">
    <div class="top">
      <div>
        <p class="brand">LUMI</p>
        <p class="muted">Dřevěné lampiony<br/>${esc(COMPANY.web)}</p>
      </div>
      <div class="muted" style="text-align:right">
        <strong style="font-size:14px;color:#101C2B">${esc(SELLER.name)}</strong><br/>
        ${esc(SELLER.address)}<br/>${esc(SELLER.city)}<br/>
        IČO: ${esc(SELLER.ico)}${SELLER.dic ? `<br/>DIČ: ${esc(SELLER.dic)}` : ''}<br/>
        ${esc(SELLER.court)}, ${esc(SELLER.fileNo)}
      </div>
    </div>

    <h1>${esc(title)} ${esc(order.invoiceNumber ?? '')}</h1>
    <div class="meta">
      <div><span>Číslo objednávky</span><strong>${esc(order.orderId)}</strong></div>
      <div><span>Datum vystavení</span><strong>${date(issued)}</strong></div>
      <div><span>Splatnost</span><strong>${date(due)}</strong></div>
      <div><span>Variabilní symbol</span><strong>${esc(order.variableSymbol ?? '—')}</strong></div>
      <div><span>Forma úhrady</span><strong>${order.payment === 'cod' ? 'Dobírka' : order.payment === 'card' ? 'Karta' : 'Převod'}</strong></div>
      <div><span>Stav</span><strong>${isPaid ? 'Uhrazeno' : 'Neuhrazeno'}</strong></div>
    </div>

    <div class="parties">
      <div>
        <h2>Odběratel</h2>
        <p>
          <strong>${esc(order.companyName || order.customerName)}</strong><br/>
          ${order.companyName ? `IČO: ${esc(order.buyerIco ?? '—')}${order.buyerDic ? `<br/>DIČ: ${esc(order.buyerDic)}` : ''}<br/>` : ''}
          ${esc(order.customerName)}<br/>
          ${address ? `${esc(address)}<br/>` : ''}
          ${esc(order.customerEmail)}<br/>${esc(order.customerPhone)}
        </p>
      </div>
      <div>
        <h2>Dodání</h2>
        <p>
          ${
            order.shipping === 'osobni-odber'
              ? 'Osobní odběr po domluvě'
              : order.shipping === 'zasilkovna'
                ? `Zásilkovna — výdejní místo<br/>${esc(order.pickupPoint ?? '—')}`
                : `Zásilkovna — na adresu<br/>${esc(address || '—')}`
          }
          ${order.trackingNumber ? `<br/>Sledovací číslo: ${esc(order.trackingNumber)}` : ''}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Položka</th><th class="num">Ks</th><th class="num">Cena/ks</th><th class="num">Celkem</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>Zboží</span><span>${czk(order.subtotalCzk)}</span></div>
      <div><span>Doprava</span><span>${order.shippingCzk === 0 ? 'zdarma' : czk(order.shippingCzk)}</span></div>
      ${order.codCzk > 0 ? `<div><span>Dobírka</span><span>${czk(order.codCzk)}</span></div>` : ''}
      <div class="grand"><span>Celkem</span><span>${czk(order.totalCzk)}</span></div>
    </div>

    <div class="pay">
      <strong>Platební údaje</strong><br/>
      Účet: ${esc(SELLER.bankAccount)} · IBAN: ${esc(SELLER.iban)} · BIC: ${esc(SELLER.bic)}<br/>
      Variabilní symbol: <strong>${esc(order.variableSymbol ?? '—')}</strong> · Částka: <strong>${czk(order.totalCzk)}</strong>
    </div>

    <p class="foot">
      Nejsme plátci DPH. Ceny jsou konečné. Tento doklad slouží jako zálohová faktura do okamžiku úhrady;
      po připsání platby je faktura uhrazena. Děkujeme, že podporujete malou dílnu.
    </p>
  </div>
</body>
</html>`;
}
