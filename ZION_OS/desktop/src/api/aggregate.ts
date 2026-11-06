// Aggregate direct API calls into the dashboard data model.
// This replaces the old Python dashboard /api/status, /api/services, /api/alerts etc.

import {
  LOCAL_BACKUP_NODE, EDGE_NODE1, EDGE_NODE2, PUBLIC_RPC, POOL, DAO, WARP, OASIS, BRIDGE,
  ATOMIC_SWAP, SWAP_AGGREGATOR, HIRANYAGARBHA, HIRAN_INFERENCE, FREE_WORLD, ISSOBELLA, WEB,
  PUBLIC_OASIS_HEALTH, PUBLIC_WEB_HEALTH, PUBLIC_FREE_WORLD_HEALTH, PUBLIC_ISSOBELLA_HEALTH,
  type ServiceEndpoint,
} from '../config/services';
import { queryAllNodes, getMempoolInfo, type ChainInfo, type NodeStatus } from './node';
import { fetchPoolStats, type PoolStats } from './pool';
import { httpGet, shareLatest, type SharedSlot } from '../lib/client';
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

const fullSlot: SharedSlot<DirectStatus> = { inflight: null, cached: null };

export function fetchDirectFullStatus(): Promise<DirectStatus> {
  return shareLatest(fullSlot, loadDirectFullStatus);
}

async function loadDirectFullStatus(): Promise<DirectStatus> {
  const now = new Date().toISOString();

  const [nodes, poolStats] = await Promise.all([
    queryAllNodes(),
    fetchPoolStats().catch(() => null),
  ]);

  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');
  const edge2 = nodes.find((n) => n.endpoint.id === 'edge-node2');
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');
  const publicRpc = nodes.find((n) => n.endpoint.id === 'public-rpc');
  const edgeShown = edge1?.alive ? edge1 : publicRpc;
  const chainInfo =
    local?.chainInfo ?? edge1?.chainInfo ?? edge2?.chainInfo ?? publicRpc?.chainInfo ?? null;
  const mempool = local?.alive ? await getMempoolInfo(LOCAL_BACKUP_NODE).catch(() => null) : null;

  const status: V3Status = {
    timestamp: now,
    topology: local?.alive ? 'local-dev' : 'edge-primary',
    node1: nodeStatus(local),
    node2: nodeStatus(edge2),
    edge_node: nodeStatus(edgeShown),
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

  const services = await buildServicesHealth(nodes, poolStats);

  const alerts: AlertItem[] = buildAlerts(nodes, poolStats, chainInfo, mempool);

  const readiness: ReadinessScore = {
    score: 0,
    checks: [
      { id: 'node_sync', ok: !!local?.chainInfo || !!edge1?.chainInfo || !!publicRpc?.chainInfo },
      { id: 'pool_online', ok: !!poolStats },
      { id: 'peers', ok: (local?.nodeInfo?.known_peers ?? 0) > 0 || (edge1?.nodeInfo?.known_peers ?? 0) > 0 || (publicRpc?.nodeInfo?.known_peers ?? 0) > 0 },
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

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

async function publicAlive(url: string, pred: (d: Record<string, unknown>) => boolean): Promise<boolean> {
  const rec = asRecord(await httpGet<unknown>(url, 4000));
  return !!rec && pred(rec);
}

function card(ep: ServiceEndpoint, alive: boolean, level: string, miss: 'local' | 'offline', meta?: Record<string, unknown>): ServiceHealth {
  return {
    ...svcHealth(ep, alive, meta),
    level,
    status: alive ? 'online' : miss,
    alive,
  };
}

async function buildServicesHealth(nodes: NodeStatus[], poolStats: PoolStats | null): Promise<ServiceHealth[]> {
  const [oasisAlive, webAlive, freeWorldAlive, issobellaAlive] = await Promise.all([
    publicAlive(PUBLIC_OASIS_HEALTH, (d) => {
      const inner = asRecord(d.data);
      return d.success === true && inner?.status === 'ok';
    }),
    publicAlive(PUBLIC_WEB_HEALTH, (d) => d.status === 'ok'),
    publicAlive(PUBLIC_FREE_WORLD_HEALTH, (d) => d.success === true && d.data === 'ok'),
    publicAlive(PUBLIC_ISSOBELLA_HEALTH, (d) => d.success === true && d.data === 'ok'),
  ]);

  const up = (id: string) => nodes.find((n) => n.endpoint.id === id)?.alive ?? false;
  return [
    card(LOCAL_BACKUP_NODE, up('local-backup'), 'L1', 'local'),
    card(EDGE_NODE1, up('edge-node1'), 'L1', 'local'),
    card(EDGE_NODE2, up('edge-node2'), 'L1', 'local'),
    card(PUBLIC_RPC, up('public-rpc'), 'L1', 'offline'),
    card(POOL, !!poolStats, 'L1', 'offline', {
      sessions: poolStats?.active_sessions ?? 0,
      blocks: poolStats?.blocks_found ?? 0,
      hashrate: poolStats?.hashrate_live ?? 0,
    }),
    card(DAO, false, 'L2', 'local'),
    card(BRIDGE, false, 'L2', 'local'),
    card(ATOMIC_SWAP, false, 'L2', 'local'),
    card(SWAP_AGGREGATOR, false, 'L2', 'local'),
    card(WARP, false, 'L3', 'local'),
    card(OASIS, oasisAlive, 'L4', 'local'),
    card(FREE_WORLD, freeWorldAlive, 'L5', 'local'),
    card(ISSOBELLA, issobellaAlive, 'L6', 'local'),
    card(HIRANYAGARBHA, false, 'AI', 'local'),
    card(HIRAN_INFERENCE, false, 'AI', 'local'),
    card(WEB, webAlive, 'Infra', 'local'),
  ];
}

function buildAlerts(nodes: NodeStatus[], poolStats: PoolStats | null, chainInfo: ChainInfo | null, mempool: { size?: number; bytes?: number } | null): AlertItem[] {
  const alerts: AlertItem[] = [];
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');
  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');
  const publicRpc = nodes.find((n) => n.endpoint.id === 'public-rpc');

  if (!local?.alive && !edge1?.alive && !publicRpc?.alive && !chainInfo) {
    alerts.push({ severity: 'critical', title: 'No node reachable', detail: 'Local backup, Edge RPC and the public RPC did not respond.' });
  } else if (!local?.alive && !edge1?.alive && (publicRpc?.alive || chainInfo)) {
    alerts.push({ severity: 'info', title: 'Public RPC', detail: 'Local nodes are offline. Chain height is from rpc.zionterranova.com.' });
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
