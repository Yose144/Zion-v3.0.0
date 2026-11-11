import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { markShopOrderPaid } from '@/lib/shop-zionpay';
import { distributeOrderBonus } from '@/lib/bonus-payout';
import { getTokenDistribution } from '@/lib/tokens';
import { getArchivePassForOrder } from '@/lib/archive-pass';
import {
  giftWhatsappPayload,
  ensureGiftClaimToken,
  giftPageUrl,
} from '@/lib/gift-whatsapp';
import { randomBytes } from 'crypto';
import { shopProducts } from '@/data/shopProducts';

export const dynamic = 'force-dynamic';

/**
 * Admin ZION gift — one call creates a gift order, marks it paid and
 * runs the whole paid pipeline: custodial wallet + seed email, native
 * L1 payout (BONUS:<orderId>), Archive Pass (item externalId gift-001
 * carries the archive-pass grant), the Kingdom of Hearts ZIP (book-001
 * filesUrl, tokens stay 0 so the admin amount is the only payout) and
 * the payment-confirmation email.
 *
 * Orders use payment='admin-gift' so they stay out of revenue stats by
 * filter and are listed back via GET here.
 */

const GIFT_PRODUCT_WITH_PASS = 'gift-001';
const GIFT_PRODUCT_TOKENS_ONLY = 'gift-token';
const BOOK_PRODUCT_ID = 'book-001';
const MAX_GIFT_ZION = 10_000_000;

