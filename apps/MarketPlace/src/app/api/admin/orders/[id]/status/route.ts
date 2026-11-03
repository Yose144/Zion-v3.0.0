import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { sendPaymentConfirmation, sendShippingNotification } from '@/lib/email';
import { distributeOrderBonus } from '@/lib/bonus-payout';
import {
  ARCHIVE_REDEEM_URL,
  issueArchivePassForOrder,
  revokeArchivePass,
  unrevokeArchivePass,
} from '@/lib/archive-pass';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: string;
      paymentStatus?: string;
      note?: string;
    };

    const before = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
    });
    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = {};
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      update.status = body.status;
      if (body.status === 'paid') {
        update.paymentStatus = 'paid';
        update.paidAt = new Date();
      }
      if (body.status === 'shipped' && !('shippedAt' in update)) {
        update.shippedAt = new Date();
      }
    }
    if (body.paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid paymentStatus: ${body.paymentStatus}` },
          { status: 400 }
        );
      }
      update.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'paid') update.paidAt = new Date();
    }
    if (body.note !== undefined) update.note = body.note;

    // Audit trail (V2 parity): append the transition to statusHistory.
    const prevHist = Array.isArray(before.statusHistory) ? before.statusHistory : [];
    update.statusHistory = [
      ...prevHist,
      {
        status: (update.status as string) ?? before.status,
        paymentStatus: (update.paymentStatus as string) ?? before.paymentStatus,
        note: body.note ?? null,
        at: new Date().toISOString(),
        by: 'admin',
      },
    ];

    // Atomically claim the pending→paid transition before the generic update:
    // only the request that actually flips paymentStatus fires the paid
    // side-effects (invoice, ZION bonus, confirmation email) — concurrent
    // mark-paid calls otherwise see the same stale `before` snapshot.
    const wantsPaid = update.paymentStatus === 'paid';
    let paidClaim = false;
    if (wantsPaid && before.paymentStatus !== 'paid') {
      const claim = await prisma.shopOrder.updateMany({
        where: { id: before.id, paymentStatus: { not: 'paid' } },
        data: {
          paymentStatus: 'paid',
          paidAt: update.paidAt as Date,
          ...(body.status === 'paid' ? { status: 'paid' } : {}),
        },
      });
      paidClaim = claim.count === 1;
    }

    // Zrušení objednávky mění, co objednávka drží ze skladu: vytvoření dělá
    // `stock: decrement`, takže cancel musí `increment` vrátit. Claim je
    // atomický, aby dvojí cancel (nebo souběžné požadavky) nevrátily sklad
    // dvakrát — přesně tenhle vzor už používá mark-paid výš.
    const wantsCancel = update.status === 'cancelled';
    const wasCancelled = before.status === 'cancelled';
    let cancelClaim = false;
    if (wantsCancel && !wasCancelled) {
      const claim = await prisma.shopOrder.updateMany({
        where: { id: before.id, status: { not: 'cancelled' } },
        data: { status: 'cancelled' },
      });
      cancelClaim = claim.count === 1;
    }

    const order = await prisma.shopOrder.updateMany({
      where: { OR: [{ id }, { orderId: id }] },
      data: update,
    });

    if (order.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.shopOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: { invoices: true },
    });

    // Bank-transfer soft-launch: admin "mark paid" must notify customer (V2 parity).
    if (paidClaim && updated) {
      // Same paid-path side effects as markShopOrderPaid / stripe webhook:
      // mark the invoice paid, then pay the ZION bonus (idempotent, skips
      // when the order has no tokens / no customer wallet).
      await prisma.invoice.updateMany({
        where: { order: { orderId: updated.orderId } },
        data: { status: 'paid', paidAt: update.paidAt as Date },
      });
      void distributeOrderBonus(updated.orderId).catch((err) =>
        console.error('Bonus payout failed:', err)
      );
      const archivePass = await issueArchivePassForOrder(updated).catch(
        (err) => {
          console.error('Archive pass issue failed:', err);
          return null;
        },
      );
      void sendPaymentConfirmation({
        archivePass: archivePass
          ? { code: archivePass.code, url: ARCHIVE_REDEEM_URL }
          : null,
        orderId: updated.orderId,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        shipping: updated.shipping,
        payment: updated.payment,
        totalCzk: updated.totalCzk,
        shippingCzk: updated.shippingCzk,
        items: updated.items,
        addressStreet: updated.addressStreet,
        addressCity: updated.addressCity,
        addressZip: updated.addressZip,
        pickupPoint: updated.pickupPoint,
        note: updated.note,
        zionTokens: updated.zionTokens,
        trackingNumber: updated.trackingNumber,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        customerWalletAddress: updated.customerWalletAddress,
        customerWalletId: updated.orderId,
      }).catch((err) => console.error('mark-paid email failed:', err));
    }

    // Cancelled orders lose their archive pass (if one was issued at paid).
    if (updated && updated.status === 'cancelled' && before.status !== 'cancelled') {
      try {
        revokeArchivePass(updated.orderId);
      } catch (err) {
        console.error('Archive pass revoke failed:', err);
      }
    }

    // Reopening a cancelled order (e.g. accidental cancel) puts the pass back
    // in force; otherwise the customer would hold a permanently dead code.
    if (updated && updated.status !== 'cancelled' && before.status === 'cancelled') {
      try {
        unrevokeArchivePass(updated.orderId);
      } catch (err) {
        console.error('Archive pass unrevoke failed:', err);
      }
    }

    // Cancel vrací sklad a ruší nezaplacenou fakturu. Dřív se nedělo ani jedno:
    // zrušená objednávka držela kus skladu navěky (oversell riziko) a faktura
    // zůstala `issued`, takže v účetnictví visela jako vystavená.
    if (cancelClaim && updated) {
      const items = Array.isArray(updated.items)
        ? (updated.items as Array<{ externalId?: unknown; quantity?: unknown }>)
        : [];
      const lines = items
        .map((item) => ({
          externalId: String(item?.externalId ?? ''),
          quantity: Number(item?.quantity ?? 0),
        }))
        .filter((line) => line.externalId && Number.isFinite(line.quantity) && line.quantity > 0);

      if (lines.length > 0) {
        try {
          await prisma.$transaction(
            lines.map((line) =>
              prisma.shopProduct.update({
                where: { externalId: line.externalId },
                data: { stock: { increment: line.quantity } },
              }),
            ),
          );
          // Produkt, který se vyprodal, je zase skladem.
          await prisma.shopProduct.updateMany({
            where: {
              externalId: { in: lines.map((line) => line.externalId) },
              stock: { gt: 0 },
              inStock: false,
            },
            data: { inStock: true },
          });
        } catch (err) {
          // Produkt mohl být mezitím smazaný — sklad se pak nedá vrátit,
          // ale zrušení objednávky nesmí selhat kvůli tomu.
          console.error('Stock restore on cancel failed:', err);
        }
      }

      // Zaplacená faktura zůstává: peníze se pohnuly a vrácení je samostatný
      // proces. Ruší se jen to, co ještě není zaplacené.
      try {
        await prisma.invoice.updateMany({
          where: { orderId: updated.id, status: { in: ['draft', 'issued'] } },
          data: { status: 'cancelled' },
        });
      } catch (err) {
        console.error('Invoice cancel failed:', err);
      }
    }

    // Obnovení zrušené objednávky sklad znovu nerezervuje — mohlo by to jít do
    // minusu a oversellnout. Operátor to musí dořešit v katalogu ručně.
    if (!wantsCancel && wasCancelled && updated && updated.status !== 'cancelled') {
      console.warn(
        `Order ${updated.orderId} reopened from cancelled: stock is NOT re-reserved, check the catalog`,
      );
    }

    // Status → shipped without separate shipping API still notifies when possible.
    const becameShipped =
      updated &&
      updated.status === 'shipped' &&
      before.status !== 'shipped' &&
      Boolean(updated.trackingNumber);
    if (becameShipped && updated) {
      void sendShippingNotification({
        orderId: updated.orderId,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        shipping: updated.shipping,
        payment: updated.payment,
        totalCzk: updated.totalCzk,
        shippingCzk: updated.shippingCzk,
        items: updated.items,
        addressStreet: updated.addressStreet,
        addressCity: updated.addressCity,
        addressZip: updated.addressZip,
        pickupPoint: updated.pickupPoint,
        note: updated.note,
        zionTokens: updated.zionTokens,
        trackingNumber: updated.trackingNumber,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
      }).catch((err) => console.error('shipped email failed:', err));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
