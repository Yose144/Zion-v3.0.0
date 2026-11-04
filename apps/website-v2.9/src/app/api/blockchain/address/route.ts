/**
 * ZION Explorer — Address API
 *
 * Returns address info combining on-chain data (balances, UTXOs, tx history)
 * with pool-side mining stats.
 *
 * Performance contract (why this file is defensive):
 *  - `getUtxos` MUST be paged. Without `limit` the native node returns the
 *    whole UTXO set — a pool payout wallet holds ~130k outputs = 27 MB and
 *    >10 s per call. That used to exceed the 8 s RPC timeout, which then made
 *    the route report a 0 balance after ~26 s and (under load) surface to
 *    users as a gateway error.
 *  - Every sub-fetch is bounded, because mining stats (pool HTTP + chain
 *    payout scan) and tx-history attribution are secondary data: a slow leg
 *    degrades the response, it never hangs the page.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { KNOWN_ADDRESS_MAP } from '@/lib/explorer/known-addresses';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';

const ADDRESS_PAGE_BUDGET_MS = 9_000;
const MINER_BUDGET_MS = 4_500;
const HISTORY_BUDGET_MS = 7_000;
const ATTRIBUTION_BUDGET_MS = 5_000;
const ATTRIBUTION_CONCURRENCY = 10;

/** Resolve with `fallback` when `promise` is slower than `ms` (never rejects). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(fallback); }
    }, ms);
    promise.then(
      (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); } },
    );
  });
}

interface AddressValidation {
  address?: string;
  error?: string;
  hint?: string;
}

/** Reject pasted/truncated strings (e.g. "zion1abc…def") before they reach
 *  the node — the search box happily passes ellipsis-decorated text. */
function validateAddress(raw: string): AddressValidation {
  const address = raw.trim();
  if (!address) {
    return { error: 'Address required', hint: 'Použij ?addr=zion1... nebo ?address=zion1...' };
  }
  if (/[…]/.test(address) || address.includes('...') || /\s/.test(address)) {
    return {
      error: 'Address looks truncated',
      hint:
        'Vložená adresa obsahuje výpustku nebo mezeru. Zkopíruj celou adresu (zion1…, 44+ znaků).',
    };
  }
  if (!/^[A-Za-z0-9]+$/.test(address)) {
    return {
      error: 'Invalid address characters',
      hint: 'ZION adresa obsahuje jen písmena a číslice (zion1…).',
    };
  }
  const isUtxo = /^zion1[0-9a-z]{30,64}$/i.test(address);
  const isAccount = /^[A-Za-z][A-Za-z0-9]{30,70}$/.test(address);
  if (!isUtxo && !isAccount) {
    return {
      error: 'Invalid ZION address',
      hint: 'Adresa musí začínat "zion1" a mít alespoň 34 znaků.',
    };
  }
  return { address };
}

