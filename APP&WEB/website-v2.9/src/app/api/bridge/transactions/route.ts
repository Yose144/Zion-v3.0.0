/**
 * GET /api/bridge/transactions
 *
 * Fetches recent bridge lock transactions from L1 RPC `getBridgeLocks`.
 * Scans the last `scan_depth` blocks (default 500) for UTXO outputs to the
 * bridge vault address with a valid `BRIDGE:<chain>:<evm_address>` memo.
 *
 * Query params:
 *  - limit: max results (default 50, max 200)
 *  - scan_depth: how many recent blocks to scan (default 500, max 2000)
 *
 * Returns array of lock transactions with computed status based on
 * block confirmations (60-block finality threshold).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

/** Bridge finality threshold — 60 L1 blocks */
const FINALITY_THRESHOLD = 60;

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const sp = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get('limit') || '50'), 200);
    const scanDepth = Math.min(parseInt(sp.get('scan_depth') || '500'), 2000);

    // Get current chain height
    const info = await rpc.getInfo();
    const chainHeight = info.height;

    if (chainHeight <= 0) {
      return NextResponse.json({ transactions: [], chain_height: 0 });
    }

    const fromHeight = Math.max(0, chainHeight - scanDepth);
    const toHeight = chainHeight;

    // Call L1 RPC getBridgeLocks
    const result = await rpc.rpcCall<any>('getBridgeLocks', {
      from_height: fromHeight,
      to_height: toHeight,
    });

    const locks = result?.locks ?? [];

    // Transform and compute status
    const transactions = locks
      .map((lock: any) => {
        const confirmations = chainHeight - (lock.block_height ?? 0);
        const finalized = confirmations >= FINALITY_THRESHOLD;
        return {
          txid: lock.txid ?? '',
          block_height: lock.block_height ?? 0,
          sender: lock.sender ?? '',
          recipient_chain: lock.recipient_chain ?? 'Base',
          recipient: lock.recipient ?? '',
          amount_zion: lock.amount_zion ?? '0',
          amount_flowers: lock.amount_flowers ?? 0,
          memo: lock.memo ?? '',
          confirmations,
          finalized,
          status: finalized ? 'finalized' : 'pending',
          direction: 'lock' as const,
        };
      })
      .sort((a: any, b: any) => b.block_height - a.block_height)
      .slice(0, limit);

    return NextResponse.json(
      {
        transactions,
        chain_height: chainHeight,
        total_detected: locks.length,
        finality_threshold: FINALITY_THRESHOLD,
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
