import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import type { ShopOrderInput, ShippingMethod } from '@/types/shop';
import { SHIPPING_PRICES } from '@/types/shop';
import { sendAdminOrderNotification, sendCustomerOrderConfirmation, sendCustomerWalletEmail } from '@/lib/email';
import { emailLangFromAcceptLanguage } from '@/lib/email-lang';
import { getActiveTokenCampaigns, campaignTokens } from '@/lib/shop-campaign';
import { createInvoiceForOrder } from '@/lib/invoice';
import { generateCustomerWallet } from '@/lib/zion-l1';
import { encryptSecret } from '@/lib/crypto';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { FIRE_CONSENT_VERSION, checkFireConsent } from '@/lib/fire-safety';
import {
  StockConflictError,
  aggregateOrderQuantities,
  duplicateOrderDecision,
  reserveProductStock,
  variableSymbol,
} from '@/lib/shop-order-guard';
import {
  SHOP_VAULT,
  shopPayMemo,
  zionPayUri,
  storeExpectation,
} from '@/lib/shop-zionpay';

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

  let claimedOrderId = '';
  let claimedEmail = '';
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
    const paymentMethod = body.payment === 'crypto' ? 'zion' : body.payment;
    if (!['transfer', 'card', 'crypto', 'zion', 'commerce'].includes(body.payment)) {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 });
    }
    // ZION payment requires the shop vault to be configured
    if (paymentMethod === 'zion' && !SHOP_VAULT) {
      return NextResponse.json({ success: false, error: 'ZION payments unavailable' }, { status: 503 });
    }
    // Coinbase Commerce must be configured before it can be selected
    if (paymentMethod === 'commerce' && !process.env.COMMERCE_API_KEY?.trim()) {
      return NextResponse.json({ success: false, error: 'Crypto checkout unavailable' }, { status: 503 });
    }
    // B2B buyer block (optional): company name + IČO/DIČ for invoices.
    const company = body.customer.company;
    if (company) {
      const ico = String(company.ico ?? '').replace(/\s/g, '');
      const dic = String(company.dic ?? '').replace(/\s/g, '');
      if (!String(company.name ?? '').trim()) {
        return NextResponse.json({ success: false, error: 'Company name required for B2B order' }, { status: 400 });
      }
      if (!/^\d{8}$/.test(ico)) {
        return NextResponse.json({ success: false, error: 'Invalid IČO (8 digits)' }, { status: 400 });
      }
      if (dic && !/^[A-Z]{2}?\d{7,12}$/i.test(dic)) {
        return NextResponse.json({ success: false, error: 'Invalid DIČ' }, { status: 400 });
      }
      company.ico = ico;
      company.dic = dic;
    }
    // Shipping rules (V2 parity):
    // - virtualni*: no address
    // - zasilkovna (pickup): requires pickupPoint name/id (no home address)
    // - zasilkovna-home: requires street address
    const isVirtual = shippingMethod.startsWith('virtualni');
    const isPickup = shippingMethod === 'zasilkovna';
    const isHome = shippingMethod === 'zasilkovna-home';
    if (isHome && !body.customer.address?.street) {
      return NextResponse.json({ success: false, error: 'Address required for home delivery' }, { status: 400 });
    }
    if (isPickup) {
      const pp = body.shipping?.pickupPoint as { name?: string; id?: string; label?: string } | string | null | undefined;
      const label =
        typeof pp === 'string'
          ? pp.trim()
          : [pp?.name, pp?.label, pp?.id].filter(Boolean).join(' ').trim();
      if (!label) {
        return NextResponse.json(
          { success: false, error: 'Pickup point required for Zásilkovna' },
          { status: 400 },
        );
      }
    }
    if (!isVirtual && !isPickup && !isHome) {
      // Future physical methods — require address by default
      if (!body.customer.address?.street) {
        return NextResponse.json({ success: false, error: 'Address required for physical shipping' }, { status: 400 });
      }
    }

    // Opakované orderId smí pokračovat jen se stejným e-mailem a jen
    // veřejným stavem. Cizí požadavek nedostane jméno, adresu ani peněženku.
    claimedOrderId = body.orderId;
    claimedEmail = body.customer.email;
    const bankPublic = {
      account: '2901809148 / 2010',
      iban: 'CZ63 2010 0000 0029 0180 9148',
      bic: BANK_BIC,
    };
    const existing = await prisma.shopOrder.findUnique({ where: { orderId: body.orderId } });
    if (existing) {
      const decision = duplicateOrderDecision(existing, body.customer.email, bankPublic);
      return NextResponse.json(decision.body, { status: decision.status });
    }

    // ── Server-side pricing: recompute total + tokens from catalog ──
    const externalIds = body.items.map((i) => String(i.externalId));
    const [products, tokenCampaigns] = await Promise.all([
      prisma.shopProduct.findMany({
        where: { externalId: { in: externalIds }, active: true },
      }),
      getActiveTokenCampaigns(),
    ]);
    const byId = new Map(products.map((p) => [p.externalId, p]));

    let itemsTotal = 0;
    let zionTokens = 0;
    type LineItem = {
      externalId: string;
      name: string;
      quantity: number;
      priceCzk: number;
      tokens: number;
      digital: boolean;
      filesUrl?: string;
      instructionsUrl?: string;
      modelUrl?: string;
    };
    const lineItems: LineItem[] = [];
    for (const item of body.items) {
      const product = byId.get(String(item.externalId));
      const qty = Math.floor(Number(item.quantity));
      if (!product) {
        return NextResponse.json({ success: false, error: `Unknown product: ${item.externalId}` }, { status: 400 });
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ success: false, error: `Invalid quantity for ${product.name}` }, { status: 400 });
      }
      // V2 parity: active campaign overrides catalog tokens,
      // else 1 Kč = 1 ZION loyalty unit
      const baseTokens =
        product.tokens > 0 ? product.tokens : Math.max(1, Math.round(product.priceCzk));
      const unitTokens = campaignTokens(tokenCampaigns, product.externalId, baseTokens);
      itemsTotal += product.priceCzk * qty;
      zionTokens += unitTokens * qty;
      lineItems.push({
        externalId: product.externalId,
        name: product.name,
        quantity: qty,
        priceCzk: product.priceCzk,
        tokens: unitTokens,
        digital: product.digital,
        filesUrl: product.filesUrl ?? undefined,
        instructionsUrl: product.instructionsUrl ?? undefined,
        modelUrl: product.modelUrl ?? undefined,
      });
    }

    // Dva řádky téhož produktu jsou jeden nárok. Kontrola po řádku by
    // poslední kus prodala dvakrát.
    const reserved = aggregateOrderQuantities(lineItems);
    for (const [externalId, qty] of reserved) {
      const product = byId.get(externalId);
      if (!product || !product.inStock || product.stock < qty) {
        return NextResponse.json(
          { success: false, error: `${product?.name ?? externalId} is out of stock` },
          { status: 409 },
        );
      }
    }

    const shippingCzk = SHIPPING_PRICES[shippingMethod];
    const totalCzk = itemsTotal + shippingCzk;

    // ── Bezpečnostní prohlášení (oheň + dřevo) ─────────────────────
    // U zboží s otevřeným plamenem musí být prohlášení odsouhlasené a
    // podepsané. Když chybí, objednávka se odmítne — vypnutý JavaScript
    // v prohlížeči není výmluva a podpis musí být doložitelný.
    const fireCheck = checkFireConsent(lineItems, body.fireSafety);
    if (fireCheck && !fireCheck.ok) {
      return NextResponse.json({ success: false, error: fireCheck.error, code: fireCheck.code }, { status: 400 });
    }
    const fireRequired = Boolean(fireCheck);
    if (fireRequired && fireCheck?.ok && fireCheck.version !== FIRE_CONSENT_VERSION) {
      // Zákazník podepsal jiné znění, než jaké je aktuální — uložíme, co
      // poslal (důkaz), ale upozorníme do logu, aby šlo dohledat.
      console.warn(
        `order ${body.orderId}: fire consent version ${fireCheck.version} != ${FIRE_CONSENT_VERSION}`,
      );
    }

    // ── Wallet + order create + stock decrement (transaction) ───────
    let customerWallet: ReturnType<typeof generateCustomerWallet> | null = null;
    if (zionTokens > 0) {
      try {
        customerWallet = generateCustomerWallet();
      } catch (walletErr) {
        console.error('Failed to generate customer ZION wallet:', walletErr);
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      await reserveProductStock(tx, reserved);
      return tx.shopOrder.create({
        data: {
          orderId: body.orderId,
          status: 'pending',
          customerName: body.customer.name.slice(0, 200),
          customerEmail: body.customer.email.slice(0, 254),
          customerPhone: body.customer.phone.slice(0, 40),
          shipping: shippingMethod,
          payment: paymentMethod,
          addressStreet: body.customer.address?.street?.slice(0, 200) ?? null,
          addressCity: body.customer.address?.city?.slice(0, 120) ?? null,
          addressZip: body.customer.address?.zip?.slice(0, 20) ?? null,
          pickupPoint: (body.shipping.pickupPoint as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
          note: body.note?.slice(0, 2000) ?? null,
          companyName: company ? company.name.slice(0, 200) : null,
          buyerIco: company ? company.ico.slice(0, 10) : null,
          buyerDic: company ? (company.dic || null) : null,
          statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: 'customer' }],
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
          // Důkaz poučení: jméno, čas (server) a verze textu prohlášení
          fireConsentName: fireCheck?.ok ? fireCheck.name : null,
          fireConsentAt: fireCheck?.ok ? new Date() : null,
          fireConsentVersion: fireCheck?.ok ? fireCheck.version : null,
        },
      });
    });

    const vs = variableSymbol(body.orderId);
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
      customerCompany: order.companyName
        ? { name: order.companyName, ico: order.buyerIco ?? '', dic: order.buyerDic ?? '' }
        : null,
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
      customerWalletAddress: order.customerWalletAddress,
      customerWalletId: order.orderId,
      // English browsers get the English confirmation (falls back to cs).
      lang: emailLangFromAcceptLanguage(req.headers.get('accept-language')),
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
        lang: emailData.lang,
      }).catch((err) => console.error('Failed to send customer wallet email:', err));
    }

    // ── ZION L1 payment payload (SHOPPAY memo flow) ─────────────────
    // Store the expected amount so the watcher-confirm endpoint can
    // verify underpayments; the URI/QR works for any wallet that scans
    // zion: links, CLI users get the raw fields too.
    let zion: {
      address: string;
      memo: string;
      amountZion: number;
      expectedFlowers: string;
      uri: string;
      qrCode: string;
      cliHint: string;
    } | null = null;
    if (paymentMethod === 'zion') {
      const exp = await storeExpectation(order.orderId, totalCzk);
      const uri = zionPayUri(order.orderId, exp.amountZion);
      const zSvg = await QRCode.toString(uri, { type: 'svg', margin: 2, width: 280 });
      zion = {
        address: exp.vault,
        memo: shopPayMemo(order.orderId),
        amountZion: exp.amountZion,
        expectedFlowers: exp.expectedFlowers,
        uri,
        qrCode: `data:image/svg+xml;base64,${Buffer.from(zSvg).toString('base64')}`,
        cliHint: `zion wallet send -t ${exp.vault} -a ${exp.amountZion} -m "${shopPayMemo(order.orderId)}"`,
      };
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
        zion,
      },
    });
  } catch (error) {
    if (error instanceof StockConflictError) {
      return NextResponse.json({ success: false, error: 'Item is out of stock' }, { status: 409 });
    }
    // Souběh dvou nových požadavků se stejným orderId: sklad se vrátil
    // s transakcí, odpověď je stejná jako u vědomého opakování.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      try {
        const raced = claimedOrderId
          ? await prisma.shopOrder.findUnique({ where: { orderId: claimedOrderId } })
          : null;
        if (raced) {
          const decision = duplicateOrderDecision(raced, claimedEmail, {
            account: '2901809148 / 2010',
            iban: 'CZ63 2010 0000 0029 0180 9148',
            bic: BANK_BIC,
          });
          return NextResponse.json(decision.body, { status: decision.status });
        }
      } catch (lookupErr) {
        console.error('Duplicate order lookup failed:', lookupErr);
      }
      return NextResponse.json(
        { success: false, duplicate: true, error: 'Order already exists' },
        { status: 409 },
      );
    }
    console.error('Failed to create shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
