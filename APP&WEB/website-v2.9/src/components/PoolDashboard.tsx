"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  HardHat,
  Heart,
  HelpCircle,
  Layers,
  Pickaxe,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  Signal,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
const LiveToast = dynamic(() => import('@/components/explorer/LiveToast'));
const Pool24hCharts = dynamic(() => import('@/components/pool/Pool24hCharts'));
const PoolEventsFeed = dynamic(() => import('@/components/pool/PoolEventsFeed'));
const PoolRewardDonut = dynamic(() => import('@/components/pool/PoolRewardDonut'));
const PoolBlocksClient = dynamic(() => import('@/components/pool/PoolBlocksClient'));
const PoolMinersClient = dynamic(() => import('@/components/pool/PoolMinersClient'));
const PoolCalculatorClient = dynamic(() => import('@/components/pool/PoolCalculatorClient'));
const PoolBenchmarksClient = dynamic(() => import('@/components/pool/PoolBenchmarksClient'));
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL } from '@/lib/site';

/* ═══════════════════════════════════════════════════════════
   ZION MINING POOL DASHBOARD
   Redesigned to match Explorer visual language
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════ TYPES ═══════════════════════ */
interface PoolServer {
  id: string;
  name: string;
  flag: string;
  host: string;
  stratum: number;
  region: string;
  online: boolean;
  stats: {
    blockchain?: { connected: boolean; height: number; difficulty: number };
    hashrate?: { pool: number; pool_1h: number; pool_24h: number };
    miners?: { active: number; total: number };
    shares?: { valid: number; invalid: number };
    blocks?: { found: number; pending: number };
    pool?: { fee: number; humanitarian_tithe: number; issobella_fund?: number; miner_share: number; version: string; uptime_secs: number };
    pplns_window_size?: number;
    payouts?: { pending_miners: number; pending_total_atomic: number };
  } | null;
}

interface Miner {
  address: string;
  last_share: number;
  server: string;
}

interface Block {
  height: number;
  hash: string;
  difficulty: number;
  reward: number;
  timestamp: number;
  miner_address: string;
  server: string;
}

interface PoolData {
  ok: boolean;
  timestamp: number;
  aggregate: {
    hashrate: number;
    hashrate_24h: number;
    active_miners: number;
    total_miners: number;
    blocks_found: number;
    valid_shares: number;
    invalid_shares: number;
    share_efficiency: string;
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
  };
  fee: {
    pool_fee: number;
    humanitarian_tithe: number;
    issobella_fund?: number;
    miner_share: number;
    min_payout: number;
    humanitarian_wallet?: string;
    issobella_wallet?: string;
    pool_fee_wallet?: string;
  };
  routing: {
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
    groups: Record<string, { submits: number; accepted: number }>;
  };
  pplns: {
    registered_miners: number;
    window_size: number;
    window_used: number;
    window_pct: number | null;
    total_paid_flowers: number;
    total_paid_zion: number;
    payout_rounds: number;
  };
  runtime: {
    chain_height: number;
    difficulty: number;
    network_hashrate?: number;
    pool_uptime_seconds: number;
    template_fees_zion: number;
    last_scrape_ts: number;
    data_sources: {
      pool_tcp: boolean;
      core_rpc: boolean;
      prometheus: boolean;
    };
  };
  servers: PoolServer[];
  miners: Miner[];
  recent_blocks: Block[];
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmtHash(h?: number): string {
  if (!h || h <= 0) return "0 H/s";
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtHashOrPending(h?: number, fallback = 'Pending'): string {
  if (!h || h <= 0) return fallback;
  return fmtHash(h);
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function fmtDifficulty(d?: number): string {
  if (!d) return "—";
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)} M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)} K`;
  return String(d);
}

function timeAgo(ts: number, cs = false): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return cs ? `před ${diff} s` : `${diff}s ago`;
  if (diff < 3600) return cs ? `před ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return cs ? `před ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  return cs ? `před ${Math.floor(diff / 86400)} d` : `${Math.floor(diff / 86400)}d ago`;
}

function fmtUptime(secs?: number): string {
  if (!secs) return "—";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtPct(value?: number | string | null, digits = 2): string {
  if (value === undefined || value === null) return '—';
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(digits)}%`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

function atomicToZion(atomic: number): string {
  return (atomic / 1e6).toFixed(4);
}

function parseHashrateInput(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([kKmMgGtTpP])?$/);
  if (!match) return Number(cleaned) || 0;
  const base = Number(match[1]) || 0;
  const unit = (match[2] || '').toUpperCase();
  const mult: Record<string, number> = {
    '': 1,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
  };
  return base * (mult[unit] ?? 1);
}

function estimateBlocksPerDay(blocks: Block[]): number {
  if (blocks.length < 2) return 1440;
  const sorted = [...blocks].sort((a, b) => b.timestamp - a.timestamp);
  const newest = sorted[0].timestamp;
  const oldest = sorted[sorted.length - 1].timestamp;
  const span = Math.max(1, newest - oldest);
  const intervals = Math.max(1, sorted.length - 1);
  const avgInterval = span / intervals;
  return Math.max(1, Math.min(10000, 86400 / avgInterval));
}

