import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.forpsi.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10);
const SMTP_USER = process.env.SMTP_USER ?? 'shop@newearth.cz';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@newearth.cz';
const SHOP_EMAIL = process.env.SHOP_EMAIL ?? 'shop@newearth.cz';
const SHOP_NAME = process.env.SHOP_NAME ?? 'ZION eShop';

function isEnabled(): boolean {
  return Boolean(SMTP_USER && SMTP_PASSWORD);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return items
    .map((it) => {
      const raw = it as Record<string, unknown>;
      const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
      const price = Math.round((raw.priceCzk as number) || 0);
      return `- ${raw.name ?? 'Produkt'} (x${qty}) - ${formatPrice(price * qty)}`;
    })
    .join('\n');
}

function formatAddress(order: {
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
}): string {
  const parts = [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean);
  return parts.join(', ');
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipping: string;
  payment: string;
  totalCzk: number;
  shippingCzk: number;
  items: unknown;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  pickupPoint: unknown;
  note: string | null;
  zionTokens: number;
  trackingNumber: string | null;
  status: string;
  paymentStatus: string;
}

export async function sendAdminOrderNotification(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const shippingInfo = order.shipping === 'zasilkovna-home'
    ? `Doručovací adresa: ${formatAddress(order)}`
    : order.shipping === 'zasilkovna'
    ? 'Zásilkovna - výdejní místo (bude upřesněno)'
    : 'Digitální doručení / online převzetí';

  const subject = `🛒 Nová objednávka #${order.orderId} - ${SHOP_NAME}`;
  const body = `=======================================
NOVÁ OBJEDNÁVKA - ${SHOP_NAME}
=======================================

Číslo objednávky: ${order.orderId}
Status: ${order.status}
Stav platby: ${order.paymentStatus}

----------------------------------------
ZÁKAZNÍK
----------------------------------------
Jméno: ${order.customerName}
Email: ${order.customerEmail}
Telefon: ${order.customerPhone}

----------------------------------------
POLOŽKY
----------------------------------------
${formatItems(order.items)}

----------------------------------------
DOPRAVA
----------------------------------------
${shippingInfo}
Doprava: ${order.shipping}

----------------------------------------
PLATBA
----------------------------------------
Způsob: ${order.payment === 'card' ? 'Platební karta (Stripe)' : order.payment === 'transfer' ? 'Bankovní převod' : order.payment}
Variabilní symbol: ${order.orderId.replace(/\D/g, '').slice(0, 10)}

----------------------------------------
CELKEM: ${formatPrice(order.totalCzk)}
----------------------------------------

Poznámka: ${order.note || '—'}
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${SHOP_NAME} <${SHOP_EMAIL}>`,
      to: ADMIN_EMAIL,
      replyTo: order.customerEmail,
      subject,
      text: body,
    });
    console.log(`Admin order notification sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send admin order notification:', error);
  }
}

export async function sendCustomerOrderConfirmation(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const paymentInfo =
    order.payment === 'card'
      ? 'Platba kartou (Stripe)'
      : order.payment === 'transfer'
      ? 'Bankovní převod'
      : order.payment;

  const bankInfo = order.payment === 'transfer'
    ? `
Platební údaje:
Příjemce: Omnity.One s.r.o.
Banka: Fio banka, a.s.
Číslo účtu: 2901809148 / 2010
IBAN: CZ63 2010 0000 0029 0180 9148
SWIFT: FIOBCZPPXXX
Variabilní symbol: ${order.orderId.replace(/\D/g, '').slice(0, 10)}
Částka: ${formatPrice(order.totalCzk)}

Po připsání platby Vám zboží obratem odešleme.
`
    : '';

  const shippingInfo = order.shipping === 'zasilkovna-home'
    ? `Doručovací adresa: ${formatAddress(order)}`
    : order.shipping === 'zasilkovna'
    ? 'Zásilkovna - výdejní místo (bude upřesněno)'
    : 'Digitální doručení / online převzetí';

  const subject = `Potvrzení objednávky #${order.orderId} - ${SHOP_NAME}`;
  const body = `Dobrý den, ${order.customerName}!

Děkujeme za Vaši objednávku v ${SHOP_NAME}.

=======================================
OBJEDNÁVKA #${order.orderId}
=======================================

${formatItems(order.items)}

Doprava: ${order.shipping} - ${order.shippingCzk === 0 ? 'Zdarma' : formatPrice(order.shippingCzk)}
----------------------------------------
CELKEM: ${formatPrice(order.totalCzk)}

----------------------------------------
PLATBA
----------------------------------------
Způsob platby: ${paymentInfo}
${bankInfo}

----------------------------------------
DOPRAVA
----------------------------------------
${shippingInfo}

O průběhu objednávky Vás budeme informovat emailem.

S pozdravem,
Tým ZION Terra Nova

www.newearth.cz
----------------------------------------
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${SHOP_NAME} <${SHOP_EMAIL}>`,
      to: order.customerEmail,
      replyTo: SHOP_EMAIL,
      subject,
      text: body,
    });
    console.log(`Customer order confirmation sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send customer order confirmation:', error);
  }
}

export async function sendPaymentConfirmation(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const subject = `Platba přijata - objednávka #${order.orderId} - ${SHOP_NAME}`;
  const body = `Dobrý den, ${order.customerName},

Vaše platba za objednávku #${order.orderId} byla úspěšně přijata.

Celková částka: ${formatPrice(order.totalCzk)}

Vaše zboží bude co nejdříve odesláno.

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${SHOP_NAME} <${SHOP_EMAIL}>`,
      to: order.customerEmail,
      replyTo: SHOP_EMAIL,
      subject,
      text: body,
    });
    console.log(`Payment confirmation sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send payment confirmation:', error);
  }
}

export async function sendShippingNotification(order: OrderEmailData): Promise<void> {
  if (!isEnabled()) {
    console.log('Email notifications disabled: SMTP not configured');
    return;
  }

  const trackingInfo = order.trackingNumber
    ? `Sledovací číslo: ${order.trackingNumber}`
    : 'Sledovací číslo bude doplněno.';

  const subject = `Zásilka odeslána - objednávka #${order.orderId} - ${SHOP_NAME}`;
  const body = `Dobrý den, ${order.customerName},

Vaše objednávka #${order.orderId} byla odeslana.

${trackingInfo}

S pozdravem,
Tým ZION Terra Nova
`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `${SHOP_NAME} <${SHOP_EMAIL}>`,
      to: order.customerEmail,
      replyTo: SHOP_EMAIL,
      subject,
      text: body,
    });
    console.log(`Shipping notification sent for ${order.orderId}`);
  } catch (error) {
    console.error('Failed to send shipping notification:', error);
  }
}
