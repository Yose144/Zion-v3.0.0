'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, BarChart3, Box, Clock, Cpu, Database, ExternalLink,
  Flame, Globe, HardDrive, Heart, Layers, Monitor, Network,
  RefreshCw, Server, Shield, Sparkles, Users, Zap,
  Coins, CircleDollarSign, ArrowUpDown, Gauge, Timer,
} from 'lucide-react';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_VERSION, SITE_VERSION } from '@/lib/site';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

/* ═══════════════════════ TYPES ═══════════════════════ */
interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PrometheusRangeResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface MonitoringData {
  // Core node
  chainHeight: number | null;
  peerCount: number | null;
  mempoolSize: number | null;
  blocksAccepted: number | null;
  templateHeight: number | null;
  templateTxs: number | null;
  templateFees: number | null;
  // Pool
  poolActiveSessions: number | null;
  poolSubmitsTotal: number | null;
  poolAcceptedTotal: number | null;
  poolRejectedTotal: number | null;
  poolAcceptRate: number | null;
  poolUptime: number | null;
  // Pool groups
  groupZionSubmits: number | null;
  groupZionAccepted: number | null;
  groupRevenueSubmits: number | null;
  groupRevenueAccepted: number | null;
  groupNclSubmits: number | null;
  groupNclAccepted: number | null;
  groupAutoSubmits: number | null;
  groupAutoAccepted: number | null;
  // PPLNS
  pplnsRegisteredMiners: number | null;
  pplnsWindowSize: number | null;
  pplnsWindowUsed: number | null;
  pplnsTotalPaid: number | null;
  pplnsPayoutRounds: number | null;
  // Infrastructure
  serverLoad1: number | null;
  serverLoad5: number | null;
  serverLoad15: number | null;
  memTotal: number | null;
  memAvailable: number | null;
  diskTotal: number | null;
  diskAvailable: number | null;
  bootTime: number | null;
  // Scrape targets
  coreUp: number | null;
  poolUp: number | null;
}