/* ═══════════════════════ COPY BUTTON ═══════════════════════ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-gray-500 hover:text-white transition-colors" title="Copy">
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function PoolDashboard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [minerSearch, setMinerSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [myHashrateInput, setMyHashrateInput] = useState('100M');
  const [activeOnly, setActiveOnly] = useState(true);
  const [miningMode, setMiningMode] = useState<'cpu' | 'gpu'>('cpu');
  const [minerOS, setMinerOS] = useState<'linux' | 'windows'>('linux');
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'miners' | 'calculator' | 'benchmarks'>('overview');
  const hashrateHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const acceptRateHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const activeMinersHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const [blockHeight, setBlockHeight] = useState(0);
  const router = useRouter();

  const onlineServers = (data?.servers ?? []).filter((s) => s.online);
  const primaryServer = onlineServers[0] ?? data?.servers?.[0];
  const backupServer = onlineServers[1] ?? data?.servers?.[1] ?? onlineServers[0] ?? data?.servers?.[0];
  const myHashrate = parseHashrateInput(myHashrateInput);
  const poolHashrate = data?.aggregate.hashrate ?? 0;
  const rewardPerBlock = data?.recent_blocks?.[0]?.reward ? data.recent_blocks[0].reward / 1e6 : 5400;
  const blocksPerDay = estimateBlocksPerDay(data?.recent_blocks ?? []);
  const mySharePct = poolHashrate > 0 ? (myHashrate / poolHashrate) * 100 : 0;
  const myDailyZion = poolHashrate > 0
    ? (myHashrate / poolHashrate) * blocksPerDay * rewardPerBlock * ((data?.fee.miner_share ?? 89) / 100)
    : 0;

  const miners = data?.miners ?? [];
  const visibleMiners = miners.filter((m) => !activeOnly || now - m.last_share < 600);

  const primaryEndpoint = primaryServer ? `${primaryServer.host}:${primaryServer.stratum}` : SITE_POOL_PRIMARY;
  const backupEndpoint = backupServer ? `${backupServer.host}:${backupServer.stratum}` : primaryEndpoint;
  const zionMinerFailoverCmd = `# Primary pool\nZION_POOL_ADDR=${primaryEndpoint} \\\nZION_WORKER_NAME=my-rig \\\nZION_MINER_ID=worker-01 \\\nZION_PAYOUT_ADDRESS=zion1...your44charaddress \\\nZION_MINER_ALGORITHM=deeksha_lite_v1 \\\nZION_LOOP_COUNT=1000000 \\\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner\n\n# Failover: switch ZION_POOL_ADDR to backup\nZION_POOL_ADDR=${backupEndpoint} cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`;
  const routingGroups = data?.routing?.groups ? Object.entries(data.routing.groups).filter(([, group]) => group.submits > 0 || group.accepted > 0) : [];

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pool/stats", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
        setLastUpdate(new Date());
        const hr = json.aggregate?.hashrate ?? 0;
        const ar = json.aggregate?.accept_rate_pct ?? 0;
        const am = json.aggregate?.active_miners ?? 0;
        const snapTs = Math.floor(Date.now() / 1000);
        hashrateHistoryRef.current = [
          ...hashrateHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: hr }
        ].slice(-60);
        acceptRateHistoryRef.current = [
          ...acceptRateHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: ar }
        ].slice(-60);
        activeMinersHistoryRef.current = [
          ...activeMinersHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: am }
        ].slice(-60);
        if (json.runtime?.chain_height && json.runtime.chain_height > blockHeight) {
          setBlockHeight(json.runtime.chain_height);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 15_000);
  usePolling(() => {
    setNow(Math.floor(Date.now() / 1000));
  }, 30_000, { immediate: false });

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows (same as Explorer) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <Pickaxe className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? 'Těžební pool' : 'Mining Pool'}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Deeksha PoW</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'Těžte ZION' : 'Mine ZION'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? `Odměny PPLNS · 89 % pro minera · 5 % humanitární tithe · 5 % fond Issobella. Veřejný pool běží na Edge Node 1 jako součást v3.0.5 E2E sítě s 3-uzlovým P2P meshem, RPC audit logem a memory leak fixem.`
                  : `PPLNS rewards · 89% miner · 5% humanitarian · 5% Issobella fund. The public pool runs on Edge Node 1 as part of the v3.0.5 E2E network with a 3-node P2P mesh, RPC audit log, and memory leak fix.`}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {cs ? 'Živá data' : 'Live Data'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Activity className="h-3 w-3 text-emerald-400" /> {cs ? 'Auto-refresh 15 s' : 'Auto-Refresh 15s'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Globe className="h-3 w-3 text-zion-cyan" /> {cs ? 'Edge Node 1' : 'Edge Node 1'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                  {cs ? 'All Green · 11/11 služeb' : 'All Green · 11/11 services'}
                </span>
              </div>
            </div>
            {/* Stratum quick connect */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Rychlé připojení' : 'Quick Connect'}</p>
                <div className="space-y-2">
                  {(data?.servers ?? []).filter(s => s.online).map(s => (
                    <div key={s.id} className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                      <div className="flex items-center gap-2">
                        <span>{s.flag}</span>
                        <code className="text-sm text-zion-cyan font-mono">{s.host}:{s.stratum}</code>
                      </div>
                      <CopyButton text={`stratum+tcp://${s.host}:${s.stratum}`} />
                    </div>
                  ))}
                </div>
                <a href="#start-mining" className="mt-3 inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  {cs ? 'Průvodce začátkem' : 'Getting started guide'} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ POOL TABS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                {cs ? 'Pool sekce' : 'Pool sections'}
              </span>
              {[
                { id: 'overview', label: cs ? 'Přehled' : 'Overview', icon: Activity },
                { id: 'blocks', label: cs ? 'Bloky' : 'Blocks', icon: Box },
                { id: 'miners', label: cs ? 'Mineři' : 'Miners', icon: Users },
                { id: 'calculator', label: cs ? 'Kalkulačka' : 'Calculator', icon: TrendingUp },
                { id: 'benchmarks', label: cs ? 'Benchmarky' : 'Benchmarks', icon: Cpu },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'zion-rainbow-sub text-white'
                        : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                    }`}
                    style={isActive ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
        </motion.section>

        {activeTab === 'overview' && (
        <>
        {/* ═══════ MINER SEARCH ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const addr = minerSearch.trim().toLowerCase();
              if (!addr) return;
              if (!addr.startsWith("zion1") || addr.length < 20) {
                setSearchError(cs ? 'Neplatná ZION adresa — musí začínat na zion1' : 'Invalid ZION address — must start with zion1');
                return;
              }
              setSearchError("");
              router.push(`/pool/miner/${addr}`);
            }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={minerSearch}
                  onChange={(e) => { setMinerSearch(e.target.value); setSearchError(""); }}
                  placeholder={cs ? 'Zadejte svou ZION adresu pro zobrazení statistik minera...' : 'Enter your ZION address to view miner stats...'}
                  className={`w-full rounded-xl border ${searchError ? 'border-red-500/60' : 'border-white/10'} bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-zion-cyan/50 focus:ring-1 focus:ring-zion-cyan/30 transition-colors font-mono`}
                />
                {searchError && (
                  <p className="absolute -bottom-5 left-0 text-xs text-red-400">{searchError}</p>
                )}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-linear-to-r from-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                {cs ? 'Najít minera' : 'Search Miner'}
              </button>
            </div>
          </form>
        </motion.section>

        {/* ═══════ POOL STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Statistiky poolu' : 'Pool Statistics'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Metriky v reálném čase agregované z veřejného pool API na Edge Node 1 (8455).' : 'Real-time metrics aggregated from the public pool API on Edge Node 1 (8455).'}</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-6 w-20 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard icon={<Activity className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={cs ? 'Hashrate poolu' : 'Pool Hashrate'} value={fmtHashOrPending(data.aggregate.hashrate)} sub={data.aggregate.hashrate > 0 ? `${cs ? '24h průměr' : '24h avg'}: ${fmtHash(data.aggregate.hashrate_24h)}` : (cs ? 'Živý backend zatím hashrate neexportuje' : 'Live backend is not exporting hashrate yet')} tip={cs ? 'Celkový výpočetní výkon všech minerů v poolu.' : 'Total computational power of all miners in the pool.'} />
              <StatCard icon={<Users className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label={cs ? 'Aktivní mineři' : 'Active Miners'} value={String(data.aggregate.active_miners)} sub={cs ? `${data.aggregate.total_miners} celkem registrovaných` : `${data.aggregate.total_miners} total registered`} tip={cs ? 'Počet minerů, kteří odeslali share za posledních 10 minut.' : 'Number of miners who submitted a share in the last 10 minutes.'} />
              <StatCard icon={<Layers className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={cs ? 'Nalezené bloky' : 'Blocks Found'} value={fmtNum(data.aggregate.blocks_found)} tip={cs ? 'Celkový počet bloků nalezených tímto poolem.' : 'Total number of blocks found by this pool.'} />
              <StatCard icon={<Shield className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={cs ? 'Efektivita share' : 'Share Efficiency'} value={`${data.aggregate.share_efficiency}%`} sub={cs ? `${fmtNum(data.aggregate.valid_shares)} validních` : `${fmtNum(data.aggregate.valid_shares)} valid`} tip={cs ? 'Poměr validních shares k celkovým odevzdaným.' : 'Ratio of valid shares to total submitted shares.'} />
              <StatCard icon={<Check className="h-5 w-5" />} color="text-teal-400" bg="bg-teal-400/10" label={cs ? 'Míra přijetí' : 'Accept Rate'} value={fmtPct(data.aggregate.accept_rate_pct)} sub={cs ? `${fmtNum(data.aggregate.accepted_total)} přijatých` : `${fmtNum(data.aggregate.accepted_total)} accepted`} tip={cs ? 'Procento share přijatých poolem (validních řešení).' : 'Percentage of shares accepted by the pool (valid solutions).'} />
              <StatCard icon={<XCircle className="h-5 w-5" />} color="text-orange-400" bg="bg-orange-400/10" label={cs ? 'Odmítnuté shares' : 'Rejected Shares'} value={fmtNum(data.aggregate.rejected_total)} sub={cs ? `${fmtNum(data.aggregate.submits_total)} submitů celkem` : `${fmtNum(data.aggregate.submits_total)} total submits`} tip={cs ? 'Počet odmítnutých share — často způsobený duplicitním řešením nebo špatnou obtížností.' : 'Number of rejected shares — often caused by duplicate solutions or stale difficulty.'} />
              <StatCard icon={<Globe className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={cs ? 'Servery online' : 'Servers Online'} value={`${data.servers.filter(s => s.online).length} / ${data.servers.length}`} tip={cs ? 'Počet dostupných pool serverů.' : 'Number of available pool servers.'} />
              <StatCard icon={<Heart className="h-5 w-5" />} color="text-pink-400" bg="bg-pink-400/10" label={cs ? 'Podíl minera' : 'Miner Share'} value={`${data.fee.miner_share}%`} sub={cs ? `${data.fee.pool_fee}% fee` : `${data.fee.pool_fee}% fee`} tip={cs ? 'Procento odměny, které získá miner (zbytek jde na fondy a fee).' : 'Percentage of reward going to the miner (rest goes to funds and fee).'} />
              <StatCard icon={<HardHat className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label="PPLNS Fill" value={fmtPct(data.pplns.window_pct)} sub={cs ? `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} share` : `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} shares`} tip={cs ? 'Naplnění PPLNS okna — určuje, kolik posledních share se započítává do odměn.' : 'PPLNS window fill — determines how many recent shares count towards rewards.'} />
              <StatCard icon={<Wallet className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={cs ? 'Celkem vyplaceno' : 'Total Paid'} value={`${data.pplns.total_paid_zion.toFixed(2)} ZION`} sub={cs ? `${fmtNum(data.pplns.payout_rounds)} payout kol` : `${fmtNum(data.pplns.payout_rounds)} payout rounds`} tip={cs ? 'Celkové množství ZION vyplacené minerům v historii poolu.' : 'Total ZION paid out to miners in pool history.'} />
              <StatCard icon={<Cpu className="h-5 w-5" />} color="text-zion-cyan" bg="bg-zion-cyan/10" label={cs ? 'Síťový hashrate' : 'Network Hashrate'} value={fmtHashOrPending(data.runtime.network_hashrate, cs ? 'Offline' : 'Offline')} sub={cs ? `Výška ${fmtNum(data.runtime.chain_height)}` : `Height ${fmtNum(data.runtime.chain_height)}`} tip={cs ? 'Celkový výpočetní výkon celé ZION sítě.' : 'Total computational power of the entire ZION network.'} />
              <StatCard icon={<Bell className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={cs ? 'Template fees' : 'Template Fees'} value={`${data.runtime.template_fees_zion.toFixed(4)} ZION`} sub={cs ? `Obtížnost ${fmtDifficulty(data.runtime.difficulty)}` : `Difficulty ${fmtDifficulty(data.runtime.difficulty)}`} tip={cs ? 'Součet fee z transakcí v aktuálním block template.' : 'Sum of fees from transactions in the current block template.'} />
              {data.servers.filter(s => s.stats?.blockchain?.connected).map(srv => (
                <StatCard
                  key={srv.id}
                  icon={<Signal className="h-5 w-5" />}
                  color="text-zion-cyan"
                  bg="bg-zion-cyan/10"
                  label={`${srv.flag} Height`}
                  value={fmtNum(srv.stats?.blockchain?.height)}
                  sub={`Diff: ${fmtDifficulty(srv.stats?.blockchain?.difficulty)}`}
                />
              ))}
              {data.servers.filter(s => s.stats?.pool?.uptime_secs).map(srv => (
                <StatCard
                  key={`uptime-${srv.id}`}
                  icon={<RefreshCw className="h-5 w-5" />}
                  color="text-teal-400"
                  bg="bg-teal-400/10"
                  label={`${srv.flag} Uptime`}
                  value={fmtUptime(srv.stats?.pool?.uptime_secs)}
                />
              ))}
            </div>
          ) : (
            <div className="zion-rainbow-sub p-6 text-center" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <p className="text-gray-400">{cs ? 'Data poolu nejsou dostupná. Servery mohou být offline.' : 'Pool data unavailable. Servers may be offline.'}</p>
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL PERFORMANCE ═══════ */}
        {data && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Výkon' : 'Performance'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
              {cs ? 'Výkon poolu' : 'Pool Performance'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Živý graf hashrate, podíl na síti a statistika štěstí poolu.' : 'Live hashrate chart, network share, and pool luck statistics.'}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            {/* Hashrate Chart */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{cs ? 'Hashrate poolu (poslední hodina)' : 'Pool Hashrate (last hour)'}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{fmtHash(data.aggregate.hashrate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{cs ? '24h průměr' : '24h average'}</p>
                  <p className="text-sm font-mono text-gray-300">{fmtHash(data.aggregate.hashrate_24h)}</p>
                </div>
              </div>
              <HashrateSpark data={hashrateHistoryRef.current} height={120} />
            </div>

            {/* Right column: Network share + Luck + Pending */}
            <div className="space-y-4">
              {/* Network Share */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Podíl na síti' : 'Network Share'}</p>
                {(() => {
                  const netHash = data.runtime.network_hashrate ?? 0;
                  const poolHash = data.aggregate.hashrate ?? 0;
                  const sharePct = netHash > 0 ? (poolHash / netHash) * 100 : 0;
                  return (
                    <>
                      <p className="text-2xl font-bold text-zion-cyan font-mono">{sharePct.toFixed(2)}%</p>
                      <div className="mt-3 h-2.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-zion-cyan to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, sharePct)}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                        <span>Pool: {fmtHash(poolHash)}</span>
                        <span>{cs ? 'Síť' : 'Network'}: {fmtHash(netHash)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pool Luck */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{cs ? 'Štěstí poolu' : 'Pool Luck'}</p>
                {(() => {
                  const netHash = data.runtime.network_hashrate ?? 0;
                  const poolHash = data.aggregate.hashrate ?? 0;
                  const uptime = data.runtime.pool_uptime_seconds ?? 0;
                  const blocksFound = data.aggregate.blocks_found ?? 0;
                  const expectedBlocks = netHash > 0 && uptime > 0 ? (poolHash / netHash) * (uptime / 60) : 0;
                  const luck = expectedBlocks > 0 ? (blocksFound / expectedBlocks) * 100 : 0;
                  const luckColor = luck >= 100 ? 'text-emerald-400' : luck >= 80 ? 'text-zion-gold' : luck >= 50 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <>
                      <p className={`text-2xl font-bold font-mono ${luckColor}`}>{luck > 0 ? `${luck.toFixed(0)}%` : '—'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {blocksFound} {cs ? 'nalezeno' : 'found'} / {expectedBlocks.toFixed(1)} {cs ? 'očekáváno' : 'expected'}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Pending Payouts */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{cs ? 'Čekající výplaty' : 'Pending Payouts'}</p>
                {(() => {
                  const srv = data.servers.find(s => s.stats?.payouts);
                  const pending = srv?.stats?.payouts;
                  const pendingZion = pending?.pending_total_atomic ? (pending.pending_total_atomic / 1e6).toFixed(4) : '0';
                  const pendingMiners = pending?.pending_miners ?? 0;
                  return (
                    <>
                      <p className="text-2xl font-bold text-amber-400 font-mono">{pendingZion} ZION</p>
                      <p className="text-[11px] text-gray-500 mt-1">{pendingMiners} {cs ? 'minerů čeká' : 'miners queued'}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.section>
        )}

        {/* ═══════ 24-HOUR POOL TRENDS ═══════ */}
        <Pool24hCharts
          cs={cs}
          hashrateData={hashrateHistoryRef.current.map((p) => p.value)}
          acceptRateData={acceptRateHistoryRef.current.map((p) => p.value)}
          activeMinersData={activeMinersHistoryRef.current.map((p) => p.value)}
        />

        {/* ═══════ POOL OPERATIONS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Provoz' : 'Operations'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Přehled runtime poolu' : 'Pool Runtime Overview'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Tok submitů, naplnění PPLNS enginu a payout throughput čerpané z živé telemetrie poolu v3.0.5.' : 'Submission flow, PPLNS engine fill, and payout throughput sourced from live v3.0.5 pool telemetry.'}</p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Routing Flow</p>
                  <h3 className="text-xl font-semibold text-white mt-1">Submission Channels</h3>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  <Signal className="h-3.5 w-3.5 text-zion-cyan" /> {fmtPct(data?.routing?.accept_rate_pct)} accepted
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(routingGroups.length > 0 ? routingGroups : Object.entries(data?.routing?.groups ?? {})).map(([name, group]) => {
                  const groupRate = group.submits > 0 ? (group.accepted / group.submits) * 100 : 0;
                  return (
                    <div key={name} className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-gray-500">{name}</p>
                      <p className="mt-2 text-2xl font-semibold text-white font-mono">{fmtNum(group.accepted)}</p>
                      <p className="text-xs text-gray-500">{cs ? 'přijaté shares' : 'accepted shares'}</p>
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-gray-400"><span>{cs ? 'Submity' : 'Submits'}</span><span className="font-mono text-gray-200">{fmtNum(group.submits)}</span></div>
                        <div className="flex items-center justify-between text-gray-400"><span>{cs ? 'Míra přijetí' : 'Accept rate'}</span><span className="font-mono text-zion-cyan">{fmtPct(groupRate)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">PPLNS Engine</p>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-400">{cs ? 'Využití okna' : 'Window utilization'}</span>
                    <span className="text-white font-mono">{fmtPct(data?.pplns?.window_pct)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-zion-cyan via-zion-gold to-emerald-400"
                      style={{ width: `${Math.max(0, Math.min(100, data?.pplns?.window_pct ?? 0))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{cs ? 'Registrovaní mineři' : 'Registered miners'}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.registered_miners)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{cs ? 'Payout kola' : 'Payout rounds'}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.payout_rounds)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{cs ? 'Celkem vyplaceno' : 'Total paid'}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{(data?.pplns?.total_paid_zion ?? 0).toFixed(4)}</p>
                    <p className="text-xs text-gray-500">ZION</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{cs ? 'Uptime poolu' : 'Pool uptime'}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtUptime(data?.runtime?.pool_uptime_seconds)}</p>
                  </div>
                </div>

                <div className="zion-rainbow-sub p-4 text-sm text-zion-cyan" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-3">
                    <span>{cs ? 'Stav telemetrie' : 'Telemetry status'}</span>
                    <span className="font-mono text-xs text-white">
                      pool {data?.runtime?.data_sources?.pool_tcp ? 'on' : 'off'} · rpc {data?.runtime?.data_sources?.core_rpc ? 'on' : 'off'} · prom {data?.runtime?.data_sources?.prometheus ? 'on' : 'off'}
                    </span>
                  </div>
                  {data?.aggregate?.hashrate !== undefined && data.aggregate.hashrate <= 0 && (
                    <p className="mt-2 text-xs text-zion-cyan/80">
                      {cs ? 'Hashrate poolu zatím není v živém backend exporteru dostupný, proto stránka upřednostňuje routing, PPLNS a zdraví chain runtime v3.0.5.' : 'Pool hashrate is still unavailable on the live backend exporter, so the page prioritizes routing, PPLNS, and v3.0.5 chain runtime health.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ POOL SERVERS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Infrastruktura' : 'Infrastructure'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-zion-gold" />
              {cs ? 'Pool servery' : 'Pool Servers'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktuální veřejný pool host a stratum endpoint vystavený na primárním serveru.' : 'Current public pool host and stratum endpoint exposed on the primary server.'}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {(data?.servers ?? []).map((srv) => {
              const connected = srv.stats?.blockchain?.connected;
              const active = (srv.stats?.miners?.active ?? 0) > 0;
              return (
                <div key={srv.id} className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{srv.flag}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{srv.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{srv.host}:{srv.stratum}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest border ${
                        !srv.online
                          ? "border-red-400/30 bg-red-400/10 text-red-300"
                          : connected && active
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : connected
                              ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                              : "border-red-400/30 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {!srv.online ? (
                        <><XCircle className="h-3 w-3" /> {cs ? 'Offline' : 'Offline'}</>
                      ) : connected && active ? (
                        <><CircleDot className="h-3 w-3" /> {cs ? 'Těží' : 'Mining'}</>
                      ) : connected ? (
                        <><CircleDot className="h-3 w-3" /> {cs ? 'Nečinný' : 'Idle'}</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> {cs ? 'Odpojen' : 'Disconnected'}</>
                      )}
                    </span>
                  </div>
                  {srv.stats ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <MiniStat label="Hashrate" value={fmtHash(srv.stats.hashrate?.pool)} highlight />
                      <MiniStat label={cs ? 'Aktivní / Celkem' : 'Active / Total'} value={`${srv.stats.miners?.active ?? 0} / ${srv.stats.miners?.total ?? 0}`} />
                      <MiniStat label={cs ? 'Validní shares' : 'Valid Shares'} value={fmtNum(srv.stats.shares?.valid)} />
                      <MiniStat label={cs ? 'Neplatné' : 'Invalid'} value={String(srv.stats.shares?.invalid ?? 0)} />
                      <MiniStat label={cs ? 'Nalezené bloky' : 'Blocks Found'} value={fmtNum(srv.stats.blocks?.found)} />
                      <MiniStat label="PPLNS Window" value={fmtNum(srv.stats.pplns_window_size)} />
                      <MiniStat label={cs ? 'Výška' : 'Height'} value={fmtNum(srv.stats.blockchain?.height)} />
                      <MiniStat label="Uptime" value={fmtUptime(srv.stats.pool?.uptime_secs)} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{cs ? 'Data nejsou dostupná' : 'No data available'}</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-gray-500" />
                    <code className="text-xs text-zion-cyan font-mono">stratum+tcp://{srv.host}:{srv.stratum}</code>
                    <CopyButton text={`stratum+tcp://${srv.host}:${srv.stratum}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ REWARD DISTRIBUTION ═══════ */}
        <PoolRewardDonut
          cs={cs}
          minerShare={data?.fee.miner_share ?? 89}
          humanitarianTithe={data?.fee.humanitarian_tithe ?? 5}
          issobellaFund={data?.fee.issobella_fund ?? 5}
          poolFee={data?.fee.pool_fee ?? 1}
        />

        {/* ═══════ MINERS TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          id="miners"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Adresář' : 'Directory'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Users className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Aktivní mineři' : 'Active Miners'} ({visibleMiners.length})
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktuální adresář minerů z živého pool backendu. Pro detail konkrétní adresy použijte vyhledávání výše.' : 'Recent miner directory from the live pool backend. Use miner search for full address-level detail.'}</p>
            <div className="mt-1 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveOnly(true)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${activeOnly ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                style={activeOnly ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
              >
                {cs ? 'Jen aktivní' : 'Active only'}
              </button>
              <button
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${!activeOnly ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                style={!activeOnly ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
              >
                {cs ? 'Všichni mineři' : 'All miners'}
              </button>
            </div>
          </div>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">#</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Adresa' : 'Address'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Server' : 'Server'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Poslední share' : 'Last Share'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Stav' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMiners.map((m, i) => {
                    const isActive = now - m.last_share < 600;
                    const serverObj = data?.servers.find(s => s.id === m.server);
                    return (
                      <tr key={m.address} className="border-b border-white/[0.04] transition-colors">
                        <td className="px-5 py-3.5 text-gray-500 font-mono">{i + 1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-white font-mono">{shortAddr(m.address)}</code>
                            <CopyButton text={m.address} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-sm">{serverObj?.flag} {serverObj?.name ?? m.server}</td>
                        <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{timeAgo(m.last_share, cs)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            isActive
                              ? "text-emerald-300 bg-emerald-400/10 border border-emerald-400/20"
                              : "text-gray-500 bg-white/5 border border-white/[0.06]"
                          }`}>
                            <CircleDot className="h-3 w-3" />
                            {isActive ? (cs ? 'Aktivní' : 'Active') : (cs ? 'Neaktivní' : 'Inactive')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleMiners.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">{cs ? 'Živý backend zatím nezveřejňuje poslední řádky minerů. Pro individuální statistiky vyhledejte adresu výše.' : 'Live backend is not exposing recent miner rows yet. Search by address above for individual stats.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ═══════ RECENT BLOCKS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          id="blocks"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Ledger' : 'Ledger'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Box className="h-7 w-7 text-zion-gold" />
              {cs ? 'Poslední síťové bloky' : 'Recent Network Blocks'} ({data?.recent_blocks.length ?? 0})
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Nejnovější potvrzené chain bloky z aktuálního v3.0.5 runtime. Veřejná atribuce vítěze poolu zatím není vystavena samostatně.' : 'Latest confirmed chain blocks from the current v3.0.5 runtime. Public pool winner attribution is not exposed separately yet.'}</p>
          </div>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Výška' : 'Height'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Hash</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Obtížnost' : 'Difficulty'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Odměna' : 'Reward'}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Miner</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{cs ? 'Čas' : 'Time'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_blocks ?? []).map((b, i) => (
                    <tr key={`${b.height}-${i}`} className="border-b border-white/[0.04] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/explorer/block?height=${b.height}`} className="text-zion-cyan hover:text-white font-mono font-semibold transition-colors">
                          #{fmtNum(b.height)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs text-gray-400 font-mono">{b.hash?.slice(0, 16)}…</code>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{fmtDifficulty(b.difficulty)}</td>
                      <td className="px-5 py-3.5 text-emerald-400 font-mono text-xs">{atomicToZion(b.reward)} ZION</td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs text-gray-400 font-mono">{shortAddr(b.miner_address)}</code>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{timeAgo(b.timestamp, cs)}</td>
                    </tr>
                  ))}
                  {(!data?.recent_blocks || data.recent_blocks.length === 0) && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">{cs ? 'Nejsou dostupné žádné poslední chain bloky' : 'No recent chain blocks available'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ═══════ LIVE POOL FEED ═══════ */}
        <PoolEventsFeed cs={cs} />

        {/* ═══════ START MINING GUIDE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          id="start-mining"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Začínáme' : 'Getting Started'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {cs ? 'Začněte těžit ZION' : 'Start Mining ZION'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Postupujte podle těchto kroků a začněte těžit během několika minut. ZION používá zion-miner (Rust binárka z V3).' : 'Follow these steps to begin mining in minutes. ZION uses zion-miner (the Rust binary from V3).'}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Step 1 — Get a ZION Wallet */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-purple-500/80 to-indigo-600/80">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? '1. Získejte ZION peněženku' : '1. Get a ZION Wallet'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? 'Vyžadována platná 44-znaková zion1... adresa' : 'Valid 44-char zion1... address required'}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{cs ? 'Stáhněte desktop peněženku ZION nebo použijte webovou peněženku pro vytvoření těžební adresy. Pool odmítne připojení bez platné payout adresy.' : 'Download the ZION desktop wallet or use the web wallet to generate your mining address. The pool rejects connections without a valid payout address.'}</p>
              <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2 mb-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <Bell className="h-3.5 w-3.5 mt-0.5" />
                <span>{cs ? 'Kritické: ZION_PAYOUT_ADDRESS musí být platná 44-znaková zion1... adresa. Pool odmítne spojení ("pool closed the connection") bez ní.' : 'Critical: ZION_PAYOUT_ADDRESS must be a valid 44-char zion1... address. The pool rejects the connection ("pool closed the connection") without it.'}</span>
              </div>
              <Link href="/download" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                {cs ? 'Stáhnout peněženku' : 'Download Wallet'} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Step 2 — Build the Miner */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-cyan/80 to-blue-600/80">
                  <Cpu className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? '2. Sestavte miner' : '2. Build the Miner'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? 'Rust toolchain + V3 zdroj' : 'Rust toolchain + V3 source'}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{cs ? 'zion-miner je Rust binárka z V3 workspace. Sestavte ji přes cargo. Pro GPU přidejte --features gpu-opencl (nebo gpu-cuda, gpu-metal).' : 'zion-miner is the Rust binary from the V3 workspace. Build it with cargo. For GPU add --features gpu-opencl (or gpu-cuda, gpu-metal).'}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{cs ? 'CPU sestavení' : 'CPU build'}</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`cargo build --release --manifest-path V3/Cargo.toml -p zion-miner`}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{cs ? 'GPU sestavení (OpenCL)' : 'GPU build (OpenCL)'}</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl`}
                  </pre>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href="/mining/node-setup" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors">
                  {cs ? 'Průvodce nastavením' : 'Node setup guide'} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Link href="/mining/guides" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors">
                  {cs ? 'Více průvodců' : 'More guides'} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Step 3 — Choose Algorithm */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-purple-500/80 to-fuchsia-600/80">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? '3. Vyberte algoritmus' : '3. Choose Algorithm'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? '3 varianty Deeksha PoW' : '3 Deeksha PoW variants'}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { algo: 'deeksha_lite_v1', tag: cs ? 'Výchozí · CPU + GPU · Vyvážený' : 'Default · CPU + GPU · Balanced', desc: cs ? 'Standardní Deeksha Lite — doporučeno pro začátek.' : 'Standard Deeksha Lite — recommended starting point.' },
                  { algo: 'cosmic_harmony_ekam_deeksha_v2', tag: cs ? 'Pokročilý · CPU + GPU' : 'Advanced · CPU + GPU', desc: cs ? 'Ekam v2 — pokročilejší varianta Deeksha.' : 'Ekam v2 — advanced Deeksha variant.' },
                  { algo: 'deeksha_lite_fire', tag: cs ? 'Teplotně náročný · 512 KiB scratchpad · Vyšší příkon' : 'Thermal-intensive · 512 KiB scratchpad · Higher power draw', desc: cs ? 'Fire — vyšší hashrate, vyšší spotřeba. RX 5700 XT: 18.16 KH/s.' : 'Fire — higher hashrate, higher power. RX 5700 XT: 18.16 KH/s.' },
                ].map((a) => (
                  <div key={a.algo} className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-sm text-zion-cyan font-mono">{a.algo}</code>
                      <CopyButton text={`ZION_MINER_ALGORITHM=${a.algo}`} />
                    </div>
                    <p className="text-[11px] text-gray-400 mb-1">{a.tag}</p>
                    <p className="text-xs text-gray-500">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 — Configure & Connect */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500/80 to-teal-600/80">
                  <Terminal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? '4. Nakonfigurujte a připojte' : '4. Configure & Connect'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? 'Spusťte zion-miner se správnými env vars' : 'Run zion-miner with the right env vars'}</p>
                </div>
              </div>

              {/* Mode + OS toggles */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMiningMode('cpu')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${miningMode === 'cpu' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={miningMode === 'cpu' ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                  >
                    <Cpu className="h-3.5 w-3.5 inline mr-1.5" /> {cs ? 'CPU těžba' : 'CPU Mining'}
                  </button>
                  <button
                    onClick={() => setMiningMode('gpu')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${miningMode === 'gpu' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={miningMode === 'gpu' ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                  >
                    <Zap className="h-3.5 w-3.5 inline mr-1.5" /> {cs ? 'GPU těžba' : 'GPU Mining'}
                  </button>
                </div>
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMinerOS('linux')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${minerOS === 'linux' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={minerOS === 'linux' ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                  >
                    Linux/macOS
                  </button>
                  <button
                    onClick={() => setMinerOS('windows')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${minerOS === 'windows' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={minerOS === 'windows' ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                  >
                    Windows
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {minerOS === 'linux' ? (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                      {cs ? 'Linux / macOS (bash)' : 'Linux / macOS (bash)'}
                      <CopyButton text={`ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\\nZION_WORKER_NAME=my-rig \\\nZION_MINER_ID=worker-01 \\\nZION_PAYOUT_ADDRESS=zion1...your44charaddress \\\nZION_MINER_ALGORITHM=deeksha_lite_v1 \\\nZION_LOOP_COUNT=1000000${miningMode === 'gpu' ? ' \\\nZION_GPU_BACKEND=opencl \\\nZION_NONCE_COUNT_GPU=262144' : ''} \\\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner`} />
                    </p>
                    <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\
ZION_WORKER_NAME=my-rig \\
ZION_MINER_ID=worker-01 \\
ZION_PAYOUT_ADDRESS=zion1...your44charaddress \\
ZION_MINER_ALGORITHM=deeksha_lite_v1 \\
ZION_LOOP_COUNT=1000000${miningMode === 'gpu' ? ` \\
ZION_GPU_BACKEND=opencl \\
ZION_NONCE_COUNT_GPU=262144` : ''} \\
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                      Windows PowerShell
                      <CopyButton text={`$env:ZION_POOL_ADDR='${SITE_POOL_PRIMARY}'\n$env:ZION_WORKER_NAME='my-rig'\n$env:ZION_MINER_ID='worker-01'\n$env:ZION_PAYOUT_ADDRESS='zion1...your44charaddress'\n$env:ZION_MINER_ALGORITHM='deeksha_lite_v1'\n$env:ZION_LOOP_COUNT='1000000'${miningMode === 'gpu' ? `\n$env:ZION_GPU_BACKEND='opencl'\n$env:ZION_NONCE_COUNT_GPU='262144'` : ''}\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner`} />
                    </p>
                    <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`$env:ZION_POOL_ADDR='${SITE_POOL_PRIMARY}'
$env:ZION_WORKER_NAME='my-rig'
$env:ZION_MINER_ID='worker-01'
$env:ZION_PAYOUT_ADDRESS='zion1...your44charaddress'
$env:ZION_MINER_ALGORITHM='deeksha_lite_v1'
$env:ZION_LOOP_COUNT='1000000'${miningMode === 'gpu' ? `
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_NONCE_COUNT_GPU='262144'` : ''}
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`}
                    </pre>
                  </div>
                )}
                {miningMode === 'gpu' && (
                  <div className="zion-rainbow-sub p-3 text-xs text-zion-cyan/90 flex items-start gap-2" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                    <Zap className="h-3.5 w-3.5 mt-0.5" />
                    <span>{cs ? 'GPU: ZION_GPU_BACKEND=opencl (nebo cuda, metal). ZION_NONCE_COUNT_GPU=262144 je kritické pro GPU hashrate. ZION_LOOP_COUNT=1000000 zabraňuje reconnectům.' : 'GPU: ZION_GPU_BACKEND=opencl (or cuda, metal). ZION_NONCE_COUNT_GPU=262144 is critical for GPU hashrate. ZION_LOOP_COUNT=1000000 prevents reconnects.'}</span>
                  </div>
                )}
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <Shield className="h-3.5 w-3.5 mt-0.5" />
                  <span>{cs ? 'Pool a miner binárky musí být zkompilovány ze stejné zdrojové verze — protokol není zpětně kompatibilní.' : 'Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible.'}</span>
                </div>
              </div>
            </div>

            {/* Step 5 — Monitor & Earn */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-gold/80 to-amber-600/80">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? '5. Sledujte a vydělávejte' : '5. Monitor & Earn'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? 'Sledujte své odměny v reálném čase' : 'Track your rewards in real-time'}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{cs ? 'Po připojení sledujte své těžební statistiky přímo zde. Výplaty probíhají automaticky po dosažení minimálního prahu.' : 'Once connected, monitor your mining stats right here. Payouts are automatic when you reach the minimum threshold.'}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{cs ? 'Min. payout' : 'Min Payout'}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.min_payout ?? 0.1)} ZION</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{cs ? 'Podíl minera' : 'Miner Share'}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.miner_share ?? 89)}%</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{cs ? 'Metoda odměn' : 'Reward Method'}</p>
                  <p className="text-lg font-bold text-white">PPLNS</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{cs ? 'Pool fee' : 'Pool Fee'}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.pool_fee ?? 1)}%</p>
                </div>
              </div>
              <div className="zion-rainbow-sub p-3 text-xs text-gray-300 mb-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                {cs ? 'Rozdělení coinbase: 89 % miner · 5 % humanitární tithe · 5 % fond Issobella · 1 % pool fee. PPLNS — férová distribuce podle odevzdaných shares.' : 'Coinbase split: 89% miner · 5% humanitarian tithe · 5% Issobella fund · 1% pool fee. PPLNS — fair distribution based on contributed shares.'}
              </div>
              <Link href="/pool/miner/YOUR_ADDRESS" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                {cs ? 'Otevřít dashboard minera' : 'Open miner dashboard'} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ═══════ WHY MINE WITH US ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Funkce' : 'Features'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400" />
              {cs ? 'Proč těžit s námi' : 'Why Mine With Us'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Férový, transparentní a humanitárně zaměřený těžební pool.' : 'Fair, transparent, and humanitarian-focused mining pool.'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Zap className="h-5 w-5 text-white" />, color: "from-purple-500/80 to-indigo-600/80", title: cs ? 'Deeksha PoW algoritmus' : 'Deeksha PoW Algorithm', desc: cs ? 'Nativní ZION PoW, CPU + GPU, odolný vůči ASIC. 3 varianty: Lite v1, Ekam v2, Fire.' : 'Native ZION PoW, CPU + GPU, ASIC-resistant. 3 variants: Lite v1, Ekam v2, Fire.' },
              { icon: <Heart className="h-5 w-5 text-white" />, color: "from-pink-500/80 to-rose-600/80", title: cs ? 'Humanitární mise' : 'Humanitarian Mission', desc: cs ? '5 % humanitární tithe + 5 % fond Issobella. Těžba pro vědomí.' : '5% humanitarian + 5% Issobella fund. Mining for consciousness.' },
              { icon: <Server className="h-5 w-5 text-white" />, color: "from-blue-500/80 to-cyan-600/80", title: cs ? 'v3.0.5 pool infrastruktura' : 'v3.0.5 Pool Infrastructure', desc: cs ? 'Edge Node 1 pool, skutečný stratum, PPLNS, 3-uzlový mesh, RPC audit log.' : 'Edge Node 1 pool, real stratum, PPLNS, 3-node mesh, RPC audit log.' },
              { icon: <Shield className="h-5 w-5 text-white" />, color: "from-emerald-500/80 to-teal-600/80", title: cs ? 'PPLNS odměny' : 'PPLNS Rewards', desc: cs ? 'Férová distribuce odměn podle vašich odevzdaných shares. Bez luck variance.' : 'Fair reward distribution based on your contributed shares. No luck variance.' },
              { icon: <Zap className="h-5 w-5 text-white" />, color: "from-orange-500/80 to-amber-600/80", title: cs ? 'GPU akcelerace' : 'GPU Acceleration', desc: cs ? 'Podpora OpenCL/CUDA/Metal. RX 5700 XT: 18 KH/s na Fire.' : 'OpenCL/CUDA/Metal support. RX 5700 XT: 18 KH/s on Fire.' },
              { icon: <Signal className="h-5 w-5 text-white" />, color: "from-zion-cyan/80 to-blue-600/80", title: cs ? 'Monitoring v reálném čase' : 'Real-Time Monitoring', desc: cs ? 'Živý přehled hashratu, shares a výdělků přes webový dashboard a API.' : 'Live hashrate, shares, and earnings via web dashboard + API.' },
            ].map((f) => (
              <div key={f.title} className="group zion-rainbow-sub p-5 transition-all duration-200" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br ${f.color} opacity-80 group-hover:opacity-100 transition mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ PRO TOOLS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Pro nástroje' : 'Pro Tools'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Nástroje operátora' : 'Operator Toolkit'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Failover šablony, odhad výnosu a automatizační endpointy pro řízený provoz těžby.' : 'Failover templates, profit estimate, and automation endpoints for managed mining operations.'}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Odhad výnosu' : 'Profit Estimator'}</p>
              <label className="text-xs text-gray-400">{cs ? 'Váš hashrate (podporuje K/M/G/T)' : 'Your hashrate (supports K/M/G/T)'}</label>
              <input
                value={myHashrateInput}
                onChange={(e) => setMyHashrateInput(e.target.value)}
                placeholder={cs ? 'např. 250M' : 'e.g. 250M'}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 font-mono outline-none focus:border-zion-cyan/50"
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-500">{cs ? 'Parsovaný hashrate' : 'Parsed hashrate'}</span><span className="text-white font-mono">{fmtHash(myHashrate)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{cs ? 'Podíl v poolu' : 'Pool share'}</span><span className="text-zion-cyan font-mono">{mySharePct.toFixed(6)}%</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{cs ? 'Pozorované bloky/den' : 'Observed blocks/day'}</span><span className="text-gray-200 font-mono">{blocksPerDay.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{cs ? 'Odměna / blok' : 'Reward / block'}</span><span className="text-gray-200 font-mono">{rewardPerBlock.toFixed(4)} ZION</span></div>
                <div className="mt-3 zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <span className="text-emerald-200 text-xs uppercase tracking-wider">{cs ? 'Odhad denní odměny' : 'Estimated daily reward'}</span>
                  <span className="text-emerald-300 font-bold font-mono">{myDailyZion.toFixed(4)} ZION</span>
                </div>
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Failover konfigurace' : 'Failover Config'}</p>
              <div className="space-y-3">
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{cs ? 'zion-miner (primární + záložní)' : 'zion-miner (primary + backup)'}</p>
                  <pre className="block text-xs text-zion-cyan whitespace-pre-wrap break-all font-mono">{zionMinerFailoverCmd}</pre>
                  <div className="mt-2"><CopyButton text={zionMinerFailoverCmd} /></div>
                </div>
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <Shield className="h-3.5 w-3.5 mt-0.5" />
                  <span>{cs ? 'Pro failover přepněte ZION_POOL_ADDR na záložní endpoint a restartujte zion-miner. Pool a miner musí být ze stejné zdrojové verze.' : 'For failover, switch ZION_POOL_ADDR to the backup endpoint and restart zion-miner. Pool and miner must be from the same source version.'}</span>
                </div>
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Automatizace a export' : 'Automation & Export'}</p>
              <div className="space-y-2.5 text-sm">
                <a href="/api/pool/stats" target="_blank" rel="noreferrer" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <span className="text-gray-200 font-mono text-xs">/api/pool/stats</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/api/pool/miner/YOUR_ZION_ADDRESS" target="_blank" rel="noreferrer" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <span className="text-gray-200 font-mono text-xs">/api/pool/miner/&lt;address&gt;</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/monitoring" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <span className="text-gray-200">Mission control</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <Bell className="h-3.5 w-3.5 mt-0.5" />
                  <span>{cs ? 'Nastavte alert: pokud poslední share přesáhne 10 minut nebo míra přijetí klesne pod 95 %, přepněte na záložní endpoint.' : 'Set alert: if last share exceeds 10 minutes or accept rate drops below 95%, rotate to the backup endpoint.'}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ FAQ ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-400 text-sm font-bold">?</span>
              {cs ? 'Časté dotazy' : 'Frequently Asked Questions'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Odpovědi na nejčastější otázky minerů.' : 'Answers to the most common miner questions.'}</p>
          </div>

          <div className="space-y-3">
            {[
              { q: cs ? 'Jaký algoritmus ZION používá?' : 'What algorithm does ZION use?', a: cs ? 'ZION používá Deeksha — vlastní proof-of-work algoritmus odolný vůči ASIC. 3 varianty: Deeksha Lite v1 (výchozí), Ekam v2 (pokročilý), Fire (teplotně náročný, 512 KiB scratchpad). Podporuje CPU i GPU těžbu.' : 'ZION uses Deeksha — a custom ASIC-resistant proof-of-work algorithm. 3 variants: Deeksha Lite v1 (default), Ekam v2 (advanced), Fire (thermal-intensive, 512 KiB scratchpad). It supports both CPU and GPU mining.' },
              { q: cs ? 'Jak funguje PPLNS?' : 'How does PPLNS work?', a: cs ? 'PPLNS (Pay Per Last N Shares) odměňuje minery podle jejich příspěvku v posledních N share. Je férovější než proporcionální odměny a penalizuje pool-hopping.' : 'PPLNS (Pay Per Last N Shares) rewards miners based on their contribution in the last N shares. It is fairer than proportional rewards and penalizes pool-hopping.' },
              { q: cs ? 'Jaký je minimální payout?' : 'What is the minimum payout?', a: cs ? `Minimální výplata je ${data?.fee?.min_payout ?? 0.1} ZION. Výplaty probíhají automaticky po nalezení bloku, jakmile váš zůstatek dosáhne prahu.` : `The minimum payout is ${data?.fee?.min_payout ?? 0.1} ZION. Payouts happen automatically after a block is found once your balance reaches the threshold.` },
              { q: cs ? 'Kam jdou tithe a fondy?' : 'Where do tithe and funds go?', a: cs ? 'Distribuce coinbase: 89 % miner, 5 % humanitární tithe, 5 % fond Issobella, 1 % pool fee. Tithe a fondy jsou kódovány přímo v coinbase transakci na chain úrovni.' : 'Coinbase distribution: 89% miner, 5% humanitarian tithe, 5% Issobella fund, 1% pool fee. Tithe and funds are encoded directly in the coinbase transaction at the chain level.' },
              { q: cs ? 'Mohu používat XMRig?' : 'Can I use XMRig?', a: cs ? 'NE. ZION používá Deeksha PoW, který XMRig nepodporuje. Musíte použít oficiální zion-miner (Rust binárka z V3).' : 'NO. ZION uses Deeksha PoW, which is not supported by XMRig. You must use the official zion-miner (the Rust binary from V3).' },
              { q: cs ? 'Co znamená Pool Luck?' : 'What does Pool Luck mean?', a: cs ? 'Pool Luck ukazuje poměr nalezených bloků vs. statisticky očekávaných na základě hashrate poolu a obtížnosti sítě. 100 % = přesně dle očekávání, nad 100 % = lepší než průměr.' : 'Pool Luck shows the ratio of blocks found vs. statistically expected based on pool hashrate and network difficulty. 100% = exactly as expected, above 100% = better than average.' },
              { q: cs ? 'Jak nastavím failover?' : 'How do I set up failover?', a: cs ? 'Pro failover přepněte ZION_POOL_ADDR na záložní endpoint a restartujte zion-miner. Pool a miner musí být zkompilovány ze stejné zdrojové verze — protokol není zpětně kompatibilní.' : 'For failover, switch ZION_POOL_ADDR to the backup endpoint and restart zion-miner. Pool and miner must be compiled from the same source version — protocol is not backward compatible.' },
              { q: cs ? 'Jak často probíhají výplaty?' : 'How often are payouts processed?', a: cs ? 'Výplaty se zpracovávají po každém nalezeném bloku. Pool spočítá PPLNS podíly, vytvoří transakci a odešle ji do sítě. Potvrzení trvá obvykle 10 bloků.' : 'Payouts are processed after every block found. The pool calculates PPLNS shares, creates a transaction, and broadcasts it. Confirmation takes around 10 blocks.' },
              { q: cs ? 'Potřebuji GPU?' : 'Do I need a GPU?', a: cs ? 'Ne, CPU těžba funguje. Ale GPU (OpenCL/CUDA/Metal) dává 10-100x vyšší hashrate. RX 5700 XT dosahuje 18.16 KH/s na Fire.' : 'No, CPU mining works. But GPU (OpenCL/CUDA/Metal) gives 10-100x more hashrate. RX 5700 XT reaches 18.16 KH/s on Fire.' },
              { q: cs ? 'Co je ZION_PAYOUT_ADDRESS?' : 'What is ZION_PAYOUT_ADDRESS?', a: cs ? 'Kritické: musí být platná 44-znaková zion1... adresa. Pool odmítne spojení ("pool closed the connection") bez ní — fallback na miner_id není povolen.' : 'Critical: must be a valid 44-char zion1... address. The pool rejects the connection ("pool closed the connection") without it — fallback to miner_id is not allowed.' },
            ].map((item) => (
              <FAQItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.36 }}
          className="zion-cta-banner"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'ZION těžební pool' : 'ZION Mining Pool'}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs ? 'Těžte ZION s Deeksha PoW — férový a transparentní PoW pool s humanitárním přesahem zabudovaným do každého bloku.' : 'Mine ZION with Deeksha PoW — a fair, transparent PoW pool with humanitarian impact built into every block.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {cs
              ? '89 % miner · 5 % humanitarian · 5 % Issobella fund · 1 % pool fee · PPLNS · v3.0.5 All Green · Public launch 31. prosince 2026'
              : '89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · PPLNS · v3.0.5 All Green · Public launch 31 December 2026'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#start-mining" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-cyan to-zion-purple px-6 py-3 text-sm font-semibold text-black">
              <Zap className="h-4 w-4" /> {cs ? 'Začít těžit' : 'Start Mining'}
            </a>
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Layers className="h-4 w-4" /> Explorer
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
        </>
        )}

        {activeTab === 'blocks' && <PoolBlocksClient embedded />}
        {activeTab === 'miners' && <PoolMinersClient embedded />}
        {activeTab === 'calculator' && <PoolCalculatorClient embedded />}
        {activeTab === 'benchmarks' && <PoolBenchmarksClient embedded />}

        <p className="text-center text-xs text-gray-600">
          {cs ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Data v reálném čase z primárního stratum endpointu · Edge Node 1 · v3.0.5 E2E All Green` : `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Real-time data from the primary stratum endpoint · Edge Node 1 · v3.0.5 E2E All Green`}
          {lastUpdate && <> · {cs ? 'Poslední aktualizace' : 'Last update'}: {lastUpdate.toLocaleTimeString(cs ? 'cs-CZ' : 'en-US')}</>}
        </p>
      </div>

      <LiveToast currentHeight={blockHeight} />
    </div>
  );
}

/* ═══════════════════════ STAT CARD ═══════════════════════ */
function StatCard({ icon, color, bg, label, value, sub, tip }: { icon: React.ReactNode; color: string; bg: string; label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bg} mb-3 [&>svg]:h-4 [&>svg]:w-4 ${color}`}>
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════ MINI STAT ═══════════════════════ */
function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-mono ${highlight ? "text-zion-cyan font-bold" : "text-gray-300"}`}>{value}</p>
    </div>
  );
}

/* ═══════════════════════ HASHRATE SPARK ═══════════════════════ */
function HashrateSpark({ data, height = 100 }: { data: {ts: number; value: number}[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]" style={{ height }}>
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 600;
  const h = height;
  const pad = 4;
  const plotH = h - pad * 2;
  const plotW = w - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * plotW;
    const y = pad + plotH - ((v - min) / range) * plotH;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${pad + plotW},${pad + plotH} L${pad},${pad + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="poolSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#poolSparkGrad)" />
      <path d={linePath} fill="none" stroke="rgb(52, 211, 153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════ FAQ ITEM ═══════════════════════ */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-medium text-white">{question}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-white/[0.04] pt-3">{answer}</div>
      )}
    </div>
  );
}
