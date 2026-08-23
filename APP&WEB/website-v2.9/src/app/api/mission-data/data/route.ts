import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { SITE_VERSION } from '@/lib/site';
import { getZionRpc } from '@/lib/zion-rpc';
import { getSeedNodesConfig } from '@/lib/network-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_MAINNET_STABILITY_START_ISO = '2026-08-23T05:00:00Z';
const MAINNET_STABILITY_TARGET_DURATION = 30 * 24 * 3600;
const MAINNET_STABILITY_STATE_CANDIDATES = [
  '/data/mainnet-stability-run/active-run.json',
  path.resolve(process.cwd(), 'ops', 'mainnet-stability-run', 'active-run.json'),
  path.resolve(process.cwd(), '..', '..', 'ops', 'mainnet-stability-run', 'active-run.json'),
];

type StabilityCollectorState = {
  source_path?: string;
  schema_version?: number;
  run_id?: string;
  started_at?: string;
  target_duration_secs?: number;
  sample_interval_secs?: number;
  last_sample_at?: string;
  samples_collected?: number;
  issue_count?: number;
  healthy_sample_ratio?: number;
  latest?: {
    status?: string;
    tip_agreement?: boolean;
    height_spread?: number;
    nodes_online?: number;
    expected_nodes?: number;
    current_tip?: string;
    min_height?: number;
    max_height?: number;
    pool_reachable?: boolean;
    pool_active_miners?: number;
    pool_valid_shares?: number;
    pool_invalid_shares?: number;
    pool_accept_rate_pct?: number;
  };
};

type MainnetStabilityRun = {
  start: string;
  elapsed_secs: number;
  remaining_secs: number;
  duration_secs: number;
  progress_pct: number;
  status: string;
  public_launch_gate: string;
  agreement: {
    online_nodes: number;
    expected_nodes: number;
    tip_agreement: boolean;
    height_spread: number | null;
    current_tip: string | null;
  };
  collector: {
    enabled: boolean;
    run_id: string | null;
    sample_interval_secs: number | null;
    samples_collected: number;
    issue_count: number;
    healthy_sample_ratio: number | null;
    last_sample_at: string | null;
    state_path: string | null;
  };
  pool: {
    reachable: boolean;
    active_miners: number;
    valid_shares: number;
    invalid_shares: number;
    accept_rate_pct: number | null;
  };
  closure_report_ready: boolean;
};

function getWindowProgress(startIso: string, durationSecs: number, nowSec: number) {
  const startSec = Math.floor(new Date(startIso).getTime() / 1000);
  const elapsedSecs = Math.max(0, nowSec - startSec);
  const clampedElapsedSecs = Math.min(elapsedSecs, durationSecs);

  return {
    elapsed_secs: clampedElapsedSecs,
    remaining_secs: Math.max(0, durationSecs - elapsedSecs),
    duration_secs: durationSecs,
    progress_pct: Math.min(100, Math.round((clampedElapsedSecs / durationSecs) * 100)),
  };
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function loadCollectorState(): Promise<StabilityCollectorState | null> {
  for (const candidate of MAINNET_STABILITY_STATE_CANDIDATES) {
    try {
      const raw = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...(parsed as StabilityCollectorState),
          source_path: candidate,
        };
      }
    } catch {
      // Ignore missing or malformed collector state and fall back to live-only telemetry.
    }
  }

  return null;
}

/* ── Load the G8 30-day continuous-run state ───────── */
async function loadG8RunState(): Promise<StabilityCollectorState | null> {
  try {
    const raw = await readFile('/opt/zion/data/g8_run.json', 'utf8');
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object' || !parsed.started || !parsed.target_end) return null;
    const startMs = new Date(parsed.started).getTime();
    const endMs = new Date(parsed.target_end).getTime();
    return {
      started_at: parsed.started,
      target_duration_secs: Math.max(3600, Math.floor((endMs - startMs) / 1000)),
      run_id: parsed.run_id ?? 'g8-30day',
      samples_collected: 0,
      issue_count: Array.isArray(parsed.critical_incidents) ? parsed.critical_incidents.length : 0,
      latest: {
        status: parsed.status,
        pool_reachable: Array.isArray(parsed.services)
          ? parsed.services.some((s: any) => s.id === 'v31-pool' && s.alive)
          : undefined,
      },
    };
  } catch {
    return null;
  }
}

