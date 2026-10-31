import { prisma } from './db';
import { sendTokenBonusEmail } from './email';
import {
  getTokenDistribution,
  recordTokenDistribution,
  tokenSettingKey,
} from './tokens';
import { readPoolWalletAddress, sendZionPayout } from './zion-l1';

export type BonusPayoutResult =
  | {
      ok: true;
      skipped?: 'unpaid' | 'no-tokens' | 'no-wallet' | 'busy';
      already?: boolean;
      txHash?: string;
      tokens?: number;
    }
  | { ok: false; error: string };

const SEND_LOCK_MS = 120_000;

async function claimSend(orderId: string, tokens: number): Promise<'ok' | 'distributed' | 'busy'> {
  const key = tokenSettingKey(orderId);
  const existing = await getTokenDistribution(orderId);
  if (existing?.status === 'distributed') return 'distributed';
  if (existing?.status === 'sending') {
    const started = existing.distributedAt ? Date.parse(existing.distributedAt) : 0;
    if (Number.isFinite(started) && Date.now() - started < SEND_LOCK_MS) return 'busy';
    await prisma.shopSetting.delete({ where: { key } }).catch(() => undefined);
  }

  const value = JSON.stringify({
    status: 'sending',
    tokens,
    distributedAt: new Date().toISOString(),
  });
  try {
    await prisma.shopSetting.create({ data: { key, value } });
    return 'ok';
  } catch {
    const again = await getTokenDistribution(orderId);
    if (again?.status === 'distributed') return 'distributed';
    return 'busy';
  }
}

async function releaseClaim(orderId: string): Promise<void> {
  const existing = await getTokenDistribution(orderId);
  if (existing?.status !== 'sending') return;
  await prisma.shopSetting.delete({ where: { key: tokenSettingKey(orderId) } }).catch(() => undefined);
}

/**
 * Send the order's ZION bonus from the canonical pool payout wallet.
 * `zionTokens` is whole ZION (the number shown in admin), not flowers.
 * Idempotent: a distributed order is not paid twice.
 * No-op until the order is paid and has a customer wallet.
 */
export async function distributeOrderBonus(
  orderId: string,
  opts?: { txHash?: string }
): Promise<BonusPayoutResult> {
  const order = await prisma.shopOrder.findFirst({
    where: { OR: [{ id: orderId }, { orderId }] },
    select: {
      orderId: true,
      zionTokens: true,
      customerEmail: true,
      customerName: true,
      customerWalletAddress: true,
      paymentStatus: true,
    },
  });

  if (!order) return { ok: false, error: 'Order not found' };
  if (order.paymentStatus !== 'paid') return { ok: true, skipped: 'unpaid' };
  if (order.zionTokens <= 0) return { ok: true, skipped: 'no-tokens' };

  const existing = await getTokenDistribution(order.orderId);
  if (existing?.status === 'distributed') {
    return { ok: true, already: true, txHash: existing.txHash, tokens: order.zionTokens };
  }

  const amountZion = order.zionTokens;
  if (!Number.isInteger(amountZion) || amountZion <= 0) {
    return { ok: false, error: 'Bonus amount must be a positive whole number of ZION' };
  }

  let txHash = opts?.txHash?.trim() || undefined;
  if (!txHash) {
    if (!order.customerWalletAddress) return { ok: true, skipped: 'no-wallet' };
    const claim = await claimSend(order.orderId, amountZion);
    if (claim === 'distributed') {
      return { ok: true, already: true, tokens: amountZion };
    }
    if (claim === 'busy') return { ok: true, skipped: 'busy' };

    try {
      readPoolWalletAddress();
      const payout = await sendZionPayout(
        order.customerWalletAddress,
        amountZion,
        undefined,
        `BONUS:${order.orderId}`
      );
      if (!payout.success) {
        await releaseClaim(order.orderId);
        return { ok: false, error: payout.error ?? 'On-chain payout failed' };
      }
      txHash = payout.txHash;
    } catch (error) {
      await releaseClaim(order.orderId);
      const message = error instanceof Error ? error.message : 'On-chain payout failed';
      return { ok: false, error: message };
    }
  }

  const distribution = await recordTokenDistribution(
    order.orderId,
    amountZion,
    order.customerEmail,
    txHash
  );

  sendTokenBonusEmail({
    orderId: order.orderId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    tokens: amountZion,
    txHash: distribution.txHash,
  }).catch((err) => console.error('Failed to send token bonus email:', err));

  return {
    ok: true,
    txHash: distribution.txHash,
    tokens: amountZion,
  };
}
