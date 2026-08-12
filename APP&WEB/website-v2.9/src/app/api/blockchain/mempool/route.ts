/**
 * ZION Explorer — Mempool API
 * 
 * Returns pending transactions from the mempool (transaction pool).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const [pool, info] = await Promise.all([
      rpc.getTransactionPool().catch(() => ({ count: 0, size: 0, total_fees: 0, transactions: [] })),
      rpc.getInfo().catch(() => null),
    ]);

    const transactions = pool.transactions.map((tx) => ({
      tx_hash: tx.id_hash,
      size: tx.blob_size || 0,
      fee: tx.fee / ATOMIC_UNITS_PER_ZION,
      receive_time: tx.receive_time,
      kept_by_block: tx.kept_by_block,
      double_spend_seen: tx.double_spend_seen,
      relayed: tx.relayed,
      age_seconds: Math.floor(Date.now() / 1000) - (tx.receive_time || 0),
    }));

    // Sort by receive time (newest first)
    transactions.sort((a, b) => b.receive_time - a.receive_time);

    // Stats
    const totalSize = transactions.reduce((sum, tx) => sum + tx.size, 0);
    const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0);
    const fees = transactions.map(tx => tx.fee).filter(f => f > 0);
    const minFee = fees.length ? Math.min(...fees) : 0;
    const maxFee = fees.length ? Math.max(...fees) : 0;
    const avgFee = fees.length ? totalFees / fees.length : 0;

    return NextResponse.json({
      count: pool.count,
      pool_size_bytes: totalSize,
      total_fees: totalFees,
      fee_stats: {
        min: minFee,
        max: maxFee,
        avg: avgFee,
        median: fees.length ? fees.sort((a, b) => a - b)[Math.floor(fees.length / 2)] : 0,
      },
      transactions,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10' },
    });
  } catch (error) {
    console.error('Failed to fetch mempool:', error);
    return NextResponse.json(
      { count: 0, pool_size_bytes: 0, total_fees: 0, fee_stats: { min: 0, max: 0, avg: 0, median: 0 }, transactions: [] },
      { status: 503 }
    );
  }
}
