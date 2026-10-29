/**
 * Hiran MetaMask / Base USDC helpers.
 */

import { createHash } from 'crypto';
import { parseAbiItem, parseEventLogs } from 'viem';
import { getPublicClient } from '@/lib/server-chain';
import { createMarketApiKey } from '@/lib/zis';
import type { HiranCaller } from '@/lib/hiran-auth';

/** Base mainnet native USDC */
export const DEFAULT_USDC =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

export function usdcConfig(plan: 'pro' | 'team'): {
  amount: string;
  token: string;
  treasury: string;
  chainId: number;
} {
  const treasury = process.env.HIRAN_TREASURY_ADDRESS?.trim();
  if (!treasury) {
    throw new Error('HIRAN_TREASURY_ADDRESS not configured');
  }
  const amount =
    plan === 'pro'
      ? process.env.HIRAN_USDC_PRO?.trim()
      : process.env.HIRAN_USDC_TEAM?.trim();
  if (!amount || !/^\d+$/.test(amount)) {
    throw new Error(`HIRAN_USDC_${plan.toUpperCase()} not configured`);
  }
  const token = (process.env.HIRAN_USDC_ADDRESS?.trim() || DEFAULT_USDC).toLowerCase();
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453');
  return { amount, token, treasury: treasury.toLowerCase(), chainId };
}

export async function resolveKeyHash(caller: HiranCaller): Promise<{
  keyHash: string;
  apiKey?: string;
}> {
  if (caller.keyHash) {
    return { keyHash: caller.keyHash, apiKey: caller.apiKey ?? undefined };
  }
  const created = await createMarketApiKey(`hiran-crypto-${Date.now()}`);
  return {
    keyHash: createHash('sha256').update(created.apiKey).digest('hex'),
    apiKey: created.apiKey,
  };
}

export async function verifyUsdcTransfer(opts: {
  txHash: `0x${string}`;
  token: string;
  to: string;
  amount: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getPublicClient();
  try {
    const receipt = await client.getTransactionReceipt({ hash: opts.txHash });
    if (!receipt || receipt.status !== 'success') {
      return { ok: false, error: 'Transaction not successful' };
    }
    const token = opts.token.toLowerCase();
    const to = opts.to.toLowerCase();
    const want = BigInt(opts.amount);

    const transfers = parseEventLogs({
      abi: [TRANSFER_EVENT],
      logs: receipt.logs,
      eventName: 'Transfer',
    });

    const match = transfers.find((log) => {
      if (log.address.toLowerCase() !== token) return false;
      const logTo = (log.args.to as string | undefined)?.toLowerCase();
      const value = log.args.value as bigint | undefined;
      return logTo === to && value !== undefined && value >= want;
    });

    if (!match) {
      return { ok: false, error: 'No matching USDC Transfer to treasury' };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'RPC verify failed',
    };
  }
}

/** Call gateway admin set-plan. */
export async function gatewaySetPlan(
  keyHash: string,
  plan: string,
): Promise<{ ok: boolean; error?: string }> {
  const adminKey = process.env.HIRAN_ADMIN_KEY?.trim();
  if (!adminKey) {
    return { ok: false, error: 'HIRAN_ADMIN_KEY not configured on MarketPlace' };
  }
  const url =
    process.env.HIRAN_GATEWAY_ADMIN_URL?.trim() ||
    'https://market.zionterranova.com/v1/admin/plan';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({ key: keyHash, plan }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `gateway ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'gateway unreachable',
    };
  }
}
