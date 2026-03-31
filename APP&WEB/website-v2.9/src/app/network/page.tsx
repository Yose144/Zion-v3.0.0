'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import NetworkStatus from '@/components/NetworkStatus';
import NetworkMap from '@/components/NetworkMap';
import PoolFinder from '@/components/PoolFinder';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Cpu,
  Copy,
  Database,
  Download,
  ExternalLink,
  Globe,
  Globe2,
  HardDrive,
  Layers,
  MapPin,
  Orbit,
  Radio,
  RefreshCw,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  SITE_NETWORK_TOPOLOGY,
  SITE_POOL_PRIMARY,
  SITE_PRIMARY_HOST,
  SITE_PRIMARY_RPC_URL,
  SITE_RELEASE_LABEL,
  SITE_RUNTIME_LABEL,
} from '@/lib/site';

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const heroStats = [
  { label: 'Public Nodes', value: '1', descriptor: 'Prague public host + USA/Singapore internal lanes' },
  { label: 'P2P Mesh', value: 'Controlled', descriptor: 'Public host + internal validator lanes' },
  { label: 'Telemetry', value: '30s', descriptor: 'Auto-refresh interval' },
  { label: 'Topology', value: 'Rehearsal', descriptor: '3-region test-mainnet rehearsal topology' },
  { label: 'Network', value: 'V3 Test Mainnet', descriptor: 'Public rehearsal line v2.9.9 · runtime v2.9.8' },
];