/* ── Fetch data for a specific node via V3 TCP RPC ───────────────── */
async function fetchNodeData(nodeId?: string) {
  const rpc = getZionRpc();

  let nodeStats: any = undefined;
  let pool: any = undefined;

  try {
    const info = nodeId ? await rpc.getInfoForNode(nodeId) : await rpc.getInfo();
    const peerCount = (info.outgoing_connections_count ?? 0) + (info.incoming_connections_count ?? 0);
    nodeStats = {
      height: info.height ?? 0,
      peers_connected: peerCount,
      difficulty: info.difficulty ?? 0,
      mempool_size: info.tx_pool_size ?? 0,
      status: info.status ?? 'OK',
      time_since_last_block: info.target ?? 60,
      tip: info.top_block_hash ?? '',
      tps: 0,
      sync: { state: 'synced' },
      network: `V3 Test Mainnet ${SITE_VERSION}`,
    };
  } catch { /* node unreachable */ }

  try {
    const poolStats = await rpc.getPoolStats();
    if (poolStats) {
      pool = {
        ok: true,
        miners: poolStats.miners ?? { active: 0, total: 0 },
        hashrate: poolStats.hashrate ?? { pool: 0, pool_24h: 0 },
        shares: poolStats.shares ?? { valid: 0, invalid: 0 },
        blocks: poolStats.blocks ?? { found: 0, pending: 0 },
        pool: poolStats.pool ?? { fee: 5, version: SITE_VERSION, uptime_secs: 0 },
        payouts: { pending_miners: 0 },
        pplns_window_size: 0,
        blockchain: { connected: !!nodeStats },
        routing: poolStats.routing ?? null,
      };
    }
  } catch { /* pool unreachable */ }

  return { ip: '', stats: nodeStats, pool };
}

type NodeResult = Awaited<ReturnType<typeof fetchNodeData>> | undefined;

function buildMainnetStabilityRun(
  nodes: { primary: NodeResult; usa: NodeResult; singapore: NodeResult },
  collectorState: StabilityCollectorState | null,
  nowSec: number,
): MainnetStabilityRun {
  const expectedNodes = Math.max(2, Math.floor(toNumber(collectorState?.latest?.expected_nodes) ?? 2));
  const startIso = collectorState?.started_at ?? DEFAULT_MAINNET_STABILITY_START_ISO;
  const durationSecs = Math.max(
    3600,
    Math.floor(toNumber(collectorState?.target_duration_secs) ?? MAINNET_STABILITY_TARGET_DURATION),
  );
  const progress = getWindowProgress(startIso, durationSecs, nowSec);

  const entries = [nodes.primary, nodes.usa, nodes.singapore];
  const liveOnlineNodes = entries.filter(node => {
    const stats = node?.stats;
    return !!stats?.tip && (stats.height ?? 0) > 0;
  }).length;
  const heights = entries
    .map(node => node?.stats?.height)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const tips = entries
    .map(node => node?.stats?.tip)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const liveTipAgreement = tips.length > 0 && new Set(tips).size === 1;
  const liveHeightSpread = heights.length > 0 ? Math.max(...heights) - Math.min(...heights) : null;

  const collectorLatest = collectorState?.latest;
  const onlineNodes = Math.floor(toNumber(collectorLatest?.nodes_online) ?? liveOnlineNodes);
  const tipAgreement = collectorLatest?.tip_agreement ?? liveTipAgreement;
  const heightSpread = toNumber(collectorLatest?.height_spread) ?? liveHeightSpread;
  const currentTip = collectorLatest?.current_tip ?? (liveTipAgreement ? tips[0] : tips[0] ?? null);

  const pool = nodes.primary?.pool;
  const liveValidShares = pool?.shares?.valid ?? 0;
  const liveInvalidShares = pool?.shares?.invalid ?? 0;
  const liveAcceptRate = liveValidShares + liveInvalidShares > 0
    ? roundTo((liveValidShares / (liveValidShares + liveInvalidShares)) * 100, 1)
    : pool?.ok
    ? 100
    : null;
  const poolReachable = collectorLatest?.pool_reachable ?? !!pool?.ok;
  const poolActiveMiners = Math.floor(toNumber(collectorLatest?.pool_active_miners) ?? (pool?.miners?.active ?? 0));
  const poolValidShares = Math.floor(toNumber(collectorLatest?.pool_valid_shares) ?? liveValidShares);
  const poolInvalidShares = Math.floor(toNumber(collectorLatest?.pool_invalid_shares) ?? liveInvalidShares);
  const poolAcceptRate = toNumber(collectorLatest?.pool_accept_rate_pct) ?? liveAcceptRate;

  let status = 'SCHEDULED';
  if (progress.elapsed_secs > 0) {
    status = tipAgreement && onlineNodes === expectedNodes && (heightSpread ?? 0) === 0 ? 'RUNNING' : onlineNodes > 0 ? 'DEGRADED' : 'ISSUE';
  }
  if (progress.progress_pct >= 100) {
    status = tipAgreement && onlineNodes === expectedNodes && (heightSpread ?? 0) === 0 ? 'PASS' : 'REVIEW REQUIRED';
  }

  const samplesCollected = Math.floor(toNumber(collectorState?.samples_collected) ?? 0);
  const issueCount = Math.floor(toNumber(collectorState?.issue_count) ?? 0);
  const healthySampleRatio = toNumber(collectorState?.healthy_sample_ratio);
  const closureReportReady = progress.progress_pct >= 100
    && tipAgreement
    && onlineNodes === expectedNodes
    && (heightSpread ?? 0) === 0
    && issueCount === 0;

  return {
    start: startIso,
    ...progress,
    status,
    public_launch_gate: 'GO',
    agreement: {
      online_nodes: onlineNodes,
      expected_nodes: expectedNodes,
      tip_agreement: tipAgreement,
      height_spread: heightSpread,
      current_tip: currentTip,
    },
    collector: {
      enabled: !!collectorState,
      run_id: collectorState?.run_id ?? null,
      sample_interval_secs: Math.floor(toNumber(collectorState?.sample_interval_secs) ?? 0) || null,
      samples_collected: samplesCollected,
      issue_count: issueCount,
      healthy_sample_ratio: healthySampleRatio,
      last_sample_at: collectorState?.last_sample_at ?? null,
      state_path: collectorState?.source_path ?? null,
    },
    pool: {
      reachable: poolReachable,
      active_miners: poolActiveMiners,
      valid_shares: poolValidShares,
      invalid_shares: poolInvalidShares,
      accept_rate_pct: poolAcceptRate,
    },
    closure_report_ready: closureReportReady,
  };
}

