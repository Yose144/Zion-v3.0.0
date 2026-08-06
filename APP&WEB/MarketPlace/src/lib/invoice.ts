import { prisma } from './db';
import { getActiveTheme, type ShopTheme } from './settings';

const COMPANY = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
  address: 'Horní Čermná',
  city: '56156',
  court: 'Krajský soud v Hradci Králové',
  country: 'Česká republika',
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
  theme: ShopTheme = 'rasta'
): string {
  const t = THEME_STYLES[theme];
  const items = buildItems(opts.items ?? [], opts.shippingCzk);
  const totals = calculateTotals(items);

  const customerAddress = opts.customerAddress;
  const addressText = customerAddress
    ? [customerAddress.street, customerAddress.city, customerAddress.zip].filter(Boolean).join(', ')
    : '';

  const paymentText = paymentMethodText(opts.paymentMethod);

  const itemsHtml = items
    .map((item, index) => {
      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.text};">${index + 1}</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.text};">${escapeHtml(item.name)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.muted};text-align:center;">${item.quantity} ${item.unit}</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.text};text-align:right;">${formatPrice(item.unitPriceWithoutVat)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.text};text-align:center;">${item.vatRate}%</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.text};text-align:right;">${formatPrice(item.vatAmount)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid ${t.border};color:${t.accent};text-align:right;font-weight:700;">${formatPrice(item.totalPrice)}</td>
        </tr>
      `;
    })
    .join('');

  const qrImg = opts.qrCodeData
    ? `<img src="${opts.qrCodeData}" alt="QR platba" style="max-width:180px;border-radius:8px;background:#fff;padding:6px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Faktura ${opts.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; line-height: 1.6; color: ${t.text}; background: ${t.bg}; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; background: ${t.card}; border-radius: 16px; box-shadow: 0 28px 72px rgba(0,0,0,0.6); border: 1px solid ${t.border}; }
    .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding: 30px; border-radius: 12px; background: ${t.headerGradient}; color: #000; }
    .company-logo { font-size: 30px; font-weight: 900; color: #000; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .company-logo span { color: #fff; font-weight: 700; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 36px; color: #000; margin-bottom: 5px; font-weight: 900; }
    .invoice-number { font-size: 16px; color: #000; font-weight: 600; }
    .parties { display: flex; gap: 24px; margin-bottom: 30px; }
    .party { flex: 1; padding: 24px; background: ${t.surface}; border-radius: 12px; border: 1px solid ${t.border}; }
    .party h3 { color: ${t.accent}; font-size: 14px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid ${t.accent}; text-transform: uppercase; letter-spacing: 1px; }
    .party p { margin: 6px 0; color: ${t.text}; }
    .party strong { color: ${t.accent3}; }
    .invoice-info { display: flex; gap: 16px; margin-bottom: 30px; background: ${t.infoBg}; padding: 24px; border-radius: 12px; color: #fff; border: 1px solid ${t.border}; }
    .info-item { flex: 1; text-align: center; }
    .info-item label { display: block; font-size: 10px; text-transform: uppercase; opacity: 0.85; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-item span { font-size: 16px; font-weight: 700; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: ${t.tableHeader}; color: #fff; padding: 14px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .items-table th:first-child { border-radius: 8px 0 0 0; }
    .items-table th:last-child { border-radius: 0 8px 0 0; }
    .items-table tr:last-child td { border-bottom: none; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-box { width: 320px; background: ${t.surface}; border-radius: 12px; overflow: hidden; border: 1px solid ${t.border}; }
    .totals-row { display: flex; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid ${t.border}; color: ${t.text}; }
    .totals-row:last-child { border-bottom: none; background: ${t.totalsBg}; color: #000; font-size: 18px; font-weight: 800; }
    .payment-info { background: ${t.paymentBg}; border: 1px solid ${t.paymentBorder}; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .payment-info h3 { color: ${t.paymentText}; margin-bottom: 15px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; color: ${t.text}; }
    .payment-grid p { margin: 5px 0; }
    .payment-grid strong { color: ${t.muted}; }
    .qr-section { text-align: center; padding: 24px; background: ${t.qrBg}; border-radius: 12px; margin-bottom: 24px; border: 1px solid ${t.border}; }
    .invoice-footer { text-align: center; padding-top: 24px; border-top: 1px solid ${t.border}; color: ${t.footer}; font-size: 12px; }
    .invoice-footer a { color: ${t.footerLink}; text-decoration: none; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
      .invoice { box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="invoice-header">
      <div class="company-logo">ZION<span> TerraNova</span></div>
      <div class="invoice-title">
        <h1>FAKTURA</h1>
        <div class="invoice-number">${escapeHtml(opts.invoiceNumber)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Dodavatel</h3>
        <p><strong>${escapeHtml(COMPANY.name)}</strong></p>
        <p>${escapeHtml(COMPANY.address)}</p>
        <p>${escapeHtml(COMPANY.country)}</p>
        <p>IČO: ${escapeHtml(COMPANY.ico)}</p>
        <p>DIČ: ${escapeHtml(COMPANY.dic)}</p>
        <p>Zapsáno: ${escapeHtml(COMPANY.court)}</p>
      </div>
      <div class="party">
        <h3>Odběratel</h3>
        <p><strong>${escapeHtml(opts.customerName)}</strong></p>
        <p>${escapeHtml(addressText)}</p>
        <p>Email: ${escapeHtml(opts.customerEmail)}</p>
        <p>Tel: ${escapeHtml(opts.customerPhone)}</p>
      </div>
    </div>

    <div class="invoice-info">
      <div class="info-item"><label>Datum vystavení</label><span>${formatDate(opts.issueDate)}</span></div>
      <div class="info-item"><label>Datum splatnosti</label><span>${formatDate(opts.dueDate)}</span></div>
      <div class="info-item"><label>Způsob platby</label><span>${escapeHtml(paymentText)}</span></div>
      <div class="info-item"><label>Variabilní symbol</label><span>${escapeHtml(opts.orderId)}</span></div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Položka</th>
          <th style="width:80px;text-align:center;">Množství</th>
          <th style="width:100px;text-align:right;">Cena/ks</th>
          <th style="width:60px;text-align:center;">DPH</th>
          <th style="width:80px;text-align:right;">DPH Kč</th>
          <th style="width:100px;text-align:right;">Celkem</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row"><span>Základ DPH:</span><span>${formatPrice(totals.withoutVat)} Kč</span></div>
        <div class="totals-row"><span>DPH 21%:</span><span>${formatPrice(totals.vat)} Kč</span></div>
        <div class="totals-row"><span>Celkem k úhradě:</span><span>${formatPrice(totals.withVat)} Kč</span></div>
      </div>
    </div>

    <div class="payment-info">
      <h3>Platební údaje</h3>
      <div class="payment-grid">
        <p><strong>Číslo účtu:</strong> ${escapeHtml(COMPANY.bankAccount)}</p>
        <p><strong>IBAN:</strong> ${escapeHtml(COMPANY.iban)}</p>
        <p><strong>SWIFT:</strong> ${escapeHtml(COMPANY.swift)}</p>
        <p><strong>Banka:</strong> ${escapeHtml(COMPANY.bankName)}</p>
        <p><strong>Variabilní symbol:</strong> ${escapeHtml(opts.orderId)}</p>
        <p><strong>Částka:</strong> ${formatPrice(totals.withVat)} Kč</p>
      </div>
    </div>

    <div class="qr-section">${qrImg}</div>

    <div class="invoice-footer">
      <p style="margin-bottom:8px;">Děkujeme za Vaši objednávku!</p>
      <p>${escapeHtml(COMPANY.name)} | ${escapeHtml(COMPANY.email)} | <a href="https://${escapeHtml(COMPANY.web)}">${escapeHtml(COMPANY.web)}</a></p>
      <p style="margin-top:12px;">Faktura byla vystavena elektronicky a je platná bez podpisu.</p>
    </div>
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
