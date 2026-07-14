// Aggregate direct API calls into the dashboard data model.
// This replaces the old Python dashboard /api/status, /api/services, /api/alerts etc.

import { LOCAL_BACKUP_NODE, EDGE_NODE1, EDGE_NODE2, POOL, DAO, WARP, OASIS, BRIDGE, ATOMIC_SWAP, SWAP_AGGREGATOR, HIRANYAGARBHA, HIRAN_INFERENCE, FREE_WORLD, ISSOBELLA, type ServiceEndpoint } from '../config/services';
import { queryAllNodes, getLocalOrEdgeChainInfo, getLocalOrEdgeNodeInfo, getMempoolInfo, type ChainInfo, type NodeInfo, type NodeStatus } from './node';
import { fetchPoolStats, type PoolStats } from './pool';
import { checkDaoHealth } from './dao';
import { checkWarpHealth } from './warp';
import { checkOasisHealth } from './oasis';
import { checkBridgeHealth } from './bridge';
import { checkSwapHealth, checkSwapAggregatorHealth } from './swap';
import { checkOrchestratorHealth, checkHiranInferenceHealth } from './hiran';
import { fetchFreeWorldStats, fetchIssobellaStats } from './auxiliary';
import type { ServiceHealth, V3Status, AlertItem, ReadinessScore, LayerStatusResponse } from '../lib/api';

export interface DirectStatus {
  status: V3Status;
  services: ServiceHealth[];
  alerts: AlertItem[];
  readiness: ReadinessScore;
  layerStatus: LayerStatusResponse;
  timestamp: string;
}

const FLOWERS_PER_ZION = 1_000_000;

function flowersToZion(flowers: string | number | undefined): number {
  if (flowers === undefined || flowers === null) return 0;
  const f = typeof flowers === 'string' ? Number(flowers) : flowers;
  return Number.isNaN(f) ? 0 : f / FLOWERS_PER_ZION;
}

function svcHealth(ep: ServiceEndpoint, alive: boolean, meta?: Record<string, unknown>): ServiceHealth {
  return {
    id: ep.id,
    name: ep.label,
    icon: ep.id,
    level: 'L1',
    kind: 'service',
    status: alive ? 'online' : 'offline',
    alive,
    meta,
  };
}

export async function fetchDirectFullStatus(): Promise<DirectStatus> {
  const now = new Date().toISOString();

  const [nodes, chainInfo, nodeInfo, mempool, poolStats] = await Promise.all([
    queryAllNodes(),
    getLocalOrEdgeChainInfo(),
    getLocalOrEdgeNodeInfo(),
    getMempoolInfo(LOCAL_BACKUP_NODE).catch(() => null),
    fetchPoolStats().catch(() => null),
  ]);

  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');
  const edge2 = nodes.find((n) => n.endpoint.id === 'edge-node2');
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');

  const status: V3Status = {
    timestamp: now,
    topology: 'local-dev',
    node1: nodeStatus(edge1),
    node2: nodeStatus(edge2),
    edge_node: nodeStatus(edge1),
    pool: {
      running: !!poolStats,
      active_sessions: poolStats?.active_sessions ?? 0,
      blocks_found: poolStats?.blocks_found ?? 0,
      shares_accepted: poolStats?.shares_accepted ?? 0,
      shares_rejected: poolStats?.shares_rejected ?? 0,
      fee_split: poolStats?.fee_split ?? '—',
      pool_wallet: poolStats?.pool_wallet ?? undefined,
      recent_payouts: [],
      miner_balances: [],
    },
    miner: {
      running: false,
      hashrate: poolStats?.hashrate_live ?? null,
      gpu_backend: null,
      gpu_device: null,
      shares_accepted: 0,
      shares_rejected: 0,
      pool_addr: null,
      current_height: chainInfo?.chain_height ?? null,
      current_algorithm: poolStats?.auxpow?.current_algorithm ?? null,
    },
    pool_edge: {
      running: !!poolStats,
      host: POOL.host,
      ports_open: poolStats ? [`${POOL.port}`] : [],
      active_miners: poolStats?.active_sessions ?? null,
      hashrate: poolStats?.hashrate_live ?? null,
      blocks_found: poolStats?.blocks_found ?? null,
    },
  };

  const services = await buildServicesHealth(poolStats);

  const alerts: AlertItem[] = buildAlerts(nodes, poolStats, chainInfo, mempool);

  const readiness: ReadinessScore = {
    score: 0,
    checks: [
      { id: 'node_sync', ok: !!local?.chainInfo || !!edge1?.chainInfo },
      { id: 'pool_online', ok: !!poolStats },
      { id: 'peers', ok: (local?.nodeInfo?.known_peers ?? 0) > 0 || (edge1?.nodeInfo?.known_peers ?? 0) > 0 },
      { id: 'chain_height', ok: (chainInfo?.chain_height ?? 0) > 0 },
    ],
  };
  readiness.score = Math.round((readiness.checks.filter((c) => c.ok).length / readiness.checks.length) * 100);

  const layerStatus: LayerStatusResponse = {
    layer: 'l1',
    ok: true,
    services: {
      node: !!local?.alive,
      pool: !!poolStats,
      miner: false,
      edge: !!edge1?.alive,
      node2: !!edge2?.alive,
    },
    block_height: chainInfo?.chain_height,
    peers: nodes.find((n) => n.alive)?.nodeInfo?.known_peers,
    hashrate: poolStats?.hashrate_live,
    shares_accepted: poolStats?.shares_accepted,
    pool_alive: !!poolStats,
    miner_alive: false,
    node2_alive: !!edge2?.alive,
    edge_alive: !!edge1?.alive,
  };

  return { status, services, alerts, readiness, layerStatus, timestamp: now };
}

