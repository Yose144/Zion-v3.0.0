import { NextResponse } from 'next/server';
import { getSeedNodesConfig, type SeedNodeConfig } from '@/lib/network-config';
import { getZionRpc } from '@/lib/zion-rpc';

/**
 * TREE_NODES Network API
 *
 * Provides real-time status of the configured ZION public host topology.
 * Uses V3 TCP JSON-RPC for node checks and TCP pool metrics.
 */

const SEED_NODES = getSeedNodesConfig();

interface NodeStatus {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  online: boolean;
  height: number;
  peers: number;
  hashrate: number;
  miners: number;
  blocks: number;
  uptime: number;
  rpcLatencyMs?: number;
  poolLatencyMs?: number;
  blockLag?: number;
  lastChecked: string;
  error?: string;
}

interface NetworkStatus {
  timestamp: string;
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    onlinePct: number;
    maxHeight: number;
    minHeight: number;
    heightGap: number;
    totalHashrate: number;
    totalMiners: number;
    totalBlocks: number;
    inSync: boolean;
  };
}

async function getNodeStatus(node: SeedNodeConfig): Promise<NodeStatus> {
  const status: NodeStatus = {
    id: node.id,
    name: node.name,
    host: node.host,
    region: node.region,
    lat: node.lat,
    lon: node.lon,
    online: false,
    height: 0,
    peers: 0,
    hashrate: 0,
    miners: 0,
    blocks: 0,
    uptime: 0,
    lastChecked: new Date().toISOString(),
  };

  // V3 node RPC via TCP
  try {
    const rpc = getZionRpc();
    const rpcStart = Date.now();
    const info = await rpc.getInfo();
    status.rpcLatencyMs = Date.now() - rpcStart;
    status.height = info.height ?? 0;
    status.peers = (info.outgoing_connections_count ?? 0) + (info.incoming_connections_count ?? 0);
    status.online = info.status === 'OK';
  } catch (e) {
    status.error = e instanceof Error ? e.message : 'RPC error';
  }

  // V3 pool metrics via TCP
  try {
    const rpc = getZionRpc();
    const poolStart = Date.now();
    const poolStats = await rpc.getPoolStats();
    status.poolLatencyMs = Date.now() - poolStart;
    if (poolStats) {
      status.online = true;
    }
  } catch {
    // Pool might not be running, that's ok
  }

  return status;
}

export async function GET() {
  try {
    // Fetch all configured hosts in parallel.
    const nodeStatuses = await Promise.all(
      SEED_NODES.map(node => getNodeStatus(node))
    );

    // Calculate summary
    const onlineNodes = nodeStatuses.filter(n => n.online);
    const heights = onlineNodes.map(n => n.height).filter(h => h > 0);
    const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
    const minHeight = heights.length > 0 ? Math.min(...heights) : 0;
    const heightGap = Math.max(0, maxHeight - minHeight);

    for (const node of nodeStatuses) {
      node.blockLag = node.height > 0 ? Math.max(0, maxHeight - node.height) : undefined;
    }

    const networkStatus: NetworkStatus = {
      timestamp: new Date().toISOString(),
      nodes: nodeStatuses,
      summary: {
        total: nodeStatuses.length,
        online: onlineNodes.length,
        onlinePct: nodeStatuses.length > 0 ? Number(((onlineNodes.length / nodeStatuses.length) * 100).toFixed(2)) : 0,
        maxHeight,
        minHeight,
        heightGap,
        totalHashrate: nodeStatuses.reduce((sum, n) => sum + n.hashrate, 0),
        totalMiners: nodeStatuses.reduce((sum, n) => sum + n.miners, 0),
        totalBlocks: nodeStatuses.reduce((sum, n) => sum + n.blocks, 0),
        inSync: heightGap <= 2
      }
    };

    return NextResponse.json(networkStatus, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    console.error('Network status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network status' },
      { status: 500 }
    );
  }
}
