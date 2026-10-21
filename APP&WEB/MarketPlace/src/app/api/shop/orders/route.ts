import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import type { ShopOrderInput, ShippingMethod } from '@/types/shop';
import { SHIPPING_PRICES } from '@/types/shop';
import { sendAdminOrderNotification, sendCustomerOrderConfirmation, sendCustomerWalletEmail } from '@/lib/email';
import { createInvoiceForOrder } from '@/lib/invoice';
import { generateCustomerWallet } from '@/lib/zion-l1';
import { encryptSecret } from '@/lib/crypto';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const BANK_ACCOUNT = 'CZ6320100000002901809148';
const BANK_BIC = 'FIOBCZPPXXX';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/shop/orders — create order and return bank transfer QR.
// Prices, shipping cost and ZION token bonuses are recomputed server-side
// from the ShopProduct catalog — client-supplied totals are never trusted.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`orders:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await req.json()) as ShopOrderInput;

    // ── Validation ──────────────────────────────────────────────────
    if (!body.orderId || typeof body.orderId !== 'string' || body.orderId.length > 64) {
      return NextResponse.json({ success: false, error: 'Missing or invalid orderId' }, { status: 400 });
    }
    if (!body.customer?.name || !body.customer?.email || !body.customer?.phone) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!EMAIL_RE.test(body.customer.email) || body.customer.email.length > 254) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json({ success: false, error: 'Empty or invalid items' }, { status: 400 });
    }
    if (!body.termsAccepted) {
      return NextResponse.json({ success: false, error: 'Terms must be accepted' }, { status: 400 });
    }
    const shippingMethod = body.shipping?.method as ShippingMethod;
    if (!shippingMethod || !(shippingMethod in SHIPPING_PRICES)) {
      return NextResponse.json({ success: false, error: 'Invalid shipping method' }, { status: 400 });
    }
    if (!['transfer', 'card', 'crypto'].includes(body.payment)) {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 });
    }
    // Physical delivery requires an address
    const isVirtual = shippingMethod.startsWith('virtualni');
    if (!isVirtual && !body.customer.address?.street) {
      return NextResponse.json({ success: false, error: 'Address required for physical shipping' }, { status: 400 });
    }

    // ── Idempotency: same orderId → return existing order ───────────
    const existing = await prisma.shopOrder.findUnique({ where: { orderId: body.orderId } });
    if (existing) {
      const { customerWalletSeed, customerWalletSecretKey, ...safeExisting } = existing;
      void customerWalletSeed;
      void customerWalletSecretKey;
      const vs = existing.orderId.match(/(\d{10})/)?.[1] ?? existing.orderId.replace(/\D/g, '').slice(0, 10);
      return NextResponse.json({
        success: true,
        data: {
          order: safeExisting,
          invoice: null,
          bank: { account: '2901809148 / 2010', iban: 'CZ63 2010 0000 0029 0180 9148', bic: BANK_BIC, vs, amount: existing.totalCzk, qrCode: null },
          duplicate: true,
        },
      });
    }

    // ── Server-side pricing: recompute total + tokens from catalog ──
    const externalIds = body.items.map((i) => String(i.externalId));
    const products = await prisma.shopProduct.findMany({
      where: { externalId: { in: externalIds }, active: true },
    });
    const byId = new Map(products.map((p) => [p.externalId, p]));

    let itemsTotal = 0;
    let zionTokens = 0;
    const lineItems: { externalId: string; name: string; quantity: number; priceCzk: number; tokens: number }[] = [];
    for (const item of body.items) {
      const product = byId.get(String(item.externalId));
      const qty = Math.floor(Number(item.quantity));
      if (!product) {
        return NextResponse.json({ success: false, error: `Unknown product: ${item.externalId}` }, { status: 400 });
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ success: false, error: `Invalid quantity for ${product.name}` }, { status: 400 });
      }
      if (!product.inStock || product.stock < qty) {
        return NextResponse.json({ success: false, error: `${product.name} is out of stock` }, { status: 409 });
      }
      itemsTotal += product.priceCzk * qty;
      zionTokens += product.tokens * qty;
      lineItems.push({ externalId: product.externalId, name: product.name, quantity: qty, priceCzk: product.priceCzk, tokens: product.tokens });
    }

    const shippingCzk = SHIPPING_PRICES[shippingMethod];
    const totalCzk = itemsTotal + shippingCzk;

    // ── Wallet + order create + stock decrement (transaction) ───────
    let customerWallet: ReturnType<typeof generateCustomerWallet> | null = null;
    if (zionTokens > 0) {
      try {
        customerWallet = generateCustomerWallet();
      } catch (walletErr) {
        console.error('Failed to generate customer ZION wallet:', walletErr);
      }
    }

    const [order] = await prisma.$transaction([
      prisma.shopOrder.create({
        data: {
          orderId: body.orderId,
          status: 'pending',
          customerName: body.customer.name.slice(0, 200),
          customerEmail: body.customer.email.slice(0, 254),
          customerPhone: body.customer.phone.slice(0, 40),
          shipping: shippingMethod,
          payment: body.payment,
          addressStreet: body.customer.address?.street?.slice(0, 200) ?? null,
          addressCity: body.customer.address?.city?.slice(0, 120) ?? null,
          addressZip: body.customer.address?.zip?.slice(0, 20) ?? null,
          pickupPoint: (body.shipping.pickupPoint as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
          note: body.note?.slice(0, 2000) ?? null,
          totalCzk,
          shippingCzk,
          items: lineItems as unknown as Prisma.InputJsonValue,
          zionTokens,
          customerWalletAddress: customerWallet?.address ?? null,
          customerWalletSeed: customerWallet ? encryptSecret(customerWallet.mnemonic) : null,
          customerWalletPublicKey: customerWallet?.publicKey ?? null,
          customerWalletSecretKey: customerWallet ? encryptSecret(customerWallet.secretKey) : null,
          termsAccepted: body.termsAccepted,
          newsletter: body.customer.newsletter ?? false,
        },
      }),
      ...lineItems.map((li) =>
        prisma.shopProduct.update({
          where: { externalId: li.externalId },
          data: { stock: { decrement: li.quantity } },
        }),
      ),
    ]);

    // Fix inStock flags for depleted products (outside txn, best-effort)
    for (const li of lineItems) {
      prisma.shopProduct.updateMany({
        where: { externalId: li.externalId, stock: { lte: 0 } },
        data: { inStock: false },
      }).catch(() => {});
    }

    const vs = body.orderId.match(/(\d{10})/)?.[1] ?? body.orderId.replace(/\D/g, '').slice(0, 10);
    const qrData = `SPD*1.0*ACC:${BANK_ACCOUNT}*AM:${totalCzk}.00*CC:CZK*MSG:Objednavka ${body.orderId}*X-VS:${vs}`;
    const qrSvg = await QRCode.toString(qrData, { type: 'svg', margin: 2, width: 280 });
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;

    const invoiceResult = await createInvoiceForOrder({
      orderId: order.orderId,
      orderDatabaseId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerAddress: body.customer.address
        ? {
            street: body.customer.address.street,
            city: body.customer.address.city,
            zip: body.customer.address.zip,
          }
        : null,
      payment: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: order.items,
    }).catch((err) => {
      console.error('Invoice auto-generation failed:', err);
      return null;
    });

    const emailData = {
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shipping: order.shipping,
      payment: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: order.items,
      addressStreet: order.addressStreet,
      addressCity: order.addressCity,
      addressZip: order.addressZip,
      pickupPoint: order.pickupPoint,
      note: order.note,
      zionTokens: order.zionTokens,
      trackingNumber: order.trackingNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
    };

    // Send notifications in background; don't block the response
    sendAdminOrderNotification(emailData).catch(console.error);
    sendCustomerOrderConfirmation(emailData, invoiceResult?.html ?? null).catch(console.error);
    if (customerWallet) {
      sendCustomerWalletEmail({
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        orderId: order.orderId,
        address: customerWallet.address,
        seed: customerWallet.mnemonic,
      }).catch((err) => console.error('Failed to send customer wallet email:', err));
    }

    // Never return wallet material (even encrypted) on the public endpoint
    const { customerWalletSeed, customerWalletSecretKey, ...safeOrder } = order;
    void customerWalletSeed;
    void customerWalletSecretKey;

    return NextResponse.json({
      success: true,
      data: {
        order: safeOrder,
        invoice: invoiceResult?.invoice ?? null,
        bank: {
          account: '2901809148 / 2010',
          iban: 'CZ63 2010 0000 0029 0180 9148',
          bic: BANK_BIC,
          vs,
          amount: totalCzk,
          qrCode,
        },
      },
    });
  } catch (error) {
    // Unique constraint on orderId → concurrent duplicate submit
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Order already exists' }, { status: 409 });
    }
    console.error('Failed to create shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