/* ── GET handler ───────────────────────────────────────────────── */
export async function GET() {
  const nodes = getSeedNodesConfig();
  const collectorState = (await loadG8RunState()) ?? (await loadCollectorState());
  // Query all nodes in parallel
  const [primary, usa, singapore] = await Promise.all([
    fetchNodeData(nodes.find(n => n.id === 'edge-vps')?.id ?? nodes[0]?.id),
    fetchNodeData(nodes.find(n => n.id === 'core-pc')?.id),
    Promise.resolve(undefined),
  ]);

  const nowSec = Math.floor(Date.now() / 1000);
  const mainnetStabilityRun = buildMainnetStabilityRun({ primary, usa, singapore }, collectorState, nowSec);
  const samplesLabel = mainnetStabilityRun.collector.samples_collected.toLocaleString();
  const lastSampleLabel = mainnetStabilityRun.collector.last_sample_at
    ? new Date(mainnetStabilityRun.collector.last_sample_at).toLocaleString('cs-CZ')
    : 'zatím bez persisted vzorku';

  const readinessMap = {
    done: [
      { title: 'G11 — public mainnet migration complete', detail: 'H1–H4 remediation finished: wZION, ZIONBridge and ZDXToken tests pass, deployment tooling wired, Terminal Miner verified, CLI build green.' },
      { title: 'E4 — Bridge Base mainnet round-trip', detail: '100 ZION lock → 100 wZION mint → 100 wZION burn → 100 ZION unlock confirmed on the ZION chain.' },
      { title: 'G5/E8 — XMR / RandomX AuxPoW on MoneroOcean', detail: 'CryptonoteStratum job/submit parsing fixed and validated for ZION miner CPU path.' },
      { title: 'G7 — chaos and load tests passed', detail: '10k-miner pool handshake, DEX/bridge overload, P2P reconnect storm and 10-min tx fuzz preview all green.' },
      { title: 'G1 — GPU/rig E2E closed', detail: 'GTX 1070 Ti (CUDA) and AMD rig connected to mainnet pool with >99% accept rate.' },
      { title: 'G3 — solver network E2E closed', detail: 'Off-chain solvers, X-Solver-Key auth and full intent→bid→settle flow verified.' },
      { title: 'G4 — public subtree sync', detail: 'public source tree is fully synchronized.' },
      { title: 'H5 — AuxPoW E2E test harness', detail: 'Local pool mock + CPU miner end-to-end validated.' },
      { title: 'Premine/coinbase maturity soft-fork', detail: 'ZION core enforces COINBASE_MATURITY=100 and admin/time locks, with configurable activation height.' },
      { title: 'V3.2.0 public release assets', detail: 'Terminal Miner, CLI and Desktop Agent build scripts, workflows and download metadata switched to v3.2.0.' },
    ],
    missing: [],
    not_missing: [
      { title: 'G11 — public mainnet migration complete', detail: 'H1–H4 remediation finished: wZION, ZIONBridge and ZDXToken tests pass, deployment tooling wired, Terminal Miner verified, CLI build green.' },
      { title: 'E4 — Bridge Base mainnet round-trip', detail: '100 ZION lock → 100 wZION mint → 100 wZION burn → 100 ZION unlock confirmed on the ZION chain.' },
      { title: 'G5/E8 — XMR / RandomX AuxPoW on MoneroOcean', detail: 'CryptonoteStratum job/submit parsing fixed and validated for ZION miner CPU path.' },
      { title: 'G7 — chaos and load tests passed', detail: '10k-miner pool handshake, DEX/bridge overload, P2P reconnect storm and 10-min tx fuzz preview all green.' },
      { title: 'G1 — GPU/rig E2E closed', detail: 'GTX 1070 Ti (CUDA) and AMD rig connected to mainnet pool with >99% accept rate.' },
      { title: 'G3 — solver network E2E closed', detail: 'Off-chain solvers, X-Solver-Key auth and full intent→bid→settle flow verified.' },
      { title: 'G4 — public subtree sync', detail: 'public source tree is fully synchronized.' },
      { title: 'H5 — AuxPoW E2E test harness', detail: 'Local pool mock + CPU miner end-to-end validated.' },
      { title: 'Premine/coinbase maturity soft-fork', detail: 'ZION core enforces COINBASE_MATURITY=100 and admin/time locks, with configurable activation height.' },
      { title: 'V3.2.0 public release assets', detail: 'Terminal Miner, CLI and Desktop Agent build scripts, workflows and download metadata switched to v3.2.0.' },
    ],
    next_48h: [
      { title: 'G8 — 30-day continuous run', detail: 'Started 2026-08-23 07:00 CET. Target 2026-09-22 07:00 CET. Uptime target ≥99.9%.' },
      { title: 'G9 — security audit', detail: 'Schedule external security audit (Trail of Bits or equivalent) for L1/L2 before public launch.' },
      { title: 'G10 — L5/L6 decision', detail: 'Formal treasury, humanitarian fund and Issobella space-fund governance activation plan.' },
      { title: 'Phase I — ZIS identity service', detail: 'Finalise ZION Identity Service deployment, rate limiting and public auth flows.' },
    ],
  };

  const data = {
    timestamp: new Date().toISOString(),
    environment: {
      label: 'Mainnet Alpha',
      current_phase: 'G8 30-day continuous run · running',
      public_launch_status: 'G8 IN-PROGRESS',
    },
    mainnet_stability_run: mainnetStabilityRun,
    launch_rehearsal: mainnetStabilityRun,
    readiness_map: readinessMap,
    current_topology: nodes.map((n: any) => n.id ?? n.ip).join(' / ') || 'edge-vps',
    primary,
    usa,
    singapore,
    log_tail: buildLogTail({ primary, usa, singapore }, mainnetStabilityRun),
  };

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://app.zionterranova.com',
    },
  });
}

