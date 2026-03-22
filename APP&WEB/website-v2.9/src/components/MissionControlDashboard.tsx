'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowLeftRight, BarChart3, Brain, CheckCircle2,
  ChevronDown, Clock, Cpu, Database, Flame, Gamepad2, Gauge, Globe, Globe2,
  HardDrive, Heart, Layers, Link, Lock, Map, Megaphone, Monitor, Network,
  Pickaxe, Radio, RefreshCw, Rocket, Scale, Server, Shield, Sparkles,
  Square, Target, Timer, TrendingUp, Wallet, Wrench, Zap, Code2, CalendarDays,
  CircleDot, XCircle, CheckCheck, Construction
} from 'lucide-react';
import { SITE_RELEASE_LABEL } from '@/lib/site';

/* ═══════════════════════ TYPES ═══════════════════════ */
interface NodeStats {
  height?: number;
  peers_connected?: number;
  difficulty?: number;
  mempool_size?: number;
  status?: string;
  time_since_last_block?: number;
  tip?: string;
  tps?: number;
  sync?: { state?: string };
  network?: string;
}
interface PoolData {
  ok?: boolean;
  miners?: { active?: number; total?: number };
  hashrate?: { pool?: number; pool_24h?: number };
  shares?: { valid?: number; invalid?: number };
  blocks?: { found?: number; pending?: number };
  pool?: { fee?: number; version?: string; uptime_secs?: number };
  payouts?: { pending_miners?: number };
  pplns_window_size?: number;
  blockchain?: { connected?: boolean };
}
interface ServerNode {
  ip?: string;
  stats?: NodeStats;
  pool?: PoolData;
  mem?: { used?: number; total?: number };
  disk?: { used_pct?: number };
  load?: number;
  containers_up?: number;
  containers_healthy?: number;
}
interface StabilityRun {
  start?: string;
  elapsed_secs?: number;
  remaining_secs?: number;
  duration_secs?: number;
  progress_pct?: number;
}
interface DashData {
  timestamp?: string;
  stability_run?: StabilityRun;
  canary_run?: StabilityRun;
  current_topology?: string;
  internal_seed_containers?: string[];
  seed_containers?: string[];
  primary?: ServerNode;
  // Legacy aliases can still be present in older mission-data snapshots.
  helsinki?: ServerNode;
  usa?: ServerNode;
  asia?: ServerNode;
  log_tail?: string;
}

/* ═══════════════════════ PROMETHEUS TYPES ═══════════════════════ */
interface PromResult { metric: Record<string, string>; value: [number, string]; }
interface PromRangeResult { metric: Record<string, string>; values: [number, string][]; }

interface V3Metrics {
  chainHeight: number | null; peerCount: number | null; mempoolSize: number | null;
  blocksAccepted: number | null; templateHeight: number | null; templateTxs: number | null; templateFees: number | null;
  poolActiveSessions: number | null; poolSubmits: number | null; poolAccepted: number | null;
  poolRejected: number | null; poolAcceptRate: number | null; poolUptime: number | null;
  groupZionSub: number | null; groupZionAcc: number | null; groupRevenueSub: number | null; groupRevenueAcc: number | null;
  groupNclSub: number | null; groupNclAcc: number | null; groupAutoSub: number | null; groupAutoAcc: number | null;
  pplnsWindowSize: number | null; pplnsWindowUsed: number | null; pplnsMiners: number | null;
  pplnsPaid: number | null; pplnsRounds: number | null;
  serverLoad1: number | null; serverLoad5: number | null; serverLoad15: number | null;
  memTotal: number | null; memAvail: number | null; diskTotal: number | null; diskAvail: number | null;
  bootTime: number | null; coreUp: number | null; poolUp: number | null;
}

interface V3Sparklines {
  chainHeight: number[]; poolSessions: number[]; shares: number[];
}

interface V3Charts {
  chainHeight: number[]; poolSessions: number[]; shares: number[];
  cpuLoad: number[]; memPct: number[]; redisMemory: number[]; timestamps: number[];
}

type ChartRange = '1h' | '6h' | '24h';
type ServiceGroup = 'all' | 'core' | 'mining' | 'monitoring' | 'remote';

interface OpsAlert {
  id: string;
  message: string;
  severity: 'info' | 'warn' | 'critical';
  href?: string;
}

interface ServiceStatus {
  name: string; job: string; up: boolean | null; image: string; ports: string; note?: string;
}

interface StackSummary {
  redisUp: number | null;
  redisClients: number | null;
  redisMemoryUsed: number | null;
  redisMemoryMax: number | null;
  redisHitRatio: number | null;
  prometheusUp: number | null;
  nodeExporterUp: number | null;
  redisExporterUp: number | null;
  germanyPoolUp: number | null;
  germanyCoreUp: number | null;
  hostKernel: string | null;
  prometheusHeadSeries: number | null;
  prometheusHeadChunks: number | null;
  prometheusReloadOk: number | null;
  alertmanagersDiscovered: number | null;
  prometheusQueueLength: number | null;
  prometheusVersion: string | null;
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt(n?: number | null) { return n != null ? n.toLocaleString() : '—'; }
function fmtTime(s?: number | null) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
function fmtHash(h?: number | null) {
  if (h == null || h === 0) return '0 H/s';
  if (h >= 1e15) return `${(h / 1e15).toFixed(2)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KH/s`;
  return `${h.toFixed(0)} H/s`;
}
function fmtUptime(secs?: number | null) {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
function valColor(pct: number | null) {
  if (pct == null) return 'text-gray-400';
  if (pct > 85) return 'text-red-400';
  if (pct > 70) return 'text-yellow-400';
  return 'text-emerald-400';
}
function barColor(pct: number | null) {
  if (pct == null) return 'bg-gray-500/40';
  if (pct > 85) return 'bg-red-500';
  if (pct > 70) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function getInternalSeedContainers(data?: DashData | null) {
  return data?.internal_seed_containers ?? data?.seed_containers ?? [];
}

/* ═══════════ PROMETHEUS HELPERS ═══════════ */
async function promQuery(query: string): Promise<PromResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.result ?? [];
  } catch { return []; }
}
async function promRange(query: string, range = '1h', step = '120'): Promise<PromRangeResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}&range=${range}&step=${step}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.result ?? [];
  } catch { return []; }
}
function pv(results: PromiseSettledResult<PromResult[]>[], i: number): number | null {
  const r = results[i] as PromiseSettledResult<PromResult[]> | undefined;
  if (r?.status === 'fulfilled') { const first = r.value[0]; if (first) return parseFloat(first.value[1] ?? ''); }
  return null;
}
function pvLabel(results: (PromiseSettledResult<PromResult[]> | undefined)[], label: string, val: string): number | null {
  for (const r of results) { if (!r || r.status !== 'fulfilled') continue; for (const m of r.value) { if (m.metric[label] === val) return parseFloat(m.value[1] ?? ''); } }
  return null;
}
async function fetchV3Metrics(): Promise<V3Metrics> {
  const qs = [
    'zion_chain_height','zion_peer_count','zion_mempool_size','zion_blocks_accepted_total',
    'zion_template_height','zion_template_txs','zion_template_fees_zion',
    'zion_pool_active_sessions','zion_pool_submits_total','zion_pool_accepted_total',
    'zion_pool_rejected_total','zion_pool_accept_rate_pct','zion_pool_uptime_seconds',
    'zion_pool_group_submits','zion_pool_group_accepted',
    'zion_pplns_window_size','zion_pplns_window_used','zion_pplns_registered_miners',
    'zion_pplns_total_paid_flowers','zion_pplns_payout_rounds',
    'node_load1','node_load5','node_load15',
    'node_memory_MemTotal_bytes','node_memory_MemAvailable_bytes',
    'node_filesystem_size_bytes{mountpoint="/"}','node_filesystem_avail_bytes{mountpoint="/"}',
    'node_boot_time_seconds',
    'up{job="zion-core-helsinki"}','up{job="zion-pool-helsinki"}',
  ];
  const res = await Promise.allSettled(qs.map(q => promQuery(q)));
  return {
    chainHeight: pv(res,0), peerCount: pv(res,1), mempoolSize: pv(res,2), blocksAccepted: pv(res,3),
    templateHeight: pv(res,4), templateTxs: pv(res,5), templateFees: pv(res,6),
    poolActiveSessions: pv(res,7), poolSubmits: pv(res,8), poolAccepted: pv(res,9),
    poolRejected: pv(res,10), poolAcceptRate: pv(res,11), poolUptime: pv(res,12),
    groupZionSub: pvLabel([res[13]],'group','zion'), groupZionAcc: pvLabel([res[14]],'group','zion'),
    groupRevenueSub: pvLabel([res[13]],'group','revenue'), groupRevenueAcc: pvLabel([res[14]],'group','revenue'),
    groupNclSub: pvLabel([res[13]],'group','ncl'), groupNclAcc: pvLabel([res[14]],'group','ncl'),
    groupAutoSub: pvLabel([res[13]],'group','auto'), groupAutoAcc: pvLabel([res[14]],'group','auto'),
    pplnsWindowSize: pv(res,15), pplnsWindowUsed: pv(res,16), pplnsMiners: pv(res,17),
    pplnsPaid: pv(res,18), pplnsRounds: pv(res,19),
    serverLoad1: pv(res,20), serverLoad5: pv(res,21), serverLoad15: pv(res,22),
    memTotal: pv(res,23), memAvail: pv(res,24), diskTotal: pv(res,25), diskAvail: pv(res,26),
    bootTime: pv(res,27), coreUp: pv(res,28), poolUp: pv(res,29),
  };
}
async function fetchV3Sparklines(): Promise<V3Sparklines> {
  const [h,s,a] = await Promise.allSettled([
    promRange('zion_chain_height','1h','120'),
    promRange('zion_pool_active_sessions','1h','120'),
    promRange('zion_pool_accepted_total','1h','120'),
  ]);
  const ex = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([,v]) => parseFloat(v)) : [];
  };
  return { chainHeight: ex(h), poolSessions: ex(s), shares: ex(a) };
}

async function fetchV3Charts(range: ChartRange): Promise<V3Charts> {
  const step = range === '1h' ? '60' : range === '6h' ? '300' : '600';
  const [h,s,a,cpu,memTotal,memAvail,redisMem] = await Promise.allSettled([
    promRange('zion_chain_height', range, step),
    promRange('zion_pool_active_sessions', range, step),
    promRange('zion_pool_accepted_total', range, step),
    promRange('node_load1', range, step),
    promRange('node_memory_MemTotal_bytes', range, step),
    promRange('node_memory_MemAvailable_bytes', range, step),
    promRange('redis_memory_used_bytes', range, step),
  ]);
  const ex = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([,v]) => parseFloat(v)) : [];
  };
  const ts = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([t]) => t) : [];
  };
  const totalArr = ex(memTotal), availArr = ex(memAvail);
  const memPct = totalArr.map((t, i) => { const a = availArr[i] ?? 0; return t > 0 ? ((1 - a / t) * 100) : 0; });
  return {
    chainHeight: ex(h),
    poolSessions: ex(s),
    shares: ex(a),
    cpuLoad: ex(cpu),
    memPct,
    redisMemory: ex(redisMem),
    timestamps: ts(h),
  };
}

async function fetchServiceStatuses(): Promise<ServiceStatus[]> {
  const STACK: Omit<ServiceStatus, 'up'>[] = [
    { name: 'zion-core', job: 'zion-core-helsinki', image: 'zion-core:2.9.8', ports: '8333, 8443, 9115' },
    { name: 'zion-pool', job: 'zion-pool-helsinki', image: 'zion-pool:2.9.8', ports: '3333, 8080' },
    { name: 'zion-miner', job: '', image: 'zion-miner:2.9.8', ports: '—', note: 'no scrape target' },
    { name: 'zion-redis', job: 'redis-helsinki', image: 'redis:7-alpine', ports: '6379' },
    { name: 'zion-seed-1', job: '', image: 'zion-core:2.9.8', ports: 'internal', note: 'seed node' },
    { name: 'zion-seed-2', job: '', image: 'zion-core:2.9.8', ports: 'internal', note: 'seed node' },
    { name: 'zion-website', job: '', image: 'zion-website:2.9.9', ports: '3000', note: 'this site' },
    { name: 'zion-prometheus', job: 'prometheus', image: 'prom/prometheus:v2.53.0', ports: '9090' },
    { name: 'zion-grafana', job: '', image: 'grafana/grafana:11.1.0', ports: '3001', note: '/grafana/' },
    { name: 'zion-node-exporter', job: 'node-helsinki', image: 'prom/node-exporter:v1.8.1', ports: '9100' },
    { name: 'zion-redis-exporter', job: 'redis-helsinki', image: 'oliver006/redis_exporter:v1.61.0', ports: '9121' },
    { name: 'zion-alertmanager', job: '', image: 'prom/alertmanager:v0.27.0', ports: '9093' },
    { name: 'germany-pool-target', job: 'zion-pool-germany', image: 'remote scrape', ports: '46.225.126.243:8080', note: 'Prometheus remote target' },
    { name: 'germany-core-target', job: 'zion-core-germany', image: 'remote scrape', ports: '46.225.126.243:9115', note: 'Prometheus remote target' },
  ];
  const upResults = await promQuery('up');
  const jobUp: Record<string, boolean> = {};
  for (const r of upResults) { jobUp[r.metric.job ?? ''] = r.value[1] === '1'; }
  return STACK.map(s => ({ ...s, up: s.job ? (jobUp[s.job] ?? null) : null }));
}