const infraFeatures = [
  {
    icon: Server,
    title: 'Prague (EU)',
    detail: 'Primary seed node: chain, pool, web, explorer',
    ip: '91.98.122.165',
    status: 'Primary',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: 'USA (Hillsboro)',
    detail: 'Internal validator lane: chain, pool',
    ip: '5.78.194.94',
    status: 'Internal',
    color: 'text-zion-cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
  {
    icon: Server,
    title: 'Singapore (APAC)',
    detail: 'Internal validator lane: chain, pool',
    ip: '5.223.84.191',
    status: 'Internal',
    color: 'text-zion-purple',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
  },
];

const runtimePanels = [
  {
    icon: Radio,
    label: 'Public Stratum',
    value: SITE_POOL_PRIMARY,
    detail: 'Current primary mining ingress on Zion2',
    accent: 'text-zion-gold',
  },
  {
    icon: Terminal,
    label: 'RPC Endpoint',
    value: SITE_PRIMARY_RPC_URL,
    detail: 'Native Rust JSON-RPC for explorers and tooling',
    accent: 'text-zion-cyan',
  },
  {
    icon: Globe,
    label: 'P2P Peer',
    value: `${SITE_PRIMARY_HOST}:8333`,
    detail: 'Primary public peer with internal lanes to USA + Singapore',
    accent: 'text-emerald-400',
  },
  {
    icon: BookOpen,
    label: 'Release Context',
    value: SITE_RELEASE_LABEL,
    detail: `Public line over ${SITE_RUNTIME_LABEL}; archived 2.9.8 rollout retained in docs`,
    accent: 'text-zion-purple',
  },
];

const guideBlocks = [
  {
    icon: Zap,
    title: 'Mining',
    description: 'Connect any Cosmic Harmony / CPU miner to the current public pool on Zion2.',
    items: [
      `Pool: ${SITE_POOL_PRIMARY} (current primary)`,
      'Wallet: YOUR_ZION_ADDRESS',
      'Password: x',
    ],
  },
  {
    icon: Terminal,
    title: 'RPC API',
    description: 'Native Rust JSON-RPC endpoint for explorers and tooling. Historical 3-host mesh is archived in release reports.',
    items: [
      `Primary: ${SITE_PRIMARY_RPC_URL}`,
      'Scope: public runtime endpoint',
      'Archive: docs/2.9.8 + March status reports',
      'Method: POST',
    ],
  },
  {
    icon: Globe,
    title: 'P2P Layer',
    description: 'Native libp2p network for blockchain synchronization on the current rehearsal topology.',
    items: [
      `Public peer: ${SITE_PRIMARY_HOST}:8333`,
      'Internal lanes: 5.78.194.94:8333, 5.223.84.191:8333',
      '1 public host + 2 internal validator lanes',
    ],
  },
];

const networkFacts = [
  { text: 'Native Rust P2P — libp2p mesh', done: true },
  { text: '1 public host + 2 internal validator lanes', done: true },
  { text: 'Primary stratum endpoint on Prague', done: true },
  { text: 'JSON-RPC endpoints live (port 8443)', done: true },
  { text: '24/7 Docker containers with auto-restart', done: true },
  { text: 'LWMA DAA — target 60s block time', done: true },
  { text: 'Archived 3-region relay evidence retained', done: true },
  { text: 'Prometheus + Grafana monitoring', done: true },
  { text: 'Geo-distributed rehearsal topology active', done: true },
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
    metricValue('up{job="zion-core-prague"}'),
    metricValue('up{job="zion-pool-prague"}'),
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
  const [copied, setCopied] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | null>(null);
  const [monitoringUpdatedAt, setMonitoringUpdatedAt] = useState<Date | null>(null);
  const factsDone = networkFacts.filter((f) => f.done).length;
  const factsTotal = networkFacts.length;

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const primaryPool = SITE_POOL_PRIMARY;
  const xmrigConnect = `./xmrig -o stratum+tcp://${primaryPool} -u YOUR_ZION_ADDRESS -p x`;
  const healthCurl = 'curl -s https://www.zionterranova.com/api/health';
  const networkCurl = 'curl -s https://www.zionterranova.com/api/network';

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const next = await fetchMonitoringSnapshot();
      if (!active) return;
      setMonitoring(next);
      setMonitoringUpdatedAt(new Date());
    };

    refresh();
    const interval = setInterval(refresh, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Radio className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · Network
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Live Status</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  P2P Network
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Real-time telemetry from the current public runtime on Zion2. Earlier multi-host validation remains preserved in
                archived 2.9.8 deploy and March status reports, but is no longer the live topology.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> Native Rust
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Runtime: {SITE_RUNTIME_LABEL}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> 1 Public Host · 2 Internal Seeds
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
        </motion.section>

        {/* ═══════ RUNTIME SNAPSHOT ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Runtime Snapshot</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-cyan" />
              Public Network Surface
            </h2>
            <p className="text-sm text-gray-400">The current live footprint distilled to the endpoints and roles operators actually need first.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
            {runtimePanels.map((panel, idx) => (
              <motion.div
                key={panel.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <panel.icon className={`h-5 w-5 ${panel.accent}`} />
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{panel.label}</p>
                </div>
                <p className="text-base font-semibold text-white break-all">{panel.value}</p>
                <p className="mt-2 text-sm text-gray-400">{panel.detail}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Infrastructure</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              Current Runtime
            </h2>
            <p className="text-sm text-gray-400">Current public runtime is a single primary host. Earlier multi-host validation remains documented as archived validation history.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-1 lg:max-w-2xl">
            {infraFeatures.map((node, idx) => (
              <motion.div
                key={node.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
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
                    <span>Stratum: port 3333</span>
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
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Live Telemetry</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              Node Status
            </h2>
            <p className="text-sm text-gray-400">Real-time health, block height, hashrate, and sync status from the current primary-host runtime.</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </motion.section>

        {/* ═══════ MONITORING SNAPSHOT ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Observability</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Database className="h-7 w-7 text-zion-gold" />
              Monitoring Snapshot
            </h2>
            <p className="text-sm text-gray-400">Fast operational signals mirrored from the monitoring stack so the public network page carries both topology and machine health at a glance.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricPanel
              label="Core Target"
              value={monitoring?.coreUp === 1 ? 'UP' : monitoring?.coreUp === 0 ? 'DOWN' : '—'}
              detail={`Height ${fmtMetric(monitoring?.chainHeight)}`}
              accent={monitoring?.coreUp === 1 ? 'text-emerald-400' : 'text-red-400'}
              icon={<Server className="h-5 w-5" />}
            />
            <MetricPanel
              label="Pool Target"
              value={monitoring?.poolUp === 1 ? 'UP' : monitoring?.poolUp === 0 ? 'DOWN' : '—'}
              detail={`${fmtMetric(monitoring?.poolSessions)} active sessions`}
              accent={monitoring?.poolUp === 1 ? 'text-emerald-400' : 'text-red-400'}
              icon={<Radio className="h-5 w-5" />}
            />
            <MetricPanel
              label="Accept Rate"
              value={fmtPct(monitoring?.poolAcceptRate)}
              detail={`Uptime ${fmtUptime(monitoring?.poolUptime)}`}
              accent="text-zion-cyan"
              icon={<Activity className="h-5 w-5" />}
            />
            <MetricPanel
              label="Template Fees"
              value={monitoring?.templateFees != null ? `${monitoring.templateFees.toFixed(4)} ZION` : '—'}
              detail="Current fee envelope from the active block template"
              accent="text-zion-gold"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <MetricPanel
              label="Load Avg 1m"
              value={fmtMetric(monitoring?.load1, 2)}
              detail="Primary host pressure"
              accent="text-zion-purple"
              icon={<Cpu className="h-5 w-5" />}
            />
            <MetricPanel
              label="Memory Free"
              value={fmtBytes(monitoring?.memAvailable)}
              detail={monitoring?.memTotal != null ? `${fmtBytes(monitoring?.memTotal)} total` : 'Node exporter memory'}
              accent="text-emerald-400"
              icon={<Database className="h-5 w-5" />}
            />
            <MetricPanel
              label="Disk Free"
              value={fmtBytes(monitoring?.diskAvailable)}
              detail={monitoring?.diskTotal != null ? `${fmtBytes(monitoring?.diskTotal)} total` : 'Root filesystem'}
              accent="text-blue-400"
              icon={<HardDrive className="h-5 w-5" />}
            />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">Deep Drilldown</p>
                <p className="text-sm text-gray-300">For sparklines, raw Prometheus-backed counters, and stack inventory, continue to the full monitoring dashboard.</p>
              </div>
              <div className="mt-5 flex items-center justify-between text-xs text-gray-500 gap-3">
                <span className="inline-flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-zion-cyan" /> {monitoringUpdatedAt ? `Updated ${monitoringUpdatedAt.toLocaleTimeString()}` : 'Loading live data'}</span>
                <Link href="/monitoring" className="text-zion-cyan hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0">
                  Full monitoring <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Geography</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              Network Map &amp; Pool Finder
            </h2>
            <p className="text-sm text-gray-400">Visualize the current topology and compare it with the archived multi-host rollout preserved in release documentation.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </motion.section>

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Connect</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              Connection Guides
            </h2>
            <p className="text-sm text-gray-400">Everything you need to connect a miner, query the RPC API, or sync a node.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
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
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Status</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              Network Readiness
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
            <span>completed</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </motion.section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Operator Toolkit</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Terminal className="h-7 w-7 text-zion-cyan" />
              Network Ops Pro
            </h2>
            <p className="text-sm text-gray-400">Failover templates, health probes, and machine-readable endpoints for operators who need to work below the public dashboard layer.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Primary Mining</p>
              <p className="text-sm text-gray-300 mb-3">Current public stratum endpoint on Zion2. Historical multi-host failover belongs to archived topology docs.</p>
              <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{xmrigConnect}</code>
              <button onClick={() => copyText('xmrig-connect', xmrigConnect)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
                <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-connect' ? 'Copied' : 'Copy command'}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Health Probes</p>
              <div className="space-y-2">
                <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{healthCurl}</code>
                <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{networkCurl}</code>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? 'Copied' : 'Copy health'}</button>
                <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? 'Copied' : 'Copy network'}</button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Export & Docs</p>
              <div className="space-y-2.5 text-sm">
                <a href="/api/network" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="font-mono text-xs text-gray-200">/api/network</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/api/health" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="font-mono text-xs text-gray-200">/api/health</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <Link href="/monitoring" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="text-gray-200">Monitoring dashboard</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </Link>
                <Link href="/docs#live-index" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="text-gray-200">Docs hub</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.34 }}
          className="rounded-4xl border border-emerald-400/30 bg-linear-to-r from-emerald-500/20 via-zion-cyan/10 to-emerald-500/20 p-10 text-center"
        >
          <Radio className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-6 text-3xl font-semibold text-white">Join the ZION Network</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            Native Rust infrastructure running 24/7 from the current primary host with internal quorum support.
            Connect your miner, run your own node, or explore the blockchain while historical rollout context stays preserved in docs.
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · Public launch target 31.12.2026
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['Cosmic Harmony PoW', 'Primary host live', 'Internal seeds', 'Docker native', 'Archived multi-host history'].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Activity className="h-4 w-4" /> Explorer
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-400 to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
              <Rocket className="h-4 w-4" /> Roadmap
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
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova {SITE_RELEASE_LABEL} — P2P Network Pro · {SITE_NETWORK_TOPOLOGY} · Archived multi-host rollout preserved in docs
        </p>
      </div>
    </div>
  );
}

function MetricPanel({
  label,
  value,
  detail,
  accent,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/40 ${accent}`}>
        {icon}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-2 text-sm text-gray-400">{detail}</p>
    </div>
  );
}