/* ── Build monitoring log from live data ────────────────────────── */
function buildLogTail(
  nodes: { primary: NodeResult; usa: NodeResult; singapore: NodeResult },
  mainnetStabilityRun: MainnetStabilityRun,
) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  const entries = [
    { label: 'EDGE VPS    ', data: nodes.primary },
    { label: 'CORE PC     ', data: nodes.usa },
  ];
  for (const { label, data } of entries) {
    const s = data?.stats;
    if (s) {
      lines.push(`[${now}] [${label}] H:${s.height} D:${s.difficulty} P:${s.peers_connected} STATUS:${s.status}`);
    } else {
      lines.push(`[${now}] [${label}] OFFLINE — unable to reach node`);
    }
  }
  const hp = nodes.primary?.pool;
  if (hp) {
    lines.push(`[${now}] [POOL        ] Miners:${hp.miners?.active} Blocks:${hp.blocks?.found} HR:${hp.hashrate?.pool}`);
  }
  lines.push(
    `[${now}] [STABILITY   ] ${mainnetStabilityRun.status} ${mainnetStabilityRun.progress_pct}% `
      + `Nodes:${mainnetStabilityRun.agreement.online_nodes}/${mainnetStabilityRun.agreement.expected_nodes} `
      + `Tip:${mainnetStabilityRun.agreement.tip_agreement ? 'LOCKED' : 'DRIFT'} `
      + `Spread:${mainnetStabilityRun.agreement.height_spread ?? 'n/a'} `
      + `Samples:${mainnetStabilityRun.collector.samples_collected} `
      + `Issues:${mainnetStabilityRun.collector.issue_count}`,
  );
  return lines.join('\n');
}
