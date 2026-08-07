import { prisma } from './db';
import { getActiveTheme, type ShopTheme } from './settings';

export const COMPANY = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
  address: 'Horní Čermná 229',
  city: '56156',
  country: 'Česká republika',
  court: 'Krajský soud v Hradci Králové',
  fileNo: '00215716',
  bankAccount: '2901809148 / 2010',
  iban: 'CZ63 2010 0000 0029 0180 9148',
  swift: 'FIOBCZPPXXX',
  bankName: 'Fio banka, a.s.',
  email: 'admin@newearth.cz',
  web: 'www.newearth.cz',
};

const VAT_RATE = 0.21;

function formatPrice(amount: number, decimals = 2): string {
  return amount.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('cs-CZ');
}

export async function generateInvoiceNumber(issueDate: Date = new Date()): Promise<string> {
  const year = issueDate.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.invoice.count({
    where: { issuedAt: { gte: start, lt: end } },
  });
  return `FV${year}-${String(count + 1).padStart(6, '0')}`;
}

interface CartItemLike {
  name: string;
  quantity: number;
  priceCzk: number;
}

interface InvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  unitPriceWithoutVat: number;
  vatRate: number;
  vatAmount: number;
  totalPrice: number;
  priceWithoutVat: number;
}

function buildItems(items: CartItemLike[], shippingCzk: number): InvoiceItem[] {
  const result: InvoiceItem[] = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.round(item.quantity || 1));
    const unitPrice = Number(item.priceCzk || 0);
    const totalPrice = quantity * unitPrice;
    const priceWithoutVat = totalPrice / 1.21;
    const vatAmount = totalPrice - priceWithoutVat;

    result.push({
      name: item.name || 'Produkt',
      quantity,
      unit: 'ks',
      unitPrice,
      unitPriceWithoutVat: unitPrice / 1.21,
      vatRate: 21,
      vatAmount,
      totalPrice,
      priceWithoutVat,
    });
  }

  if (shippingCzk > 0) {
    const priceWithoutVat = shippingCzk / 1.21;
    const vatAmount = shippingCzk - priceWithoutVat;
    result.push({
      name: 'Doprava',
      quantity: 1,
      unit: 'ks',
      unitPrice: shippingCzk,
      unitPriceWithoutVat: shippingCzk / 1.21,
      vatRate: 21,
      vatAmount,
      totalPrice: shippingCzk,
      priceWithoutVat,
    });
  }

  return result;
}

