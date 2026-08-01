import { prisma } from './db';

const COMPANY = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
  address: 'Horní Čermná 94',
  city: '561 56',
  country: 'Česká republika',
  bankAccount: 'CZ68 0600 0000 0002 5925 1079',
  bank: 'MONETA Money Bank, a.s.',
  bic: 'AGBACZPP',
  email: 'shop@newearth.cz',
  web: 'https://market.zionterranova.com',
};

const VAT_RATE = 0.21;

function formatMoneyCzk(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

function invoiceNumberForYear(year: number, sequence: number): string {
  return `FV-${year}-${String(sequence).padStart(4, '0')}`;
}

export async function generateInvoiceNumber(issueDate: Date = new Date()): Promise<string> {
  const year = issueDate.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.invoice.count({
    where: { issuedAt: { gte: start, lt: end } },
  });
  return invoiceNumberForYear(year, count + 1);
}

interface CartItemLike {
  name: string;
  quantity: number;
  priceCzk: number;
}

export function buildInvoiceHtml(opts: {
  invoiceNumber: string;
  orderId: string;
  issueDate: Date;
  dueDate: Date;
  customerName: string;
  customerAddress?: { street?: string; city?: string; zip?: string } | null;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  totalCzk: number;
  shippingCzk: number;
  items: CartItemLike[];
  bankAccount: string;
  variableSymbol?: string;
  qrCodeData?: string;
}): string {
  const items = opts.items ?? [];
  const shipping: CartItemLike = {
    name: 'Doprava',
    quantity: 1,
    priceCzk: opts.shippingCzk,
  };
  const allItems = [...items, ...(opts.shippingCzk > 0 ? [shipping] : [])];

  const rows = allItems
    .map((it) => {
      const total = it.priceCzk * it.quantity;
      const withoutVat = total / (1 + VAT_RATE);
      const vat = total - withoutVat;
      return `
        <tr>
          <td>${escapeHtml(it.name)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${formatMoneyCzk(withoutVat / it.quantity)}</td>
          <td class="num">${formatMoneyCzk(vat)}</td>
          <td class="num">${formatMoneyCzk(total)}</td>
        </tr>
      `;
    })
    .join('');

  const total = allItems.reduce((sum, it) => sum + it.priceCzk * it.quantity, 0);
  const withoutVat = total / (1 + VAT_RATE);
  const vat = total - withoutVat;

  const paymentInfo =
    opts.paymentMethod === 'card' || opts.paymentMethod === 'stripe'
      ? 'Platba kartou (Stripe)'
      : 'Bankovní převod';

  const customerAddress = opts.customerAddress;
  const addressText = customerAddress
    ? [customerAddress.street, customerAddress.city, customerAddress.zip]
        .filter(Boolean)
        .join(', ')
    : '';

  const qrImg = opts.qrCodeData
    ? `<img src="${opts.qrCodeData}" alt="QR platba" style="width:140px;height:140px;border-radius:0.5rem;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8" />
<title>Faktura ${opts.invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; background: #0b0c10; color: #e5e7eb; padding: 2rem; }
  .page { max-width: 800px; margin: 0 auto; background: #151725; border: 2px solid #facc15; border-radius: 1rem; padding: 2rem; }
  .rasta-bar { height: 6px; background: linear-gradient(90deg, #22c55e, #facc15, #ef4444); border-radius: 99px; margin-bottom: 1.5rem; }
  h1 { margin: 0; font-size: 1.75rem; color: #facc15; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1.5rem; }
  .box { background: rgba(255,255,255,0.04); border-radius: 0.75rem; padding: 1rem; }
  .box h3 { margin: 0 0 0.5rem; font-size: 0.85rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
  th { color: #facc15; font-weight: 600; }
  .num { text-align: right; }
  .totals { margin-top: 1rem; text-align: right; }
  .totals .row { display: flex; justify-content: flex-end; gap: 1rem; margin: 0.25rem 0; }
  .totals .total { font-size: 1.25rem; font-weight: 700; color: #facc15; }
  .meta { margin-top: 1.5rem; display: flex; gap: 2rem; flex-wrap: wrap; }
  .qr { margin-top: 1rem; }
  small { color: #94a3b8; }
</style>
</head>
<body>
  <div class="page">
    <div class="rasta-bar"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h1>Faktura ${opts.invoiceNumber}</h1>
        <p style="margin:0.25rem 0 0;color:#94a3b8;">Objednávka: <strong>${escapeHtml(opts.orderId)}</strong></p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;"><small>Datum vystavení:</small><br><strong>${formatDate(opts.issueDate)}</strong></p>
        <p style="margin:0.5rem 0 0;"><small>Datum splatnosti:</small><br><strong>${formatDate(opts.dueDate)}</strong></p>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Dodavatel</h3>
        <p style="margin:0;font-weight:700;">${escapeHtml(COMPANY.name)}</p>
        <p style="margin:0.25rem 0 0;">IČO: ${COMPANY.ico} | DIČ: ${COMPANY.dic}</p>
        <p style="margin:0.25rem 0 0;">${escapeHtml(COMPANY.address)}, ${escapeHtml(COMPANY.city)}</p>
        <p style="margin:0.25rem 0 0;">${escapeHtml(COMPANY.country)}</p>
        <p style="margin:0.25rem 0 0;">E-mail: ${escapeHtml(COMPANY.email)}</p>
      </div>
      <div class="box">
        <h3>Odběratel</h3>
        <p style="margin:0;font-weight:700;">${escapeHtml(opts.customerName)}</p>
        <p style="margin:0.25rem 0 0;">${escapeHtml(addressText)}</p>
        <p style="margin:0.25rem 0 0;">E-mail: ${escapeHtml(opts.customerEmail)}</p>
        <p style="margin:0.25rem 0 0;">Tel.: ${escapeHtml(opts.customerPhone)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Položka</th>
          <th class="num">Množství</th>
          <th class="num">Cena bez DPH</th>
          <th class="num">DPH 21%</th>
          <th class="num">Cena s DPH</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Mezisoučet bez DPH:</span><strong>${formatMoneyCzk(withoutVat)}</strong></div>
      <div class="row"><span>DPH 21%:</span><strong>${formatMoneyCzk(vat)}</strong></div>
      <div class="row total"><span>Celkem k úhradě:</span><strong>${formatMoneyCzk(total)}</strong></div>
    </div>

    <div class="meta">
      <div class="box" style="flex:1;min-width:260px;">
        <h3>Platební údaje</h3>
        <p style="margin:0;"><strong>${paymentInfo}</strong></p>
        <p style="margin:0.25rem 0 0;">Účet: ${escapeHtml(opts.bankAccount)}</p>
        <p style="margin:0.25rem 0 0;">Variabilní symbol: <strong>${escapeHtml(opts.variableSymbol ?? opts.orderId)}</strong></p>
        <p style="margin:0.25rem 0 0;">BIC/SWIFT: ${COMPANY.bic}</p>
      </div>
      <div class="qr" style="text-align:center;">
        ${qrImg}
      </div>
    </div>

    <p style="margin-top:2rem;text-align:center;color:#64748b;font-size:0.8rem;">
      Faktura byla vytvořena elektronicky a je platná bez podpisu. ZION eShop powered by ${escapeHtml(COMPANY.name)}
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('cs-CZ');
}
