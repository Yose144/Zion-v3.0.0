/**
 * ZION Explorer — Blockchain Stats API
 * 
 * Returns comprehensive network statistics from daemon RPC + pool API.
 * Direct RPC for accuracy — no more Pool-only estimates.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';
import { resolveSupplySnapshot } from '@/lib/supply';

export async function GET() {
  const rpc = getZionRpc();

  try {
    // Fetch from RPC daemon (authoritative source) + pool for mining stats
    const [info, lastBlock, poolStats] = await Promise.all([
      rpc.getInfo().catch(() => null),
      rpc.getLastBlockHeader().catch(() => null),
      rpc.getPoolStats().catch(() => null),
    ]);

    if (!info) {
      throw new Error('Cannot reach any ZION daemon');
    }

    const supply = await resolveSupplySnapshot(rpc, info.height);

    // Average block time: use daemon target (no extra block fetches)
    const avgBlockTime = info.target || 60;

    const stats = {
      // Chain
      block_height: info.height,
      top_block_hash: info.top_block_hash || '',
      difficulty: info.difficulty,
      cumulative_difficulty: info.cumulative_difficulty || 0,

      // Supply
      circulating_supply: supply.circulatingSupply,
      max_supply: supply.maxSupply,
      emission_pct: supply.emissionPct.toFixed(6),

      // Network
      network_hashrate: info.difficulty / (info.target || 60),
      network_hashrate_formatted: formatHashrate(info.difficulty / (info.target || 60)),
      target_block_time: info.target || 60,
      avg_block_time: avgBlockTime,

      // Transactions
      tx_count: info.tx_count || 0,
      tx_pool_size: info.tx_pool_size || 0,

      // Peers
      incoming_connections: info.incoming_connections_count || 0,
      outgoing_connections: info.outgoing_connections_count || 0,
      total_connections: (info.incoming_connections_count || 0) + (info.outgoing_connections_count || 0),
      white_peerlist_size: info.white_peerlist_size || 0,
      grey_peerlist_size: info.grey_peerlist_size || 0,

      // Block
      block_size_limit: info.block_size_limit || 0,
      block_size_median: info.block_size_median || 0,

      // Node info
      mainnet: info.mainnet ?? true,
      testnet: info.testnet ?? false,
      version: info.version || '',
      status: info.status || 'OK',
      start_time: info.start_time || 0,
      database_size: info.database_size || 0,

      // Alt blocks (potential forks)
      alt_blocks_count: info.alt_blocks_count || 0,

      // Mining pool (supplementary)
      pool_hashrate: poolStats?.hashrate?.pool || poolStats?.pool_hashrate || 0,
      pool_hashrate_formatted: formatHashrate(poolStats?.hashrate?.pool || poolStats?.pool_hashrate || 0),
      active_miners: poolStats?.miners?.active || poolStats?.active_miners || 0,
      total_miners: poolStats?.miners?.total || poolStats?.total_miners || 0,
      pool_blocks_found: poolStats?.blocks?.found || poolStats?.blocks_found || 0,
      valid_shares: poolStats?.shares?.valid || poolStats?.valid_shares || 0,
      connected: true,

      // Last block
      last_block: lastBlock ? {
        height: lastBlock.height,
        hash: lastBlock.hash,
        timestamp: lastBlock.timestamp,
        difficulty: lastBlock.difficulty,
        reward: lastBlock.reward / ATOMIC_UNITS_PER_ZION,
        num_txes: lastBlock.num_txes || 0,
        block_size: lastBlock.block_size || 0,
      } : null,

      // Legacy / frontend compatibility aliases
      latest_block: lastBlock ? {
        height: lastBlock.height,
        hash: lastBlock.hash,
        timestamp: lastBlock.timestamp,
      } : null,
      mempool_size: info.tx_pool_size || 0,
      total_supply: supply.circulatingSupply,
      total_blocks: info.height,
      total_transactions: info.tx_count || info.height,
    };

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Failed to fetch blockchain stats:', error);
    return NextResponse.json(
      {
        block_height: 0, difficulty: 0, circulating_supply: 0, max_supply: 144_000_000_000,
        network_hashrate: 0, network_hashrate_formatted: 'Offline', tx_count: 0, tx_pool_size: 0,
        total_connections: 0, connected: false, status: 'offline',
        error: 'Failed to connect to ZION daemon',
        total_blocks: 0, total_transactions: 0,
      },
      { status: 503 }
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