function calculateTotals(items: InvoiceItem[]) {
  let withVat = 0;
  let withoutVat = 0;
  let vat = 0;

  for (const item of items) {
    withVat += item.totalPrice;
    withoutVat += item.priceWithoutVat;
    vat += item.vatAmount;
  }

  return {
    withVat: Math.round(withVat * 100) / 100,
    withoutVat: Math.round(withoutVat * 100) / 100,
    vat: Math.round(vat * 100) / 100,
  };
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

function paymentMethodText(method: string): string {
  if (method === 'card' || method === 'stripe') return 'Platba kartou';
  if (method === 'transfer') return 'Bankovní převod';
  if (method === 'cash') return 'Hotově / Dobírka';
  return 'Neuvedeno';
}

const THEME_STYLES: Record<ShopTheme, Record<string, string>> = {
  rasta: {
    bg: '#0a0a0a',
    card: '#0f0f0f',
    text: '#e5e7eb',
    muted: '#9af59a',
    accent: '#fcd116',
    accent2: '#e41e2b',
    accent3: '#078930',
    headerGradient: 'linear-gradient(135deg, #078930 0%, #fcd116 50%, #e41e2b 100%)',
    infoBg: 'linear-gradient(135deg, #0d0d0d, #0d0d0d)',
    tableHeader: '#0d0d0d',
    totalsBg: 'linear-gradient(135deg, #fcd116, #e41e2b)',
    paymentBg: 'rgba(252,209,22,0.08)',
    paymentBorder: 'rgba(252,209,22,0.3)',
    paymentText: '#fcd116',
    qrBg: 'rgba(0,0,0,0.3)',
    border: 'rgba(255,255,255,0.08)',
    footer: '#888',
    footerLink: '#fcd116',
    surface: 'rgba(255,255,255,0.04)',
  },
  zion: {
    bg: '#0b0c10',
    card: '#151725',
    text: '#e5e7eb',
    muted: '#94a3b8',
    accent: '#fcd116',
    accent2: '#078930',
    accent3: '#e41e2b',
    headerGradient: 'linear-gradient(135deg, #078930 0%, #e41e2b 50%, #fcd116 100%)',
    infoBg: 'linear-gradient(135deg, #0f172a, #0f172a)',
    tableHeader: '#0f172a',
    totalsBg: 'linear-gradient(135deg, #fcd116, #e41e2b)',
    paymentBg: 'rgba(252,209,22,0.08)',
    paymentBorder: 'rgba(252,209,22,0.3)',
    paymentText: '#fcd116',
    qrBg: 'rgba(0,0,0,0.3)',
    border: 'rgba(255,255,255,0.08)',
    footer: '#64748b',
    footerLink: '#078930',
    surface: 'rgba(255,255,255,0.04)',
  },
};

export function buildInvoiceHtml(
  opts: {
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
    qrCodeData?: string;
  },
  _theme: ShopTheme = 'rasta'
): string {
  const items = buildItems(opts.items ?? [], opts.shippingCzk);
  const totals = calculateTotals(items);

  const customerAddress = opts.customerAddress;
  const addressText = customerAddress
    ? [customerAddress.street, customerAddress.city, customerAddress.zip].filter(Boolean).join(', ')
    : '';

  const paymentText = paymentMethodText(opts.paymentMethod);
  const vs = opts.orderId.replace(/\D/g, '').slice(0, 10);

  const itemsHtml = items
    .map((item, index) => {
      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#e5e7eb;">${index + 1}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#9af59a;text-align:center;">${item.quantity}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#e5e7eb;text-align:right;">${formatPrice(item.unitPriceWithoutVat)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#e5e7eb;text-align:center;">${item.vatRate}%</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#e5e7eb;text-align:right;">${formatPrice(item.vatAmount)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #333;color:#FFD700;text-align:right;font-weight:700;">${formatPrice(item.totalPrice)}</td>
        </tr>
      `;
    })
    .join('');

  const qrImg = opts.qrCodeData
    ? `<img src="${opts.qrCodeData}" alt="QR platba" style="height:56px;border-radius:8px;background:#fff;padding:3px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Faktura ${escapeHtml(opts.invoiceNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: #e0e0e0; min-height: 100vh; padding: 10px; }
    .invoice-container { max-width: 900px; margin: 0 auto; background: #1f1f1f; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .rasta-header { background: linear-gradient(90deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); height: 5px; }
    .header { padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
    .logo img { height: 48px; border-radius: 50%; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 1.7rem; color: #FFD700; margin: 0; }
    .invoice-number { font-size: 0.9rem; color: #aaa; margin-top: 2px; }
    .parties { display: flex; justify-content: space-between; padding: 8px 20px; border-bottom: 1px solid #333; }
    .party { width: 48%; }
    .party h3 { color: #1c7b1c; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 1px; }
    .party p { line-height: 1.35; color: #ccc; font-size: 0.85rem; }
    .party strong { color: #fff; font-size: 0.95rem; }
    .dates { display: flex; justify-content: space-around; padding: 8px 16px; background: #252525; }
    .date-item { text-align: center; }
    .date-item label { display: block; font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 2px; }
    .date-item span { font-size: 0.95rem; color: #FFD700; }
    .items { padding: 8px 16px; }
    .items table { width: 100%; border-collapse: collapse; }
    .items th { background: #1c7b1c; color: #fff; padding: 5px 6px; text-align: left; font-size: 0.7rem; text-transform: uppercase; }
    .items th:nth-child(3), .items th:nth-child(5) { text-align: center; }
    .items th:nth-child(4), .items th:nth-child(6), .items th:nth-child(7) { text-align: right; }
    .items td { padding: 4px 5px; border-bottom: 1px solid #333; }
    .totals { padding: 6px 16px 10px; display: flex; justify-content: flex-end; }
    .totals-table { width: 240px; }
    .totals-table tr td { padding: 3px 0; border-bottom: 1px solid #333; font-size: 0.85rem; }
    .totals-table tr td:last-child { text-align: right; color: #FFD700; }
    .totals-table tr.total { font-size: 1.05rem; font-weight: bold; }
    .totals-table tr.total td { border-top: 2px solid #1c7b1c; border-bottom: none; padding-top: 6px; }
    .payment { padding: 8px 16px; background: #252525; }
    .payment h3 { color: #1c7b1c; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 6px; }
    .payment-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .payment-item label { display: block; font-size: 0.7rem; color: #888; margin-bottom: 1px; }
    .payment-item span { color: #fff; font-size: 0.85rem; }
    .payment-item.highlight span { color: #FFD700; font-weight: bold; }
    .qr-wrap { padding: 6px 16px; background: #1f1f1f; text-align: center; border-top: 1px solid #333; }
    .qr-wrap p { color: #FFD700; font-size: 11px; margin-bottom: 4px; }
    .footer { padding: 6px 16px; text-align: center; border-top: 1px solid #333; color: #888; font-size: 0.7rem; }
    .rasta-footer { background: linear-gradient(90deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%); height: 3px; }
    @media print { body { padding: 0; background: #fff; } .invoice-container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="rasta-header"></div>

    <div class="header">
      <div class="logo">
        <img src="https://market.zionterranova.com/logo/org/zion-wordmark-dark.png" alt="ZION Logo" onerror="this.style.display='none'" />
      </div>
      <div class="invoice-title">
        <h1>FAKTURA</h1>
        <div class="invoice-number">${escapeHtml(opts.invoiceNumber)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Dodavatel</h3>
        <p>
          <strong>${escapeHtml(COMPANY.name)}</strong><br>
          ${escapeHtml(COMPANY.address)}<br>
          ${escapeHtml(COMPANY.city)}<br>
          ${escapeHtml(COMPANY.country)}<br><br>
          IČO: ${escapeHtml(COMPANY.ico)}<br>
          DIČ: ${escapeHtml(COMPANY.dic)}<br>
          Zapsáno: ${escapeHtml(COMPANY.court)}
        </p>
      </div>
      <div class="party">
        <h3>Odběratel</h3>
        <p>
          <strong>${escapeHtml(opts.customerName)}</strong><br>
          ${escapeHtml(addressText)}<br>
          Email: ${escapeHtml(opts.customerEmail)}<br>
          Tel: ${escapeHtml(opts.customerPhone)}
        </p>
      </div>
    </div>

    <div class="dates">
      <div class="date-item">
        <label>Datum vystavení</label>
        <span>${formatDate(opts.issueDate)}</span>
      </div>
      <div class="date-item">
        <label>Datum splatnosti</label>
        <span>${formatDate(opts.dueDate)}</span>
      </div>
      <div class="date-item">
        <label>Způsob platby</label>
        <span>${escapeHtml(paymentText)}</span>
      </div>
      <div class="date-item">
        <label>Variabilní symbol</label>
        <span>${escapeHtml(vs || opts.orderId)}</span>
      </div>
    </div>

    <div class="items">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Položka</th>
            <th>Množství</th>
            <th>Cena/ks</th>
            <th>DPH</th>
            <th>DPH Kč</th>
            <th>Celkem</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Základ DPH</td>
          <td>${formatPrice(totals.withoutVat)} Kč</td>
        </tr>
        <tr>
          <td>DPH 21%</td>
          <td>${formatPrice(totals.vat)} Kč</td>
        </tr>
        <tr class="total">
          <td>Celkem k úhradě</td>
          <td>${formatPrice(totals.withVat)} Kč</td>
        </tr>
      </table>
    </div>

    <div class="payment">
      <h3>Platební údaje</h3>
      <div class="payment-grid">
        <div class="payment-item">
          <label>Způsob platby</label>
          <span>${escapeHtml(paymentText)}</span>
        </div>
        <div class="payment-item">
          <label>Číslo účtu</label>
          <span>${escapeHtml(COMPANY.bankAccount)}</span>
        </div>
        <div class="payment-item highlight">
          <label>Variabilní symbol</label>
          <span>${escapeHtml(vs || opts.orderId)}</span>
        </div>
        <div class="payment-item">
          <label>IBAN</label>
          <span>${escapeHtml(COMPANY.iban)}</span>
        </div>
        <div class="payment-item">
          <label>SWIFT</label>
          <span>${escapeHtml(COMPANY.swift)}</span>
        </div>
        <div class="payment-item highlight">
          <label>Částka k úhradě</label>
          <span>${formatPrice(totals.withVat)} Kč</span>
        </div>
      </div>
    </div>

    <div class="qr-wrap">
      ${qrImg ? `<p>📱 QR kód pro platbu</p>${qrImg}` : ''}
    </div>

    <div class="footer">
      <p>Děkujeme za Váš nákup! • ${escapeHtml(COMPANY.web)} • ${escapeHtml(COMPANY.email)}</p>
      <p style="margin-top: 10px; color: #FFD700;">🦁 One Love, One Heart, One ZION 🦁</p>
      <p style="margin-top: 10px; color: #666;">Faktura byla vystavena elektronicky a je platná bez podpisu.</p>
    </div>

    <div class="rasta-footer"></div>
  </div>
</body>
</html>`;
}

interface CreateInvoiceInput {
  orderId: string;
  orderDatabaseId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: { street?: string; city?: string; zip?: string } | null;
  payment: string;
  totalCzk: number;
  shippingCzk: number;
  items: unknown;
  stripeSession?: string | null;
  dueDays?: number;
}

export async function createInvoiceForOrder(input: CreateInvoiceInput) {
  const dueDays = Math.max(1, input.dueDays ?? 14);
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + dueDays);

  const invoiceNumber = await generateInvoiceNumber(issueDate);
  const vs = input.orderId.replace(/\D/g, '').slice(0, 10);
  const ibanClean = COMPANY.iban.replace(/\s/g, '');
  const qrData = `SPD*1.0*ACC:${ibanClean}*AM:${input.totalCzk}.00*CC:CZK*MSG:Objednavka ${input.orderId}*X-VS:${vs}`;
  const qrSvg = await import('qrcode').then((QRCode) =>
    QRCode.toString(qrData, { type: 'svg', margin: 2, width: 280 })
  );
  const qrCodeData = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const typedItems = rawItems.map((it) => ({
    name: String((it as Record<string, unknown>).name ?? 'Produkt'),
    quantity: Math.max(1, Math.round((it as Record<string, unknown>).quantity as number) || 1),
    priceCzk: Math.round((it as Record<string, unknown>).priceCzk as number) || 0,
  }));

  const theme = await getActiveTheme();

  const html = buildInvoiceHtml(
    {
      invoiceNumber,
      orderId: input.orderId,
      issueDate,
      dueDate,
      customerName: input.customerName,
      customerAddress: input.customerAddress,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      paymentMethod: input.payment,
      totalCzk: input.totalCzk,
      shippingCzk: input.shippingCzk,
      items: typedItems,
      qrCodeData,
    },
    theme
  );

  // Deactivate any previous draft invoices for this order
  await prisma.invoice.updateMany({
    where: { orderId: input.orderDatabaseId, status: 'draft' },
    data: { status: 'cancelled' },
  });

  const itemsForVat = buildItems(typedItems, input.shippingCzk);
  const totals = calculateTotals(itemsForVat);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: input.orderDatabaseId,
      status: 'issued',
      totalCzk: input.totalCzk,
      vatCzk: Math.round(totals.vat),
      dueDate,
      issuedAt: issueDate,
      html,
      stripeSession: input.stripeSession ?? null,
    },
  });

  return { invoice, html, invoiceNumber };
}