async function fetchStackSummary(): Promise<StackSummary> {
  const qs = [
    'redis_up',
    'redis_connected_clients',
    'redis_memory_used_bytes',
    'redis_memory_max_bytes',
    'redis_keyspace_hits_total',
    'redis_keyspace_misses_total',
    'up{job="prometheus"}',
    'up{job="node-helsinki"}',
    'up{job="redis-helsinki"}',
    'up{job="zion-pool-germany"}',
    'up{job="zion-core-germany"}',
    'node_uname_info',
    'prometheus_tsdb_head_series',
    'prometheus_tsdb_head_chunks',
    'prometheus_config_last_reload_successful',
    'prometheus_notifications_alertmanagers_discovered',
    'prometheus_notifications_queue_length',
    'prometheus_build_info',
  ];
  const res = await Promise.allSettled(qs.map(q => promQuery(q)));
  const hits = pv(res, 4);
  const misses = pv(res, 5);
  const hitRatio = hits != null && misses != null && (hits + misses) > 0 ? (hits / (hits + misses)) * 100 : null;
  const kernelResult = res[11];
  let hostKernel: string | null = null;
  if (kernelResult?.status === 'fulfilled') {
    const first = kernelResult.value[0];
    if (first) {
      const sysname = first.metric.sysname ?? 'Linux';
      const release = first.metric.release ?? 'unknown';
      const machine = first.metric.machine ?? '';
      hostKernel = `${sysname} ${release}${machine ? ` · ${machine}` : ''}`;
    }
  }
  let prometheusVersion: string | null = null;
  const buildInfoResult = res[17];
  if (buildInfoResult?.status === 'fulfilled') {
    const first = buildInfoResult.value[0];
    if (first) {
      prometheusVersion = first.metric.version ?? null;
    }
  }
  return {
    redisUp: pv(res, 0),
    redisClients: pv(res, 1),
    redisMemoryUsed: pv(res, 2),
    redisMemoryMax: pv(res, 3),
    redisHitRatio: hitRatio,
    prometheusUp: pv(res, 6),
    nodeExporterUp: pv(res, 7),
    redisExporterUp: pv(res, 8),
    germanyPoolUp: pv(res, 9),
    germanyCoreUp: pv(res, 10),
    hostKernel,
    prometheusHeadSeries: pv(res, 12),
    prometheusHeadChunks: pv(res, 13),
    prometheusReloadOk: pv(res, 14),
    alertmanagersDiscovered: pv(res, 15),
    prometheusQueueLength: pv(res, 16),
    prometheusVersion,
  };
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/* ═══════════════════════ TAB CONFIG ═══════════════════════ */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Monitor },
  { id: 'metrics', label: 'Stack Metrics', icon: BarChart3 },
  { id: 'upgrade', label: 'Ekam Deeksha', icon: Sparkles },
  { id: 'roadmap', label: 'Roadmap', icon: Target },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'constitution', label: 'Constitution', icon: Lock },
  { id: 'economy', label: 'Economy', icon: Wallet },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'priority', label: 'Priority', icon: Zap },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CHART_RANGES: { value: ChartRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
];

const SERVICE_GROUPS: { value: ServiceGroup; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'mining', label: 'Mining' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'remote', label: 'Remote' },
];

function getServiceGroup(service: ServiceStatus): Exclude<ServiceGroup, 'all'> {
  if (service.name.includes('germany-')) return 'remote';
  if (service.name.includes('prometheus') || service.name.includes('grafana') || service.name.includes('exporter') || service.name.includes('alertmanager') || service.name.includes('website')) return 'monitoring';
  if (service.name.includes('pool') || service.name.includes('miner')) return 'mining';
  return 'core';
}

function getServiceActions(service: ServiceStatus): { href: string; label: string }[] {
  const actions: { href: string; label: string }[] = [];
  if (service.job || service.name.includes('core') || service.name.includes('pool') || service.name.includes('redis') || service.name.includes('germany-')) {
    actions.push({ href: '/monitoring', label: 'Monitoring' });
  }
  if (service.name.includes('prometheus') || service.name.includes('grafana') || service.name.includes('exporter') || service.name.includes('alertmanager')) {
    actions.push({ href: '/grafana/', label: 'Grafana' });
  }
  if (actions.length === 0) {
    actions.push({ href: '/monitoring', label: 'Inspect' });
  }
  return actions;
}

function getServiceSortRank(service: ServiceStatus): number {
  if (service.up === false) return 0;
  if (service.up === null) return 1;
  return 2;
}

/* ═══════════════════════ SUB-COMPONENTS ═══════════════════════ */
function Stat({ label, value, sub, color = 'text-white', mono }: { label: string; value: string; sub?: string; color?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-5 py-3 sm:py-4 backdrop-blur">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-400">{label}</p>
      <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold ${color} ${mono ? 'font-mono' : ''}`}>{value}</p>
      {sub && <p className="text-xs sm:text-sm text-gray-300">{sub}</p>}
    </div>
  );
}

function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 rounded-full bg-white/10 overflow-hidden ${className}`}>
      <motion.div
        className="h-full rounded-full bg-linear-to-r from-cyan-400 via-purple-400 to-pink-400"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </div>
  );
}

function BigProgress({ sr }: { sr?: StabilityRun }) {
  const pct = sr?.progress_pct ?? 0;
  return (
    <div className="mb-4">
      <div className="flex flex-col sm:flex-row sm:justify-between text-[10px] sm:text-xs text-gray-500 mb-2 gap-0.5">
        <span>Start: {sr?.start ? new Date(sr.start).toLocaleString() : '—'}</span>
        <span>End: {sr?.start && sr?.duration_secs ? new Date(new Date(sr.start).getTime() + sr.duration_secs * 1000).toLocaleString() : '—'}</span>
      </div>
      <div className="relative h-9 rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-cyan-400 via-purple-400 to-pink-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <div className="absolute right-0 inset-y-0 w-14 bg-linear-to-r from-transparent to-white/25 animate-pulse" />
        </motion.div>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">{pct}%</span>
      </div>
    </div>
  );
}

function CanaryProgress({ cr }: { cr?: StabilityRun }) {
  const pct = cr?.progress_pct ?? 0;
  return (
    <div className="mb-4">
      <div className="flex flex-col sm:flex-row sm:justify-between text-[10px] sm:text-xs text-gray-500 mb-2 gap-0.5">
        <span>Start: {cr?.start ? new Date(cr.start).toLocaleString() : '—'}</span>
        <span>End: {cr?.start && cr?.duration_secs ? new Date(new Date(cr.start).getTime() + cr.duration_secs * 1000).toLocaleString() : '—'}</span>
      </div>
      <div className="relative h-9 rounded-2xl border border-amber-500/30 bg-black/40 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-amber-400 via-orange-400 to-red-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          {pct < 100 && <div className="absolute right-0 inset-y-0 w-14 bg-linear-to-r from-transparent to-white/25 animate-pulse" />}
        </motion.div>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">{pct}%</span>
      </div>
    </div>
  );
}

