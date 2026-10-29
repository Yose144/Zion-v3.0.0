/**
 * ZION Explorer — Transactions API
 *
 * Fetches recent transactions from blockchain blocks via RPC.
 * Also supports address-specific transaction lookup via pool API.
 *
 * Amount semantics: `amount` is the NET transferred value (outputs minus
 * change returned to the sender). `amount_gross` keeps the raw output sum.
 * For address-filtered queries `amount` is the part received by / sent from
 * that address, matching the address-page attribution.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';
import {
  changeAmountAtomic,
  markChangeOutputs,
  netAmountAtomic,
  senderAddressSet,
  totalOutputAtomic,
} from '@/lib/explorer/amount';

function normalizeTxHash(rawHash: string): string {
  const trimmed = rawHash.trim();
  return trimmed.replace(/^0x/i, '').toLowerCase();
}

const zionAddresses = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.startsWith('zion1'));

const involvesAddress = (field: string | undefined, address: string) =>
  zionAddresses(field).includes(address);

/** Net amount (atomic) for a list-view tx whose inputs are already enriched. */
function netForListTx(tx: any): { net: number; gross: number; change: number } {
  const gross = Number(tx.amount_zion ?? 0) || totalOutputAtomic(tx);
  const senders = senderAddressSet(tx);
  const change = senders.size > 0 ? changeAmountAtomic(tx, senders) : 0;
  return { net: Math.max(0, gross - change), gross, change };
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);
    const address = searchParams.get('address') || '';
    const txHash = normalizeTxHash(searchParams.get('hash') || searchParams.get('tx_hash') || '');

    // ── Single TX lookup by hash ──
    if (txHash) {
      try {
        const txs = await rpc.getTransactions([txHash]);
        if (txs.length > 0) {
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

          const senders = senderAddressSet(tx);
          const grossAtomic = tx.amount_zion ? Number(tx.amount_zion) : totalOutputAtomic(tx);
          const netAtomic = netAmountAtomic(tx);
          const changeAtomic = Math.max(0, grossAtomic - netAtomic);
          const amountZion = netAtomic / ATOMIC_UNITS_PER_ZION;
          // fee_zion is atomic; tx.fee (ZION) is the fallback for models
          // that don't carry the atomic field.
          const feeZion = tx.fee_zion != null
            ? tx.fee_zion / ATOMIC_UNITS_PER_ZION
            : (tx.fee ?? 0);

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
            from: tx.from ?? '',
            to: tx.to ?? tx.outputs?.map((o) => o.address).filter(Boolean).join(', ') ?? '',
            amount: amountZion,
            amount_zion: String(netAtomic),
            amount_gross: grossAtomic / ATOMIC_UNITS_PER_ZION,
            change: changeAtomic / ATOMIC_UNITS_PER_ZION,
            fee: feeZion,
            fee_zion: tx.fee_zion ?? 0,
            nonce: tx.nonce ?? 0,
            signature: tx.signature ?? '',
            public_key: tx.public_key ?? '',
            transaction_model: tx.transaction_model ?? 'v31-native',
            version: tx.version,
            unlock_time: tx.unlock_time,
            inputs: tx.inputs?.map((i) => ({
              type: i.type,
              amount: i.amount / ATOMIC_UNITS_PER_ZION,
              address: i.address,
              key_image: i.key_image,
              previous_output: i.previous_output,
              output_index: i.output_index,
              script: i.script,
            })) ?? [],
            outputs: markChangeOutputs(
              (tx.outputs ?? []).map((o, idx) => ({
                address: o.address,
                amount: o.amount / ATOMIC_UNITS_PER_ZION,
                key: o.key,
                index: idx,
              })),
              senders,
            ),
            extra: tx.extra,
            confirmations: tx.block_height > 0 ? Math.max(0, chainInfo.height - tx.block_height) : 0,
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
        const [history, walletSnapshot] = await Promise.all([
          rpc.getTransactionHistory(address, limit, offset),
          rpc.getWalletSnapshot(address).catch(() => null),
        ]);

        let transactions: any[];
        if (history.transactions.length > 0) {
          // Per-output attribution: history carries whole-tx sums, so fetch
          // each tx's outputs and keep only this address's share (same
          // approach as /api/blockchain/address).
          const pageTxs = history.transactions.map((tx: any) => ({
            tx,
            tx_hash: tx.tx_id ?? tx.transaction?.tx_id ?? '',
          }));
          const details = await Promise.all(
            pageTxs.map(({ tx_hash }) =>
              tx_hash
                ? rpc.rpcCall<any>('getTransaction', { txid: tx_hash }).catch(() => null)
                : Promise.resolve(null),
            ),
          );

          transactions = pageTxs.map(({ tx, tx_hash }, i) => {
            const raw = tx.transaction ?? tx;
            const isCoinbase = (raw.from ?? tx.from) === 'coinbase';
            const allOutAtomic = Number(raw.amount_zion ?? tx.amount_zion ?? 0);
            const feeZion = Number(raw.fee_zion ?? tx.fee_zion ?? 0) / ATOMIC_UNITS_PER_ZION;
            const fromField: string = raw.from ?? tx.from ?? '';
            const toField: string = raw.to ?? tx.to ?? '';

            const outs = details[i]?.transaction?.outputs;
            let toMe = 0;
            let allOut = allOutAtomic;
            if (Array.isArray(outs) && outs.length > 0) {
              toMe = outs
                .filter((o: any) => (o?.address?.encoded ?? o?.address) === address)
                .reduce((s: number, o: any) => s + Number(o?.amount ?? 0), 0);
              allOut = outs.reduce((s: number, o: any) => s + Number(o?.amount ?? 0), 0);
            }

            const isOutgoing = !isCoinbase && involvesAddress(fromField, address);
            const isIncoming = involvesAddress(toField, address);
            let amountAtomic: number;
            if (isOutgoing) {
              // Amount that left this address = outputs to others (net of own change).
              amountAtomic = Math.max(0, allOut - toMe);
            } else if (isIncoming) {
              amountAtomic = toMe > 0 ? toMe : allOutAtomic;
            } else {
              amountAtomic = allOutAtomic;
            }

            return {
              tx_hash,
              type: isCoinbase ? 'coinbase' : 'transfer',
              from: fromField,
              to: toField,
              amount: amountAtomic / ATOMIC_UNITS_PER_ZION,
              amount_zion: String(amountAtomic),
              amount_gross: allOut / ATOMIC_UNITS_PER_ZION,
              direction: isCoinbase ? 'in' : isOutgoing ? 'out' : isIncoming ? 'in' : 'related',
              fee: feeZion,
              fee_zion: Number(raw.fee_zion ?? tx.fee_zion ?? 0),
              nonce: raw.nonce ?? tx.nonce,
              block_height: tx.block_height ?? raw.block_height,
              timestamp: tx.timestamp ?? raw.timestamp,
              status: tx.confirmed === false ? 'pending' : 'confirmed',
              confirmations: tx.block_height > 0 ? 1 : 0,
              transaction_model: tx.tx_model ?? raw.transaction_model,
            };
          });
        } else if (walletSnapshot?.utxos?.length) {
          // V31-native UTXO: each UTXO corresponds to a received output
          const utxoTxs = walletSnapshot.utxos.map((u: any) => {
            const isCoinbase = u.output_index === 0;
            return {
              tx_hash: u.tx_hash,
              type: isCoinbase ? 'coinbase' : 'transfer',
              from: isCoinbase ? 'coinbase' : '',
              to: u.address || address,
              amount: Number(u.amount) / ATOMIC_UNITS_PER_ZION,
              amount_zion: String(u.amount),
              amount_gross: Number(u.amount) / ATOMIC_UNITS_PER_ZION,
              direction: 'in',
              fee: 0,
              fee_zion: 0,
              nonce: 0,
              block_height: u.height ?? 0,
              timestamp: u.timestamp ?? 0,
              status: 'confirmed',
              confirmations: u.height > 0 ? 1 : 0,
              transaction_model: 'v31-native',
            };
          });
          transactions = utxoTxs.sort((a, b) => (b.timestamp || b.block_height) - (a.timestamp || a.block_height));
        } else {
          transactions = [];
        }

        return NextResponse.json({
          transactions,
          items: transactions,
          count: transactions.length,
          total: history.total || walletSnapshot?.utxos?.length || 0,
          has_more: history.has_more || false,
        });
      } catch {
        return NextResponse.json({ transactions: [], items: [], count: 0 });
      }
    }

    // ── Recent transactions from latest blocks ──
    const info = await rpc.getInfo();
    const chainHeight = info.height;

    const recentTxs = await rpc.getRecentV3Transactions(limit, offset).catch(() => []);

    const allTxs = recentTxs.map((tx) => {
      const { net, gross, change } = netForListTx(tx);
      const senders = senderAddressSet(tx);
      return {
        tx_hash: tx.tx_hash,
        tx_id: tx.tx_hash,
        type: tx.from === 'coinbase' ? 'coinbase' : 'transfer',
        from: tx.from,
        to: tx.to,
        amount: net / ATOMIC_UNITS_PER_ZION,
        amount_zion: String(net),
        amount_gross: gross / ATOMIC_UNITS_PER_ZION,
        change: change / ATOMIC_UNITS_PER_ZION,
        fee: (tx.fee_zion ?? 0) / ATOMIC_UNITS_PER_ZION,
        fee_zion: tx.fee_zion ?? 0,
        nonce: tx.nonce ?? 0,
        block_height: tx.block_height,
        timestamp: tx.timestamp,
        status: 'confirmed',
        confirmations: Math.max(0, chainHeight - tx.block_height),
        transaction_model: tx.transaction_model ?? 'v31-native',
        inputs: tx.inputs,
        outputs: markChangeOutputs(tx.outputs ?? [], senders),
      };
    });

    return NextResponse.json({
      count: allTxs.length,
      total_tx_count: info.tx_count || 0,
      has_more: allTxs.length === limit,
      transactions: allTxs,
      items: allTxs,
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
