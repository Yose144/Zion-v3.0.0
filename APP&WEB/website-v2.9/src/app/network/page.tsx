'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Coins,
  Cpu,
  ExternalLink,
  Globe,
  Globe2,
  Hash,
  Layers,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  BLOCK_REWARD_ZION,
  BLOCKS_PER_DECADE,
  DECAY_FACTOR,
  TOTAL_SUPPLY_ZION,
  GENESIS_PREMINE_ZION,
  BLOCK_TIME_SECONDS,
  blockRewardAtHeight,
} from '@/lib/constants';
import {
  SITE_NETWORK_TOPOLOGY,
  SITE_POOL_PRIMARY,
  SITE_PRIMARY_HOST,
  SITE_PRIMARY_RPC_URL,
  SITE_RELEASE_LABEL,
  SITE_RUNTIME_LABEL,
} from '@/lib/site';

const NetworkStatus = dynamic(() => import('@/components/NetworkStatus'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkMap = dynamic(() => import('@/components/NetworkMap'), {
  loading: () => <SurfaceSkeleton lines={5} />,
});
const PoolFinder = dynamic(() => import('@/components/PoolFinder'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkMonitoringSnapshot = dynamic(() => import('@/components/network/NetworkMonitoringSnapshot'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkOperatorToolkit = dynamic(() => import('@/components/network/NetworkOperatorToolkit'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  {
    label: tr('networkPage', 'public_nodes', lang),
    value: '2',
    descriptor: cs
      ? 'Edge relay (Hetzner VPS) + Core (privátní master)'
      : 'Edge relay (Hetzner VPS) + Core (private master)',
  },
  {
    label: tr('networkPage', 'p2p_mesh', lang),
    value: tr('networkPage', 'core_edge', lang),
    descriptor: tr('networkPage', 'vpn_tunnel_core_edge', lang),
  },
  {
    label: tr('networkPage', 'telemetry', lang),
    value: '30s',
    descriptor: tr('networkPage', 'auto_refresh_interval', lang),
  },
  {
    label: tr('networkPage', 'topology', lang),
    value: tr('networkPage', 'core_edge', lang),
    descriptor: tr('networkPage', 'edge_relay_core_master_pplns_window_on_core', lang),
  },
  {
    label: tr('networkPage', 'network', lang),
    value: 'V3 Mainnet',
    descriptor: cs
      ? 'Mainnet launch countdown v2.9.9 · runtime v2.9.8'
      : 'Mainnet launch countdown v2.9.9 · runtime v2.9.8',
  },
];

const getInfraFeatures = (cs: boolean) => [
  {
    icon: Server,
    title: tr('networkPage', 'edge_relay_hetzner_vps', lang),
    detail: cs
      ? 'Veřejný P2P + stratum relay — P2P 8333, Pool 8444, Node RPC 8443'
      : 'Public P2P + stratum relay — P2P 8333, Pool 8444, Node RPC 8443',
    ip: '77.42.71.94',
    status: tr('networkPage', 'active', lang),
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: tr('networkPage', 'core_private_master', lang),
    detail: cs
      ? 'Zdroj pravdy — Node 1 (Genesis), Node 2, Master PPLNS pool, GPU miner'
      : 'Source of truth — Node 1 (Genesis), Node 2, Master PPLNS pool, GPU miner',
    ip: tr('networkPage', 'private_vpn', lang),
    status: tr('networkPage', 'vpn_tunnel', lang),
    color: 'text-zion-cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
];

const getRuntimePanels = (cs: boolean) => [
  {
    icon: Radio,
    label: tr('networkPage', 'public_stratum', lang),
    value: SITE_POOL_PRIMARY,
    detail: tr('networkPage', 'current_primary_mining_ingress_on_zion2', lang),
    accent: 'text-zion-gold',
  },
  {
    icon: Terminal,
    label: 'RPC Endpoint',
    value: SITE_PRIMARY_RPC_URL,
    detail: tr('networkPage', 'native_rust_json_rpc_for_explorers_and_toolin', lang),
    accent: 'text-zion-cyan',
  },
  {
    icon: Globe,
    label: 'P2P Peer',
    value: `${SITE_PRIMARY_HOST}:8333`,
    detail: tr('networkPage', 'public_edge_relay_core_sync_via_private_vpn', lang),
    accent: 'text-emerald-400',
  },
  {
    icon: BookOpen,
    label: tr('networkPage', 'release_context', lang),
    value: SITE_RELEASE_LABEL,
    detail: cs
      ? `Verejna linka nad ${SITE_RUNTIME_LABEL}; archivovane nasazeni 2.9.8 zustava v dokumentaci`
      : `Public line over ${SITE_RUNTIME_LABEL}; archived 2.9.8 rollout retained in docs`,
    accent: 'text-zion-purple',
  },
];

const getGuideBlocks = (cs: boolean) => [
  {
    icon: Zap,
    title: tr('networkPage', 'mining', lang),
    description: tr('networkPage', 'connect_any_cosmic_harmony_cpu_miner_to_the_c', lang),
    items: [
      `Pool: ${SITE_POOL_PRIMARY} ${tr('networkPage', 'current_primary', lang)}`,
      'Wallet: YOUR_ZION_ADDRESS',
      'Password: x',
    ],
  },
  {
    icon: Terminal,
    title: 'RPC API',
    description: cs
      ? 'Nativni Rust JSON-RPC endpoint pro explorer a tooling. Historicka 3-host sit je archivovana v release reportech.'
      : 'Native Rust JSON-RPC endpoint for explorers and tooling. Historical 3-host mesh is archived in release reports.',
    items: [
      `Primary: ${SITE_PRIMARY_RPC_URL}`,
      `Scope: ${tr('networkPage', 'public_runtime_endpoint', lang)}`,
      `Archive: ${tr('networkPage', 'docs_2_9_8_march_status_reports', lang)}`,
      'Method: POST',
    ],
  },
  {
    icon: Globe,
    title: 'P2P Layer',
    description: cs
      ? 'Nativní Rust P2P síť — Edge relay přijímá inbound z internetu, Core zůstává za privátní VPN.'
      : 'Native Rust P2P network — Edge relay accepts inbound from the internet, Core stays behind private VPN.',
    items: [
      `${tr('networkPage', 'public_peer_edge', lang)}: ${SITE_PRIMARY_HOST}:8333`,
      tr('networkPage', 'core_peer_vpn_private_peer_non_public', lang),
      tr('networkPage', 'vpn_tunnel_wireguard_core_edge', lang),
    ],
  },
];

const getNetworkFacts = (cs: boolean) => [
  { text: tr('networkPage', 'native_rust_p2p_edge_relay_public', lang), done: true },
  {
    text: tr('networkPage', 'core_edge_topology_with_private_vpn_tunnel', lang),
    done: true,
  },
  {
    text: tr('networkPage', 'edge_stratum_endpoint_77_42_71_94_8444_sharer', lang),
    done: true,
  },
  { text: tr('networkPage', 'json_rpc_endpoints_live_port_8443', lang), done: true },
  { text: tr('networkPage', 'systemd_services_with_auto_restart_on_edge', lang), done: true },
  { text: tr('networkPage', 'lwma_daa_target_60s_block_time', lang), done: true },
  {
    text: tr('networkPage', 'sharerelay_protocol_edge_core_pplns_sync', lang),
    done: true,
  },
  { text: tr('networkPage', 'prometheus_grafana_monitoring', lang), done: true },
  {
    text: tr('networkPage', 'ufw_firewall_on_edge_8333_8444_22_41641', lang),
    done: true,
  },
];

interface MonitoringSnapshot {
  chainHeight: number | null;
  coreUp: number | null;
  poolUp: number | null;
  poolSessions: number | null;
  poolAcceptRate: number | null;
  poolUptime: number | null;
  templateFees: number | null;
  load1: number | null;
  memAvailable: number | null;
  memTotal: number | null;
  diskAvailable: number | null;
  diskTotal: number | null;
}

function fmtMetric(n: number | null | undefined, digits = 0) {
  if (n == null) return '—';
  return digits > 0 ? n.toFixed(digits) : n.toLocaleString('en-US');
}

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fmtUptime(secs: number | null | undefined) {
  if (!secs) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function metricValue(query: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.data?.result?.[0];
    return first ? Number.parseFloat(first.value?.[1] ?? '') : null;
  } catch {
    return null;
  }
}

async function fetchMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const values = await Promise.all([
    metricValue('zion_chain_height'),
    metricValue('up{job="zion-core"}'),
    metricValue('up{job="zion-pool"}'),
    metricValue('zion_pool_active_sessions'),
    metricValue('zion_pool_accept_rate_pct'),
    metricValue('zion_pool_uptime_seconds'),
    metricValue('zion_template_fees_zion'),
    metricValue('node_load1'),
    metricValue('node_memory_MemAvailable_bytes'),
    metricValue('node_memory_MemTotal_bytes'),
    metricValue('node_filesystem_avail_bytes{mountpoint="/"}'),
    metricValue('node_filesystem_size_bytes{mountpoint="/"}'),
  ]);

  return {
    chainHeight: values[0],
    coreUp: values[1],
    poolUp: values[2],
    poolSessions: values[3],
    poolAcceptRate: values[4],
    poolUptime: values[5],
    templateFees: values[6],
    load1: values[7],
    memAvailable: values[8],
    memTotal: values[9],
    diskAvailable: values[10],
    diskTotal: values[11],
  };
}

export default function NetworkPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = tr('networkPage', 'en_us', lang);
  const heroStats = getHeroStats(cs);
  const infraFeatures = getInfraFeatures(cs);
  const runtimePanels = getRuntimePanels(cs);
  const guideBlocks = getGuideBlocks(cs);
  const networkFacts = getNetworkFacts(cs);
  const factsDone = networkFacts.filter((f) => f.done).length;
  const factsTotal = networkFacts.length;

  const primaryPool = SITE_POOL_PRIMARY;

  /* ── Chain stats fetch ── */
  interface ChainStats {
    block_height: number;
    difficulty: number;
    cumulative_difficulty: number;
    circulating_supply: number;
    emission_pct: string;
    network_hashrate: number;
    network_hashrate_formatted: string;
    target_block_time: number;
    avg_block_time: number;
    tx_count: number;
    tx_pool_size: number;
    total_connections: number;
    incoming_connections: number;
    outgoing_connections: number;
    white_peerlist_size: number;
    grey_peerlist_size: number;
    block_size_limit: number;
    block_size_median: number;
    database_size: number;
    alt_blocks_count: number;
    active_miners: number;
    pool_hashrate: number;
    pool_hashrate_formatted: string;
    pool_blocks_found: number;
    pool_uptime_s: number;
    version: string;
    connected: boolean;
    last_block?: { height: number; hash: string; timestamp: number; difficulty: number; reward: number; num_txes: number; block_size: number };
  }

  type HistoryPoint = { ts: number; value: number };

  const [chainStats, setChainStats] = useState<ChainStats | null>(null);
  const [hashrateHistory, setHashrateHistory] = useState<HistoryPoint[]>([]);
  const [difficultyHistory, setDifficultyHistory] = useState<HistoryPoint[]>([]);
  const [blockTimeHistory, setBlockTimeHistory] = useState<HistoryPoint[]>([]);

  const fetchChainStats = useCallback(async () => {
    try {
      const res = await fetch('/api/blockchain/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setChainStats(json);
      const now = Math.floor(Date.now() / 1000);
      const appendPoint = (prev: HistoryPoint[], value: number) =>
        [...prev.filter((p) => now - p.ts < 3600), { ts: now, value }].slice(-60);

      setHashrateHistory((prev) => appendPoint(prev, json.network_hashrate ?? 0));
      setDifficultyHistory((prev) => appendPoint(prev, json.difficulty ?? 0));
      setBlockTimeHistory((prev) => appendPoint(prev, json.avg_block_time ?? 0));
    } catch { /* silent */ }
  }, []);

  usePolling(fetchChainStats, 15_000);

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <section className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Radio className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {tr('networkPage', 'network_1', lang)}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tr('networkPage', 'live_status', lang)}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {tr('networkPage', 'p2p_network', lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Telemetrie v realnem case z aktualniho verejneho runtime na Zion2. Drivejsi multi-host validace zustava zachovana v archivovanem deployi 2.9.8 a breznovych status reportech, ale uz nepredstavuje zivou topologii.'
                  : 'Real-time telemetry from the current public runtime on Zion2. Earlier multi-host validation remains preserved in archived 2.9.8 deploy and March status reports, but is no longer the live topology.'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {tr('networkPage', 'native_rust', lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Runtime: {SITE_RUNTIME_LABEL}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {tr('networkPage', '1_public_host_2_internal_seeds', lang)}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ RUNTIME SNAPSHOT ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'runtime_snapshot', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-cyan" />
              {tr('networkPage', 'public_network_surface', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'the_current_live_footprint_distilled_to_the_e', lang)}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
            {runtimePanels.map((panel) => (
              <div
                key={panel.label}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <panel.icon className={`h-5 w-5 ${panel.accent}`} />
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{panel.label}</p>
                </div>
                <p className="text-base font-semibold text-white break-all">{panel.value}</p>
                <p className="mt-2 text-sm text-gray-400">{panel.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK HEALTH SCORE ═══════ */}
        {chainStats && (
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'health', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {tr('networkPage', 'network_health_score', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'aggregate_health_indicator_based_on_key_netwo', lang)}</p>
          </div>

          {(() => {
            const checks = [
              { label: tr('networkPage', 'node_online', lang), ok: chainStats.connected, weight: 25 },
              { label: tr('networkPage', 'blocks_mining', lang), ok: chainStats.block_height > 0, weight: 20 },
              { label: tr('networkPage', 'active_miners', lang), ok: chainStats.active_miners > 0, weight: 15 },
              { label: tr('networkPage', 'normal_block_time', lang), ok: chainStats.avg_block_time > 0 && chainStats.avg_block_time < 180, weight: 15 },
              { label: 'P2P Peers', ok: chainStats.total_connections >= 1, weight: 10 },
              { label: 'Mempool', ok: true, weight: 5 },
              { label: tr('networkPage', 'database_ok', lang), ok: chainStats.database_size > 0, weight: 5 },
              { label: tr('networkPage', 'pool_online', lang), ok: chainStats.pool_hashrate > 0 || chainStats.active_miners > 0, weight: 5 },
            ];
            const score = checks.reduce((acc, c) => acc + (c.ok ? c.weight : 0), 0);
            const scoreColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-zion-gold' : score >= 50 ? 'text-amber-400' : 'text-red-400';
            const scoreBorder = score >= 90 ? 'border-emerald-400/30' : score >= 70 ? 'border-zion-gold/30' : score >= 50 ? 'border-amber-400/30' : 'border-red-400/30';
            const scoreGlow = score >= 90 ? 'shadow-emerald-400/20' : score >= 70 ? 'shadow-zion-gold/20' : score >= 50 ? 'shadow-amber-400/20' : 'shadow-red-400/20';

            return (
              <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                {/* Score circle */}
                <div className="flex flex-col items-center justify-center">
                  <div className={`relative w-40 h-40 rounded-full border-4 ${scoreBorder} flex items-center justify-center shadow-lg ${scoreGlow}`}>
                    <div className="text-center">
                      <p className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
                      <p className="text-xs text-gray-500 mt-1">{tr('networkPage', 'of_100', lang)}</p>
                    </div>
                    <svg className="absolute inset-0" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                      <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                        className={scoreColor}
                        strokeDasharray={`${(score / 100) * 465} 465`}
                        transform="rotate(-90 80 80)"
                      />
                    </svg>
                  </div>
                  <p className={`mt-4 text-sm font-semibold ${scoreColor}`}>
                    {score >= 90 ? (tr('networkPage', 'excellent', lang)) : score >= 70 ? (tr('networkPage', 'good', lang)) : score >= 50 ? (tr('networkPage', 'fair', lang)) : (tr('networkPage', 'critical', lang))}
                  </p>
                </div>

                {/* Check items */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {checks.map((c) => (
                    <div key={c.label} className={`rounded-2xl border p-4 ${c.ok ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${c.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider">{c.label}</span>
                      </div>
                      <p className={`text-lg font-bold ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>{c.ok ? (tr('networkPage', 'ok', lang)) : (tr('networkPage', 'fail', lang))}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{c.weight} {tr('networkPage', 'pts', lang)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
        )}

        {/* ═══════ CHAIN PERFORMANCE ═══════ */}
        {chainStats && (
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'performance', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {tr('networkPage', 'chain_performance', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'live_sparklines_for_hashrate_difficulty_and_b', lang)}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Hashrate */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{tr('networkPage', 'network_hashrate', lang)}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{chainStats.network_hashrate_formatted}</p>
                </div>
              </div>
              <NetSparkline data={hashrateHistory.map(p => p.value)} color="rgb(52, 211, 153)" height={80} />
            </div>

            {/* Difficulty */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{tr('networkPage', 'difficulty', lang)}</p>
                  <p className="text-2xl font-bold text-zion-cyan font-mono mt-1">{fmtLargeNum(chainStats.difficulty)}</p>
                </div>
              </div>
              <NetSparkline data={difficultyHistory.map(p => p.value)} color="rgb(34, 211, 238)" height={80} />
            </div>

            {/* Block Time */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{tr('networkPage', 'avg_block_time', lang)}</p>
                  <p className="text-2xl font-bold text-blue-400 font-mono mt-1">{chainStats.avg_block_time}s</p>
                </div>
                <span className="text-xs text-gray-500">{tr('networkPage', 'target', lang)}: {chainStats.target_block_time ?? BLOCK_TIME_SECONDS}s</span>
              </div>
              <NetSparkline data={blockTimeHistory.map(p => p.value)} color="rgb(96, 165, 250)" height={80} />
            </div>
          </div>
        </section>
        )}

        {/* ═══════ CHAIN STATISTICS ═══════ */}
        {chainStats && (
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'statistics', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-gold" />
              {tr('networkPage', 'chain_statistics', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'detailed_metrics_from_the_live_blockchain', lang)}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <ChainStatCard label={tr('networkPage', 'block_height', lang)} value={chainStats.block_height.toLocaleString(locale)} color="text-zion-gold" />
            <ChainStatCard label={tr('networkPage', 'difficulty', lang)} value={fmtLargeNum(chainStats.difficulty)} color="text-zion-cyan" />
            <ChainStatCard label={tr('networkPage', 'cumulative_diff', lang)} value={fmtLargeNum(chainStats.cumulative_difficulty)} color="text-zion-cyan" />
            <ChainStatCard label={tr('networkPage', 'circulating_supply', lang)} value={`${fmtLargeNum(chainStats.circulating_supply)} ZION`} color="text-zion-gold" />
            <ChainStatCard label={tr('networkPage', 'emission', lang)} value={`${chainStats.emission_pct}%`} color="text-pink-400" />
            <ChainStatCard label={tr('networkPage', 'total_tx', lang)} value={chainStats.tx_count.toLocaleString(locale)} color="text-purple-400" />
            <ChainStatCard label="Mempool" value={`${chainStats.tx_pool_size} tx`} color={chainStats.tx_pool_size > 0 ? 'text-amber-400' : 'text-gray-400'} />
            <ChainStatCard label={tr('networkPage', 'total_peers', lang)} value={`${chainStats.total_connections}`} sub={`↓${chainStats.incoming_connections} ↑${chainStats.outgoing_connections}`} color="text-purple-400" />
            <ChainStatCard label={tr('networkPage', 'known_peers', lang)} value={`${chainStats.white_peerlist_size}`} sub={`${chainStats.grey_peerlist_size} grey`} color="text-indigo-400" />
            <ChainStatCard label={tr('networkPage', 'block_size_limit', lang)} value={fmtBytes(chainStats.block_size_limit)} sub={`${tr('networkPage', 'median', lang)}: ${fmtBytes(chainStats.block_size_median)}`} color="text-cyan-400" />
            <ChainStatCard label={tr('networkPage', 'database', lang)} value={fmtBytes(chainStats.database_size)} color="text-pink-400" />
            <ChainStatCard label={tr('networkPage', 'version', lang)} value={chainStats.version ? `v${chainStats.version}` : '—'} color="text-gray-300" />
            <ChainStatCard label={tr('networkPage', 'alt_blocks', lang)} value={`${chainStats.alt_blocks_count ?? 0}`} color="text-amber-400" />
            <ChainStatCard label={tr('networkPage', 'active_miners', lang)} value={`${chainStats.active_miners}`} color="text-emerald-400" />
            <ChainStatCard label={tr('networkPage', 'pool_hashrate', lang)} value={chainStats.pool_hashrate_formatted || '—'} color="text-emerald-400" />
            <ChainStatCard label={tr('networkPage', 'pool_blocks', lang)} value={`${chainStats.pool_blocks_found ?? 0}`} color="text-zion-gold" />
            {chainStats.last_block && (
              <>
                <ChainStatCard label={tr('networkPage', 'last_block', lang)} value={`#${chainStats.last_block.height.toLocaleString(locale)}`} sub={new Date(chainStats.last_block.timestamp * 1000).toLocaleTimeString(locale)} color="text-zion-gold" />
                <ChainStatCard label={tr('networkPage', 'last_reward', lang)} value={`${(chainStats.last_block.reward / 1e12).toFixed(2)} ZION`} color="text-emerald-400" />
              </>
            )}
          </div>
        </section>
        )}

        {/* ═══════ EMISSION PROGRESS ═══════ */}
        {chainStats && (
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'emission', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Coins className="h-7 w-7 text-zion-gold" />
              {tr('networkPage', 'emission_progress', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'decade_decay_model_20_every_10_years_max_supp', lang)}</p>
          </div>

          {/* Overall progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{tr('networkPage', 'mined', lang)}: {chainStats.emission_pct}%</span>
              <span className="text-sm text-gray-400">{fmtLargeNum(chainStats.circulating_supply)} / {fmtLargeNum(TOTAL_SUPPLY_ZION)} ZION</span>
            </div>
            <div className="h-4 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-zion-gold via-emerald-400 to-zion-cyan transition-all duration-500" style={{ width: `${Math.min(100, Number(chainStats.emission_pct))}%` }} />
            </div>
          </div>

          {/* Decade table */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => {
              const decadeStart = i * BLOCKS_PER_DECADE + 1;
              const decadeEnd = (i + 1) * BLOCKS_PER_DECADE;
              const reward = blockRewardAtHeight(decadeStart);
              const currentDecade = Math.floor((chainStats.block_height - 1) / BLOCKS_PER_DECADE);
              const isCurrent = i === currentDecade;
              const isPast = i < currentDecade;
              return (
                <div key={i} className={`rounded-2xl border p-4 ${isCurrent ? 'border-zion-gold/40 bg-zion-gold/10' : isPast ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">{tr('networkPage', 'decade', lang)} {i + 1}</span>
                    {isCurrent && <span className="text-[9px] font-bold uppercase tracking-widest text-zion-gold bg-zion-gold/20 px-2 py-0.5 rounded-full">{tr('networkPage', 'now', lang)}</span>}
                    {isPast && <span className="text-[9px] text-emerald-400">✓</span>}
                  </div>
                  <p className={`text-lg font-bold font-mono ${isCurrent ? 'text-zion-gold' : isPast ? 'text-emerald-400' : 'text-gray-400'}`}>{reward.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">ZION/{tr('networkPage', 'block', lang)}</p>
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">{fmtLargeNum(decadeStart)}–{fmtLargeNum(decadeEnd)}</p>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'infrastructure', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              {tr('networkPage', 'current_runtime', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'current_public_runtime_is_a_single_primary_ho', lang)}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-1 lg:max-w-2xl">
            {infraFeatures.map((node) => (
              <div
                key={node.title}
                className={`relative overflow-hidden rounded-3xl border ${node.border} ${node.bg} p-6`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <node.icon className={`h-6 w-6 ${node.color}`} />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{node.title}</h3>
                      <p className="text-sm text-gray-400">{node.detail}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] rounded-full border ${node.border} px-3 py-1 ${node.color} uppercase tracking-widest`}>
                    {node.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-mono">{node.ip}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Zap className="w-3.5 h-3.5 text-gray-500" />
                    <span>{tr('networkPage', 'stratum_port_3333', lang)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Terminal className="w-3.5 h-3.5 text-gray-500" />
                    <span>RPC: port 8443</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span>P2P: port 8333</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'live_telemetry', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {tr('networkPage', 'node_status', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'real_time_health_block_height_hashrate_and_sy', lang)}</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </section>

        {/* ═══════ MONITORING SNAPSHOT ═══════ */}
        <NetworkMonitoringSnapshot cs={cs} locale={locale} />

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <section>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'geography', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              {tr('networkPage', 'network_map_pool_finder', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'visualize_the_current_topology_and_compare_it', lang)}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </section>

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'connect', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              {tr('networkPage', 'connection_guides', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'everything_you_need_to_connect_a_miner_query_', lang)}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block) => (
              <div
                key={block.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <block.icon className="h-5 w-5 text-zion-gold" />
                  <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{block.description}</p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-1">
                  {block.items.map((line) => (
                    <code key={line} className="block text-sm font-mono text-zion-gold">{line}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('networkPage', 'status', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {tr('networkPage', 'network_readiness', lang)}
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {networkFacts.map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm py-2">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${item.done ? 'text-emerald-400' : 'text-gray-600'}`} />
                <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono text-emerald-400">{factsDone}</span>
            <span>/</span>
            <span className="font-mono">{factsTotal}</span>
            <span>{tr('networkPage', 'completed', lang)}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <NetworkOperatorToolkit cs={cs} primaryPool={primaryPool} />

        {/* ═══════ NETWORK FAQ ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Hash className="h-7 w-7 text-purple-400" />
              {tr('networkPage', 'frequently_asked_questions', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('networkPage', 'everything_about_the_zion_network_in_one_plac', lang)}</p>
          </div>
          <NetFAQSection cs={cs} />
        </section>

        {/* ═══════ CTA ═══════ */}
        <section className="rounded-4xl border border-emerald-400/30 bg-linear-to-r from-emerald-500/20 via-zion-cyan/10 to-emerald-500/20 p-10 text-center">
          <Radio className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{tr('networkPage', 'join_the_zion_network', lang)}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'Nativni Rust infrastruktura bezi 24/7 z aktualniho primarniho hostu s podporou interniho kvora. Pripojte svuj miner, spustte vlastni node nebo prozkoumejte blockchain, zatimco historicky kontext rollouta zustava zachovany v dokumentaci.'
              : 'Native Rust infrastructure running 24/7 from the current primary host with internal quorum support. Connect your miner, run your own node, or explore the blockchain while historical rollout context stays preserved in docs.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · Public launch target 31.12.2026
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {[
              'Cosmic Harmony PoW',
              tr('networkPage', 'primary_host_live', lang),
              tr('networkPage', 'internal_seeds', lang),
              tr('networkPage', 'docker_native', lang),
              tr('networkPage', 'archived_multi_host_history', lang),
            ].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Activity className="h-4 w-4" /> {tr('networkPage', 'explorer', lang)}
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-400 to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
              <Rocket className="h-4 w-4" /> {tr('networkPage', 'roadmap', lang)}
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Sit Pro · ${SITE_NETWORK_TOPOLOGY} · Archivovany multi-host rollout zachovan v dokumentaci`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Network Pro · ${SITE_NETWORK_TOPOLOGY} · Archived multi-host rollout preserved in docs`}
        </p>
      </div>
    </div>
  );
}

function SurfaceSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
      <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 w-full rounded bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

/* ─── NetSparkline ─── */
function NetSparkline({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <div className="flex items-center justify-center" style={{ height }}><span className="text-xs text-gray-500">collecting…</span></div>;
  const w = 260;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
    </svg>
  );
}

/* ─── ChainStatCard ─── */
function ChainStatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color} truncate`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

/* ─── NetFAQSection ─── */
function NetFAQSection({ cs }: { cs: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: tr('networkPage', 'what_consensus_does_zion_use', lang), a: tr('networkPage', 'cosmic_harmony_proof_of_work_a_custom_crypton', lang) },
    { q: tr('networkPage', 'what_is_the_target_block_time', lang), a: tr('networkPage', '60_seconds_difficulty_adjusts_dynamically_eve', lang) },
    { q: tr('networkPage', 'how_many_zion_are_mined_per_block', lang), a: cs ? `V první dekádě je odměna ${BLOCK_REWARD_ZION.toFixed(3)} ZION/blok. Každých 10 let (${BLOCKS_PER_DECADE.toLocaleString()} bloků) se odměna sníží o 20 % (Decade Decay).` : `In the first decade the reward is ${BLOCK_REWARD_ZION.toFixed(3)} ZION/block. Every 10 years (${BLOCKS_PER_DECADE.toLocaleString()} blocks) the reward decreases by 20% (Decade Decay).` },
    { q: tr('networkPage', 'what_is_the_maximum_supply', lang), a: cs ? `Maximální supply je ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} miliard ZION včetně genesis premine ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)} mld ZION.` : `Maximum supply is ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} billion ZION including genesis premine of ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)}B ZION.` },
    { q: tr('networkPage', 'how_to_connect_as_a_miner', lang), a: tr('networkPage', 'download_xmrig_or_the_desktop_agent_and_use_s', lang) },
    { q: tr('networkPage', 'how_to_run_your_own_full_node', lang), a: tr('networkPage', 'clone_the_repo_cargo_build_release_from_l1_co', lang) },
    { q: tr('networkPage', 'what_pool_fee_does_zion_charge', lang), a: tr('networkPage', '89_goes_to_the_miner_5_to_the_humanitarian_fu', lang) },
    { q: tr('networkPage', 'is_the_network_publicly_launched', lang), a: tr('networkPage', 'v3_mainnet_is_in_preparation_target_launch_31', lang)s Eve). Core + Edge topology is in testing, mining test active, bridge in preparation on Base Mainnet.' },
  ];
  return (
    <div className="divide-y divide-white/[0.06]">
      {faqs.map((f, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between py-4 text-left gap-4 group">
            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">{f.q}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="pb-4 text-sm text-gray-400 leading-relaxed">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

/* ─── formatters ─── */
function fmtLargeNum(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}