const BOOK_ZIP =
  shopProducts.find((p) => p.externalId === BOOK_PRODUCT_ID)?.filesUrl ?? '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface GiftBody {
  email?: string;
  name?: string;
  phone?: string;
  amountZion?: number;
  withPass?: boolean;
  withBook?: boolean;
  note?: string;
}

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = (await request.json()) as GiftBody;
    const emailRaw = body.email?.trim().toLowerCase();
    const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
    const phone = body.phone?.trim() || '';
    // Dárek jde buď na email, nebo jen na telefon (WhatsApp wa.me carry).
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    const amountZion = Math.round(Number(body.amountZion));
    if (!Number.isInteger(amountZion) || amountZion <= 0 || amountZion > MAX_GIFT_ZION) {
      return NextResponse.json(
        { success: false, error: `amountZion must be a whole number 1..${MAX_GIFT_ZION}` },
        { status: 400 }
      );
    }

    const withPass = body.withPass !== false;
    const withBook = body.withBook !== false && Boolean(BOOK_ZIP);
    const name = body.name?.trim() || email?.split('@')[0] || 'Příjemce';
    const orderId = `GIFT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const items: Array<Record<string, unknown>> = [
      {
        externalId: withPass ? GIFT_PRODUCT_WITH_PASS : GIFT_PRODUCT_TOKENS_ONLY,
        name: withPass
          ? `🎁 ZION Gift — ${amountZion.toLocaleString('cs-CZ')} ZION + Archive Pass`
          : `🎁 ZION Gift — ${amountZion.toLocaleString('cs-CZ')} ZION`,
        quantity: 1,
        priceCzk: 0,
        tokens: amountZion,
        // Peněženka a pass nejsou soubor. Kniha má vlastní řádek s odkazem na ZIP.
        digital: false,
      },
    ];
    if (withBook) {
      items.push({
        // book-001 nese grant Archive Pass. Když admin pass vypne, řádek
        // nesmí ten grant spustit — ZIP se pošle i tak, jen pod jiným id.
        externalId: withPass ? BOOK_PRODUCT_ID : 'gift-book',
        name: 'Království srdce — kompletní edice (PDF + EPUB, 5 jazyků)',
        quantity: 1,
        priceCzk: 0,
        tokens: 0,
        digital: true,
        filesUrl: BOOK_ZIP,
      });
    }

    await prisma.shopOrder.create({
      data: {
        orderId,
        status: 'pending',
        paymentStatus: 'pending',
        customerName: name,
        customerEmail: email,
        customerPhone: phone || '+420000000000',
        shipping: 'virtualni-nakup',
        payment: 'admin-gift',
        totalCzk: 0,
        shippingCzk: 0,
        items: items as Prisma.InputJsonValue,
        zionTokens: amountZion,
        giftClaimToken: randomBytes(24).toString('base64url'),
        note: body.note?.trim() || null,
        statusHistory: [
          {
            status: 'pending',
            paymentStatus: 'pending',
            at: new Date().toISOString(),
            by: 'admin-gift',
          },
        ],
      },
    });

    const paid = await markShopOrderPaid(orderId, {
      by: 'admin-gift',
      note: body.note?.trim() || 'ZION gift',
    });
    if (!paid.ok) {
      return NextResponse.json(
        { success: false, error: paid.error ?? 'Paid transition failed', orderId },
        { status: 500 }
      );
    }

    // markShopOrderPaid fires the bonus asynchronously (void). Await the
    // outcome here — claimSend() dedupes, so this either wins the payout
    // itself or observes the async winner's record once it lands.
    let bonus: { txHash?: string; tokens?: number; status: string } = { status: 'pending' };
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const res = await distributeOrderBonus(orderId);
      if (res.ok && (res.txHash || res.already)) {
        bonus = { txHash: res.txHash, tokens: res.tokens ?? amountZion, status: 'distributed' };
        break;
      }
      if (!res.ok) {
        bonus = { status: `error: ${res.error}` };
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (bonus.status === 'pending') {
      const dist = await getTokenDistribution(orderId);
      if (dist?.status === 'distributed') {
        bonus = { txHash: dist.txHash, tokens: dist.tokens, status: 'distributed' };
      } else {
        bonus = { status: 'pending — bonus-sweep will retry' };
      }
    }

    const order = await prisma.shopOrder.findUnique({ where: { orderId } });
    const pass = withPass ? getArchivePassForOrder(orderId) : null;
    const whatsapp = giftWhatsappPayload(order?.customerPhone, {
      orderId,
      customerName: order?.customerName,
      amountZion,
      passCode: pass?.code ?? null,
      bookUrl: withBook ? BOOK_ZIP : null,
      bonusTxHash: bonus.txHash ?? null,
      giftUrl: order?.giftClaimToken ? giftPageUrl(order.giftClaimToken) : null,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        email,
        phone: order?.customerPhone ?? null,
        amountZion,
        paymentStatus: order?.paymentStatus ?? 'paid',
        wallet: order?.customerWalletAddress ?? null,
        pass: pass ? { code: pass.code } : null,
        book: withBook ? { filesUrl: BOOK_ZIP } : null,
        bonus,
        whatsapp,
      },
    });
  } catch (error) {
    console.error('Admin gift failed:', error);
    return NextResponse.json(
      { success: false, error: 'Gift creation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const orders = await prisma.shopOrder.findMany({
    where: { payment: 'admin-gift' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      orderId: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      zionTokens: true,
      status: true,
      paymentStatus: true,
      customerWalletAddress: true,
      giftClaimToken: true,
      note: true,
      items: true,
      createdAt: true,
      paidAt: true,
    },
  });

  const data = await Promise.all(
    orders.map(async (o) => {
      const dist = await getTokenDistribution(o.orderId);
      const pass = getArchivePassForOrder(o.orderId);
      const lines = Array.isArray(o.items) ? o.items : [];
      const bookLine = lines.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as { externalId?: string }).externalId === BOOK_PRODUCT_ID ||
          (item as { externalId?: string }).externalId === 'gift-book',
      ) as { filesUrl?: string } | undefined;
      const { items: _items, giftClaimToken: _claimToken, ...rest } = o;
      const claimToken = await ensureGiftClaimToken(o.orderId, o.giftClaimToken);
      const whatsapp = giftWhatsappPayload(o.customerPhone, {
        orderId: o.orderId,
        customerName: o.customerName,
        amountZion: o.zionTokens,
        passCode: pass?.code ?? null,
        bookUrl: bookLine?.filesUrl ?? null,
        bonusTxHash: dist?.txHash ?? null,
        giftUrl: claimToken ? giftPageUrl(claimToken) : null,
      });
      return {
        ...rest,
        whatsapp: whatsapp ? { url: whatsapp.url } : null,
        pass: pass ? { code: pass.code } : null,
        book: bookLine?.filesUrl ? { filesUrl: bookLine.filesUrl } : null,
        bonus: dist
          ? { status: dist.status, txHash: dist.txHash, distributedAt: dist.distributedAt }
          : null,
      };
    })
  );

  return NextResponse.json({ success: true, data });
}
