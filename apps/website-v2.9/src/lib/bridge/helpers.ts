/**
 * Shared bridge API logic used by both /api/bridge/* and /api/blockchain/bridge/* routes.
 */

import { coreUrl } from '@/lib/core-endpoints';
import { getZionRpc } from '@/lib/zion-rpc';
import { BRIDGE_VALIDATORS } from '@/lib/defi-contracts';
import { NextResponse } from 'next/server';
import {
  mapWarpTransfer,
  mergeBridgeTransactions,
  relayIsOnline,
  type BridgeActivity,
} from '@/lib/bridge/live';

// ── Bridge status helpers ────────────────────────────────────────────────────

export function getBridgeMetricsUrl(): string {
  const envVar = process.env['BRIDGE_' + 'METRICS_' + 'URL'];
  return coreUrl('bridgeMetrics', envVar) + '/metrics';
}

function parsePrometheus(text: string, name: string): number {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith(name) && !line.startsWith('#')) {
      const parts = line.trim().split(/\s+/);
      const val = parseFloat(parts[parts.length - 1]);
      return isNaN(val) ? 0 : val;
    }
  }
  return 0;
}

const canonicalBridgeState = {
  online: false,
  uptime_seconds: 0,
  last_l1_height: 0,
  last_evm_block: 0,
  l1_locks_detected: 0,
  l1_locks_finalized: 0,
  evm_mints_submitted: 0,
  evm_mints_confirmed: 0,
  evm_burns_detected: 0,
  l1_unlocks_submitted: 0,
  l1_unlocks_confirmed: 0,
  errors_total: 0,
  l1_vault_address: 'zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7',
  bridge_e2e_confirmed: true,
  bridge_e2e_burn_tx: '0x70ad4d93ee3922210ae2783fed5af1c34bfe6080fb01089b18572e0ceaa8a719',
  bridge_e2e_unlock_block: 20919,
  validator_threshold: `${BRIDGE_VALIDATORS.length}/${BRIDGE_VALIDATORS.length}`,
  validator_count: BRIDGE_VALIDATORS.length,
  validators: BRIDGE_VALIDATORS,
  chains_active: 1,
  chains: ['Base'],
  wzion_address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  bridge_contract: '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467',
};

