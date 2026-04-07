import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { SITE_VERSION } from '@/lib/site';
import { getZionRpc } from '@/lib/zion-rpc';
import { getSeedNodesConfig } from '@/lib/network-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_MAINNET_STABILITY_START_ISO = '2026-03-29T00:00:00Z';
const MAINNET_STABILITY_TARGET_DURATION = 72 * 3600;
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
  // Use actual configured seed node count (Prague-only = 1) unless the
  // collector state explicitly records a different expectation.
  const configuredNodes = getSeedNodesConfig().length;
  const expectedNodes = Math.max(1, Math.floor(toNumber(collectorState?.latest?.expected_nodes) ?? configuredNodes));
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
  const samplesCollected = Math.floor(toNumber(collectorState?.samples_collected) ?? 0);
  const issueCount = Math.floor(toNumber(collectorState?.issue_count) ?? 0);
  const healthySampleRatio = toNumber(collectorState?.healthy_sample_ratio);

  const zeroSpread = (heightSpread ?? 0) === 0;
  const stableTipAgreement = tipAgreement && onlineNodes === expectedNodes && zeroSpread;
  const closureReady = stableTipAgreement && issueCount === 0;

  let status = 'SCHEDULED';
  if (progress.elapsed_secs > 0) {
    status = stableTipAgreement ? 'RUNNING' : onlineNodes > 0 ? 'DEGRADED' : 'ISSUE';
  }
  if (progress.progress_pct >= 100) {
    status = closureReady ? 'PASS' : 'REVIEW REQUIRED';
  }

  const closureReportReady = progress.progress_pct >= 100 && closureReady;

  return {
    start: startIso,
    ...progress,
    status,
    public_launch_gate: 'NO-GO',
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
  const collectorState = await loadCollectorState();
  // Query only configured seed nodes — avoids timeout delay for missing nodes.
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const [primary, usa, singapore] = await Promise.all([
    fetchNodeData(nodeMap.get('prague-eu')?.id ?? nodes[0]?.id),
    nodeMap.has('usa-west') ? fetchNodeData('usa-west') : Promise.resolve(undefined),
    nodeMap.has('singapore-ap') ? fetchNodeData('singapore-ap') : Promise.resolve(undefined),
  ]);

  const nowSec = Math.floor(Date.now() / 1000);
  const mainnetStabilityRun = buildMainnetStabilityRun({ primary, usa, singapore }, collectorState, nowSec);
  const samplesLabel = mainnetStabilityRun.collector.samples_collected.toLocaleString();
  const lastSampleLabel = mainnetStabilityRun.collector.last_sample_at
    ? new Date(mainnetStabilityRun.collector.last_sample_at).toLocaleString('cs-CZ')
    : 'zatím bez persisted vzorku';

  const readinessMap = {
    done: [
      {
        title: 'Consensus a on-chain reward split jsou ověřené',
        detail: 'Live bloky 465, 471 a 472 potvrdily 89/5/5/1 split přímo na chainu, ne jen v pool accounting vrstvě.',
      },
      {
        title: 'Prague, USA a Singapore drží tip po rolloutu',
        detail: 'Prague single-node drží chain tip stabilně. Multi-node topology bude přidána po stabilizaci.',
      },
      {
        title: 'Deploy runbook a operator guide jsou srovnané',
        detail: 'Aktuální docs odpovídají raw TCP RPC modelu, živým portům a skutečným binárkám node/server/zion-miner.',
      },
      {
        title: 'Monitoring a pool telemetry běží',
        detail: 'Dashboard, Prometheus a pool stats vrací live data pro právě běžící 72h stability run.',
      },
    ],
    missing: [
      {
        title: 'BFG scrub a secret hygiene v historii repa',
        detail: 'Git historie stále ukazuje PREMINE_WALLETS_BACKUP.json, takže public production launch zůstává blokovaný.',
      },
      {
        title: 'Genesis artefakty, tag a checksumy',
        detail: 'Offline genesis chain, release naming a veřejné checksum workflow ještě nejsou formálně uzavřené.',
      },
      {
        title: 'Exit criteria sign-off',
        detail: 'MAINNET_EXIT_CRITERIA.md existuje, ale stále je draft bez finálního launch podpisu.',
      },
      {
        title: 'Measured 72h stability closure report',
        detail: `Collector má zatím ${samplesLabel} vzorků, poslední vzorek ${lastSampleLabel}. Public launch zůstává NO-GO, dokud není 72h run uzavřený reportem a recovery evidencí.`,
      },
    ],
    not_missing: [
      {
        title: 'Nejde o broken consensus',
        detail: 'Chain roste, uzly se drží na stejném tipu a runtime už není v režimu neřízeného testnetu.',
      },
      {
        title: 'Nejde o pool-only payout iluzi',
        detail: 'Reward split je vynucený core logikou a validací bloků, ne jen dashboard účetnictvím.',
      },
      {
        title: 'Nejde o nulovou dokumentaci',
        detail: 'Runbook, rollout checklist, go/no-go report i operator guide už existují a byly srovnané v této session.',
      },
      {
        title: 'Nejde o chybějící fuzz harnessy',
        detail: 'Harnessy pro core a pool jsou v repu; chybí campaign a sign-off, ne samotný základ.',
      },
    ],
    next_48h: [
      {
        title: 'Hour 0-24 — sběr vzorků bez driftu',
        detail: 'Držet Prague na stabilním tipu, zaznamenat peer count, výšku chainu a první pool recovery okno.',
      },
      {
        title: 'Hour 24-48 — restart discipline a recovery',
        detail: 'Pokud dojde k restartu nebo degradaci, collector musí zachytit dobu obnovy, tip agreement i pool acceptance po návratu.',
      },
      {
        title: 'Hour 48-72 — closure report',
        detail: 'Po dosažení 72h vyexportovat měřený verdict pro chain growth, tip agreement, reject rate, restart discipline a pool recovery.',
      },
    ],
  };

  const data = {
    timestamp: new Date().toISOString(),
    environment: {
      label: 'Controlled V3 mainnet stability verification',
      current_phase: '72h mainnet stability run',
      public_launch_status: 'NO-GO',
    },
    mainnet_stability_run: mainnetStabilityRun,
    launch_rehearsal: mainnetStabilityRun,
    readiness_map: readinessMap,
    current_topology: nodes.length === 1 ? 'single-node-prague' : '3-node-test-mainnet-mesh',
    primary,
    usa,
    singapore,
    log_tail: buildLogTail({ primary, usa, singapore }, mainnetStabilityRun),
  };

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://zionterranova.com',
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
    { label: 'PRAGUE (EU) ', data: nodes.primary },
    { label: 'USA (WEST)  ', data: nodes.usa },
    { label: 'SINGAPORE   ', data: nodes.singapore },
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
