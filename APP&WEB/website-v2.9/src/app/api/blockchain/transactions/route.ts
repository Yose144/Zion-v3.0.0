/**
 * ZION Explorer — Transactions API
 * 
 * Fetches recent transactions from blockchain blocks via RPC.
 * Also supports address-specific transaction lookup via pool API.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, BLOCK_REWARD_ZION } from '@/lib/constants';

function normalizeTxHash(rawHash: string): string {
  const trimmed = rawHash.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^0x/i, '').toLowerCase();
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const address = searchParams.get('address') || '';
    const txHash = normalizeTxHash(searchParams.get('hash') || searchParams.get('tx_hash') || '');

    // ── Single TX lookup by hash ──
    if (txHash) {
      try {
        const txs = await rpc.getTransactions([txHash]);
        if (txs.length > 0) {
          const tx = txs[0];
          const totalOut = tx.vout.reduce((sum, out) => sum + (out.amount || 0), 0);
          return NextResponse.json({
            tx_hash: tx.tx_hash,
            block_height: tx.block_height,
            block_timestamp: tx.block_timestamp,
            in_pool: tx.in_pool,
            fee: tx.fee / ATOMIC_UNITS_PER_ZION,
            amount: totalOut / ATOMIC_UNITS_PER_ZION,
            version: tx.version,
            unlock_time: tx.unlock_time,
            inputs: tx.vin.map((input: any) => ({
              type: input.key ? 'key' : 'coinbase',
              amount: input.key?.amount ? input.key.amount / ATOMIC_UNITS_PER_ZION : 0,
              key_image: input.key?.k_image || '',
              key_offsets: input.key?.key_offsets || [],
            })),
            outputs: tx.vout.map((out: any, i: number) => ({
              amount: out.amount / ATOMIC_UNITS_PER_ZION,
              key: out.target?.key || '',
              index: tx.output_indices?.[i] || i,
            })),
            extra: tx.extra,
            confirmations: tx.block_height > 0 ? (await rpc.getInfo().catch(() => ({ height: 0 }))).height - tx.block_height : 0,
            status: tx.in_pool ? 'pending' : 'confirmed',
          });
        }
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      } catch (err: any) {
        return NextResponse.json({ error: `TX lookup failed: ${err.message}` }, { status: 503 });
      }
    }

    // ── Address-specific transactions (from pool) ──
    if (address) {
      try {
        const minerData = await rpc.getMinerInfo(address);
        const payouts = minerData.recent_payouts || [];

        const transactions = payouts.map((payout: any, index: number) => ({
          tx_hash: payout.tx_id || `payout_${payout.timestamp || index}`,
          type: 'payout',
          sender: 'Pool',
          receiver: address,
          amount: payout.amount || 0,
          fee: 0,
          timestamp: payout.timestamp || 0,
          block_height: null,
          status: payout.status || 'confirmed',
        }));

        return NextResponse.json({
          transactions,
          items: transactions,
          count: transactions.length,
        });
      } catch {
        return NextResponse.json({ transactions: [], items: [], count: 0 });
      }
    }

    // ── Recent transactions from latest blocks ──
    const info = await rpc.getInfo();
    const chainHeight = info.height;

    // Scan recent blocks for transactions
    const endHeight = Math.max(0, chainHeight - 1);
    const startHeight = Math.max(0, endHeight - 49); // Scan last 50 blocks
    const headers = await rpc.getBlockHeaders(startHeight, endHeight);

    const allTxs: any[] = [];

    // Collect all transaction hashes from recent blocks
    for (const header of headers.reverse()) {
      // Coinbase TX for every block
      allTxs.push({
        tx_hash: `coinbase_${header.height}`,
        type: 'coinbase',
        amount: header.reward ? header.reward / ATOMIC_UNITS_PER_ZION : BLOCK_REWARD_ZION,
        fee: 0,
        block_height: header.height,
        timestamp: header.timestamp,
        status: 'confirmed',
        confirmations: chainHeight - header.height,
      });

      if (allTxs.length >= limit) break;
    }

    // If blocks had non-coinbase TXs, we could fetch them here
    // For now, most blocks only have coinbase

    return NextResponse.json({
      count: allTxs.length,
      total_tx_count: info.tx_count || 0,
      transactions: allTxs.slice(0, limit),
      items: allTxs.slice(0, limit),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { count: 0, transactions: [], items: [], error: 'Failed to fetch transactions' },
      { status: 503 }
    );
  }
}
