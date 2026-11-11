import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { PRODUCTS, productById } from '@/data/catalog';
import { getSaleRows, ensureSeeded } from '@/lib/catalog-server';
import { checkFireConsent, FIRE_CONSENT_VERSION } from '@/lib/fire-safety';
import { nextInvoiceNumber, variableSymbolFor } from '@/lib/settings';
import { bankPaymentData } from '@/lib/qr';
import { orderToLike, publicOrder } from '@/lib/order';
import { sendAdminOrderNotification, sendOrderConfirmation } from '@/lib/email';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import {
  COD_FEE_CZK,
  SHIPPING_OPTIONS,
  shippingPriceFor,
  type PaymentMethod,
  type ShippingMethod,
} from '@/types/shop';
import type { StoredOrderItem } from '@/lib/order-types';
import type { Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_ID_RE = /^LUMI-[A-Z0-9-]{6,40}$/;

class StockConflict extends Error {}
class InvalidInput extends Error {}

interface Payload {
  orderId?: string;
  lang?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: { street?: string; city?: string; zip?: string } | null;
    newsletter?: boolean;
    company?: { name?: string; ico?: string; dic?: string } | null;
  };
  shipping?: { method?: string; pickupPoint?: string | null };
  payment?: string;
  items?: Array<{ externalId?: string; quantity?: number }>;
  note?: string;
  termsAccepted?: boolean;
  fireSafety?: { accepted?: boolean; signature?: string; version?: string; signedAt?: string };
}

