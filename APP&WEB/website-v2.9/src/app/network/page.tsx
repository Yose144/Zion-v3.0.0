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
  HelpCircle,
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
const NetworkAlgorithmPanel = dynamic(() => import('@/components/network/NetworkAlgorithmPanel'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkRewardDistribution = dynamic(() => import('@/components/network/NetworkRewardDistribution'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkEventsFeed = dynamic(() => import('@/components/network/NetworkEventsFeed'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const Network24hCharts = dynamic(() => import('@/components/network/Network24hCharts'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkLatencyPanel = dynamic(() => import('@/components/network/NetworkLatencyPanel'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const LiveToast = dynamic(() => import('@/components/explorer/LiveToast'));

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  {
    label: cs ? 'Veřejné nody' : 'Public Nodes',
    value: '2',
    descriptor: cs
      ? 'Edge relay (Hetzner VPS) + Core (privátní master)'
      : 'Edge relay (Hetzner VPS) + Core (private master)',
  },
  {
    label: cs ? 'P2P mesh' : 'P2P Mesh',
    value: cs ? 'Core + Edge' : 'Core + Edge',
    descriptor: cs ? 'VPN tunel — Core ↔ Edge' : 'VPN tunnel — Core ↔ Edge',
  },
  {
    label: cs ? 'Telemetrie' : 'Telemetry',
    value: '30s',
    descriptor: cs ? 'Interval auto-obnovení' : 'Auto-refresh interval',
  },
  {
    label: cs ? 'Topologie' : 'Topology',
    value: cs ? 'Core + Edge' : 'Core + Edge',
    descriptor: cs ? 'Edge relay + Core master (PPLNS okno na Core)' : 'Edge relay + Core master (PPLNS window on Core)',
  },
  {
    label: cs ? 'Síť' : 'Network',
    value: 'V3 Mainnet',
    descriptor: cs
      ? 'Mainnet launch countdown v3.0.2 · runtime v3.0.2'
      : 'Mainnet launch countdown v3.0.2 · runtime v3.0.2',
  },
];

const getInfraFeatures = (cs: boolean) => [
  {
    icon: Server,
    title: cs ? 'Edge relay (Hetzner VPS)' : 'Edge Relay (Hetzner VPS)',
    detail: cs
      ? 'Veřejný P2P + stratum relay — P2P 8333, Pool 8444, Node RPC 8443'
      : 'Public P2P + stratum relay — P2P 8333, Pool 8444, Node RPC 8443',
    ip: '77.42.71.94',
    status: cs ? 'Aktivní' : 'Active',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: cs ? 'Core (privátní master)' : 'Core (private master)',
    detail: cs
      ? 'Zdroj pravdy — Node 1 (Genesis), Node 2, Master PPLNS pool, GPU miner'
      : 'Source of truth — Node 1 (Genesis), Node 2, Master PPLNS pool, GPU miner',
    ip: cs ? 'Privátní VPN' : 'Private VPN',
    status: cs ? 'VPN tunel' : 'VPN tunnel',
    color: 'text-zion-cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
];

const getRuntimePanels = (cs: boolean) => [
  {
    icon: Radio,
    label: cs ? 'Verejny stratum' : 'Public Stratum',
    value: SITE_POOL_PRIMARY,
    detail: cs ? 'Aktualni primarni tezebni vstup na Zion2' : 'Current primary mining ingress on Zion2',
    accent: 'text-zion-gold',
  },
  {
    icon: Terminal,
    label: 'RPC Endpoint',
    value: SITE_PRIMARY_RPC_URL,
    detail: cs ? 'Nativni Rust JSON-RPC pro explorer a tooling' : 'Native Rust JSON-RPC for explorers and tooling',
    accent: 'text-zion-cyan',
  },
  {
    icon: Globe,
    label: 'P2P Peer',
    value: `${SITE_PRIMARY_HOST}:8333`,
    detail: cs ? 'Veřejný Edge relay — Core sync přes privátní VPN' : 'Public Edge relay — Core sync via private VPN',
    accent: 'text-emerald-400',
  },
  {
    icon: BookOpen,
    label: cs ? 'Kontext releasu' : 'Release Context',
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
    title: cs ? 'Tezba' : 'Mining',
    description: cs ? 'Pripojte jakykoli Cosmic Harmony / CPU miner k aktualnimu verejnemu poolu na Zion2.' : 'Connect any Cosmic Harmony / CPU miner to the current public pool on Zion2.',
    items: [
      `Pool: ${SITE_POOL_PRIMARY} ${cs ? '(aktualni primarni)' : '(current primary)'}`,
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
      `Scope: ${cs ? 'verejny runtime endpoint' : 'public runtime endpoint'}`,
      `Archive: ${cs ? 'docs/2.9.8 + breznovy status report' : 'docs/2.9.8 + March status reports'}`,
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
      `${cs ? 'Veřejný peer (Edge)' : 'Public peer (Edge)'}: ${SITE_PRIMARY_HOST}:8333`,
      cs ? 'Core peer (VPN): Privátní peer (neveřejný)' : 'Core peer (VPN): Private peer (non-public)',
      cs ? 'VPN tunel: WireGuard (Core ↔ Edge)' : 'VPN tunnel: WireGuard (Core ↔ Edge)',
    ],
  },
];

const getNetworkFacts = (cs: boolean) => [
  { text: cs ? 'Nativní Rust P2P — Edge relay veřejný' : 'Native Rust P2P — Edge relay public', done: true },
  {
    text: cs ? 'Core + Edge topologie s privátním VPN tunelem' : 'Core + Edge topology with private VPN tunnel',
    done: true,
  },
  {
    text: cs ? 'Edge stratum endpoint: 77.42.71.94:8444 (ShareRelay)' : 'Edge stratum endpoint: 77.42.71.94:8444 (ShareRelay)',
    done: true,
  },
  { text: cs ? 'JSON-RPC endpointy live (port 8443)' : 'JSON-RPC endpoints live (port 8443)', done: true },
  { text: cs ? 'systemd služby s auto-restartem na Edge' : 'systemd services with auto-restart on Edge', done: true },
  { text: cs ? 'LWMA DAA — cíl 60s block time' : 'LWMA DAA — target 60s block time', done: true },
  {
    text: cs ? 'ShareRelay protokol: Edge → Core PPLNS synchronizace' : 'ShareRelay protocol: Edge → Core PPLNS sync',
    done: true,
  },
  { text: cs ? 'Monitoring Prometheus + Grafana' : 'Prometheus + Grafana monitoring', done: true },
  {
    text: cs ? 'UFW firewall na Edge (8333, 8444, 22, 41641)' : 'UFW firewall on Edge (8333, 8444, 22, 41641)',
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
  const locale = cs ? 'cs-CZ' : 'en-US';
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
  const [blockHeight, setBlockHeight] = useState(0);

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
      if (json.block_height) setBlockHeight(json.block_height);
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
        <section
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="zion-kicker border-cyan-400/35 bg-cyan-400/10 text-cyan-200">
                <Radio className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? 'Sit' : 'Network'}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Zivy stav' : 'Live Status'}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'P2P Sit' : 'P2P Network'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Telemetrie v realnem case z aktualniho verejneho runtime na Zion2. Drivejsi multi-host validace zustava zachovana v archivovanem deployi 2.9.8 a breznovych status reportech, ale uz nepredstavuje zivou topologii.'
                  : 'Real-time telemetry from the current public runtime on Zion2. Earlier multi-host validation remains preserved in archived 2.9.8 deploy and March status reports, but is no longer the live topology.'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {cs ? 'Nativni Rust' : 'Native Rust'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Runtime: {SITE_RUNTIME_LABEL}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {cs ? '1 verejny host · 2 interni seedy' : '1 Public Host · 2 Internal Seeds'}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div
                  key={chip.label}
                  className="zion-rainbow-sub px-5 py-4 backdrop-blur"
                  style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ RUNTIME SNAPSHOT ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Runtime prehled' : 'Runtime Snapshot'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Verejny povrch site' : 'Public Network Surface'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktualni zivy footprint zredukovany na endpointy a role, ktere operatori potrebuji jako prvni.' : 'The current live footprint distilled to the endpoints and roles operators actually need first.'}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
            {runtimePanels.map((panel) => (
              <div
                key={panel.label}
                className="zion-rainbow-sub p-6"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
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
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Zdraví' : 'Health'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {cs ? 'Skóre zdraví sítě' : 'Network Health Score'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Agregátní indikátor stavu sítě na základě klíčových metrik.' : 'Aggregate health indicator based on key network metrics.'}</p>
          </div>

          {(() => {
            const checks = [
              { label: cs ? 'Node online' : 'Node Online', ok: chainStats.connected, weight: 25 },
              { label: cs ? 'Bloky se těží' : 'Blocks Mining', ok: chainStats.block_height > 0, weight: 20 },
              { label: cs ? 'Aktivní mineři' : 'Active Miners', ok: chainStats.active_miners > 0, weight: 15 },
              { label: cs ? 'Normální block time' : 'Normal Block Time', ok: chainStats.avg_block_time > 0 && chainStats.avg_block_time < 180, weight: 15 },
              { label: 'P2P Peers', ok: chainStats.total_connections >= 1, weight: 10 },
              { label: 'Mempool', ok: true, weight: 5 },
              { label: cs ? 'Databáze OK' : 'Database OK', ok: chainStats.database_size > 0, weight: 5 },
              { label: cs ? 'Pool online' : 'Pool Online', ok: chainStats.pool_hashrate > 0 || chainStats.active_miners > 0, weight: 5 },
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
                      <p className="text-xs text-gray-500 mt-1">{cs ? 'ze 100' : 'of 100'}</p>
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
                    {score >= 90 ? (cs ? 'Výborný' : 'Excellent') : score >= 70 ? (cs ? 'Dobrý' : 'Good') : score >= 50 ? (cs ? 'Průměrný' : 'Fair') : (cs ? 'Kritický' : 'Critical')}
                  </p>
                </div>

                {/* Check items */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {checks.map((c) => (
                    <div key={c.label} className="zion-rainbow-sub p-4" style={{ '--rc': c.ok ? '52, 211, 153' : '248, 113, 113' } as React.CSSProperties}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${c.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider">{c.label}</span>
                      </div>
                      <p className={`text-lg font-bold ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>{c.ok ? (cs ? 'OK' : 'OK') : (cs ? 'FAIL' : 'FAIL')}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{c.weight} {cs ? 'bodů' : 'pts'}</p>
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
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Výkon' : 'Performance'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Výkon chainu' : 'Chain Performance'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Živé grafy hashrate, obtížnosti a block time za poslední hodinu.' : 'Live sparklines for hashrate, difficulty, and block time over the last hour.'}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Hashrate */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{cs ? 'Hashrate sítě' : 'Network Hashrate'}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{chainStats.network_hashrate_formatted}</p>
                </div>
              </div>
              <NetSparkline data={hashrateHistory.map(p => p.value)} color="rgb(52, 211, 153)" height={80} />
            </div>

            {/* Difficulty */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{cs ? 'Obtížnost' : 'Difficulty'}</p>
                  <p className="text-2xl font-bold text-zion-cyan font-mono mt-1">{fmtLargeNum(chainStats.difficulty)}</p>
                </div>
              </div>
              <NetSparkline data={difficultyHistory.map(p => p.value)} color="rgb(34, 211, 238)" height={80} />
            </div>

            {/* Block Time */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{cs ? 'Průměrný block time' : 'Avg Block Time'}</p>
                  <p className="text-2xl font-bold text-blue-400 font-mono mt-1">{chainStats.avg_block_time}s</p>
                </div>
                <span className="text-xs text-gray-500">{cs ? 'Cíl' : 'Target'}: {chainStats.target_block_time ?? BLOCK_TIME_SECONDS}s</span>
              </div>
              <NetSparkline data={blockTimeHistory.map(p => p.value)} color="rgb(96, 165, 250)" height={80} />
            </div>
          </div>
        </section>
        )}

        {/* ═══════ 24-HOUR TRENDS ═══════ */}
        <Network24hCharts
          cs={cs}
          hashrateData={hashrateHistory.map((p) => p.value)}
          difficultyData={difficultyHistory.map((p) => p.value)}
          blockTimeData={blockTimeHistory.map((p) => p.value)}
        />

        {/* ═══════ CHAIN STATISTICS ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Statistika' : 'Statistics'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-gold" />
              {cs ? 'Statistiky chainu' : 'Chain Statistics'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Detailní metriky z živého blockchainu.' : 'Detailed metrics from the live blockchain.'}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <ChainStatCard label={cs ? 'Výška bloku' : 'Block Height'} value={chainStats.block_height.toLocaleString(locale)} color="text-zion-gold" tip={cs ? 'Celkový počet vytěžených bloků od genesis.' : 'Total number of mined blocks since genesis.'} />
            <ChainStatCard label={cs ? 'Obtížnost' : 'Difficulty'} value={fmtLargeNum(chainStats.difficulty)} color="text-zion-cyan" tip={cs ? 'Aktuální těžební obtížnost nastavená LWMA DAA.' : 'Current mining difficulty set by LWMA DAA.'} />
            <ChainStatCard label={cs ? 'Kumulativní obtížnost' : 'Cumulative Diff'} value={fmtLargeNum(chainStats.cumulative_difficulty)} color="text-zion-cyan" tip={cs ? 'Součet obtížnosti všech bloků — měří celkovou práci v síti.' : 'Sum of difficulty across all blocks — measures total network work.'} />
            <ChainStatCard label={cs ? 'Oběžná zásoba' : 'Circulating Supply'} value={`${fmtLargeNum(chainStats.circulating_supply)} ZION`} color="text-zion-gold" tip={cs ? 'Celkové množství ZION v oběhu včetně genesis premine.' : 'Total ZION in circulation including genesis premine.'} />
            <ChainStatCard label={cs ? 'Emise' : 'Emission'} value={`${chainStats.emission_pct}%`} color="text-pink-400" tip={cs ? 'Procento vytěžené celkové zásoby podle Decade Decay plánu.' : 'Percentage of total supply mined according to the Decade Decay schedule.'} />
            <ChainStatCard label={cs ? 'Celkem TX' : 'Total TX'} value={chainStats.tx_count.toLocaleString(locale)} color="text-purple-400" tip={cs ? 'Celkový počet transakcí zapsaných na blockchainu.' : 'Total number of transactions recorded on the blockchain.'} />
            <ChainStatCard label="Mempool" value={`${chainStats.tx_pool_size} tx`} color={chainStats.tx_pool_size > 0 ? 'text-amber-400' : 'text-gray-400'} tip={cs ? 'Transakce čekající na potvrzení v mempoolu.' : 'Transactions waiting for confirmation in the mempool.'} />
            <ChainStatCard label={cs ? 'Peery celkem' : 'Total Peers'} value={`${chainStats.total_connections}`} sub={`↓${chainStats.incoming_connections} ↑${chainStats.outgoing_connections}`} color="text-purple-400" tip={cs ? 'Aktivní P2P spojení — příchozí a odchozí.' : 'Active P2P connections — incoming and outgoing.'} />
            <ChainStatCard label={cs ? 'Známé peery' : 'Known Peers'} value={`${chainStats.white_peerlist_size}`} sub={`${chainStats.grey_peerlist_size} grey`} color="text-indigo-400" tip={cs ? 'Známy (white) a neznámý (grey) peer seznam.' : 'Known (white) and unknown (grey) peer lists.'} />
            <ChainStatCard label={cs ? 'Limit bloku' : 'Block Size Limit'} value={fmtBytes(chainStats.block_size_limit)} sub={`${cs ? 'Medián' : 'Median'}: ${fmtBytes(chainStats.block_size_median)}`} color="text-cyan-400" tip={cs ? 'Maximální a mediánová velikost bloku v bytech.' : 'Maximum and median block size in bytes.'} />
            <ChainStatCard label={cs ? 'Databáze' : 'Database'} value={fmtBytes(chainStats.database_size)} color="text-pink-400" tip={cs ? 'Velikost lokálního blockchain databázového souboru.' : 'Size of the local blockchain database file.'} />
            <ChainStatCard label={cs ? 'Verze' : 'Version'} value={chainStats.version ? `v${chainStats.version}` : '—'} color="text-gray-300" tip={cs ? 'Verze softwaru uzlu.' : 'Node software version.'} />
            <ChainStatCard label={cs ? 'Alt bloky' : 'Alt Blocks'} value={`${chainStats.alt_blocks_count ?? 0}`} color="text-amber-400" tip={cs ? 'Počet alternativních větví (orphan chain tipy).' : 'Number of alternative branches (orphan chain tips).'} />
            <ChainStatCard label={cs ? 'Aktivní mineři' : 'Active Miners'} value={`${chainStats.active_miners}`} color="text-emerald-400" tip={cs ? 'Počet aktivních minerů připojených k poolu.' : 'Number of active miners connected to the pool.'} />
            <ChainStatCard label={cs ? 'Pool hashrate' : 'Pool Hashrate'} value={chainStats.pool_hashrate_formatted || '—'} color="text-emerald-400" tip={cs ? 'Celkový výpočetní výkon všech minerů v poolu.' : 'Total computational power of all miners in the pool.'} />
            <ChainStatCard label={cs ? 'Pool bloky' : 'Pool Blocks'} value={`${chainStats.pool_blocks_found ?? 0}`} color="text-zion-gold" tip={cs ? 'Počet bloků nalezených tímto poolem.' : 'Number of blocks found by this pool.'} />
            {chainStats.last_block && (
              <>
                <ChainStatCard label={cs ? 'Poslední blok' : 'Last Block'} value={`#${chainStats.last_block.height.toLocaleString(locale)}`} sub={new Date(chainStats.last_block.timestamp * 1000).toLocaleTimeString(locale)} color="text-zion-gold" tip={cs ? 'Nejnovější potvrzený blok a čas jeho vytěžení.' : 'Latest confirmed block and its mining time.'} />
                <ChainStatCard label={cs ? 'Odměna' : 'Last Reward'} value={`${(chainStats.last_block.reward / 1e6).toFixed(2)} ZION`} color="text-emerald-400" tip={cs ? 'Odměna za poslední blok dle Decade Decay.' : 'Reward for the latest block per Decade Decay.'} />
              </>
            )}
          </div>
        </section>
        )}

        {/* ═══════ EMISSION PROGRESS ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Emise' : 'Emission'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Coins className="h-7 w-7 text-zion-gold" />
              {cs ? 'Průběh emise' : 'Emission Progress'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Decade Decay model: -20 % každých 10 let. Max supply 144 miliard ZION.' : 'Decade Decay model: -20% every 10 years. Max supply 144 billion ZION.'}</p>
          </div>

          {/* Overall progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{cs ? 'Vytěženo' : 'Mined'}: {chainStats.emission_pct}%</span>
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
                <div key={i} className="zion-rainbow-sub p-4" style={{ '--rc': isCurrent ? '251, 191, 36' : isPast ? '52, 211, 153' : '255, 255, 255' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">{cs ? 'Dekáda' : 'Decade'} {i + 1}</span>
                    {isCurrent && <span className="text-[9px] font-bold uppercase tracking-widest text-zion-gold bg-zion-gold/20 px-2 py-0.5 rounded-full">{cs ? 'Nyní' : 'Now'}</span>}
                    {isPast && <span className="text-[9px] text-emerald-400">✓</span>}
                  </div>
                  <p className={`text-lg font-bold font-mono ${isCurrent ? 'text-zion-gold' : isPast ? 'text-emerald-400' : 'text-gray-400'}`}>{reward.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">ZION/{cs ? 'blok' : 'block'}</p>
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">{fmtLargeNum(decadeStart)}–{fmtLargeNum(decadeEnd)}</p>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Infrastruktura' : 'Infrastructure'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              {cs ? 'Aktualni runtime' : 'Current Runtime'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktualni verejny runtime je jeden primarni host. Drivejsi multi-host validace zustava zdokumentovana jako archivovana historie validace.' : 'Current public runtime is a single primary host. Earlier multi-host validation remains documented as archived validation history.'}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-1 lg:max-w-2xl">
            {infraFeatures.map((node) => (
              <div
                key={node.title}
                className="relative overflow-hidden zion-rainbow-sub p-6"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
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
                    <span>{cs ? 'Stratum: port 3333' : 'Stratum: port 3333'}</span>
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

        {/* ═══════ ACTIVE ALGORITHM ═══════ */}
        <NetworkAlgorithmPanel cs={cs} />

        {/* ═══════ BLOCK REWARD DISTRIBUTION ═══════ */}
        <NetworkRewardDistribution cs={cs} />

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Ziva telemetrie' : 'Live Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Stav nodu' : 'Node Status'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Zdravi, vyska chainu, hashrate a sync stav v realnem case z aktualniho runtime na primarnim hostu.' : 'Real-time health, block height, hashrate, and sync status from the current primary-host runtime.'}</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </section>

        {/* ═══════ MONITORING SNAPSHOT ═══════ */}
        <NetworkMonitoringSnapshot cs={cs} locale={locale} />

        {/* ═══════ LIVE NETWORK FEED ═══════ */}
        <NetworkEventsFeed cs={cs} />

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <section>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Geografie' : 'Geography'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Mapa site a vyhledavac poolu' : 'Network Map & Pool Finder'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Vizualizujte aktualni topologii a porovnejte ji s archivovanym multi-host rolloutem zachovanym v release dokumentaci.' : 'Visualize the current topology and compare it with the archived multi-host rollout preserved in release documentation.'}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </section>

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Pripojeni' : 'Connect'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              {cs ? 'Pripojovaci navody' : 'Connection Guides'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Vse, co potrebujete k pripojeni minera, dotazovani RPC API nebo synchronizaci nodu.' : 'Everything you need to connect a miner, query the RPC API, or sync a node.'}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block) => (
              <div
                key={block.title}
                className="zion-rainbow-sub p-6 space-y-4"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <block.icon className="h-5 w-5 text-zion-gold" />
                  <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{block.description}</p>
                <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                  {block.items.map((line) => (
                    <code key={line} className="block text-sm font-mono text-zion-gold">{line}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Stav' : 'Status'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {cs ? 'Pripravenost site' : 'Network Readiness'}
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
            <span>{cs ? 'dokonceno' : 'completed'}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <NetworkOperatorToolkit cs={cs} primaryPool={primaryPool} />

        {/* ═══════ NETWORK FAQ ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Hash className="h-7 w-7 text-purple-400" />
              {cs ? 'Často kladené dotazy' : 'Frequently Asked Questions'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Vše o síti ZION na jednom místě.' : 'Everything about the ZION network in one place.'}</p>
          </div>
          <NetFAQSection cs={cs} />
        </section>

        {/* ═══════ CTA ═══════ */}
        <section
          className="zion-cta-banner"
          style={{
            borderColor: 'rgba(52, 211, 153, 0.35)',
            background:
              'linear-gradient(90deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.14) 50%, rgba(16, 185, 129, 0.25))',
            boxShadow: '0 24px 80px rgba(16, 185, 129, 0.18)',
          }}
        >
          <Radio className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'Pripojte se k siti ZION' : 'Join the ZION Network'}</h2>
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
              cs ? 'Primarni host online' : 'Primary host live',
              cs ? 'Interni seedy' : 'Internal seeds',
              cs ? 'Docker nativne' : 'Docker native',
              cs ? 'Archivovana multi-host historie' : 'Archived multi-host history',
            ].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Activity className="h-4 w-4" /> {cs ? 'Explorer' : 'Explorer'}
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-400 to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
              <Rocket className="h-4 w-4" /> {cs ? 'Roadmapa' : 'Roadmap'}
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

      <LiveToast currentHeight={blockHeight} />
    </div>
  );
}

function SurfaceSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="zion-rainbow-sub p-6 space-y-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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
function ChainStatCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color: string; tip?: string }) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 zion-tile px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-lg font-bold font-mono ${color} truncate`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

/* ─── NetFAQSection ─── */
function NetFAQSection({ cs }: { cs: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: cs ? 'Jaký konsenzus ZION používá?' : 'What consensus does ZION use?', a: cs ? 'Cosmic Harmony Proof-of-Work – vlastní CryptoNight varianta optimalizovaná pro CPU/GPU mining s 60s block time a Decade Decay emisí.' : 'Cosmic Harmony Proof-of-Work – a custom CryptoNight variant optimized for CPU/GPU mining with 60s block time and Decade Decay emission.' },
    { q: cs ? 'Jaký je cílový block time?' : 'What is the target block time?', a: cs ? '60 sekund. Obtížnost se dynamicky přizpůsobuje každý blok, aby udržela stabilní tempo.' : '60 seconds. Difficulty adjusts dynamically every block to maintain a stable pace.' },
    { q: cs ? 'Kolik ZION se vytěží za blok?' : 'How many ZION are mined per block?', a: cs ? `V první dekádě je odměna ${BLOCK_REWARD_ZION.toFixed(3)} ZION/blok. Každých 10 let (${BLOCKS_PER_DECADE.toLocaleString()} bloků) se odměna sníží o 20 % (Decade Decay).` : `In the first decade the reward is ${BLOCK_REWARD_ZION.toFixed(3)} ZION/block. Every 10 years (${BLOCKS_PER_DECADE.toLocaleString()} blocks) the reward decreases by 20% (Decade Decay).` },
    { q: cs ? 'Jaká je maximální zásoba?' : 'What is the maximum supply?', a: cs ? `Maximální supply je ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} miliard ZION včetně genesis premine ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)} mld ZION.` : `Maximum supply is ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} billion ZION including genesis premine of ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)}B ZION.` },
    { q: cs ? 'Jak se připojit jako miner?' : 'How to connect as a miner?', a: cs ? 'Stáhněte si XMRig nebo Desktop Agent a použijte stratum+tcp://77.42.71.94:8444 jako pool adresu. Detaily najdete v Connection Guides výše.' : 'Download XMRig or the Desktop Agent and use stratum+tcp://77.42.71.94:8444 as the pool address. See the Connection Guides section above for details.' },
    { q: cs ? 'Jak spustit vlastní full node?' : 'How to run your own full node?', a: cs ? 'Klonujte repo, spusťte cargo build --release v L1/core a pak ./target/release/ziond --p2p-bind-ip 0.0.0.0 --add-exclusive-node 77.42.71.94:21000. Docker compose je k dispozici v docker/docker-compose.mainnet.yml.' : 'Clone the repo, cargo build --release from L1/core and then ./target/release/ziond --p2p-bind-ip 0.0.0.0 --add-exclusive-node 77.42.71.94:21000. Docker compose is available in docker/docker-compose.mainnet.yml.' },
    { q: cs ? 'Jaký pool fee si ZION účtuje?' : 'What pool fee does ZION charge?', a: cs ? '89 % putuje minerovi, 5 % do humanitarian fondu, 5 % do fondu Issobella a 1 % pool provozní poplatek.' : '89% goes to the miner, 5% to the humanitarian fund, 5% to the Issobella fund, and 1% pool operational fee.' },
    { q: cs ? 'Je síť veřejně spuštěna?' : 'Is the network publicly launched?', a: cs ? 'MainNet Genesis proběhl 11. června 2026. Veřejný plný launch je naplánován na 31. prosince 2026 (Silvestr). Core + Edge topologie běží, mining je aktivní, bridge se připravuje na Base Mainnet.' : 'MainNet Genesis took place on 11 June 2026. The public full launch is scheduled for 31 December 2026 (New Year\'s Eve). Core + Edge topology is live, mining is active, and the bridge is being prepared for Base Mainnet.' },
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
