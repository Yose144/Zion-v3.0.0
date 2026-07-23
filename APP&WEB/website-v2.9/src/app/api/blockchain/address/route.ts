/**
 * ZION Explorer — Address API
 * 
 * Returns address info combining pool API (mining stats) and blockchain data.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { KNOWN_ADDRESS_LABELS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('addr') || searchParams.get('address') || '';

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    // Fetch blockchain balance (authoritative) + pool mining stats + on-chain TXs in parallel
    const [walletSnapshot, minerData, txHistory] = await Promise.all([
      rpc.getWalletSnapshot(address).catch(() => null),
      rpc.getMinerInfo(address).catch(() => null),
      rpc.getTransactionHistory(address, 50, 0).catch(() => null),
    ]);

    // Build address info — chain balance is the real balance
    const balanceZion = walletSnapshot?.balance_zion ?? 0;
    const balanceAtomic = walletSnapshot?.balance_atomic ?? 0;
    const utxoCount = walletSnapshot?.utxo_count ?? 0;

    const balance = {
      total: balanceZion,
      total_atomic: balanceAtomic,
      utxo_count: utxoCount,
      // Pool sub-balances (pending payouts etc.)
      pool_pending: minerData?.balance?.pending || 0,
      pool_locked: minerData?.balance?.locked || 0,
      pool_paid: minerData?.balance?.paid || 0,
    };

    // UTXO list (for zion1 addresses)
    const utxoList = walletSnapshot?.utxos ?? [];

    // Use on-chain transaction history (authoritative) when available;
    // fall back to pool payouts for legacy compatibility.
    let transactions: any[];
    let totalReceived: number;
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
      totalReceived = transactions
        .filter((tx) => tx.to === address)
        .reduce((sum, tx) => sum + tx.amount, 0);
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

    const addressInfo = {
      address,
      known_label: KNOWN_ADDRESS_LABELS[address]?.label || null,
      known_type: KNOWN_ADDRESS_LABELS[address]?.type || null,
      balance,
      total_received: minerData?.balance?.paid || totalReceived,
      total_sent: 0,
      net_balance: balanceZion,
      transaction_count: txHistory?.total ?? transactions.length,
      first_seen: minerData?.first_seen || 0,
      last_seen: minerData?.last_seen || 0,

      // Mining stats (ZION-specific)
      is_miner: !!minerData,
      mining_stats: minerData ? {
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
      transactions,
      recent_transactions: transactions.slice(0, 10),

      // UTXO list
      utxos: utxoList,
      transaction_model: walletSnapshot?.transaction_model ?? (address.startsWith('zion1') ? 'utxo' : 'account'),
    };

    return NextResponse.json(addressInfo, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Failed to fetch address:', error);
    return NextResponse.json({ error: 'Failed to fetch address info' }, { status: 503 });
  }
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} kH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}