function bad(error: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function aggregate(items: Array<{ externalId?: string; quantity?: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const id = String(item.externalId ?? '').trim();
    const qty = Number(item.quantity);
    if (!id) throw new InvalidInput('Chybí identifikátor produktu.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new InvalidInput('Neplatné množství.');
    map.set(id, (map.get(id) ?? 0) + qty);
    if ((map.get(id) ?? 0) > 20) throw new InvalidInput('Příliš velké množství jednoho produktu.');
  }
  if (map.size === 0) throw new InvalidInput('Objednávka je prázdná.');
  if (map.size > 50) throw new InvalidInput('Příliš mnoho položek.');
  return map;
}

async function replay(orderId: string, email: string) {
  const existing = await prisma.order.findUnique({ where: { orderId } });
  if (!existing) return null;
  if (existing.customerEmail.toLowerCase() !== email.toLowerCase()) {
    return bad('Objednávka s tímto číslem už existuje.', 409, 'duplicate');
  }
  const bank =
    existing.payment === 'transfer'
      ? await bankPaymentData(existing.totalCzk, existing.variableSymbol ?? variableSymbolFor(existing.orderId), existing.orderId)
      : null;
  return NextResponse.json(
    { success: true, duplicate: true, data: { order: publicOrder(existing), bank } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`orders:${clientIp(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Příliš mnoho pokusů. Zkuste to za chvíli.', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return bad('Neplatný požadavek.');
  }

  const email = String(body.customer?.email ?? '').trim();
  const orderId = String(body.orderId ?? '').trim();

  try {
    if (!ORDER_ID_RE.test(orderId)) throw new InvalidInput('Neplatné číslo objednávky.');
    if (!body.customer?.name?.trim()) throw new InvalidInput('Chybí jméno.');
    if (!EMAIL_RE.test(email) || email.length > 254) throw new InvalidInput('Neplatný e-mail.');
    if (!body.customer?.phone?.trim()) throw new InvalidInput('Chybí telefon.');
    if (body.termsAccepted !== true) throw new InvalidInput('Je potřeba souhlasit s obchodními podmínkami.');
    if (!Array.isArray(body.items) || body.items.length === 0) throw new InvalidInput('Objednávka je prázdná.');

    const shipping = body.shipping?.method as ShippingMethod;
    const shippingDef = SHIPPING_OPTIONS.find((option) => option.value === shipping);
    if (!shippingDef) throw new InvalidInput('Neplatná doprava.');

    const payment = body.payment as PaymentMethod;
    if (!['transfer', 'card', 'cod'].includes(payment)) throw new InvalidInput('Neplatná platba.');
    if (payment === 'card' && !process.env.STRIPE_SECRET_KEY?.trim()) {
      return bad('Platba kartou zatím není dostupná.', 503);
    }
    if (payment === 'cod' && COD_FEE_CZK <= 0) {
      return bad('Dobírka není dostupná.', 503);
    }

    if (shippingDef.needsAddress && !body.customer?.address?.street) throw new InvalidInput('Chybí adresa.');
    if (shippingDef.needsPickup && !body.shipping?.pickupPoint?.trim()) {
      throw new InvalidInput('Zadejte prosím výdejní místo Zásilkovny.');
    }
    // Adresu vyžaduje jen doprava na adresu; u výdejního místa stačí jeho název.
    const addressRequired = shipping === 'zasilkovna-home';
    if (addressRequired && (!body.customer?.address?.street?.trim() || !body.customer?.address?.city?.trim() || !body.customer?.address?.zip?.trim())) {
      throw new InvalidInput('Vyplňte prosím dodací adresu.');
    }

    const company = body.customer?.company;
    if (company) {
      if (!String(company.name ?? '').trim()) throw new InvalidInput('Chybí název firmy.');
      if (!/^\d{8}$/.test(String(company.ico ?? '').replace(/\s/g, ''))) throw new InvalidInput('Neplatné IČO.');
    }

    const existing = await prisma.order.findUnique({ where: { orderId } });
    if (existing) {
      const replayed = await replay(orderId, email);
      if (replayed) return replayed;
    }

    const reserved = aggregate(body.items);
    await ensureSeeded();
    const rows = await getSaleRows();

    // Personalizace a dárkové balení samostatně nedávají smysl — patří
    // k lampionu. Server to hlídá, ne jen UI.
    const hasLantern = [...reserved.keys()].some(
      (externalId) => productById(externalId)?.category === 'lampiony',
    );
    const hasAddon = [...reserved.keys()].some(
      (externalId) => productById(externalId)?.category === 'doplnky',
    );
    if (hasAddon && !hasLantern) {
      throw new InvalidInput('Personalizace a dárkové balení se objednávají spolu s lampionem.');
    }

    const itemDefs = new Map(PRODUCTS.map((product) => [product.externalId, product]));
    const lineItems: StoredOrderItem[] = [];
    let subtotalCzk = 0;

    for (const [externalId, quantity] of reserved) {
      const def = itemDefs.get(externalId);
      const row = rows.get(externalId);
      if (!def) throw new InvalidInput(`Neznámý produkt: ${externalId}`);
      if (!row || !row.active) throw new InvalidInput(`Produkt není v nabídce: ${externalId}`);
      if (row.stock < quantity) throw new StockConflict(`Produkt je vyprodaný: ${def.name.cs}`);
      const lineTotalCzk = row.priceCzk * quantity;
      subtotalCzk += lineTotalCzk;
      lineItems.push({
        externalId: def.externalId,
        slug: def.slug,
        name: def.name,
        quantity,
        unitPriceCzk: row.priceCzk,
        lineTotalCzk,
      });
    }

    const fireCheck = checkFireConsent(lineItems, body.fireSafety);
    if (fireCheck && !fireCheck.ok) return bad(fireCheck.error, 400, fireCheck.code);
    if (fireCheck?.ok && fireCheck.version !== FIRE_CONSENT_VERSION) {
      console.warn(`order ${orderId}: fire consent version ${fireCheck.version} != ${FIRE_CONSENT_VERSION}`);
    }

    const shippingCzk = shippingPriceFor(shipping, subtotalCzk);
    const codCzk = payment === 'cod' ? COD_FEE_CZK : 0;
    const totalCzk = subtotalCzk + shippingCzk + codCzk;
    const variableSymbol = variableSymbolFor(orderId);
    const lang: Lang = body.lang === 'en' || body.lang === 'de' ? body.lang : 'cs';

    const order = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx);
      const created = await tx.order.create({
        data: {
          orderId,
          status: 'pending',
          paymentStatus: 'pending',
          customerName: body.customer!.name!.trim().slice(0, 200),
          customerEmail: email.slice(0, 254),
          customerPhone: body.customer!.phone!.trim().slice(0, 40),
          lang,
          shipping,
          payment,
          addressStreet: addressRequired ? body.customer?.address?.street?.trim().slice(0, 200) ?? null : null,
          addressCity: addressRequired ? body.customer?.address?.city?.trim().slice(0, 120) ?? null : null,
          addressZip: addressRequired ? body.customer?.address?.zip?.trim().slice(0, 20) ?? null : null,
          pickupPoint: shipping === 'zasilkovna' ? body.shipping?.pickupPoint?.trim().slice(0, 200) ?? null : null,
          note: body.note?.slice(0, 2000) || null,
          companyName: company ? String(company.name).trim().slice(0, 200) : null,
          buyerIco: company ? String(company.ico).replace(/\s/g, '').slice(0, 10) : null,
          buyerDic: company ? String(company.dic ?? '').replace(/\s/g, '').slice(0, 20) || null : null,
          items: JSON.stringify(lineItems),
          subtotalCzk,
          shippingCzk,
          codCzk,
          totalCzk,
          variableSymbol,
          invoiceNumber,
          fireConsentName: fireCheck?.ok ? fireCheck.name : null,
          fireConsentAt: fireCheck?.ok ? new Date() : null,
          fireConsentVersion: fireCheck?.ok ? fireCheck.version : null,
          termsAccepted: true,
          newsletter: Boolean(body.customer?.newsletter),
          statusHistory: JSON.stringify([
            { status: 'pending', at: new Date().toISOString(), by: 'customer' },
          ]),
        },
      });

      for (const [externalId, quantity] of reserved) {
        const updated = await tx.product.updateMany({
          where: { externalId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (updated.count === 0) throw new StockConflict(`Produkt se právě vyprodal: ${externalId}`);
      }

      return created;
    });

    // Zákazník dostane potvrzení, i když platba ještě nedorazila.
    void sendOrderConfirmation(orderToLike(order)).catch((error) => console.error(error));
    void sendAdminOrderNotification(orderToLike(order)).catch((error) => console.error(error));

    const bank =
      payment === 'transfer'
        ? await bankPaymentData(totalCzk, variableSymbol, orderId)
        : null;

    return NextResponse.json(
      { success: true, data: { order: publicOrder(order), bank } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof InvalidInput) return bad(error.message);
    if (error instanceof StockConflict) return bad(error.message, 409, 'out_of_stock');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replayed = await replay(orderId, email);
      if (replayed) return replayed;
      return bad('Objednávka s tímto číslem už existuje.', 409, 'duplicate');
    }
    console.error('Lumi order failed:', error);
    return bad('Objednávku se nepodařilo vytvořit.', 500);
  }
}
