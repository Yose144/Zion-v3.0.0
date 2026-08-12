/**
 * ZION Explorer — Single Transaction API (V4)
 *
 * Dedicated TX detail endpoint. Fetches full transaction data by hash
 * from the daemon RPC, including block context and confirmations.
 *
 * Query params:
 *   - hash (required) — transaction hash / tx_id
 *
 * Response shape matches the V4 plan §10 Transaction schema:
 *   { hash, block_height, block_hash, confirmations, timestamp, size, fee,
 *     version, type, memo, from, to, amount, inputs, outputs, raw }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, KNOWN_ADDRESS_LABELS } from '@/lib/constants';

function normalizeTxHash(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^0x/i, '').toLowerCase();
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const txHash = normalizeTxHash(searchParams.get('hash') || searchParams.get('tx') || searchParams.get('tx_hash') || '');

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash required (?hash=<txid>)' }, { status: 400 });
    }

    // Fetch TX via RPC — getTransactions handles the V3 getTransaction call
    const txs = await rpc.getTransactions([txHash]);
    if (txs.length === 0) {
      return NextResponse.json({ error: 'Transaction not found', tx_hash: txHash }, { status: 404 });
    }

    const tx = txs[0];

    // Build a human-readable from/to summary from UTXO inputs/outputs
    const fromAddrs = (tx.inputs || [])
      .map((i) => i.address)
      .filter((a): a is string => typeof a === 'string' && a.startsWith('zion1'));
    tx.from = fromAddrs.length ? Array.from(new Set(fromAddrs)).join(', ') : tx.from;

    const toAddrs = (tx.outputs || [])
      .map((o) => o.address || o.key)
      .filter((a): a is string => typeof a === 'string' && a.startsWith('zion1'));
    tx.to = toAddrs.length ? Array.from(new Set(toAddrs)).join(', ') : tx.to;

    // Fetch block timestamp if not present
    let blockTimestamp = tx.block_timestamp ?? 0;
    let blockHash = '';
    if (tx.block_height > 0) {
      try {
        const block = await rpc.getBlock(tx.block_height);
        blockTimestamp = block?.timestamp ?? blockTimestamp;
        blockHash = block?.hash ?? '';
      } catch { /* non-critical */ }
    }

    // Get chain height for confirmations
    const chainInfo = await rpc.getInfo().catch(() => ({ height: 0 }));
    const confirmations = tx.block_height > 0 ? Math.max(0, chainInfo.height - tx.block_height) : 0;

    // Determine TX type
    const isCoinbase = tx.from === 'coinbase' || (tx.inputs?.length === 0 && tx.outputs && tx.outputs.length > 0);
    const type = isCoinbase ? 'coinbase' : 'transfer';

    const amountZion = tx.amount_zion ? Number(tx.amount_zion) / ATOMIC_UNITS_PER_ZION : 0;
    const feeZion = (tx.fee_zion ?? tx.fee ?? 0) / ATOMIC_UNITS_PER_ZION;

    // Build inputs/outputs for V31-native UTXO transactions
    const inputs: Array<{ address?: string; amount: number; type: string; key_image?: string; previous_output?: string }> =
      tx.inputs?.map((i) => ({
        address: i.address,
        amount: i.amount / ATOMIC_UNITS_PER_ZION,
        type: i.type ?? (i.previous_output ? 'standard' : 'coinbase'),
        key_image: i.key_image,
        previous_output: i.previous_output,
      })) ?? [];

    const outputs: Array<{ address: string; amount: number; type: string; key?: string }> =
      tx.outputs?.map((o) => ({
        address: o.address,
        amount: o.amount / ATOMIC_UNITS_PER_ZION,
        type: 'standard',
        key: o.key,
      })) ?? [];

    // Known address labels
    const fromLabel = tx.from ? KNOWN_ADDRESS_LABELS[tx.from]?.label ?? null : null;
    const toLabel = tx.to ? KNOWN_ADDRESS_LABELS[tx.to]?.label ?? null : null;

    const result = {
      hash: tx.tx_hash ?? tx.tx_id ?? txHash,
      tx_id: tx.tx_id ?? tx.tx_hash ?? txHash,
      tx_hash: tx.tx_hash ?? tx.tx_id ?? txHash,
      block_height: tx.block_height,
      block_hash: blockHash,
      block_timestamp: blockTimestamp,
      timestamp: blockTimestamp,
      confirmations,
      in_pool: tx.in_pool ?? !confirmations,
      status: tx.in_pool ? 'pending' : (confirmations > 0 ? 'confirmed' : 'unknown'),
      amount: amountZion,
      amount_zion: tx.amount_zion ?? String(Math.round(amountZion * ATOMIC_UNITS_PER_ZION)),
      fee: feeZion,
      fee_zion: tx.fee_zion ?? 0,
      size: 0,
      from: tx.from ?? (inputs[0]?.previous_output ? `UTXO: ${inputs[0].previous_output.slice(0, 16)}…` : ''),
      to: tx.to ?? outputs[0]?.address ?? '',
      nonce: tx.nonce ?? 0,
      signature: tx.signature ?? '',
      public_key: tx.public_key ?? '',
      transaction_model: tx.transaction_model ?? 'v31-native',
      type,
      from_label: fromLabel,
      to_label: toLabel,
      inputs,
      outputs,
      version: tx.version ?? 1,
      unlock_time: tx.unlock_time ?? 0,
      extra: tx.extra ?? [],
      double_spend_seen: tx.double_spend_seen ?? false,
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch transaction: ${msg}` }, { status: 503 });
  }
}
