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
  helsinki?: ServerNode;
  usa?: ServerNode;
  asia?: ServerNode;
  log_tail?: string;
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
function valColor(pct: number) {
  if (pct > 85) return 'text-red-400';
  if (pct > 70) return 'text-yellow-400';
  return 'text-emerald-400';
}
function barColor(pct: number) {
  if (pct > 85) return 'bg-red-500';
  if (pct > 70) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

/* ═══════════════════════ TAB CONFIG ═══════════════════════ */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Monitor },
  { id: 'roadmap', label: 'Roadmap', icon: Target },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'constitution', label: 'Constitution', icon: Lock },
  { id: 'economy', label: 'Economy', icon: Wallet },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'priority', label: 'Priority', icon: Zap },
] as const;

type TabId = (typeof TABS)[number]['id'];

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

function fmtLastBlock(secs?: number | null) {
  if (secs == null) return '—';
  if (secs < 120) return `${secs}s`;
  if (secs < 7200) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function ServerCard({ node, name, flag, ip }: { node?: ServerNode; name: string; flag: string; ip: string }) {
  const s = node?.stats;
  const memPct = node?.mem?.total && node.mem.total > 0 ? Math.round((node.mem.used ?? 0) / node.mem.total * 100) : 0;
  const diskPct = node?.disk?.used_pct ?? 0;
  const isHealthy = s?.status === 'OK' || s?.status === 'ok' || s?.status === 'healthy';
  const isSyncing = s?.sync?.state === 'Downloading' || s?.sync?.state === 'Syncing';
  const isStale = (s?.time_since_last_block ?? 0) > 300; // 5 min no blocks

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
        <MiniMetric label="Containers" value={`${node?.containers_up ?? 0}/${node?.containers_healthy ?? 0}`} />
        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">Memory</p>
          <p className={`text-base font-bold font-mono ${valColor(memPct)}`}>{memPct}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(memPct)}`} style={{ width: `${memPct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">Disk</p>
          <p className={`text-base font-bold font-mono ${valColor(diskPct)}`}>{diskPct}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(diskPct)}`} style={{ width: `${diskPct}%` }} />
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

function PoolSection({ helsinki }: { helsinki?: PoolData }) {
  const hm = helsinki?.miners ?? {};
  const hhr = helsinki?.hashrate ?? {};
  const hsh = helsinki?.shares ?? {};
  const hbl = helsinki?.blocks ?? {};

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
          Mining Pool — Live Metrics
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Active Miners" value={String(totalActive)} sub={`total: ${totalMiners}`} color="text-purple-400" mono />
        <Stat label="Pool Hashrate" value={fmtHash(totalHR)} sub={`24h avg: ${fmtHash(totalHR24)}`} color="text-cyan-400" mono />
        <Stat label="Valid Shares" value={fmt(validShares)} sub={`invalid: ${invalidShares}`} color="text-emerald-400" mono />
        <Stat label="Blocks Found" value={String(blocksFound)} color="text-orange-400" mono />
      </div>
      <div className="grid md:grid-cols-1 gap-4 sm:gap-5 max-w-md">
        <PoolNodeCard name="Helsinki Pool" flag="🇫🇮" pool={helsinki} />
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
    const iv = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [refresh]);

  const sr = data?.stability_run;
  const hStats = data?.helsinki?.stats;
  const sStats = data?.usa?.stats;
  const hH = hStats?.height ?? 0;
  const sH = sStats?.height ?? 0;
  const allNodes = [data?.helsinki, data?.usa, data?.asia];
  const onlineCount = allNodes.filter(n => n?.stats?.status === 'OK' || n?.stats?.status === 'ok' || n?.stats?.status === 'healthy').length;
  const allHealthy = onlineCount === 3;
  const anyHealthy = onlineCount > 0;
  const stabilityPct = sr?.progress_pct ?? 0;
  const stabilityFinalWindow = stabilityPct >= 90 && stabilityPct < 100;
  const stabilityReady = stabilityFinalWindow && allHealthy;
  const stabilityStatus = stabilityPct >= 100 ? 'PASS' : stabilityReady ? 'READY' : (hH > 0 || sH > 0) ? 'RUNNING' : 'ISSUE';
  const stabilityStatusColor = stabilityPct >= 100
    ? 'text-emerald-400'
    : stabilityReady
    ? 'text-yellow-400'
    : (hH > 0 || sH > 0)
    ? 'text-cyan-400'
    : 'text-red-400';

  return (
    <div className="min-h-screen pt-24 sm:pt-32 pb-16 sm:pb-24 px-3 sm:px-4">
      <div className="container mx-auto max-w-7xl space-y-6 sm:space-y-8 lg:space-y-10">

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
                ZION v2.9.6 · Mission Control
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Live Telemetry</p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-gradient leading-tight">
                  Mission Control
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Real-time monitoring, roadmap tracking, mining pool metrics a kompletní přehled stavu
                ZION TerraNova — od TestNet stability po MainNet launch.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE DATA · 30s refresh
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> 3 Nodes · 3 Continents
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Shield className="h-3 w-3 text-emerald-400" /> {allHealthy ? 'All Systems Healthy' : anyHealthy ? 'Partial Systems Up' : 'Systems Monitoring'}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-3 grid-cols-2 lg:w-auto lg:min-w-[340px]">
              {[
                { label: 'Block Height', value: fmt(Math.max(hH, sH)), descriptor: 'latest block' },
                { label: 'Stability', value: `${sr?.progress_pct ?? 0}%`, descriptor: '168h stability run' },
                { label: 'Network Peers', value: fmt(Math.max(hStats?.peers_connected ?? 0, sStats?.peers_connected ?? 0)), descriptor: 'unique peers' },
                { label: 'Status', value: allHealthy ? 'PASS' : (hH > 0 || sH > 0) ? 'RUN' : 'DOWN', descriptor: allHealthy ? 'all systems go' : (hH > 0 || sH > 0) ? 'monitoring...' : 'nodes offline' },
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

        {/* ═══════════════════════════════════════════════
            TAB 1: DASHBOARD
           ═══════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && data && (
          <div className="space-y-8">
            {/* 72h Stability Run */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl sm:rounded-3xl lg:rounded-4xl border border-white/10 bg-black/40 p-4 sm:p-6 lg:p-8"
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Stability</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Gauge className="h-7 w-7 text-cyan-400" />
                  168h Stability Run — 3 Nodes · 3 Continents
                </h2>
              </div>
              <BigProgress sr={sr} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Elapsed" value={fmtTime(sr?.elapsed_secs)} color="text-cyan-400" mono />
                <Stat label="Remaining" value={fmtTime(sr?.remaining_secs)} mono />
                <Stat label="Block Height" value={fmt(Math.max(hH, sH))} color="text-purple-400" mono />
                <Stat label="Status" value={stabilityStatus} color={stabilityStatusColor} />
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
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Network</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Globe className="h-7 w-7 text-emerald-400" />
                  Network Status
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Stat label="Network" value={hStats?.network ?? 'TestNet 2.9.6'} color="text-cyan-400" />
                <Stat label="Total Peers" value={fmt(Math.max(hStats?.peers_connected ?? 0, sStats?.peers_connected ?? 0))} sub={`${onlineCount}/3 nodes online`} mono />
                <Stat label="Difficulty" value={fmt(hStats?.difficulty)} mono />
                <Stat label="Sync Status" value={(hStats?.status === 'OK' || hStats?.status === 'healthy') ? 'SYNCED ✓' : hH > 0 ? 'RUNNING' : '—'} color={(hStats?.status === 'OK' || hStats?.status === 'healthy') ? 'text-emerald-400' : 'text-gray-400'} />
              </div>
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
                <ServerCard node={data.helsinki} name="Helsinki" flag="🇫🇮" ip="77.42.31.72 · 8GB · aarch64" />
                <ServerCard node={data.usa}     name="Usa"      flag="🇺🇸" ip="178.156.240.160 · 4GB · amd64" />
                <ServerCard node={data.asia}    name="Asia"     flag="🌏" ip="5.223.43.93 · 4GB · amd64" />
              </div>
            </motion.section>

            {/* Mining Pool */}
            <PoolSection helsinki={data.helsinki?.pool} />

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
                <Stat label="Codebase" value="52,590" sub="lines of Rust" color="text-cyan-400" />
                <Stat label="Tests" value="502" sub="passing / 0 failing" color="text-emerald-400" />
                <Stat label="MainNet Ready" value="~92%" color="text-purple-400" />
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
                      { name: 'cosmic-harmony/ (PoW)', pct: 88, loc: '~11k LOC' },
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
                  Monitoring Log (3 Nodes)
                </h2>
              </div>
              <LogConsole logTail={data.log_tail} />
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
                <p className="text-sm text-gray-400">Fáze 0 (Feb) → Fáze 5 (Dec 2026) · Cíl: 31. 12. 2026</p>
              </div>
              <div className="relative h-9 rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <motion.div className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-cyan-400 via-purple-400 to-pink-400" initial={{ width: 0 }} animate={{ width: '45%' }} transition={{ duration: 1.2 }} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">~45% → MainNet</span>
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

              <PhaseAccordion icon={<RefreshCw className="h-6 w-6 text-cyan-400" />} title="Fáze 1 — Hardened TestNet" pct={77} status="PROBÍHÁ" statusColor="border-cyan-400/30 bg-cyan-400/10 text-cyan-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Únor — Květen 2026 | 420 testů dosud</p>
                <table className="w-full text-left"><thead><tr><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Sprint</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Obsah</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Testy</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Stav</th></tr></thead><tbody>
                  <SprintRow name="1.0 Network Deploy" content="Chain reset, Docker, 3-server" tests="—" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.1 Config Validation" content="TOML parsing, boundary checks" tests="70" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.2 Security Edge-Case" content="Reorg, double-spend, fork-choice" tests="29" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.3 IBD Hardening" content="Timeouts, stall detect, peer scoring" tests="42" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.4 Pool Payout" content="Batch TX, PoolWallet, JSON-RPC" tests="23" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.5 Buyback + DAO" content="100% DAO revenue, burn, tracker" tests="28" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.6 Supply API" content="getSupplyInfo, getBuybackStats" tests="15" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.7 P2P Rate-Limit" content="200 msgs/peer/60s, escalating bans" tests="13" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.8 Health & Metrics" content="getHealthCheck, getMetrics" tests="8" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.9 Stress Tests" content="High-throughput TX, rapid blocks" tests="21" status={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
                  <SprintRow name="1.10 168h Stability" content="5 nodů · 5 kontinentů · 7 dní — GATE" tests="—" status={<span className="text-cyan-400 inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> NOW</span>} highlight />
                  <SprintRow name="1.11 Partition Test" content="Izolace node 30 min, reconnect" tests="—" status={<Square className="h-4 w-4 text-gray-500" />} />
                  <SprintRow name="1.12 100 Miners" content="Simulace 100 Stratum klientů" tests="—" status={<Square className="h-4 w-4 text-gray-500" />} />
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

              <PhaseAccordion icon={<Globe className="h-6 w-6 text-yellow-400" />} title="Fáze 3 — Infrastructure & Legal" pct={50} status="PROBÍHÁ" statusColor="border-yellow-400/30 bg-yellow-400/10 text-yellow-200">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Srpen — Září 2026 | Early-start: kód + konfigurace hotové, deploy pending</p>
                <table className="w-full text-left"><tbody>
                  <SprintRow name="3.1 Seed Nodes" content="Prom+Grafana DEPLOYED ✅ (Helsinki+Germany 14/14 targets UP), dashboardy 3×, alerty 13×, 72h stability run zahájen 12.2. — seed nody 0/5" status={<span className="text-emerald-400">LIVE</span>} />
                  <SprintRow name="3.2 Docker & Deploy" content="mainnet.yml ✅, runbook ✅, CI/CD ⬜, images ⬜" status={<span className="text-yellow-400">2/5</span>} />
                  <SprintRow name="3.3 Legal" content="6 legal docs ✅, footer ✅, comm guidelines ⬜" status={<span className="text-emerald-400">7/8</span>} />
                  <SprintRow name="3.4 Exchange Ready" content="Supply API ✅, whitepaper ⬜, wZION ⬜, bridge ⬜" status={<span className="text-yellow-400">1/6</span>} />
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
                  { label: 'L3 — WARP & AI NATIVE', color: 'border-l-purple-400 bg-purple-500/5', title: 'Neural Compute Layer & AI Agents', desc: 'NCL — decentralizovaný AI marketplace, Warp Bridges, AI Native SDK', tags: ['NCL Tasks', 'AI Orchestrátor', 'Warp Bridges', 'GPU za ZION'], date: '2027 Q3+', labelColor: 'text-purple-400', active: false, Icon: Brain },
                  { label: 'L2 — DEX & DeFi', color: 'border-l-blue-400 bg-blue-500/5', title: 'Atomic Swaps, AMM & DAO', desc: 'Atomic Swaps (ZION ↔ BTC/ETH/XMR), wZION ERC-20, AMM DEX, DAO Governance', tags: ['HTLC Swaps', 'wZION Bridge', 'Uniswap', 'DAO Voting'], date: '2027 Q1-Q2', labelColor: 'text-blue-400', active: false, Icon: ArrowLeftRight },
                  { label: 'L1 — ZION BLOCKCHAIN ← ZDE', color: 'border-l-cyan-400 bg-cyan-500/[0.08] border-2 border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.12)]', title: 'PoW Cosmic Harmony v3', desc: 'UTXO + Ed25519, Decade Decay emise (-20%/dekádu), LWMA DAA, fee burning, dual-mining ZION+VRSC', tags: ['ASIC-resistant', 'UTXO Model', 'Ed25519', 'Decade Decay', 'Fee Burn', 'Dual Mining'], date: 'MainNet 31. 12. 2026', labelColor: 'text-cyan-400', active: true, Icon: Link },
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
                  Pre-MainNet Security Checklist
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
                <span className="font-mono text-emerald-400">14</span>
                <span>/</span>
                <span className="font-mono">19</span>
                <span>completed</span>
                <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: '73.7%' }} />
                </div>
                <span className="font-mono text-cyan-400">73.7%</span>
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
                      { active: true, date: 'Únor — Květen 2026', title: 'Fáze 1 — Hardened TestNet', desc: '420 testů, 72h stability run', color: 'text-cyan-400' },
                      { done: true, date: 'Červen — Červenec', title: 'Fáze 2 — Node UX & Mining', desc: 'Explorer, mining guides, node setup — HOTOVO', color: 'text-emerald-400' },
                      { active: true, date: 'Srpen — Září', title: 'Fáze 3 — Infra & Legal', desc: 'Monitoring ✅, legal ✅, seed nody TODO', color: 'text-yellow-400' },
                      { date: 'Říjen — Listopad', title: 'Fáze 4 — Dress Rehearsal', desc: '7-day run, security audit, code freeze' },
                      { date: '31. Prosince 2026', title: 'MAINNET GENESIS', desc: 'Genesis block, seed nodes, pool mining', color: 'text-pink-400' },
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
                      { date: '2027 Q1-Q2', title: 'L2 — DEX & DeFi', desc: 'Atomic Swaps, wZION Bridge, AMM', color: 'text-blue-400' },
                      { date: '2027 Q3+', title: 'L3 — Warp & AI Native', desc: 'NCL, AI Orchestrátor, AI SDK', color: 'text-purple-400' },
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
                  { layer: 'L1 Blockchain', period: '2026', phases: 'Fáze 0 → 1 → 2–4 → MainNet', color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
                  { layer: 'L2 DEX / DeFi', period: '2027 Q1–Q2', phases: 'Atomic Swaps · wZION · AMM', color: 'from-blue-400 to-cyan-400', width: '22%', offset: '44%' },
                  { layer: 'L3 Warp / AI', period: '2027 Q3+', phases: 'NCL · AI · Warp Bridges', color: 'from-purple-400 to-pink-400', width: '22%', offset: '56%' },
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
                      { prio: 'P0', prioColor: 'text-red-400 font-bold', task: '72h stability run', phase: '1.10', status: 'PROBÍHÁ', sColor: 'text-cyan-400', bg: 'bg-red-500/5' },
                      { prio: 'P0', prioColor: 'text-red-400 font-bold', task: 'Live partition test', phase: '1.11', status: 'TODO', sColor: 'text-gray-500', bg: 'bg-red-500/5' },
                      { prio: 'P0', prioColor: 'text-red-400 font-bold', task: '100 miners stress test', phase: '1.12', status: 'TODO', sColor: 'text-gray-500', bg: 'bg-red-500/5' },
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
          ZION TerraNova v2.9.6 — L1 TerraNova · L2 NCL · L3 DAO · L4 Oasis · L5 Free World · L6 ZION Issobella<br />
          <em>&quot;On the Star — 6-Layer Architecture&quot;</em><br /><br />
          Last update: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'} · Auto-refresh: 30s
        </div>
      </div>
    </div>
  );
}
