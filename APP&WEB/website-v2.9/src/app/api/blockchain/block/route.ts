/**
 * ZION Explorer — Single Block API
 * 
 * Fetches full block details from daemon RPC.
 * Supports lookup by height or hash.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, BLOCK_REWARD_ZION, POOL_FEE_PCT } from '@/lib/constants';
import { KNOWN_ADDRESS_MAP } from '@/lib/explorer/known-addresses';

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const height = searchParams.get('height') || searchParams.get('id');
    const hash = searchParams.get('hash');

    if (!height && !hash) {
      return NextResponse.json({ error: 'Block height or hash required' }, { status: 400 });
    }

    // Get current chain height for confirmations
    const info = await rpc.getInfo();

    // Fetch full block
    let block;
    if (height && /^\d+$/.test(height)) {
      block = await rpc.getBlock(parseInt(height));
    } else if (hash) {
      block = await rpc.getBlock(hash);
    } else if (height) {
      // Could be a hash passed as 'id'
      block = await rpc.getBlock(height);
    }

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Extract miner address from V3 block fields
    let minerAddress = block.miner_address || '';
    let baseReward = (block as any).miner_reward_zion ?? (block as any).subsidy_zion ?? block.reward ?? 0;

    // Build transaction list from V3 transactions array (already in block response)
    const txs: any[] = [];
    const v3Txs = block.v3_transactions ?? [];

    if (v3Txs.length > 0) {
      // Use the transactions array directly from the V3 RPC response
      for (const tx of v3Txs as any[]) {
        const isCoinbase = tx.from === 'coinbase';
        const amountAtomic = Number(tx.amount_zion ?? 0);
        const feeAtomic = Number(tx.fee_zion ?? 0);

        // Build a human-readable from/to summary from UTXO inputs/outputs
        const fromAddrs = (tx.inputs || [])
          .map((i: any) => i.address)
          .filter((a: any) => typeof a === 'string' && a.startsWith('zion1'));
        const uniqueFrom = Array.from(new Set(fromAddrs)).join(', ') || (isCoinbase ? 'coinbase' : '');

        const toAddrs = (tx.outputs || [])
          .map((o: any) => o.address || o.key)
          .filter((a: any) => typeof a === 'string' && a.startsWith('zion1'));
        const uniqueTo = Array.from(new Set(toAddrs)).join(', ') || tx.to || '';

        txs.push({
          tx_hash: tx.tx_id,
          type: isCoinbase ? 'coinbase' : 'transfer',
          fee: feeAtomic / ATOMIC_UNITS_PER_ZION,
          amount: amountAtomic / ATOMIC_UNITS_PER_ZION,
          timestamp: block.timestamp,
          from: uniqueFrom,
          to: uniqueTo,
          amount_zion: tx.amount_zion,
          fee_zion: feeAtomic,
          nonce: tx.nonce,
          signature: tx.signature,
          public_key: tx.public_key,
          transaction_model: 'v31-native',
          inputs: isCoinbase
            ? [{ type: 'coinbase', height: block.height }]
            : (tx.inputs || []).map((i: any) => ({
                type: i.type,
                amount: i.amount || 0,
                key_image: i.key_image || i.previous_output || '',
                previous_output: i.previous_output || '',
                address: i.address || '',
              })),
          outputs: Array.isArray(tx.outputs) && tx.outputs.length > 0
            ? tx.outputs.map((o: any) => ({
                amount: (o.amount || 0) / ATOMIC_UNITS_PER_ZION,
                key: o.address || o.key || '',
                address: o.address || o.key || '',
              }))
            : [{
                amount: amountAtomic / ATOMIC_UNITS_PER_ZION,
                key: uniqueTo,
                address: uniqueTo,
              }],
        });
      }
    } else {
      // Fallback: synthesize coinbase TX from block fields
      txs.push({
        tx_hash: block.miner_tx_hash || `coinbase_${block.height}`,
        type: 'coinbase',
        fee: 0,
        amount: block.reward ? block.reward / ATOMIC_UNITS_PER_ZION : baseReward / ATOMIC_UNITS_PER_ZION,
        timestamp: block.timestamp,
        inputs: [{ type: 'coinbase', height: block.height }],
        outputs: (block.miner_tx?.vout || []).map((out: any) => ({
          amount: out.amount / ATOMIC_UNITS_PER_ZION,
          key: out.target?.key || '',
        })),
      });

      // Regular transactions (fetch details if hashes present)
      if (block.tx_hashes && block.tx_hashes.length > 0) {
        try {
          const txDetails = await rpc.getTransactions(block.tx_hashes);
          for (const tx of txDetails) {
            const totalOut = tx.vout.reduce((sum, out) => sum + (out.amount || 0), 0);
            txs.push({
              tx_hash: tx.tx_hash,
              type: 'transfer',
              fee: tx.fee / ATOMIC_UNITS_PER_ZION,
              amount: totalOut / ATOMIC_UNITS_PER_ZION,
              timestamp: tx.block_timestamp || block.timestamp,
              inputs: tx.vin.map((input: any) => ({
                type: input.key ? 'key' : 'coinbase',
                amount: input.key?.amount ? input.key.amount / ATOMIC_UNITS_PER_ZION : 0,
                key_image: input.key?.k_image || '',
              })),
              outputs: tx.vout.map((out: any) => ({
                amount: out.amount / ATOMIC_UNITS_PER_ZION,
                key: out.target?.key || '',
              })),
            });
          }
        } catch {
          // If we can't fetch tx details, still return block with hash list
          for (const txHash of block.tx_hashes) {
            txs.push({ tx_hash: txHash, type: 'transfer', fee: 0, amount: 0 });
          }
        }
      }
    }

    const confirmations = Math.max(0, info.height - block.height);

    const blockInfo = {
      height: block.height,
      hash: block.hash,
      prev_hash: block.prev_hash || '',
      timestamp: block.timestamp,
      difficulty: block.difficulty,
      nonce: block.nonce || 0,
      reward: block.subsidy_zion ?? (block.reward ? block.reward / ATOMIC_UNITS_PER_ZION : BLOCK_REWARD_ZION),
      block_size: block.block_size || 0,
      num_txes: block.num_txes || 0,
      orphan_status: block.orphan_status || false,
      depth: block.depth || 0,
      major_version: block.major_version || 0,
      minor_version: block.minor_version || 0,
      miner_tx_hash: block.miner_tx_hash || '',
      confirmations,
      status: block.orphan_status ? 'orphaned' : 'confirmed',

      // Miner info
      miner: minerAddress,
      miner_address: minerAddress,
      miner_label: KNOWN_ADDRESS_MAP.get(minerAddress)?.label || null,
      is_pool_block: KNOWN_ADDRESS_MAP.get(minerAddress)?.type === 'pool',

      // Transactions
      tx_count: txs.length,
      txs,
      tx_hashes: block.tx_hashes || [],

      // Computed fields
      total_fees: txs.reduce((sum, tx) => sum + (tx.fee || 0), 0),
      // total_output = sum of coinbase outputs only (real new supply emitted in this block)
      total_output: txs
        .filter((tx) => tx.type === 'coinbase')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0),

      // Coinbase reward breakdown from outputs
      reward_breakdown: (() => {
        const coinbase = txs.find((tx) => tx.type === 'coinbase');
        const outs = coinbase?.outputs || [];
        const breakdown: Record<string, { address: string; amount: number; pct: number }> = {};
        for (const out of outs) {
          const addr = out.key || out.address || '';
          const known = KNOWN_ADDRESS_MAP.get(addr);
          let label = 'miner';
          if (known?.type === 'humanitarian') {
            label = 'humanitarian';
          } else if (known?.type === 'pool' || known?.label?.toLowerCase().includes('pool fee')) {
            label = 'pool_fee';
          } else if (known?.label?.toLowerCase().includes('issobella') || known?.category?.toLowerCase().includes('issobella')) {
            label = 'issobella';
          }
          breakdown[label] = { address: addr, amount: out.amount || 0, pct: 0 };
        }
        const emitted = Object.values(breakdown).reduce((s, v) => s + v.amount, 0);
        // Pool fee is burned: the difference between full subsidy and emitted coinbase outputs
        const subsidy = (block as any).subsidy_zion ?? (emitted / (1 - POOL_FEE_PCT / 100));
        const poolFee = Math.max(0, subsidy - emitted);
        if (poolFee > 0) {
          breakdown.pool_fee = { address: '', amount: poolFee, pct: 0 };
        }
        const total = Object.values(breakdown).reduce((s, v) => s + v.amount, 0);
        if (total > 0) {
          for (const v of Object.values(breakdown)) v.pct = (v.amount / total) * 100;
        }
        return breakdown;
      })(),
    };

    return NextResponse.json(blockInfo, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Failed to fetch block:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch block: ${msg}` }, { status: 503 });
  }
}
