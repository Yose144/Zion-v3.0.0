export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090';

async function promQuery(query: string): Promise<any> {
  try {
    const res = await fetch(
      `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.result?.[0]?.value?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const rpc = getZionRpc();

  try {
    const [info, poolStats, load1, memTotalStr, memAvailStr, diskSizeStr, diskAvailStr] = await Promise.all([
      rpc.getInfo().catch(() => null),
      rpc.getPoolStats().catch(() => null),
      promQuery('node_load1'),
      promQuery('node_memory_MemTotal_bytes'),
      promQuery('node_memory_MemAvailable_bytes'),
      promQuery('node_filesystem_size_bytes{mountpoint="/"}'),
      promQuery('node_filesystem_avail_bytes{mountpoint="/"}'),
    ]);

    const totalShares = (poolStats?.shares?.valid ?? 0) + (poolStats?.shares?.invalid ?? 0);
    const acceptRate = totalShares > 0
      ? Math.round(((poolStats?.shares?.valid ?? 0) / totalShares) * 100)
      : (poolStats?.routing?.accept_rate_pct ?? 0);

    const memTotal = memTotalStr != null ? parseFloat(memTotalStr) : 0;
    const memAvail = memAvailStr != null ? parseFloat(memAvailStr) : 0;
    const memUsed = memTotal > 0 ? memTotal - memAvail : 0;

    const diskSize = diskSizeStr != null ? parseFloat(diskSizeStr) : 0;
    const diskAvail = diskAvailStr != null ? parseFloat(diskAvailStr) : 0;
    const diskUsedPct = diskSize > 0 ? ((diskSize - diskAvail) / diskSize) * 100 : 0;

    const metrics = {
      chain: {
        height: info?.height ?? 0,
        peers: (info?.incoming_connections_count ?? 0) + (info?.outgoing_connections_count ?? 0),
        mempool: info?.tx_pool_size ?? 0,
        tps: 0,
        difficulty: info?.difficulty ?? 0,
        total_blocks: info?.height ?? 0,
        total_transactions: info?.tx_count ?? 0,
        network_hashrate: info?.difficulty && info?.target
          ? info.difficulty / info.target
          : 0,
      },
      pool: {
        sessions: poolStats?.miners?.active ?? 0,
        hashrate_hps: poolStats?.hashrate?.pool ?? 0,
        accept_rate_pct: acceptRate,
        uptime_secs: poolStats?.pool?.uptime_secs ?? 0,
        blocks_found: poolStats?.blocks?.found ?? 0,
      },
      miner: {
        hashrate_hps: 0,
        accepted: poolStats?.shares?.valid ?? 0,
        rejected: poolStats?.shares?.invalid ?? 0,
        accept_rate_pct: acceptRate,
      },
      system: {
        load1: load1 != null ? parseFloat(load1) : 0,
        mem_used_gb: memTotal > 0 ? memUsed / (1024 ** 3) : 0,
        mem_total_gb: memTotal > 0 ? memTotal / (1024 ** 3) : 0,
        disk_used_pct: diskUsedPct,
      },
      source: 'live',
    };

    return NextResponse.json(metrics, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json(
      {
        chain: { height: 0, peers: 0, mempool: 0, tps: 0, difficulty: 0, total_blocks: 0, total_transactions: 0, network_hashrate: 0 },
        pool: { sessions: 0, hashrate_hps: 0, accept_rate_pct: 0, uptime_secs: 0, blocks_found: 0 },
        miner: { hashrate_hps: 0, accepted: 0, rejected: 0, accept_rate_pct: 0 },
        system: { load1: 0, mem_used_gb: 0, mem_total_gb: 0, disk_used_pct: 0 },
        source: 'fallback',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
