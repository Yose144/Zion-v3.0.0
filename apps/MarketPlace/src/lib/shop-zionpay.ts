import { prisma } from '@/lib/db';
import { sendPaymentConfirmation } from '@/lib/email';
import type { Prisma } from '@prisma/client';

/**
 * ZION L1 shop payments (SHOPPAY memo flow).
 *
 * The customer pays native ZION to the shop vault address with memo
 * `SHOPPAY:<orderId>`. The l1-watcher service scans for the memo and, after
 * finality, POSTs to /api/shop/zion-confirm which marks the order paid.
 *
 * Env:
 *   L1_SHOP_VAULT         — shop receiving address (default: pool wallet)
 *   SHOP_ZION_PER_CZK     — ZION units per 1 CZK (default 10, matching the
 *                           loyalty-token valuation: tokens = 10x price)
 *   SHOP_CONFIRM_SECRET   — shared secret for the watcher->app webhook
 */

export const SHOP_VAULT =
  process.env.L1_SHOP_VAULT ?? 'zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2';

export const ZION_PER_CZK = Math.max(
  0.000001,
  Number(process.env.SHOP_ZION_PER_CZK ?? '10') || 10,
);

export const FLOWERS_PER_ZION = 1_000_000n;

export interface ZionPayExpectation {
  orderId: string;
  totalCzk: number;
  amountZion: number;
  expectedFlowers: string;
  vault: string;
  createdAt: string;
}

export function zionAmountForCzk(totalCzk: number): number {
  // Round UP to whole ZION — underpayment by dust would block auto-confirm.
  return Math.ceil(totalCzk * ZION_PER_CZK);
}

export function flowersForZion(amountZion: number): bigint {
  return BigInt(Math.round(amountZion)) * FLOWERS_PER_ZION;
}

export function shopPayMemo(orderId: string): string {
  return `SHOPPAY:${orderId}`;
}

/** Wallet URI — parses as zion:<addr>?amount=<zion>&memo=<memo> */
export function zionPayUri(orderId: string, amountZion: number): string {
  return `zion:${SHOP_VAULT}?amount=${amountZion}&memo=${encodeURIComponent(shopPayMemo(orderId))}`;
}

const settingKey = (orderId: string) => `zionpay:${orderId}`;

export async function storeExpectation(orderId: string, totalCzk: number): Promise<ZionPayExpectation> {
  const amountZion = zionAmountForCzk(totalCzk);
  const exp: ZionPayExpectation = {
    orderId,
    totalCzk,
    amountZion,
    expectedFlowers: flowersForZion(amountZion).toString(),
    vault: SHOP_VAULT,
    createdAt: new Date().toISOString(),
  };
  await prisma.shopSetting.upsert({
    where: { key: settingKey(orderId) },
    create: { key: settingKey(orderId), value: JSON.stringify(exp) },
    update: { value: JSON.stringify(exp) },
  });
  return exp;
}

export async function loadExpectation(orderId: string): Promise<ZionPayExpectation | null> {
  const row = await prisma.shopSetting.findUnique({ where: { key: settingKey(orderId) } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as ZionPayExpectation;
  } catch {
    return null;
  }
}

/**
 * Mark an order paid. Shared by the ZION L1 confirm endpoint and the
 * Coinbase Commerce webhook — same semantics as the Stripe webhook:
 * paymentStatus=paid, paidAt, invoice paid, statusHistory append, email.
 * Idempotent: a second call for an already-paid order returns {already:true}.
 */
export async function markShopOrderPaid(
  orderId: string,
  meta: { by: string; txRef?: string; note?: string },
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const order = await prisma.shopOrder.findFirst({ where: { orderId } });
  if (!order) return { ok: false, error: 'Order not found' };

  if (order.paymentStatus === 'paid') {
    return { ok: true, already: true };
  }

  const now = new Date();
  const hist = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  hist.push({
    status: 'paid',
    paymentStatus: 'paid',
    at: now.toISOString(),
    by: meta.by,
    ...(meta.txRef ? { tx: meta.txRef } : {}),
    ...(meta.note ? { note: meta.note } : {}),
  });

  await prisma.$transaction([
    prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: now,
        statusHistory: hist as Prisma.InputJsonValue,
      },
    }),
    prisma.invoice.updateMany({
      where: { order: { orderId } },
      data: { status: 'paid', paidAt: now },
    }),
  ]);

  sendPaymentConfirmation({
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
    status: 'paid',
    paymentStatus: 'paid',
  }).catch(console.error);

  return { ok: true };
}
