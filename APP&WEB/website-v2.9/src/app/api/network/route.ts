import { NextResponse } from 'next/server';
import { getSeedNodesConfig, type SeedNodeConfig } from '@/lib/network-config';

/**
 * TREE_NODES Network API
 * 
 * Provides real-time status of all ZION network nodes
 * Integrates with TREE_NODES infrastructure toolkit
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
  lastChecked: string;
  error?: string;
}

interface NetworkStatus {
  timestamp: string;
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    maxHeight: number;
    totalHashrate: number;
    totalMiners: number;
    totalBlocks: number;
    inSync: boolean;
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      cache: 'no-store'
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function computeRpcUrl(node: SeedNodeConfig): string {
  if (node.rpcUrl) return node.rpcUrl;
  return `http://${node.host}:${node.ports.rpc}/json_rpc`;
}

function computePoolApiBaseUrl(node: SeedNodeConfig): string {
  if (node.poolApiUrl) return node.poolApiUrl;
  return `http://${node.host}:${node.ports.pool_api}`;
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
    lastChecked: new Date().toISOString()
  };

  // Try RPC for blockchain info
  try {
    const rpcUrl = computeRpcUrl(node);
    
    // Get block info - use POST with JSON-RPC (ZION uses get_info method)
    const blockRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'get_info', params: [] }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    
    if (blockRes.ok) {
      const blockData = await blockRes.json();
      // ZION RPC returns { result: { height, difficulty, status, tip } }
      status.height = blockData.result?.height || 0;
      status.online = blockData.result?.status === 'OK';
    }
  } catch (e) {
    status.error = e instanceof Error ? e.message : 'RPC error';
  }

  // Try Pool API for mining stats
  try {
    const poolApiBase = computePoolApiBaseUrl(node).replace(/\/+$/, '');
    const poolRes = await fetchWithTimeout(
      `${poolApiBase}/stats`,
      5000
    );
    
    if (poolRes.ok) {
      const poolData = await poolRes.json();
      status.hashrate = poolData.hashrate?.pool || 0;
      status.miners = poolData.miners?.active || 0;
      status.blocks = poolData.blocks?.found || 0;
      // Use pool's blockchain height as fallback
      if (!status.height && poolData.blockchain?.height) {
        status.height = poolData.blockchain.height;
      }
      status.online = true;
    }
  } catch {
    // Pool might not be running, that's ok
  }

  return status;
}

export async function GET() {
  try {
    // Fetch all nodes in parallel
    const nodeStatuses = await Promise.all(
      SEED_NODES.map(node => getNodeStatus(node))
    );

    // Calculate summary
    const onlineNodes = nodeStatuses.filter(n => n.online);
    const heights = onlineNodes.map(n => n.height).filter(h => h > 0);
    const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
    const minHeight = heights.length > 0 ? Math.min(...heights) : 0;

    const networkStatus: NetworkStatus = {
      timestamp: new Date().toISOString(),
      nodes: nodeStatuses,
      summary: {
        total: nodeStatuses.length,
        online: onlineNodes.length,
        maxHeight,
        totalHashrate: nodeStatuses.reduce((sum, n) => sum + n.hashrate, 0),
        totalMiners: nodeStatuses.reduce((sum, n) => sum + n.miners, 0),
        totalBlocks: nodeStatuses.reduce((sum, n) => sum + n.blocks, 0),
        inSync: maxHeight - minHeight <= 2
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