interface SparklineData {
  chainHeight: number[];
  poolSessions: number[];
  shares: number[];
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt(n: number | null | undefined) {
  return n != null ? n.toLocaleString() : '—';
}

function fmtDec(n: number | null | undefined, decimals = 1) {
  return n != null ? n.toFixed(decimals) : '—';
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function fmtUptime(secs: number | null | undefined) {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtPct(n: number | null | undefined) {
  return n != null ? `${n.toFixed(1)}%` : '—';
}

const CORE_UP_QUERY = 'up{job="zion-core",instance="host.docker.internal:9115"}';
const POOL_UP_QUERY = 'up{job="zion-pool",instance="zion-pool:8080"}';

async function queryPrometheus(query: string): Promise<PrometheusResult[]> {
  const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

async function queryRange(query: string, range = '1h', step = '60'): Promise<PrometheusRangeResult[]> {
  const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}&range=${range}&step=${step}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

function pVal(results: PromiseSettledResult<PrometheusResult[]>[]): (index: number) => number | null {
  return (i: number) => {
    const r = results[i] as PromiseSettledResult<PrometheusResult[]> | undefined;
    if (r?.status === 'fulfilled') {
      const first = r.value[0];
      if (first) return parseFloat(first.value[1] ?? '');
    }
    return null;
  };
}

function pValLabeled(results: (PromiseSettledResult<PrometheusResult[]> | undefined)[], label: string, labelVal: string): number | null {
  for (const r of results) {
    if (!r || r.status !== 'fulfilled') continue;
    for (const m of r.value) {
      if (m.metric[label] === labelVal) return parseFloat(m.value[1] ?? '');
    }
  }
  return null;
}

async function fetchMetrics(): Promise<MonitoringData> {
  const queries = [
    /* 0  */ 'zion_chain_height',
    /* 1  */ 'zion_peer_count',
    /* 2  */ 'zion_mempool_size',
    /* 3  */ 'zion_blocks_accepted_total',
    /* 4  */ 'zion_template_height',
    /* 5  */ 'zion_template_txs',
    /* 6  */ 'zion_template_fees_zion',
    /* 7  */ 'zion_pool_active_sessions',
    /* 8  */ 'zion_pool_submits_total',
    /* 9  */ 'zion_pool_accepted_total',
    /* 10 */ 'zion_pool_rejected_total',
    /* 11 */ 'zion_pool_accept_rate_pct',
    /* 12 */ 'zion_pool_uptime_seconds',
    /* 13 */ 'zion_pool_group_submits',
    /* 14 */ 'zion_pool_group_accepted',
    /* 15 */ 'zion_pplns_registered_miners',
    /* 16 */ 'zion_pplns_window_size',
    /* 17 */ 'zion_pplns_window_used',
    /* 18 */ 'zion_pplns_total_paid_flowers',
    /* 19 */ 'zion_pplns_payout_rounds',
    /* 20 */ 'node_load1',
    /* 21 */ 'node_load5',
    /* 22 */ 'node_load15',
    /* 23 */ 'node_memory_MemTotal_bytes',
    /* 24 */ 'node_memory_MemAvailable_bytes',
    /* 25 */ 'node_filesystem_size_bytes{mountpoint="/"}',
    /* 26 */ 'node_filesystem_avail_bytes{mountpoint="/"}',
    /* 27 */ 'node_boot_time_seconds',
    /* 28 */ 'up{job="zion-core"}',
    /* 29 */ 'up{job="zion-pool"}',
  ];

  const results = await Promise.allSettled(queries.map(q => queryPrometheus(q)));
  const v = pVal(results);

  return {
    chainHeight:          v(0),
    peerCount:            v(1),
    mempoolSize:          v(2),
    blocksAccepted:       v(3),
    templateHeight:       v(4),
    templateTxs:          v(5),
    templateFees:         v(6),
    poolActiveSessions:   v(7),
    poolSubmitsTotal:     v(8),
    poolAcceptedTotal:    v(9),
    poolRejectedTotal:    v(10),
    poolAcceptRate:       v(11),
    poolUptime:           v(12),
    groupZionSubmits:     pValLabeled([results[13]], 'group', 'zion'),
    groupZionAccepted:    pValLabeled([results[14]], 'group', 'zion'),
    groupRevenueSubmits:  pValLabeled([results[13]], 'group', 'revenue'),
    groupRevenueAccepted: pValLabeled([results[14]], 'group', 'revenue'),
    groupNclSubmits:      pValLabeled([results[13]], 'group', 'ncl'),
    groupNclAccepted:     pValLabeled([results[14]], 'group', 'ncl'),
    groupAutoSubmits:     pValLabeled([results[13]], 'group', 'auto'),
    groupAutoAccepted:    pValLabeled([results[14]], 'group', 'auto'),
    pplnsRegisteredMiners: v(15),
    pplnsWindowSize:      v(16),
    pplnsWindowUsed:      v(17),
    pplnsTotalPaid:       v(18),
    pplnsPayoutRounds:    v(19),
    serverLoad1:          v(20),
    serverLoad5:          v(21),
    serverLoad15:         v(22),
    memTotal:             v(23),
    memAvailable:         v(24),
    diskTotal:            v(25),
    diskAvailable:        v(26),
    bootTime:             v(27),
    coreUp:               v(28),
    poolUp:               v(29),
  };
}

async function fetchSparklines(): Promise<SparklineData> {
  const [heightR, sessionsR, sharesR] = await Promise.allSettled([
    queryRange('zion_chain_height', '1h', '120'),
    queryRange('zion_pool_active_sessions', '1h', '120'),
    queryRange('zion_pool_accepted_total', '1h', '120'),
  ]);

  const extract = (r: PromiseSettledResult<PrometheusRangeResult[]>) => {
    if (r.status !== 'fulfilled') return [];
    const first = r.value[0];
    return first ? first.values.map(([, v]) => parseFloat(v)) : [];
  };

  return {
    chainHeight: extract(heightR),
    poolSessions: extract(sessionsR),
    shares: extract(sharesR),
  };
}

/* ═══════════════════════ COMPONENTS ═══════════════════════ */

function StatCard({ label, value, icon: Icon, accent = 'text-zion-cyan', sub }: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="zion-panel rounded-xl bg-black/60 border border-white/10 p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-[0.2em] truncate">
        <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-mono font-bold ${accent} truncate`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 truncate">{sub}</div>}
    </div>
  );
}

function StatusDot({ up }: { up: number | null }) {
  const color = up === 1 ? 'bg-emerald-400' : up === 0 ? 'bg-red-400' : 'bg-gray-500';
  const pulse = up === 1 ? 'animate-pulse' : '';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color} ${pulse}`} />;
}

function ProgressBar({ value, max, color = 'bg-emerald-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Sparkline({ data, color = '#10b981', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div className="h-8 flex items-center text-xs text-gray-600">no data</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 160;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupRow({ name, submits, accepted, color }: {
  name: string; submits: number | null | undefined; accepted: number | null | undefined; color: string;
}) {
  const s = submits ?? 0;
  const a = accepted ?? 0;
  const rate = s > 0 ? ((a / s) * 100) : 0;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
      <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white capitalize">{name}</span>
          <span className="text-xs text-gray-400">{fmt(submits)} sub / {fmt(accepted)} acc</span>
        </div>
        <ProgressBar value={a} max={s || 1} color={s > 0 ? 'bg-emerald-500' : 'bg-gray-600'} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-12 text-right">{s > 0 ? `${rate.toFixed(0)}%` : '—'}</span>
    </div>
  );
}

/* ═══════════════════════ MAIN ═══════════════════════ */

export default function MonitoringClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const [data, setData] = useState<MonitoringData | null>(null);
  const [sparklines, setSparklines] = useState<SparklineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([fetchMetrics(), fetchSparklines()]);
      setData(m);
      setSparklines(s);
      setLastUpdate(new Date());
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(refresh, 15_000);

  // Derived calculations
  const memUsedPct = data?.memTotal && data?.memAvailable
    ? ((1 - data.memAvailable / data.memTotal) * 100) : null;
  const diskUsedPct = data?.diskTotal && data?.diskAvailable
    ? ((1 - data.diskAvailable / data.diskTotal) * 100) : null;
  const serverUptime = data?.bootTime
    ? Math.floor(Date.now() / 1000) - data.bootTime : null;
  const pplnsWindowPct = data?.pplnsWindowSize && data?.pplnsWindowUsed
    ? ((data.pplnsWindowUsed / data.pplnsWindowSize) * 100) : null;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-emerald-500/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-8">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-panel rounded-3xl bg-black/60 p-6 md:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-400 uppercase">
                <Monitor className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? 'Monitoring' : 'Monitoring'}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-linear-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                {cs ? 'Sitovy monitoring' : 'Network Monitoring'}
              </h1>
              <p className="text-gray-400 max-w-2xl text-sm md:text-base">
                {cs
                  ? 'Zive Prometheus metriky z V3 core nodu, mining poolu, PPLNS enginu a serverove infrastruktury. 30+ metrik · automaticky refresh kazdych 15 sekund.'
                  : 'Live Prometheus metrics from the V3 core node, mining pool, PPLNS engine, and server infrastructure. 30+ metrics · Auto-refreshes every 15 seconds.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/grafana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                {cs ? 'Otevrit Grafana dashboard' : 'Open Grafana Dashboard'}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:border-white/40 px-5 py-3 text-sm font-medium text-gray-300 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {cs ? 'Obnovit' : 'Refresh'}
              </button>
            </div>
          </div>
          {lastUpdate && (
            <div className="mt-4 text-xs text-gray-500">
              {cs ? 'Posledni aktualizace' : 'Last update'}: {lastUpdate.toLocaleTimeString(locale)} · {cs ? 'dalsi za 15 s' : 'Next in 15s'}
            </div>
          )}
        </motion.section>

        {/* ═══════ STATUS BAR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap gap-4 items-center px-2"
        >
          <div className="flex items-center gap-2 text-sm">
            <StatusDot up={data?.coreUp ?? null} />
            <span className="text-gray-300">{cs ? 'Core node' : 'Core Node'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <StatusDot up={data?.poolUp ?? null} />
            <span className="text-gray-300">{cs ? 'Mining pool' : 'Mining Pool'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <StatusDot up={data?.serverLoad1 != null ? 1 : null} />
            <span className="text-gray-300">Node Exporter</span>
          </div>
          <div className="ml-auto text-xs text-gray-500 font-mono">
            {data?.chainHeight != null ? `${cs ? 'Blok' : 'Block'} #${data.chainHeight.toLocaleString(locale)}` : ''}
          </div>
        </motion.section>

        {/* ═══════ CORE NODE METRICS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-zion-cyan" />
            {cs ? 'Core node' : 'Core Node'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <StatCard icon={Layers}   label="Chain Height"    value={fmt(data?.chainHeight)} accent="text-zion-gold" />
            <StatCard icon={Layers}   label="Template Height" value={fmt(data?.templateHeight)} accent="text-amber-400" />
            <StatCard icon={Globe}    label="Peers"           value={fmt(data?.peerCount)} accent="text-zion-cyan" />
            <StatCard icon={Database} label="Mempool Txs"     value={fmt(data?.mempoolSize)} accent="text-purple-400" />
            <StatCard icon={Sparkles} label="Blocks Accepted" value={fmt(data?.blocksAccepted)} accent="text-emerald-400" />
            <StatCard icon={Box}      label="Template Txs"    value={fmt(data?.templateTxs)} accent="text-sky-400" sub="in current block" />
            <StatCard icon={Coins}    label="Template Fees"   value={data?.templateFees != null ? `${data.templateFees} ZION` : '—'} accent="text-amber-300" sub="pending fees" />
          </div>
          {/* Sparkline */}
          {sparklines && sparklines.chainHeight.length > 1 && (
            <div className="mt-3 zion-panel rounded-xl bg-black/40 border border-white/10 p-4">
              <div className="text-xs text-gray-400 mb-2">{cs ? 'Vyska chainu — posledni 1 hodina' : 'Chain Height — last 1 hour'}</div>
              <Sparkline data={sparklines.chainHeight} color="#FFD700" height={40} />
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL METRICS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-zion-gold" />
            {cs ? 'Mining pool' : 'Mining Pool'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <StatCard icon={Users}    label="Active Miners"    value={fmt(data?.poolActiveSessions)} accent="text-zion-gold" />
            <StatCard icon={ArrowUpDown} label="Total Submits" value={fmt(data?.poolSubmitsTotal)} accent="text-sky-400" />
            <StatCard icon={Sparkles} label="Accepted Shares"  value={fmt(data?.poolAcceptedTotal)} accent="text-emerald-400" />
            <StatCard icon={Activity} label="Rejected Shares"  value={fmt(data?.poolRejectedTotal)} accent="text-red-400" />
            <StatCard icon={Gauge}    label="Accept Rate"      value={fmtPct(data?.poolAcceptRate)} accent={data?.poolAcceptRate != null && data.poolAcceptRate >= 95 ? 'text-emerald-400' : 'text-amber-400'} />
            <StatCard icon={Timer}    label="Pool Uptime"      value={fmtUptime(data?.poolUptime)} accent="text-zion-cyan" />
            <StatCard icon={Heart}    label="PPLNS Miners"     value={fmt(data?.pplnsRegisteredMiners)} accent="text-pink-400" />
          </div>
          {/* Sparklines */}
          {sparklines && (sparklines.poolSessions.length > 1 || sparklines.shares.length > 1) && (
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              {sparklines.poolSessions.length > 1 && (
                <div className="zion-panel rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="text-xs text-gray-400 mb-2">{cs ? 'Aktivni mineri — posledni 1 hodina' : 'Active Miners — last 1 hour'}</div>
                  <Sparkline data={sparklines.poolSessions} color="#FFD700" height={36} />
                </div>
              )}
              {sparklines.shares.length > 1 && (
                <div className="zion-panel rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="text-xs text-gray-400 mb-2">{cs ? 'Prijate shares — posledni 1 hodina' : 'Accepted Shares — last 1 hour'}</div>
                  <Sparkline data={sparklines.shares} color="#10b981" height={36} />
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL GROUPS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="zion-panel rounded-2xl bg-black/40 border border-white/10 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Network className="h-5 w-5 text-sky-400" />
            {cs ? 'Skupiny poolu' : 'Pool Groups'}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <GroupRow name="zion (Main)" submits={data?.groupZionSubmits} accepted={data?.groupZionAccepted} color="bg-emerald-400" />
            <GroupRow name="revenue (CH3)" submits={data?.groupRevenueSubmits} accepted={data?.groupRevenueAccepted} color="bg-amber-400" />
            <GroupRow name="ncl (Neural)" submits={data?.groupNclSubmits} accepted={data?.groupNclAccepted} color="bg-purple-400" />
            <GroupRow name="auto" submits={data?.groupAutoSubmits} accepted={data?.groupAutoAccepted} color="bg-sky-400" />
          </div>
        </motion.section>

        {/* ═══════ PPLNS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="zion-panel rounded-2xl bg-black/40 border border-white/10 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-pink-400" />
            {cs ? 'PPLNS vyplatni engine' : 'PPLNS Reward Engine'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div className="space-y-2 min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider truncate">Window Size</div>
              <div className="text-base sm:text-xl font-mono font-bold text-pink-400 truncate">{fmt(data?.pplnsWindowSize)}</div>
              <div className="text-xs text-gray-500">maximum shares</div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider truncate">Window Used</div>
              <div className="text-base sm:text-xl font-mono font-bold text-pink-300 truncate">{fmt(data?.pplnsWindowUsed)}</div>
              {pplnsWindowPct != null && (
                <ProgressBar value={data?.pplnsWindowUsed ?? 0} max={data?.pplnsWindowSize ?? 1} color="bg-pink-500" />
              )}
              <div className="text-xs text-gray-500">{pplnsWindowPct != null ? (cs ? `${pplnsWindowPct.toFixed(1)} % zaplneno` : `${pplnsWindowPct.toFixed(1)}% full`) : ''}</div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider truncate">Registered Miners</div>
              <div className="text-base sm:text-xl font-mono font-bold text-emerald-400 truncate">{fmt(data?.pplnsRegisteredMiners)}</div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider truncate">Total Paid</div>
              <div className="text-base sm:text-xl font-mono font-bold text-zion-gold truncate">{fmt(data?.pplnsTotalPaid)} <span className="text-xs text-gray-500">ZION</span></div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider truncate">Payout Rounds</div>
              <div className="text-base sm:text-xl font-mono font-bold text-amber-400 truncate">{fmt(data?.pplnsPayoutRounds)}</div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ SERVER INFRASTRUCTURE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="zion-panel rounded-2xl bg-black/40 border border-white/10 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-zion-cyan" />
            Server Infrastructure
            <span className="ml-2 text-xs text-gray-500 font-normal">Edge VPS · Hetzner</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* CPU Load */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="h-3 w-3" /> {cs ? 'CPU zatez' : 'CPU Load'}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold text-zion-cyan">{fmtDec(data?.serverLoad1)}</span>
                <span className="text-xs text-gray-500">{fmtDec(data?.serverLoad5)} / {fmtDec(data?.serverLoad15)}</span>
              </div>
              <div className="text-xs text-gray-500">{cs ? 'prumer 1m / 5m / 15m' : '1m / 5m / 15m average'}</div>
            </div>

            {/* Memory */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="h-3 w-3" /> {cs ? 'Pamet' : 'Memory'}
              </div>
              <div className="text-xl font-mono font-bold text-purple-400">
                {memUsedPct != null ? `${memUsedPct.toFixed(1)}%` : '—'}
              </div>
              {data?.memTotal && data?.memAvailable && (
                <ProgressBar
                  value={data.memTotal - data.memAvailable}
                  max={data.memTotal}
                  color={memUsedPct != null && memUsedPct > 85 ? 'bg-red-500' : 'bg-purple-500'}
                />
              )}
              <div className="text-xs text-gray-500">
                {cs ? `${fmtBytes(data?.memAvailable)} volne z ${fmtBytes(data?.memTotal)}` : `${fmtBytes(data?.memAvailable)} free of ${fmtBytes(data?.memTotal)}`}
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> Disk
              </div>
              <div className="text-xl font-mono font-bold text-amber-400">
                {diskUsedPct != null ? `${diskUsedPct.toFixed(1)}%` : '—'}
              </div>
              {data?.diskTotal && data?.diskAvailable && (
                <ProgressBar
                  value={data.diskTotal - data.diskAvailable}
                  max={data.diskTotal}
                  color={diskUsedPct != null && diskUsedPct > 85 ? 'bg-red-500' : 'bg-amber-500'}
                />
              )}
              <div className="text-xs text-gray-500">
                {cs ? `${fmtBytes(data?.diskAvailable)} volne z ${fmtBytes(data?.diskTotal)}` : `${fmtBytes(data?.diskAvailable)} free of ${fmtBytes(data?.diskTotal)}`}
              </div>
            </div>

            {/* Server Uptime */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> {cs ? 'Uptime serveru' : 'Server Uptime'}
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                {fmtUptime(serverUptime)}
              </div>
              <div className="text-xs text-gray-500">
                {cs ? 'od' : 'since'} {data?.bootTime ? new Date(data.bootTime * 1000).toLocaleDateString(locale) : '—'}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ MONITORING STACK INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="zion-panel rounded-2xl bg-black/40 border border-white/10 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            {cs ? 'Monitoring stack' : 'Monitoring Stack'}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              { name: 'Prometheus', ver: 'v2.53.0', desc: cs ? 'Sber metrik a alerting' : 'Metrics collection & alerting', color: 'text-orange-400' },
              { name: 'Grafana', ver: 'v11.1.0', desc: cs ? '22panelovy dashboard V3' : '22-panel V3 dashboard', color: 'text-zion-gold' },
              { name: 'Node Exporter', ver: 'v1.8.1', desc: cs ? 'Host CPU, RAM, disk, sit' : 'Host CPU, RAM, disk, network', color: 'text-zion-cyan' },
              { name: 'Redis Exporter', ver: 'v1.61.0', desc: cs ? 'Metriky persistence Redisu' : 'Redis persistence metrics', color: 'text-red-400' },
              { name: 'Alertmanager', ver: 'v0.27.0', desc: cs ? 'Routing alertu a notifikace' : 'Alert routing & notifications', color: 'text-purple-400' },
              { name: cs ? 'Core metriky' : 'Core Metrics', ver: ':9115', desc: cs ? 'Prometheus endpoint V3 nodu (7 gaugu)' : 'V3 node Prometheus endpoint (7 gauges)', color: 'text-emerald-400' },
              { name: cs ? 'Pool metriky' : 'Pool Metrics', ver: ':8080', desc: cs ? 'Mining pool /metrics (20+ counteru/gaugu)' : 'Mining pool /metrics (20+ counters/gauges)', color: 'text-zion-gold' },
              { name: 'API Proxy', ver: '/api/metrics', desc: cs ? 'Bezpecny allowlist query proxy' : 'Secure allowlisted query proxy', color: 'text-sky-400' },
              { name: cs ? 'Web' : 'Website', ver: SITE_VERSION, desc: `Next.js 16 + Tailwind CSS 4 · runtime ${SITE_RUNTIME_VERSION}`, color: 'text-pink-400' },
            ].map((s) => (
              <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                <div className={`mt-0.5 h-2 w-2 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                <div>
                  <div className="font-medium text-white">
                    {s.name} <span className="text-gray-500 font-normal">{s.ver}</span>
                  </div>
                  <div className="text-gray-400 text-xs">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-white/10 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-2">
            <span>{cs ? '30+ zivych Prometheus metrik' : '30+ live Prometheus metrics'}</span>
            <span>{cs ? 'Instantni + range dotazy' : 'Instant + Range queries'}</span>
            <span>{cs ? 'Allowlist proxy (zion_*, node_*)' : 'Allowlisted proxy (zion_*, node_*)'}</span>
            <span>{cs ? 'Auto-refresh 15 s' : '15s auto-refresh'}</span>
            <span>{cs ? 'SVG sparkliny (historie 1 h)' : 'SVG sparklines (1h history)'}</span>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