function fmtLastBlock(secs?: number | null) {
  if (secs == null) return '—';
  if (secs < 120) return `${secs}s`;
  if (secs < 7200) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function ServerCard({ node, name, flag, ip }: { node?: ServerNode; name: string; flag: string; ip: string }) {
  const s = node?.stats;
  const memPct =
    node?.mem?.total && node.mem.total > 0 && node.mem.used != null
      ? Math.round((node.mem.used / node.mem.total) * 100)
      : null;
  const diskPct = node?.disk?.used_pct ?? null;
  const isHealthy = s?.status === 'OK' || s?.status === 'ok' || s?.status === 'healthy';
  const isSyncing = s?.sync?.state === 'Downloading' || s?.sync?.state === 'Syncing';
  const isStale = (s?.time_since_last_block ?? 0) > 300; // 5 min no blocks
  const containersLabel =
    node?.containers_up != null && node?.containers_healthy != null
      ? `${node.containers_up}/${node.containers_healthy}`
      : '—/—';

  const statusLabel = !s?.status ? 'Offline' : isHealthy ? 'Online' : isSyncing ? 'Syncing' : isStale ? 'Stale' : 'Unhealthy';
  const statusStyle = isHealthy
    ? 'text-emerald-200 bg-emerald-400/10 border-emerald-400/30'
    : isSyncing
    ? 'text-blue-200 bg-blue-400/10 border-blue-400/30'
    : s?.status
    ? 'text-yellow-200 bg-yellow-400/10 border-yellow-400/30'
    : 'text-red-200 bg-red-400/10 border-red-400/30';
  const StatusIcon = isHealthy ? CircleDot : !s?.status ? XCircle : AlertTriangle;
  const borderStyle = isHealthy ? 'border-cyan-500/30 bg-cyan-500/5' : isSyncing ? 'border-blue-500/30 bg-blue-500/5' : 'border-yellow-500/30 bg-yellow-500/5';

  return (
    <div className={`rounded-2xl sm:rounded-3xl border backdrop-blur-sm p-4 sm:p-6 ${borderStyle}`}>
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 flex-wrap">
        <span className="text-xl sm:text-2xl">{flag}</span>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm sm:text-base">{name}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">{ip}</div>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border uppercase tracking-widest ${statusStyle}`}>
          <StatusIcon className="h-3 w-3" /> {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
        <MiniMetric label="Height" value={fmt(s?.height)} color="text-cyan-400" />
        <MiniMetric label="Peers" value={fmt(s?.peers_connected)} />
        <MiniMetric label="Difficulty" value={fmt(s?.difficulty)} />
        <MiniMetric label="Mempool" value={fmt(s?.mempool_size)} />
        <MiniMetric label="Last Block" value={fmtLastBlock(s?.time_since_last_block)} color={isStale ? 'text-yellow-400' : 'text-white'} />
        <MiniMetric label="Containers" value={containersLabel} />
        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">Memory</p>
          <p className={`text-base font-bold font-mono ${valColor(memPct)}`}>{memPct == null ? '—' : `${memPct}%`}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(memPct)}`} style={{ width: `${memPct ?? 0}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">Disk</p>
          <p className={`text-base font-bold font-mono ${valColor(diskPct)}`}>{diskPct == null ? '—' : `${diskPct}%`}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(diskPct)}`} style={{ width: `${diskPct ?? 0}%` }} />
          </div>
        </div>
        <MiniMetric label="Load" value={String(node?.load ?? '—')} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-white/5 p-2 sm:p-3 border border-white/10">
      <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-400">{label}</p>
      <p className={`text-sm sm:text-base font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function OpsServiceCard({ service, onOpen }: { service: ServiceStatus; onOpen: (service: ServiceStatus) => void }) {
  const group = getServiceGroup(service);
  const actions = getServiceActions(service);
  const statusClass = service.up === true
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : service.up === false
    ? 'text-red-300 border-red-500/30 bg-red-500/10'
    : 'text-gray-400 border-white/10 bg-white/5';
  const dotClass = service.up === true ? 'bg-emerald-400' : service.up === false ? 'bg-red-400' : 'bg-gray-500';
  const statusLabel = service.up === true ? 'UP' : service.up === false ? 'DOWN' : 'N/A';
  return (
    <button onClick={() => onOpen(service)} className="w-full text-left rounded-xl border border-white/10 bg-black/30 p-3 space-y-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotClass} ${service.up === true ? 'animate-pulse' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{service.name}</div>
          <div className="text-[10px] text-gray-500 font-mono truncate">{service.image}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border uppercase tracking-widest ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 uppercase tracking-[0.2em] text-gray-400">{group}</span>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {actions.map(action => (
            <a
              key={`${service.name}_${action.label}`}
              href={action.href}
              onClick={event => event.stopPropagation()}
              target={action.href.startsWith('/grafana') ? '_blank' : undefined}
              rel={action.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors"
            >
              <Link className="h-3 w-3" />
              {action.label}
            </a>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="uppercase tracking-[0.2em] text-gray-500 mb-1">Ports</div>
          <div className="font-mono text-gray-300 break-all">{service.ports}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="uppercase tracking-[0.2em] text-gray-500 mb-1">Meta</div>
          <div className="text-gray-300 break-words">{service.note ?? (service.job ? `job: ${service.job}` : 'local service')}</div>
        </div>
      </div>
    </button>
  );
}

function ServiceDetailDrawer({ service, onClose }: { service: ServiceStatus; onClose: () => void }) {
  const group = getServiceGroup(service);
  const actions = getServiceActions(service);
  const statusLabel = service.up === true ? 'UP' : service.up === false ? 'DOWN' : 'N/A';
  const statusClass = service.up === true
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : service.up === false
    ? 'text-red-300 border-red-500/30 bg-red-500/10'
    : 'text-gray-300 border-white/10 bg-white/5';
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <button aria-label="Close details" onClick={onClose} className="absolute inset-0" />
      <motion.div initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }} className="relative h-full w-full max-w-lg border-l border-white/10 bg-zinc-950/95 p-5 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Service Detail</p>
            <h3 className="text-2xl font-semibold text-white mt-2">{service.name}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">{service.image}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 hover:text-white hover:border-white/20 transition-colors">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border uppercase tracking-widest ${statusClass}`}>{statusLabel}</span>
          <span className="text-[10px] font-semibold px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 uppercase tracking-widest">{group}</span>
          {service.job && <span className="text-[10px] font-semibold px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 uppercase tracking-widest">{service.job}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MiniMetric label="Ports" value={service.ports} color="text-cyan-400" />
          <MiniMetric label="Status" value={statusLabel} color={service.up === true ? 'text-emerald-400' : service.up === false ? 'text-red-400' : 'text-gray-300'} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Operational Context</div>
          <div className="text-sm text-gray-300 leading-relaxed">{service.note ?? (service.job ? `Prometheus target linked through job ${service.job}.` : 'Local service without a direct Prometheus scrape target.')}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">Quick Actions</div>
          <div className="flex flex-wrap gap-2">
            {actions.map(action => (
              <a key={`${service.name}_drawer_${action.label}`} href={action.href} target={action.href.startsWith('/grafana') ? '_blank' : undefined} rel={action.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors">
                <Link className="h-4 w-4" />
                {action.label}
              </a>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">Operator Notes</div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>Status `DOWN` znamená scrape fail nebo nedostupný target.</li>
            <li>Status `N/A` znamená, že služba není napojená přímo na Prometheus scrape.</li>
            <li>Pro hlubší drill-down použij Monitoring nebo Grafana akce výše.</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

function StatusDot({ up }: { up: number | null }) {
  const c = up === 1 ? 'bg-emerald-400' : up === 0 ? 'bg-red-400' : 'bg-gray-500';
  const p = up === 1 ? 'animate-pulse' : '';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c} ${p}`} />;
}

function MetricBar({ value, max, color = 'bg-emerald-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MiniSparkline({ data: d, color = '#10b981', height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (d.length < 2) return <div className="h-7 flex items-center text-[10px] text-gray-600">awaiting data</div>;
  const min = Math.min(...d), max = Math.max(...d), range = max - min || 1, w = 140;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AreaChart({ data: d, timestamps, label, color = '#10b981', unit = '', height = 120 }: { data: number[]; timestamps?: number[]; label: string; color?: string; unit?: string; height?: number }) {
  if (d.length < 2) return <div className="rounded-xl bg-black/40 border border-white/10 p-4"><div className="text-[10px] text-gray-500 mb-1">{label}</div><div className="h-20 flex items-center justify-center text-[10px] text-gray-600">awaiting data</div></div>;
  const min = Math.min(...d), max = Math.max(...d), range = max - min || 1;
  const w = 600, h = height, pad = 2;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${h - ((v - min) / range) * (h - pad * 2) - pad}`);
  const polyline = pts.join(' ');
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`;
  const gradId = `grad_${label.replace(/\s/g, '_')}`;
  // Y-axis labels
  const yMax = max >= 1000 ? `${(max / 1000).toFixed(1)}k` : max >= 1 ? max.toFixed(max < 10 ? 1 : 0) : max.toFixed(2);
  const yMin = min >= 1000 ? `${(min / 1000).toFixed(1)}k` : min >= 1 ? min.toFixed(min < 10 ? 1 : 0) : min.toFixed(2);
  const yMid = ((min + max) / 2);
  const yMidLabel = yMid >= 1000 ? `${(yMid / 1000).toFixed(1)}k` : yMid >= 1 ? yMid.toFixed(yMid < 10 ? 1 : 0) : yMid.toFixed(2);
  // Time labels
  const tLabels: string[] = [];
  if (timestamps && timestamps.length >= 2) {
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor((i / 4) * (timestamps.length - 1));
      const t = timestamps[idx];
      if (t != null) tLabels.push(new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }
  const latest = d[d.length - 1] ?? 0;
  const latestStr = latest >= 1000 ? `${(latest / 1000).toFixed(1)}k` : latest.toFixed(latest < 10 ? 1 : 0);
  return (
    <div className="rounded-xl bg-black/40 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-mono font-bold" style={{ color }}>{latestStr}{unit}</div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[8px] text-gray-600 font-mono w-8 shrink-0">
          <span>{yMax}</span><span>{yMidLabel}</span><span>{yMin}</span>
        </div>
        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1={0} y1={h / 4} x2={w} y2={h / 4} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1={0} y1={h * 3 / 4} x2={w} y2={h * 3 / 4} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <polygon points={area} fill={`url(#${gradId})`} />
            <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {tLabels.length > 0 && (
            <div className="flex justify-between text-[8px] text-gray-600 font-mono mt-1">
              {tLabels.map((t, i) => <span key={i}>{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PoolGroupRow({ name, submits, accepted, dot }: { name: string; submits: number | null | undefined; accepted: number | null | undefined; dot: string }) {
  const s = submits ?? 0, a = accepted ?? 0, rate = s > 0 ? ((a / s) * 100) : 0;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white capitalize">{name}</span>
          <span className="text-xs text-gray-400">{fmt(submits)} sub / {fmt(accepted)} acc</span>
        </div>
        <MetricBar value={a} max={s || 1} color={s > 0 ? 'bg-emerald-500' : 'bg-gray-600'} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-12 text-right">{s > 0 ? `${rate.toFixed(0)}%` : '—'}</span>
    </div>
  );
}

/* ═══════════ V3 MAINNET METRICS SECTION ═══════════ */
function V3MetricsSection({ v3: m, sparks }: { v3: V3Metrics; sparks: V3Sparklines }) {
  const memPct = m.memTotal && m.memAvail ? ((1 - m.memAvail / m.memTotal) * 100) : null;
  const diskPct = m.diskTotal && m.diskAvail ? ((1 - m.diskAvail / m.diskTotal) * 100) : null;
  const uptime = m.bootTime ? Math.floor(Date.now() / 1000) - m.bootTime : null;
  const pplnsPct = m.pplnsWindowSize && m.pplnsWindowUsed ? ((m.pplnsWindowUsed / m.pplnsWindowSize) * 100) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-emerald-500/30 bg-black/40 p-4 sm:p-6 lg:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">V3 Mainnet</p>
          <span className="text-[10px] uppercase tracking-widest border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">LIVE PROMETHEUS</span>
        </div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
          <TrendingUp className="h-7 w-7 text-emerald-400" />
          V3 Mainnet Metrics
        </h2>
        <p className="text-sm text-gray-400">30+ live Prometheus metrics · Core node · Mining pool · PPLNS engine · Server infrastructure</p>
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.coreUp} /><span className="text-gray-300">Core Node</span></div>
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.poolUp} /><span className="text-gray-300">Mining Pool</span></div>
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.serverLoad1 != null ? 1 : null} /><span className="text-gray-300">Node Exporter</span></div>
        <div className="ml-auto text-xs text-gray-500 font-mono">{m.chainHeight != null ? `Block #${m.chainHeight}` : ''}</div>
      </div>

      {/* ── Core Blockchain ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Server className="h-4 w-4 text-zion-cyan" /> Core Blockchain</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <MiniMetric label="Chain Height" value={fmt(m.chainHeight)} color="text-zion-gold" />
          <MiniMetric label="Template Ht" value={fmt(m.templateHeight)} color="text-amber-400" />
          <MiniMetric label="Peers" value={fmt(m.peerCount)} color="text-cyan-400" />
          <MiniMetric label="Mempool" value={fmt(m.mempoolSize)} color="text-purple-400" />
          <MiniMetric label="Blocks Acc" value={fmt(m.blocksAccepted)} color="text-emerald-400" />
          <MiniMetric label="Tmpl Txs" value={fmt(m.templateTxs)} color="text-sky-400" />
          <MiniMetric label="Tmpl Fees" value={m.templateFees != null ? `${m.templateFees}` : '—'} color="text-amber-300" />
        </div>
        {sparks.chainHeight.length > 1 && (
          <div className="mt-2 rounded-xl bg-black/40 border border-white/10 p-3">
            <div className="text-[10px] text-gray-500 mb-1">Chain Height — 1h</div>
            <MiniSparkline data={sparks.chainHeight} color="#FFD700" height={32} />
          </div>
        )}
      </div>

      {/* ── Mining Pool ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-zion-gold" /> Mining Pool</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <MiniMetric label="Active Miners" value={fmt(m.poolActiveSessions)} color="text-zion-gold" />
          <MiniMetric label="Submits" value={fmt(m.poolSubmits)} color="text-sky-400" />
          <MiniMetric label="Accepted" value={fmt(m.poolAccepted)} color="text-emerald-400" />
          <MiniMetric label="Rejected" value={fmt(m.poolRejected)} color="text-red-400" />
          <MiniMetric label="Accept Rate" value={m.poolAcceptRate != null ? `${m.poolAcceptRate.toFixed(1)}%` : '—'} color={m.poolAcceptRate != null && m.poolAcceptRate >= 95 ? 'text-emerald-400' : 'text-amber-400'} />
          <MiniMetric label="Pool Uptime" value={fmtUptime(m.poolUptime)} color="text-cyan-400" />
          <MiniMetric label="PPLNS Miners" value={fmt(m.pplnsMiners)} color="text-pink-400" />
        </div>
        {(sparks.poolSessions.length > 1 || sparks.shares.length > 1) && (
          <div className="mt-2 grid md:grid-cols-2 gap-2.5">
            {sparks.poolSessions.length > 1 && (<div className="rounded-xl bg-black/40 border border-white/10 p-3"><div className="text-[10px] text-gray-500 mb-1">Active Miners — 1h</div><MiniSparkline data={sparks.poolSessions} color="#FFD700" /></div>)}
            {sparks.shares.length > 1 && (<div className="rounded-xl bg-black/40 border border-white/10 p-3"><div className="text-[10px] text-gray-500 mb-1">Accepted Shares — 1h</div><MiniSparkline data={sparks.shares} color="#10b981" /></div>)}
          </div>
        )}
      </div>

      {/* ── Pool Groups ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Network className="h-4 w-4 text-sky-400" /> Pool Routing Groups</h3>
        <div className="grid md:grid-cols-2 gap-2.5">
          <PoolGroupRow name="zion (Main)" submits={m.groupZionSub} accepted={m.groupZionAcc} dot="bg-emerald-400" />
          <PoolGroupRow name="revenue (CH3)" submits={m.groupRevenueSub} accepted={m.groupRevenueAcc} dot="bg-amber-400" />
          <PoolGroupRow name="ncl (Neural)" submits={m.groupNclSub} accepted={m.groupNclAcc} dot="bg-purple-400" />
          <PoolGroupRow name="auto" submits={m.groupAutoSub} accepted={m.groupAutoAcc} dot="bg-sky-400" />
        </div>
      </div>

      {/* ── PPLNS Reward Engine ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-pink-400" /> PPLNS Reward Engine</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Window Size</p>
            <p className="text-lg font-mono font-bold text-pink-400">{fmt(m.pplnsWindowSize)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Window Used</p>
            <p className="text-lg font-mono font-bold text-pink-300">{fmt(m.pplnsWindowUsed)}</p>
            {pplnsPct != null && <MetricBar value={m.pplnsWindowUsed ?? 0} max={m.pplnsWindowSize ?? 1} color="bg-pink-500" />}
            <p className="text-[10px] text-gray-500">{pplnsPct != null ? `${pplnsPct.toFixed(1)}% full` : ''}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Registered Miners</p>
            <p className="text-lg font-mono font-bold text-emerald-400">{fmt(m.pplnsMiners)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Total Paid</p>
            <p className="text-lg font-mono font-bold text-zion-gold">{fmt(m.pplnsPaid)} <span className="text-[10px] text-gray-500">flowers</span></p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Payout Rounds</p>
            <p className="text-lg font-mono font-bold text-amber-400">{fmt(m.pplnsRounds)}</p>
          </div>
        </div>
      </div>

      {/* ── Server Infrastructure ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><HardDrive className="h-4 w-4 text-cyan-400" /> Server Infrastructure <span className="text-[10px] text-gray-500 font-normal">Helsinki · Hetzner</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 flex items-center gap-1"><Flame className="h-3 w-3" /> CPU Load</p>
            <p className="text-lg font-mono font-bold text-cyan-400">{m.serverLoad1?.toFixed(1) ?? '—'}</p>
            <p className="text-[10px] text-gray-500">{m.serverLoad5?.toFixed(1) ?? '—'} / {m.serverLoad15?.toFixed(1) ?? '—'} (5m/15m)</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Memory</p>
            <p className={`text-lg font-mono font-bold ${memPct != null && memPct > 85 ? 'text-red-400' : 'text-purple-400'}`}>{memPct != null ? `${memPct.toFixed(1)}%` : '—'}</p>
            {m.memTotal && m.memAvail && <MetricBar value={m.memTotal - m.memAvail} max={m.memTotal} color={memPct != null && memPct > 85 ? 'bg-red-500' : 'bg-purple-500'} />}
            <p className="text-[10px] text-gray-500">{fmtBytes(m.memAvail)} free / {fmtBytes(m.memTotal)}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Disk</p>
            <p className={`text-lg font-mono font-bold ${diskPct != null && diskPct > 85 ? 'text-red-400' : 'text-amber-400'}`}>{diskPct != null ? `${diskPct.toFixed(1)}%` : '—'}</p>
            {m.diskTotal && m.diskAvail && <MetricBar value={m.diskTotal - m.diskAvail} max={m.diskTotal} color={diskPct != null && diskPct > 85 ? 'bg-red-500' : 'bg-amber-500'} />}
            <p className="text-[10px] text-gray-500">{fmtBytes(m.diskAvail)} free / {fmtBytes(m.diskTotal)}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Server Uptime</p>
            <p className="text-lg font-mono font-bold text-emerald-400">{fmtUptime(uptime)}</p>
            <p className="text-[10px] text-gray-500">since {m.bootTime ? new Date(m.bootTime * 1000).toLocaleDateString() : '—'}</p>
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-gray-500 pt-2 border-t border-white/10">
        <span>30+ live Prometheus metrics</span>
        <span>Instant + Range queries</span>
        <span>15s auto-refresh</span>
        <span>SVG sparklines (1h)</span>
        <a href="/monitoring" className="text-emerald-400 hover:text-emerald-300 transition-colors">Full monitoring page →</a>
        <a href="/grafana/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors">Open Grafana →</a>
      </div>
    </motion.section>
  );
}

function PoolSection({ primary }: { primary?: PoolData }) {
  const hm = primary?.miners ?? {};
  const hhr = primary?.hashrate ?? {};
  const hsh = primary?.shares ?? {};
  const hbl = primary?.blocks ?? {};

  const totalActive = hm.active ?? 0;
  const totalMiners = hm.total ?? 0;
  const totalHR = hhr.pool ?? 0;
  const totalHR24 = hhr.pool_24h ?? 0;
  const validShares = hsh.valid ?? 0;
  const invalidShares = hsh.invalid ?? 0;
  const blocksFound = hbl.found ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-purple-500/30 bg-black/40 p-4 sm:p-6 lg:p-8"
    >
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Mining</p>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
          <Pickaxe className="h-7 w-7 text-purple-400" />
          Mining Pool — Primary Host
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Active Miners" value={String(totalActive)} sub={`total: ${totalMiners}`} color="text-purple-400" mono />
        <Stat label="Pool Hashrate" value={fmtHash(totalHR)} sub={`24h avg: ${fmtHash(totalHR24)}`} color="text-cyan-400" mono />
        <Stat label="Valid Shares" value={fmt(validShares)} sub={`invalid: ${invalidShares}`} color="text-emerald-400" mono />
        <Stat label="Blocks Found" value={String(blocksFound)} color="text-orange-400" mono />
      </div>
      <div className="grid md:grid-cols-1 gap-4 sm:gap-5 max-w-md">
        <PoolNodeCard name="Primary Pool" flag="🖥️" pool={primary} />
      </div>
    </motion.section>
  );
}

function PoolNodeCard({ name, flag, pool }: { name: string; flag: string; pool?: PoolData }) {
  if (!pool?.ok && !pool?.miners) return (
    <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-3"><span>{flag}</span><span className="font-semibold text-sm text-white">{name}</span><span className="ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-red-200 border border-red-400/30 bg-red-400/10 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest"><XCircle className="h-3 w-3" /> Offline</span></div>
    </div>
  );
  const m = pool.miners ?? {};
  const hr = pool.hashrate ?? {};
  const sh = pool.shares ?? {};
  const p = pool.pool ?? {};
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-5 backdrop-blur">
      <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
        <span className="text-lg sm:text-xl">{flag}</span><span className="font-semibold text-sm sm:text-base text-white">{name}</span>
        <span className={`ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold border rounded-full px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest ${pool.blockchain?.connected ? 'text-emerald-200 bg-emerald-400/10 border-emerald-400/30' : 'text-red-200 bg-red-400/10 border-red-400/30'}`}>
          {pool.blockchain?.connected ? (m.active ?? 0) > 0 ? <><CircleDot className="h-3 w-3" /> Active</> : <><CircleDot className="h-3 w-3" /> Idle</> : <><XCircle className="h-3 w-3" /> Disconnected</>}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <MiniMetric label="Active / Total" value={`${m.active ?? 0} / ${m.total ?? 0}`} />
        <MiniMetric label="Hashrate" value={fmtHash(hr.pool)} color="text-cyan-400" />
        <MiniMetric label="Valid / Invalid" value={`${fmt(sh.valid)} / ${sh.invalid ?? 0}`} />
        <MiniMetric label="PPLNS Window" value={String(pool.pplns_window_size ?? '—')} />
        <MiniMetric label="Pool Fee" value={`${p.fee ?? 0}%`} />
        <MiniMetric label="Uptime" value={fmtUptime(p.uptime_secs)} />
      </div>
    </div>
  );
}

/* ═══════════════════════ PHASE COMPONENT ═══════════════════════ */
function PhaseAccordion({ icon, title, pct, status, statusColor, children, defaultOpen }: { icon: React.ReactNode; title: string; pct: number; status: string; statusColor: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const pctColor = pct >= 100 ? 'text-emerald-400' : pct > 0 ? 'text-cyan-400' : 'text-gray-500';
  const barCls = pct >= 100 ? 'bg-emerald-400' : pct > 0 ? 'bg-linear-to-r from-cyan-400 via-purple-400 to-pink-400' : 'bg-gray-700';
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 p-4 sm:p-6 hover:bg-white/5 transition-colors text-left">
        <span className="shrink-0">{icon}</span>
        <span className="font-semibold text-sm sm:text-lg text-white flex-1 min-w-0 truncate sm:whitespace-normal sm:overflow-visible">{title}</span>
        <div className="hidden sm:block w-28 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs sm:text-sm font-mono font-semibold ${pctColor} shrink-0`}>{pct}%</span>
        <span className={`text-[10px] sm:text-xs rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest ${statusColor} shrink-0`}>{status}</span>
        <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-white/5 overflow-x-auto">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SprintRow({ name, content, tests, status, highlight }: { name: string; content: string; tests?: string; status: React.ReactNode; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-cyan-500/5' : ''}>
      <td className={`py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-l-lg whitespace-nowrap ${highlight ? 'text-cyan-400' : 'text-white'}`}>{name}</td>
      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-400">{content}</td>
      {tests !== undefined && <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-mono text-cyan-400">{tests}</td>}
      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm rounded-r-lg">{status}</td>
    </tr>
  );
}

/* ═══════════════════════ LOG CONSOLE ═══════════════════════ */
function LogConsole({ logTail }: { logTail?: string }) {
  if (!logTail) return <div className="text-gray-500 text-center py-8 text-sm">No log data</div>;
  const lines = logTail.split('\\n').filter(l => l.trim());
  return (
    <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-4 max-h-64 overflow-y-auto overflow-x-auto font-mono text-[10px] sm:text-[11px] leading-relaxed text-gray-500 whitespace-pre">
      {lines.map((line, i) => (
        <div key={i} className={line.includes('[') && !line.includes('| OK') ? 'text-red-400 font-semibold' : line.includes('OK') ? '' : ''}>
          {line.includes('OK') ? <>{line.replace('OK', '')}<span className="text-emerald-400">OK</span></> : line}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MissionControlDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [v3, setV3] = useState<V3Metrics | null>(null);
  const [v3Sparks, setV3Sparks] = useState<V3Sparklines | null>(null);
  const [v3Charts, setV3Charts] = useState<V3Charts | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [stackSummary, setStackSummary] = useState<StackSummary | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('6h');
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('all');
  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/mission-data/data?t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mission-data/data?t=${Date.now()}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setData(d);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    // V3 Prometheus metrics
    const refreshV3 = async () => {
      try {
        const [metrics, sparks] = await Promise.all([fetchV3Metrics(), fetchV3Sparklines()]);
        setV3(metrics);
        setV3Sparks(sparks);
      } catch { /* silent */ }
    };
    const refreshCharts = async () => {
      try {
        const [charts, svc, summary] = await Promise.all([fetchV3Charts(chartRange), fetchServiceStatuses(), fetchStackSummary()]);
        setV3Charts(charts);
        setServices(svc);
        setStackSummary(summary);
      } catch { /* silent */ }
    };
    refreshV3();
    refreshCharts();
    const iv = setInterval(refresh, 30_000);
    const iv2 = setInterval(refreshV3, 15_000);
    const iv3 = setInterval(refreshCharts, 60_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(iv2); clearInterval(iv3); };
  }, [refresh, chartRange]);

  const sr = data?.stability_run;
  const cr = data?.canary_run;
  const primaryNode = data?.primary ?? data?.helsinki;
  const internalSeedContainers = getInternalSeedContainers(data);
  const primaryStats = primaryNode?.stats;
  const primaryHeight = primaryStats?.height ?? 0;
  const onlineCount = primaryStats?.status === 'OK' || primaryStats?.status === 'ok' || primaryStats?.status === 'healthy' ? 1 : 0;
  const allHealthy = onlineCount === 1;
  const anyHealthy = onlineCount > 0;
  const stabilityPct = sr?.progress_pct ?? 0;
  const stabilityFinalWindow = stabilityPct >= 90 && stabilityPct < 100;
  const stabilityReady = stabilityFinalWindow && allHealthy;
  const stabilityStatus = stabilityPct >= 100 ? 'PASS' : stabilityReady ? 'READY' : primaryHeight > 0 ? 'RUNNING' : 'ISSUE';
  const stabilityStatusColor = stabilityPct >= 100
    ? 'text-emerald-400'
    : stabilityReady
    ? 'text-yellow-400'
    : primaryHeight > 0
    ? 'text-cyan-400'
    : 'text-red-400';
  const visibleServices = (serviceGroup === 'all' ? services : services.filter(service => getServiceGroup(service) === serviceGroup))
    .slice()
    .sort((left, right) => {
      const rank = getServiceSortRank(left) - getServiceSortRank(right);
      return rank !== 0 ? rank : left.name.localeCompare(right.name);
    });
  const monitoredServices = services.filter(service => service.up !== null);
  const servicesUp = monitoredServices.filter(service => service.up).length;
  const servicesDown = monitoredServices.filter(service => service.up === false).length;
  const servicesNa = services.filter(service => service.up === null).length;
  const opsAlertsRaw: Array<OpsAlert | null> = [
    servicesDown > 0 ? { id: 'targets-down', message: `${servicesDown} target${servicesDown > 1 ? 's' : ''} down`, severity: 'critical', href: '/monitoring' } : null,
    stackSummary?.prometheusReloadOk === 0 ? { id: 'prometheus-reload', message: 'Prometheus reload failed', severity: 'critical', href: '/grafana/' } : null,
    stackSummary?.prometheusQueueLength != null && stackSummary.prometheusQueueLength > 0 ? { id: 'alert-queue', message: `Alert queue ${fmt(stackSummary.prometheusQueueLength)}`, severity: stackSummary.prometheusQueueLength > 10 ? 'critical' : 'warn', href: '/grafana/' } : null,
    stackSummary?.redisUp === 0 ? { id: 'redis-unhealthy', message: 'Redis exporter path unhealthy', severity: 'warn', href: '/monitoring' } : null,
    servicesNa > 0 ? { id: 'na-services', message: `${servicesNa} service${servicesNa > 1 ? 's' : ''} without scrape`, severity: 'info', href: '/monitoring' } : null,
  ];
  const opsAlerts = opsAlertsRaw.filter((value): value is OpsAlert => value !== null);

  return (
    <div className="zion-shell min-h-screen pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-6 sm:space-y-8 lg:space-y-10">

        {/* ══════════════ HERO SECTION ══════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl sm:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 sm:p-8 lg:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-cyan-400 uppercase">
                <Activity className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · Release Gate GO
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Live Telemetry</p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-gradient leading-tight">
                  Mission Control
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Real-time monitoring, roadmap tracking, mining pool metrics a přehled aktuálního
                single-host provozu ZION TerraNova po přesunu na nový primární server.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE DATA · 30s refresh
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> 1 public host · 2 internal seeds
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-yellow-200">
                  <CheckCircle2 className="h-3 w-3" /> Current infra: primary host live · internal seeds active
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Shield className="h-3 w-3 text-emerald-400" /> {allHealthy ? 'All Systems Healthy' : anyHealthy ? 'Partial Systems Up' : 'Systems Monitoring'}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-3 grid-cols-2 lg:w-auto lg:min-w-[340px]">
              {[
                { label: 'Block Height', value: fmt(primaryHeight), descriptor: 'latest public chain tip' },
                { label: 'Seeds', value: String(internalSeedContainers.length || 2), descriptor: 'internal seed containers' },
                { label: 'Network Peers', value: fmt(primaryStats?.peers_connected ?? 0), descriptor: 'public node peers' },
                { label: 'Status', value: allHealthy ? 'LIVE' : primaryHeight > 0 ? 'RUN' : 'DOWN', descriptor: allHealthy ? 'primary infra healthy' : primaryHeight > 0 ? 'monitoring...' : 'node offline' },
              ].map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ══════════════ TAB NAVIGATION ══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-2"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Zap className="h-4 w-4 text-cyan-400 mx-2 sm:mx-3 shrink-0" />
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}
              >
                <span className="inline-flex items-center gap-1.5"><tab.icon className="h-3.5 w-3.5 shrink-0" /><span className="text-[10px] sm:text-xs">{tab.label}</span></span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-emerald-400 whitespace-nowrap pr-2 sm:pr-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">LIVE</span>
            </div>
          </div>
        </motion.div>

        {/* ══════════════ LOADING ══════════════ */}
        {loading && !data && (
          <div className="text-center py-20 text-gray-500">
            <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading Mission Control data…</p>
          </div>
        )}

        {/* ══════════════ API OFFLINE FALLBACK ══════════════ */}
        {!loading && !data && (
          <div className="text-center py-16 text-gray-500 rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <Radio className="h-8 w-8 text-orange-400 mx-auto mb-3" />
            <p className="text-orange-300 font-semibold">Live telemetry unavailable</p>
            <p className="text-sm mt-1">Node API temporarily unreachable — roadmap &amp; constitution tabs still work.</p>
            <button onClick={refresh} className="mt-4 px-4 py-2 text-xs rounded-xl border border-orange-400/30 text-orange-300 hover:bg-orange-500/10 transition-colors">Retry</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 1: DASHBOARD
           ═══════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && data && (
          <div className="space-y-8">
            {/* 168h Stability Run */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Historical Validation</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Gauge className="h-7 w-7 text-cyan-400" />
                  168h Stability Snapshot — archived pre-reset validation
                </h2>
              </div>
              <BigProgress sr={sr} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Elapsed" value={fmtTime(sr?.elapsed_secs)} color="text-cyan-400" mono />
                <Stat label="Remaining" value={fmtTime(sr?.remaining_secs)} mono />
                <Stat label="Block Height" value={fmt(primaryHeight)} color="text-purple-400" mono />
                <Stat label="Status" value={stabilityStatus} color={stabilityStatusColor} />
              </div>
            </motion.section>

            {/* 72h Canary Run — B-CRIT-02 */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.09 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-amber-500/30 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Historical Canary</p>
                  <span className="text-[10px] uppercase tracking-widest border border-amber-500/40 bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                    B-CRIT-02 · {(cr?.progress_pct ?? 0) >= 100 ? 'PASS ✅' : 'IN PROG'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Activity className="h-7 w-7 text-amber-400" />
                  72h Canary Snapshot — archived validation window
                </h2>
              </div>
              <CanaryProgress cr={cr} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Elapsed" value={fmtTime(cr?.elapsed_secs)} color="text-amber-400" mono />
                <Stat label="Remaining" value={fmtTime(cr?.remaining_secs)} mono />
                <Stat label="Progress" value={`${cr?.progress_pct ?? 0}%`} color={(cr?.progress_pct ?? 0) >= 100 ? 'text-emerald-400' : 'text-amber-400'} mono />
                <Stat label="Status" value={(cr?.progress_pct ?? 0) >= 100 ? 'PASS ✅' : (cr?.elapsed_secs ?? 0) > 0 ? 'RUNNING' : 'STARTING'} color={(cr?.progress_pct ?? 0) >= 100 ? 'text-emerald-400' : 'text-amber-400'} />
              </div>
            </motion.section>

            {/* Network Stats */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Current Infra</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Globe className="h-7 w-7 text-emerald-400" />
                  Primary Host Status
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Stat label="Network" value={primaryStats?.network ?? `TestNet ${SITE_RELEASE_LABEL}`} color="text-cyan-400" />
                <Stat label="Total Peers" value={fmt(primaryStats?.peers_connected ?? 0)} sub={`${onlineCount}/1 public host online`} mono />
                <Stat label="Difficulty" value={fmt(primaryStats?.difficulty)} mono />
                <Stat label="Sync Status" value={(primaryStats?.status === 'OK' || primaryStats?.status === 'healthy') ? 'SYNCED ✓' : primaryHeight > 0 ? 'RUNNING' : '—'} color={(primaryStats?.status === 'OK' || primaryStats?.status === 'healthy') ? 'text-emerald-400' : 'text-gray-400'} />
              </div>
              <div className="grid gap-5 lg:max-w-xl">
                <ServerCard node={primaryNode} name="Zion2 Primary" flag="🖥️" ip="91.98.122.165 · public RPC + pool + web" />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-gray-300">
                Two internal seed containers remain part of the chain runtime, but they are not exposed as separate public hosts. Dashboard live status is therefore keyed to the public primary node.
              </div>
            </motion.section>

            {/* Mining Pool */}
            <PoolSection primary={primaryNode?.pool} />

            {/* Project Stats */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Telemetry</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Database className="h-7 w-7 text-cyan-400" />
                  Project Stats
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Codebase" value="53,200+" sub="lines of Rust" color="text-cyan-400" />
                <Stat label="Tests" value="900+" sub="passing / 0 failing" color="text-emerald-400" />
                <Stat label="Release Gate" value="GO" sub="v2.9.9 Ekam Deeksha live" color="text-emerald-400" />
                <Stat label="Crates" value="5" sub="core, pool, miner, cosmic-harmony, native-libs" />
              </div>
            </motion.section>

            {/* Component Readiness */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Readiness</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Code2 className="h-7 w-7 text-purple-400" />
                  Component Readiness
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Komponenta</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Readiness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'core/ (blockchain)', pct: 94, loc: '~17k LOC' },
                      { name: 'cosmic-harmony/ (PoW)', pct: 95, loc: '~18.3k LOC' },
                      { name: 'pool/ (mining pool)', pct: 93, loc: '~12k LOC' },
                      { name: 'miner/ (universal)', pct: 85, loc: '~6k LOC' },
                      { name: 'desktop-agent/ (Electron)', pct: 84, loc: '~3k JS' },
                      { name: 'website-v2.9/ (Next.js)', pct: 82, loc: '~5k' },
                      { name: 'mobile-app/ (RN)', pct: 60, loc: '~2k JS' },
                    ].map(c => (
                      <tr key={c.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-white">{c.name}</td>
                        <td className="py-3 px-4 text-gray-300">{c.loc}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 rounded-full bg-white/10">
                              <div
                                className={`h-2 rounded-full ${c.pct >= 85 ? 'bg-emerald-400' : c.pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${c.pct}%` }}
                              />
                            </div>
                            <span className="text-gray-300 font-mono">{c.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>

            {/* Monitoring Log */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Logs</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Activity className="h-7 w-7 text-cyan-400" />
                  Monitoring Log (primary host)
                </h2>
              </div>
              <LogConsole logTail={data.log_tail} />
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: STACK METRICS
           ═══════════════════════════════════════════════ */}
        {activeTab === 'metrics' && (
          <div className="space-y-8">

            {/* ── TEST METRICS BANNER ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Testovací metriky / Test Metrics</p>
                <p className="text-xs text-amber-200/70">Tato data pochází z testovacího provozu. Hodnoty nereprezentují produkční mainnet. · These are test-environment metrics, not production mainnet data.</p>
              </div>
            </motion.div>

            {stackSummary && (
              <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="rounded-2xl sm:rounded-3xl border border-white/10 bg-linear-to-br from-cyan-500/10 via-transparent to-emerald-500/10 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-2 mb-5">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Ops Summary</p>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                    <Gauge className="h-6 w-6 text-cyan-400" />
                    Cluster Snapshot
                  </h2>
                  <p className="text-xs text-gray-500">Local scrape + remote Germany targets + Redis runtime health</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  <MiniMetric label="Redis" value={stackSummary.redisUp === 1 ? 'UP' : stackSummary.redisUp === 0 ? 'DOWN' : '—'} color={stackSummary.redisUp === 1 ? 'text-emerald-400' : 'text-red-400'} />
                  <MiniMetric label="Redis Clients" value={fmt(stackSummary.redisClients)} color="text-cyan-400" />
                  <MiniMetric label="Redis Memory" value={fmtBytes(stackSummary.redisMemoryUsed)} color="text-purple-400" />
                  <MiniMetric label="Cache Hit Rate" value={stackSummary.redisHitRatio != null ? `${stackSummary.redisHitRatio.toFixed(1)}%` : '—'} color={stackSummary.redisHitRatio != null && stackSummary.redisHitRatio > 90 ? 'text-emerald-400' : 'text-amber-400'} />
                  <MiniMetric label="Germany Pool" value={stackSummary.germanyPoolUp === 1 ? 'UP' : stackSummary.germanyPoolUp === 0 ? 'DOWN' : '—'} color={stackSummary.germanyPoolUp === 1 ? 'text-emerald-400' : 'text-red-400'} />
                  <MiniMetric label="Germany Core" value={stackSummary.germanyCoreUp === 1 ? 'UP' : stackSummary.germanyCoreUp === 0 ? 'DOWN' : '—'} color={stackSummary.germanyCoreUp === 1 ? 'text-emerald-400' : 'text-red-400'} />
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="uppercase tracking-[0.25em] text-gray-500">Scrape Coverage</span>
                      <span className="font-mono text-gray-300">{services.filter(s => s.up !== null).filter(s => s.up).length}/{services.filter(s => s.up !== null).length}</span>
                    </div>
                    <MetricBar value={services.filter(s => s.up !== null).filter(s => s.up).length} max={Math.max(services.filter(s => s.up !== null).length, 1)} color="bg-cyan-500" />
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500">
                      <span>Prometheus: {stackSummary.prometheusUp === 1 ? 'up' : 'down'}</span>
                      <span>Node exporter: {stackSummary.nodeExporterUp === 1 ? 'up' : 'down'}</span>
                      <span>Redis exporter: {stackSummary.redisExporterUp === 1 ? 'up' : 'down'}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Host Kernel</div>
                    <div className="text-sm text-gray-200 font-mono break-all">{stackSummary.hostKernel ?? '—'}</div>
                    <div className="mt-2 text-[10px] text-gray-500">Redis memory cap: {fmtBytes(stackSummary.redisMemoryMax)}</div>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Prometheus Runtime</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Version" value={stackSummary.prometheusVersion ?? '—'} color="text-cyan-400" />
                      <MiniMetric label="Reload" value={stackSummary.prometheusReloadOk === 1 ? 'OK' : 'ERR'} color={stackSummary.prometheusReloadOk === 1 ? 'text-emerald-400' : 'text-red-400'} />
                      <MiniMetric label="Head Series" value={fmt(stackSummary.prometheusHeadSeries)} color="text-purple-400" />
                      <MiniMetric label="Head Chunks" value={fmt(stackSummary.prometheusHeadChunks)} color="text-amber-400" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Alert Pipeline</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Alertmanagers" value={fmt(stackSummary.alertmanagersDiscovered)} color="text-emerald-400" />
                      <MiniMetric label="Queue Length" value={fmt(stackSummary.prometheusQueueLength)} color="text-cyan-400" />
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">Alertmanager není scrape target v tomto stacku, stav se čte přes Prometheus notification pipeline.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Remote Coverage</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Germany Pool" value={stackSummary.germanyPoolUp === 1 ? 'UP' : stackSummary.germanyPoolUp === 0 ? 'DOWN' : '—'} color={stackSummary.germanyPoolUp === 1 ? 'text-emerald-400' : 'text-red-400'} />
                      <MiniMetric label="Germany Core" value={stackSummary.germanyCoreUp === 1 ? 'UP' : stackSummary.germanyCoreUp === 0 ? 'DOWN' : '—'} color={stackSummary.germanyCoreUp === 1 ? 'text-emerald-400' : 'text-red-400'} />
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">Veřejně scrapeované targety z Helsinek Promethea.</div>
                  </div>
                </div>
                {opsAlerts.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2 text-amber-300 text-xs uppercase tracking-[0.25em] font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Ops Alerts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opsAlerts.map(alert => {
                        const cls = alert.severity === 'critical'
                          ? 'border-red-500/30 bg-red-500/10 text-red-200'
                          : alert.severity === 'warn'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                          : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
                        return alert.href ? (
                          <a key={alert.id} href={alert.href} target={alert.href.startsWith('/grafana') ? '_blank' : undefined} rel={alert.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined} className={`rounded-full border px-3 py-1 text-xs transition-colors hover:brightness-110 ${cls}`}>{alert.message}</a>
                        ) : (
                          <span key={alert.id} className={`rounded-full border px-3 py-1 text-xs ${cls}`}>{alert.message}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* ── SERVICE STATUS GRID ── */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-black/40 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Docker Stack</p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                    <Server className="h-6 w-6 text-emerald-400" />
                    Ops Panel — Helsinki + Remote Targets
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 font-semibold uppercase tracking-widest">{servicesUp} up</span>
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-300 font-semibold uppercase tracking-widest">{servicesDown} down</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300 font-semibold uppercase tracking-widest">{servicesNa} n/a</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{services.length} services/targets · zion-net Docker network · Prometheus scrape 15s</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {SERVICE_GROUPS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setServiceGroup(option.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${serviceGroup === option.value ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleServices.map(service => <OpsServiceCard key={service.name} service={service} onOpen={setSelectedService} />)}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
                <span>{servicesUp} / {monitoredServices.length || services.length} monitored targets UP</span>
                <span>·</span>
                <span>{servicesNa} without Prometheus scrape</span>
                <span>·</span>
                <span>showing {visibleServices.length} in {serviceGroup}</span>
              </div>
            </motion.section>

            {/* ── V3 MAINNET METRICS ── */}
            {v3 && v3Sparks && <V3MetricsSection v3={v3} sparks={v3Sparks} />}

            {/* ── 6H CHARTS ── */}
            {v3Charts && (
              <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-2xl sm:rounded-3xl border border-purple-500/30 bg-black/40 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Time Series</p>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                      <TrendingUp className="h-6 w-6 text-purple-400" />
                      Charts — {chartRange.toUpperCase()}
                    </h2>
                    <p className="text-xs text-gray-500">Prometheus range queries · auto-refresh 60s · adaptive step by selected range</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 self-start">
                    {CHART_RANGES.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setChartRange(option.value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartRange === option.value ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-400 hover:text-gray-200'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <AreaChart data={v3Charts.chainHeight} timestamps={v3Charts.timestamps} label={`Chain Height — ${chartRange}`} color="#FFD700" />
                  <AreaChart data={v3Charts.poolSessions} timestamps={v3Charts.timestamps} label={`Active Miners — ${chartRange}`} color="#a855f7" />
                  <AreaChart data={v3Charts.shares} timestamps={v3Charts.timestamps} label={`Accepted Shares (cumul.) — ${chartRange}`} color="#10b981" />
                  <AreaChart data={v3Charts.cpuLoad} timestamps={v3Charts.timestamps} label={`CPU Load (1m avg) — ${chartRange}`} color="#06b6d4" />
                  <AreaChart data={v3Charts.memPct} timestamps={v3Charts.timestamps} label={`Memory Usage % — ${chartRange}`} color="#ec4899" unit="%" />
                  <AreaChart data={v3Charts.redisMemory} timestamps={v3Charts.timestamps} label={`Redis Memory — ${chartRange}`} color="#f97316" />
                </div>
              </motion.section>
            )}

            {/* ── DOCKER STACK ARCHITECTURE ── */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="rounded-2xl sm:rounded-3xl border border-cyan-500/30 bg-black/40 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Infrastructure</p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Layers className="h-6 w-6 text-cyan-400" />
                  Docker Stack Architecture
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Core Layer */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2"><Database className="h-4 w-4" /> Core Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">zion-core</span><span className="text-gray-500 font-mono">:8333 :8443 :9115</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-redis</span><span className="text-gray-500 font-mono">:6379</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-seed-1</span><span className="text-gray-500 font-mono">internal</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-seed-2</span><span className="text-gray-500 font-mono">internal</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Blockchain consensus + P2P + RPC · read-only rootfs · no-new-privileges</p>
                </div>
                {/* Mining Layer */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2"><Pickaxe className="h-4 w-4" /> Mining Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">zion-pool</span><span className="text-gray-500 font-mono">:3333 :8080</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-miner</span><span className="text-gray-500 font-mono">—</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Stratum pool · PPLNS engine · Cosmic Harmony PoW · internal miner</p>
                </div>
                {/* Monitoring Layer */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2"><Activity className="h-4 w-4" /> Monitoring Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">prometheus</span><span className="text-gray-500 font-mono">:9090</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">grafana</span><span className="text-gray-500 font-mono">:3001</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">node-exporter</span><span className="text-gray-500 font-mono">:9100</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">redis-exporter</span><span className="text-gray-500 font-mono">:9121</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">alertmanager</span><span className="text-gray-500 font-mono">:9093</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">website</span><span className="text-gray-500 font-mono">:3000</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Prometheus 90d retention · Grafana dashboards · alert rules</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Globe className="h-4 w-4 text-gray-400" /> Network Topology</h3>
                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1 font-semibold">Helsinki (Primary) — 91.98.122.165</p>
                    <p className="text-gray-500">12 Docker containers · zion-net bridge · Prometheus local scrape</p>
                    <p className="text-gray-500">Core + Pool + Miner + Redis + 2 Seeds + Monitoring stack</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 font-semibold">Germany (Remote) — 46.225.126.243</p>
                    <p className="text-gray-500">Remote Prometheus targets: zion-pool-germany, zion-core-germany</p>
                    <p className="text-gray-500">Scraped over public IP from Helsinki Prometheus</p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ── FOOTER LINKS ── */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-gray-500 pt-2 border-t border-white/10">
              <span>30+ live Prometheus metrics</span>
              <span>6h range queries · 5m resolution</span>
              <span>15s instant refresh · 60s chart refresh</span>
              <span>Redis + remote target telemetry</span>
              <a href="/monitoring" className="text-emerald-400 hover:text-emerald-300 transition-colors">Full monitoring page →</a>
              <a href="/grafana/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors">Open Grafana →</a>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedService && <ServiceDetailDrawer service={selectedService} onClose={() => setSelectedService(null)} />}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════
            TAB: EKAM DEEKSHA UPGRADE
           ═══════════════════════════════════════════════ */}
        {activeTab === 'upgrade' && (
          <div className="space-y-8">
            {/* Upgrade Overview */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-zion-gold/30 bg-linear-to-br from-zion-gold/10 via-transparent to-zion-purple/10 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">v2.9.9</p>
                  <span className="text-[10px] uppercase tracking-widest border border-zion-gold/40 bg-zion-gold/10 text-zion-gold px-2 py-0.5 rounded-full font-semibold">
                    DEPLOYED · TESTNET LIVE
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Sparkles className="h-7 w-7 text-zion-gold" />
                  Ekam Deeksha — ASIC Resistance Upgrade
                </h2>
                <p className="text-sm text-gray-400">
                  Ekam Deeksha je dvouúrovňový upgrade ASIC rezistence pro Cosmic Harmony v3.
                  Tier 1 zpevňuje scratchpad paměťový vzor, Tier 2 přidává epoch-rotující NPU váhy.
                  Oba tiery jsou nasazeny a validovány na canary testnetu.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Verze" value="v2.9.9" sub="Ekam Deeksha" color="text-zion-gold" />
                <Stat label="Nové testy" value="122" sub="108 Tier 1 + 14 Tier 2" color="text-emerald-400" mono />
                <Stat label="Pool Accept" value="100%" sub="10/10 accepted · 0 rejected" color="text-emerald-400" mono />
                <Stat label="Hashrate" value="166 H/s" sub="testnet canary miner" color="text-cyan-400" mono />
              </div>
            </motion.section>

            {/* Tier Progress */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Implementation</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Shield className="h-7 w-7 text-emerald-400" />
                  Tier Checklist
                </h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {/* Tier 1 */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-emerald-400" />
                      Tier 1 — Scratchpad Ekam
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-2 py-0.5 rounded-full font-semibold">DONE</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { done: true, text: 'Scratchpad 256 KiB (zvýšení z 64 KiB)' },
                      { done: true, text: '4 hashovací průchody (z 3)' },
                      { done: true, text: '256 paměťových čtení (z 128)' },
                      { done: true, text: 'Memory-hard vzor — ASIC penalizace' },
                      { done: true, text: '108 unit testů — deterministika, vektory' },
                      { done: true, text: 'Commit c423a5e' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Tier 2 */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-emerald-400" />
                      Tier 2 — Epoch NPU Weights
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-2 py-0.5 rounded-full font-semibold">DONE</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { done: true, text: 'NPU_EPOCH_LENGTH: 2016 (mainnet) / 100 (testnet)' },
                      { done: true, text: 'Deterministické váhy z epoch seed' },
                      { done: true, text: 'Rotace každých 2016 bloků (jako BTC retarget)' },
                      { done: true, text: 'algorithms_npu.rs — +370 řádků' },
                      { done: true, text: '14 testů — epoch boundaries, přechody' },
                      { done: true, text: 'Commit 79c903a' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Deploy & Verification */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Deploy & Verify</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Server className="h-7 w-7 text-purple-400" />
                  Canary Testnet Deployment
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Krok</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Popis</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { step: 'Feature Flag', desc: 'Testnet conditional compile: NPU_EPOCH_LENGTH=100', status: 'done', ref: '605cd38' },
                      { step: 'Docker Build', desc: 'zion-{core,pool,miner}:2.9.8-testnet images', status: 'done', ref: '3 images' },
                      { step: 'Server Deploy', desc: '91.98.122.165 — full sync via SFTP + compose up', status: 'done', ref: '6 containers' },
                      { step: 'Core Health', desc: 'Chain height 4034+, 2 peers, synced', status: 'done', ref: 'healthy' },
                      { step: 'Pool Accept', desc: '10/10 shares accepted, 0 rejected (100%)', status: 'done', ref: '10 accepted' },
                      { step: 'Miner Verify', desc: '166 H/s, 256 KiB scratchpad confirmed in logs', status: 'done', ref: '256 KiB' },
                      { step: 'VarDiff', desc: 'Auto-adjusting: 500 → 2118 → 1000', status: 'done', ref: 'working' },
                      { step: 'Epoch Transition', desc: 'Block 4100 boundary — epoch 40 → 41', status: 'pending', ref: 'monitoring' },
                      { step: '24h Stability', desc: 'Overnight hashrate + accept rate monitoring', status: 'pending', ref: 'in progress' },
                    ].map(row => (
                      <tr key={row.step} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${row.status === 'pending' ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-3 px-4 font-semibold text-white">{row.step}</td>
                        <td className="py-3 px-4 text-gray-400">{row.desc}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${row.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {row.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                            {row.ref}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>

            {/* Technical Details */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Technical</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Code2 className="h-7 w-7 text-cyan-400" />
                  Ekam Deeksha — Technické parametry
                </h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white mb-4">Scratchpad Ekam (Tier 1)</h3>
                  <div className="space-y-2">
                    {[
                      ['Velikost', '256 KiB (262,144 B)'],
                      ['Průchody', '4 (z 3)'],
                      ['Paměťová čtení', '256 (z 128)'],
                      ['Hash funkce', 'Blake3 + Keccak256'],
                      ['Soubor', 'scratchpad_ekam.rs'],
                      ['ASIC skóre', '65/100 → odhadovaný 78/100'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-white/5 pb-1.5">
                        <span className="text-gray-400">{k}</span>
                        <span className="font-mono text-white">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white mb-4">Epoch NPU (Tier 2)</h3>
                  <div className="space-y-2">
                    {[
                      ['Epoch délka', '2016 bloků (mainnet)'],
                      ['Testnet epoch', '100 bloků'],
                      ['Rotace vah', 'Deterministická z epoch seed'],
                      ['NPU operace', '16 (add/sub/xor/rot/mul/...)'],
                      ['Soubor', 'algorithms_npu.rs (+370 LOC)'],
                      ['Test vektor', 'd043e26b...35c3'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-white/5 pb-1.5">
                        <span className="text-gray-400">{k}</span>
                        <span className="font-mono text-white">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Affected Files */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Changed Files</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Construction className="h-7 w-7 text-orange-400" />
                  Dotčené soubory
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { file: 'L1/cosmic-harmony/src/scratchpad_ekam.rs', change: 'Nový — 256 KiB scratchpad', type: 'new' },
                  { file: 'L1/cosmic-harmony/src/algorithms_npu.rs', change: 'Nový — epoch NPU weights (+370 LOC)', type: 'new' },
                  { file: 'L1/cosmic-harmony/src/deeksha.rs', change: 'Upraven — v2 pipeline + block_height', type: 'mod' },
                  { file: 'L1/cosmic-harmony/src/algorithms_opt.rs', change: 'Upraven — apply_npu_weights()', type: 'mod' },
                  { file: 'L1/cosmic-harmony/src/lib.rs', change: 'Upraven — export nových modulů', type: 'mod' },
                  { file: 'L1/miner/src/native_algos.rs', change: 'Upraven — deeksha_v2_hash()', type: 'mod' },
                  { file: '3x GPU kernels', change: 'CUDA/OpenCL/Metal — NPU weights', type: 'mod' },
                  { file: 'L1/pool/ E2E testy', change: 'Nové — pool-side validace Tier 1+2', type: 'new' },
                  { file: 'docker/Dockerfile.{core,pool,miner}', change: 'FEATURES build arg + testnet', type: 'mod' },
                  { file: 'docker/docker-compose.testnet.yml', change: 'Testnet feature flag v2.9.8', type: 'mod' },
                ].map(f => (
                  <div key={f.file} className="flex items-center gap-3 text-sm py-2.5 px-4 rounded-xl bg-white/5 border border-white/10">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${f.type === 'new' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-blue-400/20 text-blue-300'}`}>
                      {f.type === 'new' ? 'NEW' : 'MOD'}
                    </span>
                    <div>
                      <span className="font-mono text-gray-300 text-xs">{f.file}</span>
                      <p className="text-[11px] text-gray-500">{f.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Git Commits */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Git Log</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Database className="h-7 w-7 text-purple-400" />
                  Commity Ekam Deeksha
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  { hash: 'c423a5e', msg: 'feat(cosmic-harmony): Tier 1 scratchpad ekam — 256 KiB, 4 passes, 256 reads, 108 tests', date: '2026-03-16' },
                  { hash: '79c903a', msg: 'feat(cosmic-harmony): Tier 2 epoch NPU weights — rotate per 2016/100 blocks, 14 tests', date: '2026-03-16' },
                  { hash: '605cd38', msg: 'feat: testnet feature flag — conditional NPU_EPOCH_LENGTH, Docker FEATURES build arg', date: '2026-03-17' },
                  { hash: '8f40f73', msg: 'chore: deploy scripts + testnet compose alignment', date: '2026-03-17' },
                ].map(c => (
                  <div key={c.hash} className="flex items-center gap-3 text-sm py-2 px-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="font-mono text-xs text-zion-gold bg-zion-gold/10 px-2 py-1 rounded">{c.hash}</span>
                    <span className="text-gray-300 flex-1">{c.msg}</span>
                    <span className="text-xs text-gray-500 shrink-0">{c.date}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 2: ROADMAP
           ═══════════════════════════════════════════════ */}
        {activeTab === 'roadmap' && (
          <div className="space-y-8">
            {/* Overall Progress */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Progress</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Target className="h-7 w-7 text-zion-gold" />
                  Roadmap — MainNet 31. 12. 2026
                </h2>
                <p className="text-sm text-gray-400">Fáze 0 (Feb) → Fáze 5 (Dec 2026) · archived 168h stability PASS · current primary-host infra GO</p>
              </div>
              <div className="relative h-9 rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <motion.div className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-cyan-400 via-purple-400 to-pink-400" initial={{ width: 0 }} animate={{ width: '52%' }} transition={{ duration: 1.2 }} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">{SITE_RELEASE_LABEL} · GO · 168h PASS ✅ · Ekam Deeksha deployed ✅</span>
              </div>
            </motion.section>

            {/* Phases */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="space-y-5"
            >
              <PhaseAccordion icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />} title="Fáze 0 — Spec Freeze & Core Rewrite" pct={100} status="DOKONČENO" statusColor="border-emerald-400/30 bg-emerald-400/10 text-emerald-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Únor 2026 — 155 testů, 8 commitů</p>
                <table className="w-full text-left"><tbody>
                  <SprintRow name="0.0 Repo Migrace" content="Čisté repo, workspace, Docker, CI/CD" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="0.1 Emission & Genesis" content="5,400.067 ZION/block, 16.28B premine" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="0.2 DAA & Consensus" content="LWMA 60-blok, ±25%, fork-choice" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="0.3 Fee Market" content="Fee burning, double-spend, min fee" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="0.4 Wallet & TX" content="UTXO select, Ed25519, broadcast" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="0.5 Consensus Hardening" content="Maturity=100, reorg=10, finality=60" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                </tbody></table>
              </PhaseAccordion>

              <PhaseAccordion icon={<RefreshCw className="h-6 w-6 text-cyan-400" />} title="Fáze 1 — Hardened TestNet" pct={85} status="PROBÍHÁ" statusColor="border-cyan-400/30 bg-cyan-400/10 text-cyan-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Únor — Březen 2026 | 168h stability PASS (2026-03-03)</p>
                <table className="w-full text-left"><thead><tr><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Sprint</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Obsah</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Testy</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Stav</th></tr></thead><tbody>
                  <SprintRow name="1.0 Network Deploy" content="Chain reset, Docker, historical 3-server rollout baseline" tests="—" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.1 Config Validation" content="TOML parsing, boundary checks" tests="70" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.2 Security Edge-Case" content="Reorg, double-spend, fork-choice" tests="29" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.3 IBD Hardening" content="Timeouts, stall detect, peer scoring" tests="42" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.4 Pool Payout" content="Batch TX, PoolWallet, JSON-RPC" tests="23" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.5 Buyback + DAO" content="100% DAO revenue, burn, tracker" tests="28" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.6 Supply API" content="getSupplyInfo, getBuybackStats" tests="15" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.7 P2P Rate-Limit" content="200 msgs/peer/60s, escalating bans" tests="13" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.8 Health & Metrics" content="getHealthCheck, getMetrics" tests="8" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.9 Stress Tests" content="High-throughput TX, rapid blocks" tests="21" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.10 168h Stability" content="Archived 3-node / 3-continent validation gate · 7 dní" tests="—" status={<span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> PASS · 2026-03-03</span>} highlight />
                  <SprintRow name="1.11 Partition Test" content="Izolace node 30 min, reconnect" tests="—" status={<Square className="h-4 w-4 text-gray-500" />} />
                  <SprintRow name="1.12 100 Miners" content="Simulace 100 Stratum klientů" tests="—" status={<Square className="h-4 w-4 text-gray-500" />} />
                  <SprintRow name="1.13 Ekam Tier 1" content="Scratchpad 256 KiB, 4 passes, 256 reads" tests="108" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} highlight />
                  <SprintRow name="1.14 Ekam Tier 2" content="Epoch NPU weights, rotate per 2016/100 blocks" tests="14" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} highlight />
                  <SprintRow name="1.15 Testnet Flag" content="Conditional compile NPU_EPOCH_LENGTH" tests="—" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.16 Canary Deploy" content="Pool 10/10 accepted, 0 rejected, 166 H/s" tests="—" status={<span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> VERIFIED</span>} highlight />
                </tbody></table>
              </PhaseAccordion>

              <PhaseAccordion icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />} title="Fáze 2 — Node UX & Mining" pct={100} status="DOKONČENO" statusColor="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Červen — Červenec 2026 — Node setup, mining guides, explorer live</p>
                <table className="w-full text-left"><tbody>
                  <SprintRow name="2.1 Node UX" content="10-min setup, config.toml, structured logging, CLI → /mining/node-setup" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="2.2 Mining Polish" content="CPU bench, GPU stability, failover, solo → /mining/guides" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="2.3 Block Explorer" content="Backend indexer, frontend UI, Supply API, Rich list → /explorer" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                </tbody></table>
              </PhaseAccordion>

              <PhaseAccordion icon={<Globe className="h-6 w-6 text-yellow-400" />} title="Fáze 3 — Infrastructure & Legal" pct={55} status="PROBÍHÁ" statusColor="border-yellow-400/30 bg-yellow-400/10 text-yellow-200">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Srpen — Září 2026 | current primary-host ops live, historical multi-host rollout retained only in reports</p>
                <table className="w-full text-left"><tbody>
                  <SprintRow name="3.1 Public Host Runtime" content="Current public runtime is consolidated on Zion2 with internal seed containers behind the same host. Historical multi-host monitoring remains archived in reports." status={<span className="text-emerald-400">LIVE</span>} />
                  <SprintRow name="3.2 Docker & Deploy" content="mainnet.yml ✅, runbook ✅, CI/CD ⬜, images ⬜" status={<span className="text-yellow-400">2/5</span>} />
                  <SprintRow name="3.3 Legal" content="6 legal docs ✅, footer ✅, comm guidelines ⬜" status={<span className="text-emerald-400">7/8</span>} />
                  <SprintRow name="3.4 Exchange Ready" content="Supply API ✅, whitepaper ⬜, wZION bridge (Base Sepolia) ✅, listing prep ⬜" status={<span className="text-yellow-400">3/6</span>} />
                </tbody></table>
              </PhaseAccordion>

              <PhaseAccordion icon={<Target className="h-6 w-6 text-gray-400" />} title="Fáze 4 — Dress Rehearsal" pct={0} status="ŘÍJ-LIS 2026" statusColor="border-white/20 bg-white/5 text-gray-300">
                <table className="w-full text-left"><tbody>
                  <SprintRow name="4.1 Dress Rehearsal" content="Staging chain, genesis test, 1000 miners, 7-day run" status={<Square className="h-4 w-4 text-gray-500" />} />
                  <SprintRow name="4.2 Security Audit" content="External audit (Trail of Bits / OtterSec)" status={<Square className="h-4 w-4 text-gray-500" />} />
                  <SprintRow name="4.3 Code Freeze" content="Feature freeze, tag v2.9.6-mainnet, binary builds" status={<Square className="h-4 w-4 text-gray-500" />} />
                </tbody></table>
              </PhaseAccordion>

              <PhaseAccordion icon={<Rocket className="h-6 w-6 text-red-400" />} title="Fáze 5 — MainNet Launch" pct={0} status="31. 12. 2026" statusColor="border-red-400/30 bg-red-400/10 text-red-200">
                <table className="w-full text-left"><thead><tr><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Den</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Aktivita</th></tr></thead><tbody>
                  {[
                    ['T-14', 'Genesis freeze — parametry zmrazeny'],
                    ['T-10', 'Seed nody deployed a sync'],
                    ['T-7', 'Community announcement + wallety'],
                    ['T-5', 'Wallet release (desktop + CLI)'],
                    ['T-3', 'Mining guide publikován'],
                    ['T-2', 'Final node software release'],
                    ['T-1', 'Genesis block vytvořen OFFLINE'],
                  ].map(([day, act]) => <tr key={day}><td className="py-2.5 px-4 text-sm font-semibold text-white rounded-l-lg">{day}</td><td className="py-2.5 px-4 text-sm text-gray-400 rounded-r-lg">{act}</td></tr>)}
                  <tr className="bg-pink-500/5"><td className="py-2.5 px-4 text-sm font-semibold text-pink-400 rounded-l-lg"><span className="inline-flex items-center gap-1">T-0 <Rocket className="h-3.5 w-3.5" /></span></td><td className="py-2.5 px-4 text-sm font-bold text-pink-400 rounded-r-lg">MAINNET GENESIS</td></tr>
                </tbody></table>
              </PhaseAccordion>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 3: LAYERS
           ═══════════════════════════════════════════════ */}
        {activeTab === 'layers' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-8">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Architecture</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Layers className="h-7 w-7 text-zion-gold" />
                  Layer Stack
                </h2>
                <p className="text-sm text-gray-400 italic">&quot;Jednoduchý L1 blockchain, který funguje bezchybně, je základem pro nekonečný ekosystém nad ním.&quot;</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'L6 — ZION ISSOBELLA', color: 'border-l-rose-400 bg-rose-500/5', title: 'Orbital Consciousness Station', desc: 'Vesmírná stanice ZION Issobella — decentralizovaný výzkum, orbital mining, 5% block reward fund', tags: ['Space Station', 'Orbital Mining', '5% Fund', 'Deep Research'], date: '2040+', labelColor: 'text-rose-400', active: false, Icon: Rocket },
                  { label: 'L5 — FREE WORLD', color: 'border-l-amber-400 bg-amber-500/5', title: 'Sovereign Governance Layer', desc: 'Plně decentralizovaná správa, komunitní governance, svobodný ekosystém bez hranic', tags: ['Governance', 'Sovereignty', 'Community', 'Freedom'], date: '2030+', labelColor: 'text-amber-400', active: false, Icon: Globe2 },
                  { label: 'L4 — ZION OASIS', color: 'border-l-pink-400 bg-pink-500/5', title: 'Consciousness Mining as Gameplay', desc: 'UE5 open-world, XP/Consciousness levels, NFT avatary, Play-to-Mine', tags: ['UE5 World', 'XP System', 'NFT Avatars', 'Play-to-Mine'], date: '2029+', labelColor: 'text-pink-400', active: false, Icon: Gamepad2 },
                  { label: 'L3 — WARP & AI NATIVE', color: 'border-l-purple-400 bg-purple-500/5', title: 'Neural Compute Layer & AI Agents', desc: 'WARP adapters 7/7 hotovo, NCL gateway online, AI Native SDK navazuje', tags: ['WARP 7/7', 'NCL Gateway', 'AI Orchestrátor', 'GPU za ZION'], date: '2026 Q1–Q2 (testnet hotovo)', labelColor: 'text-purple-400', active: true, Icon: Brain },
                  { label: 'L2 — DEX & DeFi', color: 'border-l-blue-400 bg-blue-500/5', title: 'Atomic Swaps, AMM & DAO', desc: 'wZION bridge na Base Sepolia testnet ready, další DeFi kroky navazují', tags: ['HTLC Swaps', 'wZION Bridge', 'Base Sepolia', 'DAO Voting'], date: '2026 Q1–Q2 (testnet ready)', labelColor: 'text-blue-400', active: true, Icon: ArrowLeftRight },
                  { label: 'L1 — ZION BLOCKCHAIN ← ZDE', color: 'border-l-cyan-400 bg-cyan-500/[0.08] border-2 border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.12)]', title: 'PoW Cosmic Harmony v3 — Ekam Deeksha', desc: 'UTXO + Ed25519, Decade Decay emise (-20%/dekádu), LWMA DAA, fee burning, dual-mining ZION+VRSC. Ekam Deeksha: 256 KiB scratchpad + epoch NPU weights (ASIC resistance Tier 1+2 deployed).', tags: ['Ekam Deeksha', 'ASIC-resistant', 'UTXO Model', 'Ed25519', 'Decade Decay', 'Fee Burn', 'Dual Mining'], date: 'MainNet 31. 12. 2026', labelColor: 'text-cyan-400', active: true, Icon: Link },
                ].map((l, idx) => (
                  <motion.div
                    key={l.label}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 + idx * 0.06 }}
                    className={`rounded-3xl border-l-4 p-6 ${l.color} hover:translate-x-1 transition-transform`}
                  >
                    <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${l.labelColor}`}>{l.label}</p>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><l.Icon className="h-5 w-5" />{l.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{l.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">{l.tags.map(t => <span key={t} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10">{t}</span>)}</div>
                    <p className="text-[11px] text-gray-600 mt-3 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {l.date}</p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 4: CONSTITUTION
           ═══════════════════════════════════════════════ */}
        {activeTab === 'constitution' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="grid gap-6 lg:grid-cols-2"
            >
              {/* Constitution */}
              <div className="rounded-2xl sm:rounded-3xl border border-zion-gold/30 bg-linear-to-br from-zion-gold/10 via-transparent to-zion-purple/10 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="h-6 w-6 text-zion-gold" />
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">MainNet Constitution</h2>
                    <p className="text-xs sm:text-sm text-gray-400">Zmrazené parametry — nelze změnit bez hard forku</p>
                  </div>
                </div>
                <div className="space-y-0">
                  {[
                    ['Chain ID', 'zion-mainnet-1'],
                    ['Total Supply', '144,000,000,000'],
                    ['Mining Supply', '127,720,000,000'],
                    ['Genesis Premine', '16,280,000,000'],
                    ['Block Reward (D1)', '5,400.067 ZION'],
                    ['Emission Model', 'Decade Decay (-20%/10y)'],
                    ['Tail Emission', '724.785 ZION/block ∞'],
                    ['Block Time', '60 sekund'],
                    ['DAA', 'LWMA (60 bloků, ±25%)'],
                    ['Max Reorg', '10 bloků'],
                    ['Soft Finality', '60 bloků'],
                    ['Coinbase Maturity', '100 bloků'],
                    ['Consensus', 'PoW CHv3 + VRSC dual'],
                    ['Distribution', '89% miner · 5% humanit. · 5% Issobella · 1% pool'],
                    ['Presale', 'NEEXISTUJE'],
                    ['Atomic Units', '1M per ZION'],
                    ['Mining Horizon', '100+ let + tail ∞'],
                  ].map(([param, value]) => (
                    <div key={param} className="flex items-center justify-between py-2 sm:py-2.5 border-b border-white/5 text-xs sm:text-sm gap-2">
                      <span className="text-gray-400 shrink-0">{param}</span>
                      <span className={`font-mono text-white flex items-center gap-1 sm:gap-1.5 text-right ${value === 'NEEXISTUJE' ? 'text-red-400' : ''}`}>
                        <Lock className="h-3 w-3 text-zion-gold/60" />
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premine Allocation */}
              <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Scale className="h-6 w-6 text-zion-purple" />
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Genesis Premine</h2>
                    <p className="text-xs sm:text-sm text-gray-400">16,280,000,000 ZION — transparentní alokace</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { cat: 'ZION OASIS + Winners Golden Egg/Xp', Icon: Pickaxe, amount: '8,250,000,000', pct: 50.7, lock: 'Okamžitě dostupné', lockColor: 'text-emerald-400' },
                    { cat: 'DAO Treasury', Icon: Database, amount: '4,000,000,000', pct: 24.6, lock: 'Okamžitě dostupné', lockColor: 'text-emerald-400' },
                    { cat: 'Infrastructure & Dev', Icon: Wrench, amount: '2,500,000,000', pct: 15.4, lock: 'Okamžitě dostupné', lockColor: 'text-emerald-400' },
                    { cat: 'Humanitarian Fund', Icon: Heart, amount: '1,530,000,000', pct: 9.4, lock: 'Okamžitě dostupné', lockColor: 'text-emerald-400' },
                  ].map(p => (
                    <div key={p.cat} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2"><p.Icon className="h-4 w-4 text-gray-400" />{p.cat}</h4>
                        <span className="text-xs text-zion-gold font-mono">{p.pct}%</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
                        <span className="font-mono">{p.amount} ZION</span>
                        <span className={`text-xs ${p.lockColor}`}>{p.lock}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-linear-to-r from-zion-gold to-zion-purple"
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 5: ECONOMY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'economy' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Tokenomics</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Wallet className="h-7 w-7 text-zion-gold" />
                  Ekonomický model
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Block Reward (D1)" value="5,400.067" sub="ZION/block · Decade Decay" color="text-cyan-400" mono />
                <Stat label="Tail Emission" value="724.785" sub="ZION/block ∞ (od 2126)" color="text-emerald-400" mono />
                <Stat label="Distribution" value="89/5/5/1" sub="miner / humanit. / Issobella / pool" color="text-purple-400" mono />
                <Stat label="Mining Horizon" value="100+ let" sub="+ perpetuální tail ∞" color="text-zion-gold" mono />
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-red-500/20 bg-red-500/5 p-4 sm:p-6 lg:p-8 flex items-center gap-3 sm:gap-6"
            >
              <Flame className="h-8 w-8 sm:h-10 sm:w-10 text-red-400 shrink-0" />
              <div>
                <p className="text-sm sm:text-lg font-bold text-white">ALL L1 Transaction Fees → <span className="text-red-400">BURNED</span></p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Posílány na burn address bez privátního klíče → deflationary tlak</p>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 6: SECURITY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Security</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Shield className="h-7 w-7 text-emerald-400" />
                  MainNet Readiness Security Checklist
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  [true, 'Ed25519 signature verification'],
                  [true, 'Double-spend ochrana (mempool + UTXO)'],
                  [true, 'Overflow ochrana (checked_add)'],
                  [true, 'P2P rate limiting (200/peer/60s)'],
                  [true, 'Coinbase maturity 100 bloků'],
                  [true, 'Reorg limit 10 bloků'],
                  [true, 'Timestamp validace ±120s'],
                  [true, 'Mempool limits (50k TX, min fee)'],
                  [true, 'P2P fork detection + auto reorg'],
                  [true, 'credit_balance za feature flag'],
                  [true, 'Reorg serializace (reorg_lock)'],
                  [true, 'is_stronger_chain anti-fork'],
                  [true, 'VarDiff deadlock fix'],
                  [true, 'Pool accept loop deadlock fix'],
                  [true, 'Ekam Deeksha Tier 1 — 256 KiB scratchpad'],
                  [true, 'Ekam Deeksha Tier 2 — epoch NPU weights'],
                  [false, 'RPC autentizace (API key)'],
                  [false, 'Block size limit (max 1 MB)'],
                  [false, 'TX size limit (max 100 KB)'],
                  [false, 'Peer limit (50 in, 8 out)'],
                  [false, 'External security audit'],
                ].map(([done, text]) => (
                  <div key={text as string} className="flex items-center gap-3 text-sm py-2.5 px-4 rounded-2xl bg-white/5 border border-white/10">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-600 shrink-0" />
                    )}
                    <span className={done ? 'text-gray-300' : 'text-gray-500'}>{text as string}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 text-sm text-gray-400">
                <span className="font-mono text-emerald-400">16</span>
                <span>/</span>
                <span className="font-mono">21</span>
                <span>completed</span>
                <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: '76.2%' }} />
                </div>
                <span className="font-mono text-cyan-400">76.2%</span>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 7: TIMELINE
           ═══════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-8">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Timeline</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <CalendarDays className="h-7 w-7 text-zion-gold" />
                  Master Timeline 2026 – 2028
                </h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <h3 className="font-semibold text-white text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-zion-gold" /> 2026 — L1 Blockchain Year</h3>
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-white/20 space-y-4 sm:space-y-6">
                    {[
                      { done: true, date: 'Únor 2026', title: 'Fáze 0 — Spec Freeze', desc: 'Core rewrite, 155 testů', color: 'text-emerald-400' },
                      { active: true, date: 'Únor — Březen 2026', title: 'Fáze 1 — Hardened TestNet', desc: '168h stability PASS, archived 3-node validation', color: 'text-cyan-400' },
                      { done: true, date: 'Červen — Červenec', title: 'Fáze 2 — Node UX & Mining', desc: 'Explorer, mining guides, node setup — HOTOVO', color: 'text-emerald-400' },
                      { active: true, date: 'Srpen — Září', title: 'Fáze 3 — Infra & Legal', desc: 'Monitoring ✅, legal ✅, seed nody TODO', color: 'text-yellow-400' },
                      { date: 'Říjen — Listopad', title: 'Fáze 4 — Dress Rehearsal', desc: '7-day run, security audit, code freeze' },
                      { date: '31. Prosince 2026', title: 'MAINNET GENESIS', desc: 'Genesis block, public host bootstrap, pool mining', color: 'text-pink-400' },
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[21px] sm:-left-[25px] top-1.5 w-3 h-3 rounded-full border-2 ${item.done ? 'bg-emerald-400 border-emerald-400' : item.active ? 'bg-cyan-400 border-cyan-400 shadow-[0_0_12px_var(--color-cyan-400)]' : 'bg-black border-gray-600'}`} />
                        <p className="text-[11px] text-gray-500">{item.date}</p>
                        <p className={`text-sm font-semibold ${item.color ?? 'text-white'}`}>{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <h3 className="font-semibold text-white text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-zion-gold" /> 2027–2028 — Ecosystem Expansion</h3>
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-700 space-y-4 sm:space-y-6">
                    {[
                      { date: 'Leden — Červen 2027', title: 'Fáze 6 — Post-Launch', desc: 'Silent MainNet, DEX, CMC/CoinGecko', color: 'text-white' },
                      { date: '2026 Q1–Q2', title: 'L2 — DEX & DeFi', desc: 'wZION bridge Base Sepolia testnet ready', color: 'text-blue-400' },
                      { date: '2026 Q1–Q2', title: 'L3 — Warp & AI Native', desc: 'WARP adapters 7/7 hotovo, NCL online', color: 'text-purple-400' },
                      { date: '2029+', title: 'L4 — ZION Oasis', desc: 'UE5 World, XP System, Play-to-Mine', color: 'text-pink-400' },
                      { date: '2030+', title: 'L5 — Free World', desc: 'Sovereignty, decentralizovaná governance', color: 'text-amber-400' },
                      { date: '2040+', title: 'L6 — ZION Issobella', desc: 'Orbital station, 5% block reward fund', color: 'text-rose-400' },
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] sm:-left-[25px] top-1.5 w-3 h-3 rounded-full border-2 bg-black border-gray-600" />
                        <p className="text-[11px] text-gray-500">{item.date}</p>
                        <p className={`text-sm font-semibold ${item.color}`}>{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Gantt-like chart */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="space-y-3 sm:space-y-4 overflow-x-auto">
                {[
                  { layer: 'L1 Blockchain', period: '2026', phases: 'Phase 0 → 1 → 2–4 → MainNet', color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
                  { layer: 'L2 NCL / Neural Conscious', period: '2027', phases: 'wZION Bridge · Base Sepolia', color: 'from-blue-400 to-cyan-400', width: '22%', offset: '44%' },
                  { layer: 'L3 ZION DAO', period: '2028', phases: 'WARP Protocol · NCL · AI', color: 'from-purple-400 to-pink-400', width: '22%', offset: '56%' },
                  { layer: 'L4 Oasis', period: '2029+', phases: 'UE5 · Play-to-Mine · Beta', color: 'from-yellow-400 to-orange-400', width: '18%', offset: '68%' },
                  { layer: 'L5 Free World', period: '2030+', phases: 'Governance · Sovereignty', color: 'from-amber-400 to-yellow-400', width: '18%', offset: '72%' },
                  { layer: 'L6 Issobella', period: '2040+', phases: 'Orbital Station · Fund', color: 'from-rose-400 to-red-400', width: '12%', offset: '88%' }
                ].map((row) => (
                  <div key={row.layer} className="flex items-center gap-2 sm:gap-4 min-w-[480px] sm:min-w-0">
                    <div className="w-24 sm:w-28 md:w-36 shrink-0 text-right">
                      <p className="text-xs sm:text-sm font-semibold text-white">{row.layer}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">{row.period}</p>
                    </div>
                    <div className="flex-1 h-8 sm:h-10 rounded-xl bg-white/5 relative overflow-hidden">
                      <div
                        className={`absolute top-0 bottom-0 rounded-xl bg-linear-to-r ${row.color} opacity-60 flex items-center px-2 sm:px-3`}
                        style={{ width: row.width, left: row.offset }}
                      >
                        <span className="text-[9px] sm:text-[11px] text-white font-medium truncate">{row.phases}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 sm:gap-4 mt-2 min-w-[480px] sm:min-w-0">
                  <div className="w-24 sm:w-28 md:w-36 shrink-0" />
                  <div className="flex-1 flex justify-between text-[8px] sm:text-[10px] text-gray-600 px-1">
                    {['2026 Q1', 'Q2', 'Q3', 'Q4', '2027 Q1', 'Q2', 'Q3', 'Q4', '2028'].map((q) => (
                      <span key={q}>{q}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 8: PRIORITY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'priority' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Priorities</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Zap className="h-7 w-7 text-yellow-400" />
                  Priority To-Do
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">Prio</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">Úkol</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">Fáze</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: '168h stability snapshot · archived 3-node PASS ✅', phase: '1.10', status: 'PASS', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'CHv4 E2E 11/11 PASS + cosmic_harmony_v3', phase: 'B-CRIT-01', status: 'DONE', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Ekam Deeksha Tier 1+2 — ASIC resistance upgrade', phase: '1.13–1.16', status: 'DEPLOYED', sColor: 'text-emerald-400' },
                      { prio: 'P0', prioColor: 'text-red-400 font-bold', task: 'Ekam Deeksha 24h stability + epoch transition', phase: 'B-CRIT-02', status: 'IN PROG', sColor: 'text-amber-400', bg: 'bg-amber-500/5' },
                      { prio: 'P0', prioColor: 'text-red-400 font-bold', task: 'Genesis/freeze artefakty + sign-off', phase: 'B-CRIT-03', status: 'BLOCKED', sColor: 'text-red-400', bg: 'bg-red-500/5' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Block explorer', phase: '2.3', status: 'HOTOVO', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Node UX ("10 min setup")', phase: '2.1', status: 'HOTOVO', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Mining guides', phase: '2.2', status: 'HOTOVO', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Prometheus + Grafana', phase: '3.1', status: 'HOTOVO', sColor: 'text-emerald-400' },
                      { prio: '✅', prioColor: 'text-emerald-400 font-bold', task: 'Legal docs (6/6 + footer)', phase: '3.3', status: 'HOTOVO', sColor: 'text-emerald-400' },
                      { prio: 'P1', prioColor: 'text-yellow-400 font-bold', task: '5+ seed nodů', phase: '3.1', status: 'TODO', sColor: 'text-gray-500' },
                      { prio: 'P1', prioColor: 'text-yellow-400 font-bold', task: 'Security audit (externí)', phase: '4.2', status: 'TODO', sColor: 'text-gray-500' },
                      { prio: 'P2', prioColor: 'text-blue-400 font-semibold', task: 'wZION ERC-20 + bridge', phase: '3.4', status: 'TODO', sColor: 'text-gray-500' },
                      { prio: 'P2', prioColor: 'text-blue-400 font-semibold', task: 'CMC + CoinGecko', phase: '6C', status: 'TODO', sColor: 'text-gray-500' },
                      { prio: 'P2', prioColor: 'text-blue-400 font-semibold', task: 'Docker images publish', phase: '3.2', status: 'TODO', sColor: 'text-gray-500' },
                    ].map((row, i) => (
                      <tr key={i} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${row.bg ?? ''}`}>
                        <td className={`px-4 py-3 rounded-l-lg ${row.prioColor}`}>{row.prio}</td>
                        <td className="px-4 py-3 font-semibold text-white">{row.task}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{row.phase}</td>
                        <td className={`px-4 py-3 rounded-r-lg ${row.sColor}`}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          </div>
        )}

        {/* ══════════════ FOOTER ══════════════ */}
        <div className="text-center text-xs text-gray-600 pt-8 border-t border-white/10">
          ZION TerraNova {SITE_RELEASE_LABEL} · Archived 168h stability PASS ✅ · Ekam Deeksha v2.9.9 live<br />
          <em>6-layer architecture · operations-first web shell</em><br /><br />
          Last update: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'} · Auto-refresh: 30s
        </div>
      </div>
    </div>
  );
}