function nodeStatus(n?: NodeStatus): V3Status['node1'] {
  const chainInfo = n?.chainInfo;
  const nodeInfo = n?.nodeInfo;
  return {
    running: n?.alive ?? false,
    chain_height: chainInfo?.chain_height ?? null,
    known_peers: nodeInfo?.known_peers ?? 0,
    mempool_size: chainInfo?.mempool_transactions ?? 0,
    p2p_bind: nodeInfo?.p2p_bind ?? null,
    node_id: nodeInfo?.node_id ?? null,
    uptime_seconds: null,
  };
}

async function buildServicesHealth(poolStats: PoolStats | null): Promise<ServiceHealth[]> {
  const [
    daoAlive,
    warpAlive,
    oasisAlive,
    bridgeAlive,
    swapAlive,
    swapAggAlive,
    orchAlive,
    hiranAlive,
    freeWorldStats,
    issobellaStats,
  ] = await Promise.all([
    checkDaoHealth().catch(() => false),
    checkWarpHealth().catch(() => false),
    checkOasisHealth().catch(() => false),
    checkBridgeHealth().catch(() => false),
    checkSwapHealth().catch(() => false),
    checkSwapAggregatorHealth().catch(() => false),
    checkOrchestratorHealth().catch(() => false),
    checkHiranInferenceHealth().catch(() => false),
    fetchFreeWorldStats().catch(() => null),
    fetchIssobellaStats().catch(() => null),
  ]);

  return [
    svcHealth(LOCAL_BACKUP_NODE, true),
    svcHealth(EDGE_NODE1, true, { level: 'L1' }),
    svcHealth(EDGE_NODE2, true, { level: 'L1' }),
    svcHealth(POOL, !!poolStats, {
      sessions: poolStats?.active_sessions ?? 0,
      blocks: poolStats?.blocks_found ?? 0,
      hashrate: poolStats?.hashrate_live ?? 0,
    }),
    svcHealth(DAO, daoAlive, { level: 'L2' }),
    svcHealth(BRIDGE, bridgeAlive, { level: 'L2' }),
    svcHealth(ATOMIC_SWAP, swapAlive, { level: 'L2' }),
    svcHealth(SWAP_AGGREGATOR, swapAggAlive, { level: 'L2' }),
    svcHealth(WARP, warpAlive, { level: 'L3' }),
    svcHealth(OASIS, oasisAlive, { level: 'L4' }),
    svcHealth(FREE_WORLD, !!freeWorldStats, { level: 'L5' }),
    svcHealth(ISSOBELLA, !!issobellaStats, { level: 'L6' }),
    svcHealth(HIRANYAGARBHA, orchAlive, { level: 'AI' }),
    svcHealth(HIRAN_INFERENCE, hiranAlive, { level: 'AI' }),
  ];
}

function buildAlerts(nodes: NodeStatus[], poolStats: PoolStats | null, chainInfo: ChainInfo | null, mempool: { size?: number; bytes?: number } | null): AlertItem[] {
  const alerts: AlertItem[] = [];
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');
  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');

  if (!local?.alive && !edge1?.alive) {
    alerts.push({ severity: 'critical', title: 'No node reachable', detail: 'Neither local backup nor Edge RPC responded.' });
  }
  if (local?.alive && edge1?.alive && local.chainInfo && edge1.chainInfo) {
    const gap = Math.abs(local.chainInfo.chain_height - edge1.chainInfo.chain_height);
    if (gap > 3) {
      alerts.push({ severity: 'warning', title: 'Node sync gap', detail: `Local backup and Edge differ by ${gap} blocks.` });
    }
  }
  if (!poolStats) {
    alerts.push({ severity: 'warning', title: 'Pool metrics offline', detail: `Could not reach pool API at ${POOL.host}:${POOL.port}.` });
  }
  if (mempool && (mempool.size ?? 0) > 1000) {
    alerts.push({ severity: 'info', title: 'Large mempool', detail: `${mempool.size} transactions in mempool.` });
  }
  if (chainInfo && chainInfo.chain_height === 0) {
    alerts.push({ severity: 'warning', title: 'Chain at genesis', detail: 'Local chain height is 0 — node may still be syncing.' });
  }
  return alerts;
}
