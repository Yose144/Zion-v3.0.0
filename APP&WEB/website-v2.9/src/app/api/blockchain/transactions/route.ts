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
    const offset = parseInt(searchParams.get('offset') || '0');
    const address = searchParams.get('address') || '';
    const txHash = normalizeTxHash(searchParams.get('hash') || searchParams.get('tx_hash') || '');

    // ── Single TX lookup by hash ──
    if (txHash) {
      try {
        const txs = await rpc.getTransactions([txHash]);
        if (txs.length > 0) {
          const tx = txs[0];
          // V3 account-model: amount_zion is string (flowers), fee_zion is number (flowers)
          const amountZion = tx.amount_zion ? Number(tx.amount_zion) / ATOMIC_UNITS_PER_ZION : 0;
          const feeZion = (tx.fee_zion ?? tx.fee ?? 0) / ATOMIC_UNITS_PER_ZION;

          // Fetch block timestamp from the block if tx is confirmed
          let blockTimestamp = tx.block_timestamp ?? 0;
          if (!blockTimestamp && tx.block_height > 0) {
            try {
              const block = await rpc.getBlock(tx.block_height);
              blockTimestamp = block?.timestamp ?? 0;
            } catch { /* non-critical */ }
          }

          const chainInfo = await rpc.getInfo().catch(() => ({ height: 0 }));
          return NextResponse.json({
            tx_hash: tx.tx_hash,
            tx_id: tx.tx_id ?? tx.tx_hash,
            block_height: tx.block_height,
            block_timestamp: blockTimestamp,
            in_pool: tx.in_pool,
            // V3 account-model fields
            from: tx.from ?? '',
            to: tx.to ?? '',
            amount: amountZion,
            amount_zion: tx.amount_zion ?? '',
            fee: feeZion,
            fee_zion: tx.fee_zion ?? 0,
            nonce: tx.nonce ?? 0,
            signature: tx.signature ?? '',
            public_key: tx.public_key ?? '',
            transaction_model: tx.transaction_model ?? 'hybrid',
            // Legacy fields for backward compat
            version: tx.version,
            unlock_time: tx.unlock_time,
            inputs: [],
            outputs: [],
            extra: tx.extra,
            confirmations: tx.block_height > 0 ? chainInfo.height - tx.block_height : 0,
            status: tx.in_pool ? 'pending' : 'confirmed',
          });
        }
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      } catch (err: any) {
        return NextResponse.json({ error: `TX lookup failed: ${err.message}` }, { status: 503 });
      }
    }

    // ── Address-specific transactions (from on-chain RPC) ──
    if (address) {
      try {
        const history = await rpc.getTransactionHistory(address, limit, offset);
        const transactions = history.transactions.map((tx) => {
          const isCoinbase = tx.from === 'coinbase';
          const amountZion = Number(tx.amount_zion) / ATOMIC_UNITS_PER_ZION;
          const feeZion = Number(tx.fee_zion) / ATOMIC_UNITS_PER_ZION;
          return {
            tx_hash: tx.tx_id,
            type: isCoinbase ? 'coinbase' : 'transfer',
            from: tx.from,
            to: tx.to,
            amount: amountZion,
            amount_zion: tx.amount_zion,
            fee: feeZion,
            fee_zion: tx.fee_zion,
            nonce: tx.nonce,
            block_height: tx.block_height,
            timestamp: tx.timestamp,
            status: tx.confirmed ? 'confirmed' : 'pending',
            confirmations: tx.block_height > 0 ? 1 : 0, // approx; chain height not fetched here
            transaction_model: tx.tx_model,
          };
        });

        return NextResponse.json({
          transactions,
          items: transactions,
          count: transactions.length,
          total: history.total,
          has_more: history.has_more,
        });
      } catch {
        return NextResponse.json({ transactions: [], items: [], count: 0 });
      }
    }

    // ── Recent transactions from latest blocks ──
    const info = await rpc.getInfo();
    const chainHeight = info.height;

    // Get V3 account-model transactions (non-coinbase) from recent blocks
    const v3Txs = await rpc.getRecentV3Transactions(limit).catch(() => []);

    const allTxs: any[] = [];

    // Add V3 account-model transactions first (most interesting to users)
    for (const tx of v3Txs) {
      allTxs.push({
        tx_hash: tx.tx_id,
        type: 'transfer',
        from: tx.from,
        to: tx.to,
        amount: Number(tx.amount_zion) / ATOMIC_UNITS_PER_ZION,
        amount_zion: tx.amount_zion,
        fee: tx.fee_zion / ATOMIC_UNITS_PER_ZION,
        fee_zion: tx.fee_zion,
        nonce: tx.nonce,
        block_height: tx.block_height,
        timestamp: tx.timestamp,
        status: 'confirmed',
        confirmations: chainHeight - tx.block_height,
        transaction_model: 'account',
      });
      if (allTxs.length >= limit) break;
    }

    // Add coinbase transactions from recent blocks
    const endHeight = Math.max(0, chainHeight);
    const startHeight = Math.max(0, endHeight - 9); // Scan last 10 blocks for coinbase
    const headers = await rpc.getBlockHeaders(startHeight, endHeight);

    for (const header of headers.reverse()) {
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
