import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { markShopOrderPaid } from '@/lib/shop-zionpay';
import { distributeOrderBonus } from '@/lib/bonus-payout';
import { getTokenDistribution } from '@/lib/tokens';
import { getArchivePassForOrder } from '@/lib/archive-pass';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Admin ZION gift — one call creates a gift order, marks it paid and
 * runs the whole paid pipeline: custodial wallet + seed email, native
 * L1 payout (BONUS:<orderId>), Archive Pass (item externalId gift-001
 * carries the archive-pass grant) and the payment-confirmation email.
 *
 * Orders use payment='admin-gift' so they stay out of revenue stats by
 * filter and are listed back via GET here.
 */

const GIFT_PRODUCT_WITH_PASS = 'gift-001';
const GIFT_PRODUCT_TOKENS_ONLY = 'gift-token';
const MAX_GIFT_ZION = 10_000_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface GiftBody {
  email?: string;
  name?: string;
  phone?: string;
  amountZion?: number;
  withPass?: boolean;
  note?: string;
}

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = (await request.json()) as GiftBody;
    const email = body.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
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
    const name = body.name?.trim() || email.split('@')[0];
    const orderId = `GIFT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const items = [
      {
        externalId: withPass ? GIFT_PRODUCT_WITH_PASS : GIFT_PRODUCT_TOKENS_ONLY,
        name: withPass
          ? `🎁 ZION Gift — ${amountZion.toLocaleString('cs-CZ')} ZION + Archive Pass`
          : `🎁 ZION Gift — ${amountZion.toLocaleString('cs-CZ')} ZION`,
        quantity: 1,
        priceCzk: 0,
        tokens: amountZion,
        digital: true,
      },
    ];

    await prisma.shopOrder.create({
      data: {
        orderId,
        status: 'pending',
        paymentStatus: 'pending',
        customerName: name,
        customerEmail: email,
        customerPhone: body.phone?.trim() || '+420000000000',
        shipping: 'virtualni-nakup',
        payment: 'admin-gift',
        totalCzk: 0,
        shippingCzk: 0,
        items,
        zionTokens: amountZion,
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

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        email,
        amountZion,
        paymentStatus: order?.paymentStatus ?? 'paid',
        wallet: order?.customerWalletAddress ?? null,
        pass: pass ? { code: pass.code } : null,
        bonus,
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
      zionTokens: true,
      status: true,
      paymentStatus: true,
      customerWalletAddress: true,
      note: true,
      createdAt: true,
      paidAt: true,
    },
  });

  const data = await Promise.all(
    orders.map(async (o) => {
      const dist = await getTokenDistribution(o.orderId);
      const pass = getArchivePassForOrder(o.orderId);
      return {
        ...o,
        pass: pass ? { code: pass.code } : null,
        bonus: dist
          ? { status: dist.status, txHash: dist.txHash, distributedAt: dist.distributedAt }
          : null,
      };
    })
  );

  return NextResponse.json({ success: true, data });
}