// Pool PPLNS unpaid is pool-side accounting — the node RPC does not know it.
// Public endpoint: /public/v1/miner/<coin>/<wallet> → { unpaid: "<flowers>" }.
async function fetchPoolUnpaid(address: string, timeoutMs = 4000): Promise<number | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${SITE_PRIMARY_POOL_API_URL.replace(/\/$/, '')}/public/v1/miner/zion/${address}`,
      { cache: 'no-store', signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const unpaid = Number(j?.unpaid ?? 0);
    return Number.isFinite(unpaid) ? unpaid / ATOMIC_UNITS_PER_ZION : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch tx outputs for a bounded page of transactions, with concurrency + a
 *  hard overall budget. Returns a map keyed by tx hash. */
async function fetchAttributionDetails(
  rpc: ReturnType<typeof getZionRpc>,
  txHashes: string[],
): Promise<Map<string, any[]>> {
  const unique = Array.from(new Set(txHashes.filter(Boolean)));
  const map = new Map<string, any[]>();

  const work = (async () => {
    for (let i = 0; i < unique.length; i += ATTRIBUTION_CONCURRENCY) {
      const batch = unique.slice(i, i + ATTRIBUTION_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (txid) => {
          const detail = await withTimeout(
            rpc.rpcCall<any>('getTransaction', { txid }).catch(() => null),
            4_000,
            null,
          );
          return [txid, Array.isArray(detail?.transaction?.outputs) ? detail.transaction.outputs : []] as const;
        }),
      );
      for (const [txid, outputs] of results) {
        if (outputs.length > 0) map.set(txid, outputs);
      }
    }
    return map;
  })();

  return withTimeout(work, ATTRIBUTION_BUDGET_MS, map);
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawAddress = searchParams.get('addr') || searchParams.get('address') || '';

    const validation = validateAddress(rawAddress);
    if (!validation.address) {
      return NextResponse.json(
        { error: validation.error, hint: validation.hint, code: 'invalid_address', address: rawAddress },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const address = validation.address;

    // Fetch blockchain balance (authoritative) + pool mining stats + on-chain TXs
    // + pool PPLNS unpaid in parallel. Secondary legs are bounded.
    const [walletSnapshot, minerData, txHistory, poolUnpaid] = await Promise.all([
      withTimeout(rpc.getWalletSnapshot(address).catch(() => null), ADDRESS_PAGE_BUDGET_MS, null),
      withTimeout(rpc.getMinerInfo(address).catch(() => null), MINER_BUDGET_MS, null),
      withTimeout(rpc.getTransactionHistory(address, 50, 0).catch(() => null), HISTORY_BUDGET_MS, null),
      fetchPoolUnpaid(address),
    ]);

    // No chain data at all → the node is down/slow. Never answer with a
    // fabricated zero balance (that is how a 0-ZION whale wallet was shown).
    if (!walletSnapshot && !txHistory && !minerData) {
      return NextResponse.json(
        {
          error: 'Blockchain node is temporarily unavailable',
          hint: 'Zkus to prosím za okamžik znovu.',
          code: 'node_unavailable',
          address,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Build address info — chain balance is the real balance
    const balanceZion = walletSnapshot?.balance_zion ?? 0;
    const balanceAtomic = walletSnapshot?.balance_atomic ?? 0;
    const utxoCount = walletSnapshot?.utxo_count ?? 0;

    const balance = {
      total: balanceZion,
      total_atomic: balanceAtomic,
      utxo_count: utxoCount,
      // Pool sub-balances — pool API unpaid is authoritative for PPLNS;
      // node-side balance.pending is only a fallback (usually 0).
      pool_pending: poolUnpaid ?? (minerData?.balance?.pending || 0),
      pool_locked: minerData?.balance?.locked || 0,
      pool_paid: minerData?.balance?.paid || 0,
    };

    // UTXO list (for zion1 addresses) — paged by the RPC client.
    const utxoList = walletSnapshot?.utxos ?? [];

    // Build address transaction history.
    // Priority 1: on-chain transaction history (account-model).
    // Priority 2: UTXO-derived received transactions (v31-native UTXO).
    // Priority 3: pool payouts as legacy fallback.
    let transactions: any[];
    let totalReceived: number;
    let totalSent = 0;
    let attributionPartial = false;

    // `to`/`from` are comma-joined lists of every distinct output/input
    // address on a UTXO transaction (e.g. "zion1abc..., zion1def..."), not a
    // single address — an exact `===` match against `address` therefore
    // almost never matches multi-output transfers. Use `includes()` against
    // the individual comma-separated entries instead.
    const involvesAddress = (field: string | undefined) =>
      !!field && field.split(',').map((a) => a.trim()).includes(address);

    if (txHistory && txHistory.transactions.length > 0) {
      transactions = txHistory.transactions.map((tx) => {
        const isCoinbase = tx.from === 'coinbase';
        const amountZion = Number(tx.amount_zion) / 1_000_000;
        return {
          tx_hash: tx.tx_id,
          type: isCoinbase ? 'coinbase' : 'transfer',
          from: tx.from,
          to: tx.to,
          amount: amountZion,
          fee: Number(tx.fee_zion) / 1_000_000,
          timestamp: tx.timestamp,
          block_height: tx.block_height,
          status: tx.confirmed ? 'confirmed' : 'pending',
        };
      });

      // Per-output attribution: txHistory.amount_zion is the WHOLE tx sum,
      // which overstates amounts on multi-output txs (coinbase 89/5/5/1
      // splits, genesis premine). Keep only this address's share.
      const details = await fetchAttributionDetails(
        rpc,
        transactions.map((tx) => tx.tx_hash),
      );
      if (details.size < transactions.filter((tx) => tx.tx_hash).length) attributionPartial = true;

      transactions.forEach((tx) => {
        const outs = details.get(tx.tx_hash);
        if (!Array.isArray(outs) || outs.length === 0) return;
        const toMe = outs
          .filter((o: any) => (o?.address?.encoded ?? o?.address) === address)
          .reduce((s: number, o: any) => s + Number(o?.amount ?? 0), 0) / 1_000_000;
        const allOut = outs.reduce((s: number, o: any) => s + Number(o?.amount ?? 0), 0) / 1_000_000;
        if (involvesAddress(tx.to)) {
          tx.amount = toMe;
        } else if (involvesAddress(tx.from)) {
          // Outgoing: amount that left this address = all outputs minus
          // outputs that came back (UTXO change).
          tx.amount = Math.max(0, allOut - toMe);
        }
      });
      totalReceived = transactions
        .filter((tx) => involvesAddress(tx.to))
        .reduce((sum, tx) => sum + tx.amount, 0);
      totalSent = transactions
        .filter((tx) => tx.type !== 'coinbase' && involvesAddress(tx.from))
        .reduce((sum, tx) => sum + tx.amount, 0);
    } else if (utxoList.length > 0 && address.startsWith('zion1')) {
      // V31-native UTXO: each UTXO corresponds to a received output.
      const utxoTxs = utxoList.map((u: any) => {
        const isCoinbase = u.output_index === 0;
        return {
          tx_hash: u.tx_hash,
          type: isCoinbase ? 'coinbase' : 'transfer',
          from: isCoinbase ? 'coinbase' : '',
          to: u.address || address,
          amount: Number(u.amount) / 1_000_000,
          fee: 0,
          timestamp: u.timestamp ?? 0,
          block_height: u.height ?? 0,
          status: 'confirmed',
          output_index: u.output_index ?? 0,
        };
      });
      // Sort newest first by timestamp/height.
      transactions = utxoTxs.sort((a: any, b: any) => (b.timestamp || b.block_height) - (a.timestamp || a.block_height));
      totalReceived = utxoList.reduce((sum: number, u: any) => sum + Number(u.amount ?? 0), 0) / 1_000_000;
    } else {
      const payouts = minerData?.recent_payouts || [];
      transactions = payouts.map((p: any, idx: number) => ({
        tx_hash: p.tx_id || `payout_${p.timestamp || idx}`,
        type: 'payout',
        from: 'Pool',
        to: address,
        amount: p.amount_zion ?? p.amount ?? 0,
        fee: 0,
        timestamp: p.timestamp || 0,
        status: p.status || 'confirmed',
      }));
      totalReceived = transactions.reduce((sum: number, tx: any) => sum + tx.amount, 0);
    }

    // `total_received`/`total_sent` are sums over the fetched transaction
    // window only (the node's getTransactionHistory scans the whole chain per
    // call, so lifetime sums aren't computable per request). `totals_scope`
    // tells the UI whether the window covers the full history.
    const txTotal = (txHistory && txHistory.total > 0)
      ? txHistory.total
      : (utxoCount > 0 ? utxoCount : transactions.length);
    const totalsWindow = transactions.length;
    const totalsScope: 'lifetime' | 'window' =
      totalsWindow >= txTotal ? 'lifetime' : 'window';

    const knownAddress = KNOWN_ADDRESS_MAP.get(address);
    const isMiner = !!minerData && (
      (minerData.hashrate_1h ?? 0) > 0 ||
      (minerData.accepted_shares ?? 0) > 0 ||
      (minerData.blocks_found ?? 0) > 0 ||
      (minerData.first_seen ?? 0) > 0 ||
      (minerData.worker_name && minerData.worker_name !== 'default')
    );

    const timestamps = utxoList.map((u: any) => u.timestamp ?? 0).filter((t: number) => t > 0);
    const firstSeen = minerData?.first_seen || (timestamps.length ? Math.min(...timestamps) : 0);
    const lastSeen = minerData?.last_seen || (timestamps.length ? Math.max(...timestamps) : 0);

    const addressInfo = {
      address,
      known_label: knownAddress?.label || null,
      known_type: knownAddress?.type || null,
      balance,
      total_received: totalReceived,
      total_sent: totalSent,
      totals_scope: totalsScope,
      totals_window: totalsWindow,
      net_balance: balanceZion,
      transaction_count: txTotal,
      first_seen: firstSeen,
      last_seen: lastSeen,

      // Degradation flags — the UI can say "partial data" instead of lying.
      partial: !walletSnapshot || !txHistory || attributionPartial,
      utxos_truncated: walletSnapshot?.utxos_truncated ?? false,
      chain_height: walletSnapshot?.chain_height ?? 0,

      // Mining stats (ZION-specific)
      is_miner: isMiner,
      mining_stats: isMiner && minerData ? {
        blocks_found: minerData.blocks_found || 0,
        accepted_shares: minerData.accepted_shares || 0,
        rejected_shares: minerData.rejected_shares || 0,
        worker_name: minerData.worker_name || 'default',
        hashrate_1h: minerData.hashrate_1h || 0,
        hashrate_formatted: formatHashrate(minerData.hashrate_1h || 0),
        consciousness_level: minerData.consciousness_level || 'PHYSICAL',
        consciousness_multiplier: minerData.consciousness_multiplier || 1.0,
      } : null,

      // Transactions
      transactions: transactions.slice(0, 50),
      recent_transactions: transactions.slice(0, 10),

      // UTXO list — already paged by the RPC client (default 200). Active
      // pool/mining wallets hold tens of thousands of outputs; serializing
      // all of them stalls the page.
      utxos: utxoList.slice(0, 200),
      transaction_model: walletSnapshot?.transaction_model ?? (address.startsWith('zion1') ? 'utxo' : 'account'),
    };

    return NextResponse.json(addressInfo, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Failed to fetch address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address info', code: 'internal_error' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} kH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}