export async function getBridgeStatusResponse() {
  try {
    const url = getBridgeMetricsUrl();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
    });

    if (res.ok) {
      const text = await res.text();
      const uptimeSeconds = parsePrometheus(text, 'zion_bridge_uptime_seconds');
      const lastL1Height = parsePrometheus(text, 'zion_bridge_last_l1_height');
      return NextResponse.json(
        {
          ...canonicalBridgeState,
          online: relayIsOnline(uptimeSeconds, lastL1Height),
          uptime_seconds: uptimeSeconds,
          last_l1_height: lastL1Height,
          last_evm_block: parsePrometheus(text, 'zion_bridge_last_evm_block'),
          l1_locks_detected: parsePrometheus(text, 'zion_bridge_l1_locks_detected_total'),
          l1_locks_finalized: parsePrometheus(text, 'zion_bridge_l1_locks_finalized_total'),
          evm_mints_submitted: parsePrometheus(text, 'zion_bridge_evm_mints_submitted_total'),
          evm_mints_confirmed: parsePrometheus(text, 'zion_bridge_evm_mints_confirmed_total'),
          evm_burns_detected: parsePrometheus(text, 'zion_bridge_evm_burns_detected_total'),
          l1_unlocks_submitted: parsePrometheus(text, 'zion_bridge_l1_unlocks_submitted_total'),
          l1_unlocks_confirmed: parsePrometheus(text, 'zion_bridge_l1_unlocks_confirmed_total'),
          errors_total: parsePrometheus(text, 'zion_bridge_errors_total'),
          validator_threshold: `${canonicalBridgeState.validator_count}/${canonicalBridgeState.validator_count}`,
          validators: canonicalBridgeState.validators,
          relay_metrics_online: true,
          fetched_at: Date.now(),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }
  } catch {
    /* Relay offline — still return canonical bridge state */
  }

  return NextResponse.json(
    { ...canonicalBridgeState, relay_metrics_online: false, fetched_at: Date.now() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

// ── Bridge transactions helpers ──────────────────────────────────────────────

const BRIDGE_FINALITY_THRESHOLD = 60;

export type BridgeLockTransaction = BridgeActivity;

async function loadRecentLocks(chainHeight: number, scanDepth: number): Promise<BridgeActivity[]> {
  const rpc = getZionRpc();
  const fromHeight = Math.max(0, chainHeight - scanDepth);
  let result: { locks?: Array<Record<string, unknown>> } | null = null;
  try {
    result = await rpc.rpcCall<{ locks?: Array<Record<string, unknown>> }>('getBridgeLocks', {
      from_height: fromHeight,
      to_height: chainHeight,
    });
  } catch (lockErr) {
    console.warn('getBridgeLocks RPC not available or failed:', lockErr);
    return [];
  }

  return (result?.locks ?? []).map((lock) => {
    const blockHeight = Number(lock.block_height ?? 0);
    const confirmations = chainHeight - blockHeight;
    const finalized = confirmations >= BRIDGE_FINALITY_THRESHOLD;
    return {
      txid: String(lock.txid ?? ''),
      block_height: Number.isFinite(blockHeight) ? blockHeight : 0,
      sender: String(lock.sender ?? ''),
      recipient_chain: String(lock.recipient_chain ?? 'Base'),
      recipient: String(lock.recipient ?? ''),
      amount_zion: String(lock.amount_zion ?? '0'),
      amount_flowers: Number(lock.amount_flowers ?? 0),
      memo: String(lock.memo ?? ''),
      confirmations,
      finalized,
      status: finalized ? 'finalized' as const : 'pending' as const,
      direction: 'lock' as const,
    };
  }).filter((tx) => tx.txid);
}

/** Server-side read of warpd. The public /api/warp proxy stays key-gated. */
async function loadWarpTransfers(): Promise<BridgeActivity[]> {
  const base = coreUrl('warp', process.env.ZION_WARP_API_URL).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/transfers`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = await res.json() as { data?: unknown };
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return rows
      .map((row) => mapWarpTransfer(row, BRIDGE_FINALITY_THRESHOLD))
      .filter((tx): tx is BridgeActivity => tx !== null);
  } catch (err) {
    console.warn('WARP transfer list unavailable:', err);
    return [];
  }
}

export async function getBridgeTransactionsResponse(request: { searchParams: URLSearchParams }) {
  try {
    const limit = Math.min(parseInt(request.searchParams.get('limit') || '50'), 200);
    const scanDepth = Math.min(parseInt(request.searchParams.get('scan_depth') || '500'), 2000);

    let chainHeight = 0;
    let chainFailed = false;
    try {
      const info = await getZionRpc().getInfo();
      chainHeight = info.height ?? 0;
    } catch (error) {
      chainFailed = true;
      console.warn('bridge chain height unavailable:', error);
    }

    const locks = chainHeight > 0 ? await loadRecentLocks(chainHeight, scanDepth) : [];
    const warp = await loadWarpTransfers();
    if (chainFailed && warp.length === 0 && locks.length === 0) {
      return NextResponse.json(
        { transactions: [], error: 'Failed to fetch bridge transactions' },
        { status: 503 },
      );
    }

    const transactions = mergeBridgeTransactions(locks, warp, limit);
    return NextResponse.json(
      {
        transactions,
        chain_height: chainHeight,
        total_detected: transactions.length,
        lock_count: locks.length,
        warp_count: warp.length,
        finality_threshold: BRIDGE_FINALITY_THRESHOLD,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Failed to fetch bridge transactions:', error);
    return NextResponse.json(
      { transactions: [], error: 'Failed to fetch bridge transactions' },
      { status: 503 },
    );
  }
}
