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
  return (atomic / 1e12).toFixed(4);
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
  const hashrateHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const router = useRouter();

  const onlineServers = (data?.servers ?? []).filter((s) => s.online);
  const primaryServer = onlineServers[0] ?? data?.servers?.[0];
  const backupServer = onlineServers[1] ?? data?.servers?.[1] ?? onlineServers[0] ?? data?.servers?.[0];
  const myHashrate = parseHashrateInput(myHashrateInput);
  const poolHashrate = data?.aggregate.hashrate ?? 0;
  const rewardPerBlock = data?.recent_blocks?.[0]?.reward ? data.recent_blocks[0].reward / 1e12 : 5400;
  const blocksPerDay = estimateBlocksPerDay(data?.recent_blocks ?? []);
  const mySharePct = poolHashrate > 0 ? (myHashrate / poolHashrate) * 100 : 0;
  const myDailyZion = poolHashrate > 0
    ? (myHashrate / poolHashrate) * blocksPerDay * rewardPerBlock * ((data?.fee.miner_share ?? 89) / 100)
    : 0;

  const miners = data?.miners ?? [];
  const visibleMiners = miners.filter((m) => !activeOnly || now - m.last_share < 600);

  const primaryEndpoint = primaryServer ? `${primaryServer.host}:${primaryServer.stratum}` : SITE_POOL_PRIMARY;
  const backupEndpoint = backupServer ? `${backupServer.host}:${backupServer.stratum}` : primaryEndpoint;
  const xmrigFailoverCmd = `./xmrig -o stratum+tcp://${primaryEndpoint} --url-backup=stratum+tcp://${backupEndpoint} -u YOUR_ZION_ADDRESS -p x`;
  const nativeFailoverCmd = `python zion_native_miner_v2_9.py --pool ${primaryEndpoint} --pool-backup ${backupEndpoint} --wallet YOUR_ZION_ADDRESS`;
  const routingGroups = data?.routing?.groups ? Object.entries(data.routing.groups).filter(([, group]) => group.submits > 0 || group.accepted > 0) : [];

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pool/stats", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
        setLastUpdate(new Date());
        const hr = json.aggregate?.hashrate ?? 0;
        const snapTs = Math.floor(Date.now() / 1000);
        hashrateHistoryRef.current = [
          ...hashrateHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: hr }
        ].slice(-60);
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
          className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <Pickaxe className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {tr('poolDashboard', 'mining_pool', lang)}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Cosmic Harmony</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {tr('poolDashboard', 'mine_zion', lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Odměny PPLNS · 89 % pro minera · 5 % humanitární tithe · 5 % fond Issobella. Provozní telemetrie z veřejného pool runtime s automatickou obnovou každých 15 sekund.'
                  : 'PPLNS rewards · 89% miner · 5% humanitarian · 5% Issobella fund. Operational telemetry from the public pool runtime with auto-refresh every 15 seconds.'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {tr('poolDashboard', 'live_data', lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Activity className="h-3 w-3 text-emerald-400" /> {tr('poolDashboard', 'auto_refresh_15s', lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Globe className="h-3 w-3 text-zion-cyan" /> {data?.servers.length ?? 1} {tr('poolDashboard', 'public_pool_host', lang)}
                </span>
              </div>
            </div>
            {/* Stratum quick connect */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('poolDashboard', 'quick_connect', lang)}</p>
                <div className="space-y-2">
                  {(data?.servers ?? []).filter(s => s.online).map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2">
                        <span>{s.flag}</span>
                        <code className="text-sm text-zion-cyan font-mono">{s.host}:{s.stratum}</code>
                      </div>
                      <CopyButton text={`stratum+tcp://${s.host}:${s.stratum}`} />
                    </div>
                  ))}
                </div>
                <a href="#start-mining" className="mt-3 inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  {tr('poolDashboard', 'getting_started_guide', lang)} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ MINER SEARCH ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const addr = minerSearch.trim().toLowerCase();
              if (!addr) return;
              if (!addr.startsWith("zion1") || addr.length < 20) {
                setSearchError(tr('poolDashboard', 'invalid_zion_address_must_start_with_zio', lang));
                return;
              }
              setSearchError("");
              router.push(`/pool/miner/${addr}`);
            }}
            className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 md:p-6"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={minerSearch}
                  onChange={(e) => { setMinerSearch(e.target.value); setSearchError(""); }}
                  placeholder={tr('poolDashboard', 'enter_your_zion_address_to_view_miner_st', lang)}
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
                {tr('poolDashboard', 'search_miner', lang)}
              </button>
            </div>
          </form>
        </motion.section>

        {/* ═══════ POOL STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'telemetry', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {tr('poolDashboard', 'pool_statistics', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'real_time_metrics_aggregated_from_the_pu', lang)}</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 animate-pulse">
                  <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-6 w-20 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard icon={<Activity className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={tr('poolDashboard', 'pool_hashrate', lang)} value={fmtHashOrPending(data.aggregate.hashrate)} sub={data.aggregate.hashrate > 0 ? `${tr('poolDashboard', '24h_avg', lang)}: ${fmtHash(data.aggregate.hashrate_24h)}` : (tr('poolDashboard', 'live_backend_is_not_exporting_hashrate_y', lang))} />
              <StatCard icon={<Users className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label={tr('poolDashboard', 'active_miners', lang)} value={String(data.aggregate.active_miners)} sub={cs ? `${data.aggregate.total_miners} celkem registrovaných` : `${data.aggregate.total_miners} total registered`} />
              <StatCard icon={<Layers className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={tr('poolDashboard', 'blocks_found', lang)} value={fmtNum(data.aggregate.blocks_found)} />
              <StatCard icon={<Shield className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={tr('poolDashboard', 'share_efficiency', lang)} value={`${data.aggregate.share_efficiency}%`} sub={cs ? `${fmtNum(data.aggregate.valid_shares)} validních` : `${fmtNum(data.aggregate.valid_shares)} valid`} />
              <StatCard icon={<Check className="h-5 w-5" />} color="text-teal-400" bg="bg-teal-400/10" label={tr('poolDashboard', 'accept_rate', lang)} value={fmtPct(data.aggregate.accept_rate_pct)} sub={cs ? `${fmtNum(data.aggregate.accepted_total)} přijatých` : `${fmtNum(data.aggregate.accepted_total)} accepted`} />
              <StatCard icon={<XCircle className="h-5 w-5" />} color="text-orange-400" bg="bg-orange-400/10" label={tr('poolDashboard', 'rejected_shares', lang)} value={fmtNum(data.aggregate.rejected_total)} sub={cs ? `${fmtNum(data.aggregate.submits_total)} submitů celkem` : `${fmtNum(data.aggregate.submits_total)} total submits`} />
              <StatCard icon={<Globe className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={tr('poolDashboard', 'servers_online', lang)} value={`${data.servers.filter(s => s.online).length} / ${data.servers.length}`} />
              <StatCard icon={<Heart className="h-5 w-5" />} color="text-pink-400" bg="bg-pink-400/10" label={tr('poolDashboard', 'miner_share', lang)} value={`${data.fee.miner_share}%`} sub={cs ? `${data.fee.pool_fee}% fee` : `${data.fee.pool_fee}% fee`} />
              <StatCard icon={<HardHat className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label="PPLNS Fill" value={fmtPct(data.pplns.window_pct)} sub={cs ? `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} share` : `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} shares`} />
              <StatCard icon={<Wallet className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={tr('poolDashboard', 'total_paid', lang)} value={`${data.pplns.total_paid_zion.toFixed(2)} ZION`} sub={cs ? `${fmtNum(data.pplns.payout_rounds)} payout kol` : `${fmtNum(data.pplns.payout_rounds)} payout rounds`} />
              <StatCard icon={<Cpu className="h-5 w-5" />} color="text-zion-cyan" bg="bg-zion-cyan/10" label={tr('poolDashboard', 'network_hashrate', lang)} value={fmtHashOrPending(data.runtime.network_hashrate, tr('poolDashboard', 'offline', lang))} sub={cs ? `Výška ${fmtNum(data.runtime.chain_height)}` : `Height ${fmtNum(data.runtime.chain_height)}`} />
              <StatCard icon={<Bell className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={tr('poolDashboard', 'template_fees', lang)} value={`${data.runtime.template_fees_zion.toFixed(4)} ZION`} sub={cs ? `Obtížnost ${fmtDifficulty(data.runtime.difficulty)}` : `Difficulty ${fmtDifficulty(data.runtime.difficulty)}`} />
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
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <p className="text-gray-400">{tr('poolDashboard', 'pool_data_unavailable_servers_may_be_off', lang)}</p>
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL PERFORMANCE ═══════ */}
        {data && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'performance', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
              {tr('poolDashboard', 'pool_performance', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'live_hashrate_chart_network_share_and_po', lang)}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            {/* Hashrate Chart */}
            <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{tr('poolDashboard', 'pool_hashrate_last_hour', lang)}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{fmtHash(data.aggregate.hashrate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{tr('poolDashboard', '24h_average', lang)}</p>
                  <p className="text-sm font-mono text-gray-300">{fmtHash(data.aggregate.hashrate_24h)}</p>
                </div>
              </div>
              <HashrateSpark data={hashrateHistoryRef.current} height={120} />
            </div>

            {/* Right column: Network share + Luck + Pending */}
            <div className="space-y-4">
              {/* Network Share */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('poolDashboard', 'network_share', lang)}</p>
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
                        <span>{tr('poolDashboard', 'network', lang)}: {fmtHash(netHash)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pool Luck */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{tr('poolDashboard', 'pool_luck', lang)}</p>
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
                        {blocksFound} {tr('poolDashboard', 'found', lang)} / {expectedBlocks.toFixed(1)} {tr('poolDashboard', 'expected', lang)}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Pending Payouts */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{tr('poolDashboard', 'pending_payouts', lang)}</p>
                {(() => {
                  const srv = data.servers.find(s => s.stats?.payouts);
                  const pending = srv?.stats?.payouts;
                  const pendingZion = pending?.pending_total_atomic ? (pending.pending_total_atomic / 1e12).toFixed(4) : '0';
                  const pendingMiners = pending?.pending_miners ?? 0;
                  return (
                    <>
                      <p className="text-2xl font-bold text-amber-400 font-mono">{pendingZion} ZION</p>
                      <p className="text-[11px] text-gray-500 mt-1">{pendingMiners} {tr('poolDashboard', 'miners_queued', lang)}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.section>
        )}

        {/* ═══════ POOL OPERATIONS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'operations', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {tr('poolDashboard', 'pool_runtime_overview', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'submission_flow_pplns_engine_fill_and_pa', lang)}</p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
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
                    <div key={name} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-gray-500">{name}</p>
                      <p className="mt-2 text-2xl font-semibold text-white font-mono">{fmtNum(group.accepted)}</p>
                      <p className="text-xs text-gray-500">{tr('poolDashboard', 'accepted_shares', lang)}</p>
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-gray-400"><span>{tr('poolDashboard', 'submits', lang)}</span><span className="font-mono text-gray-200">{fmtNum(group.submits)}</span></div>
                        <div className="flex items-center justify-between text-gray-400"><span>{tr('poolDashboard', 'accept_rate_1', lang)}</span><span className="font-mono text-zion-cyan">{fmtPct(groupRate)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">PPLNS Engine</p>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-400">{tr('poolDashboard', 'window_utilization', lang)}</span>
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
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs text-gray-500">{tr('poolDashboard', 'registered_miners', lang)}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.registered_miners)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs text-gray-500">{tr('poolDashboard', 'payout_rounds', lang)}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.payout_rounds)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs text-gray-500">{tr('poolDashboard', 'total_paid_1', lang)}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{(data?.pplns?.total_paid_zion ?? 0).toFixed(4)}</p>
                    <p className="text-xs text-gray-500">ZION</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs text-gray-500">{tr('poolDashboard', 'pool_uptime', lang)}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtUptime(data?.runtime?.pool_uptime_seconds)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-zion-cyan/20 bg-zion-cyan/10 p-4 text-sm text-zion-cyan">
                  <div className="flex items-center justify-between gap-3">
                    <span>{tr('poolDashboard', 'telemetry_status', lang)}</span>
                    <span className="font-mono text-xs text-white">
                      pool {data?.runtime?.data_sources?.pool_tcp ? 'on' : 'off'} · rpc {data?.runtime?.data_sources?.core_rpc ? 'on' : 'off'} · prom {data?.runtime?.data_sources?.prometheus ? 'on' : 'off'}
                    </span>
                  </div>
                  {data?.aggregate?.hashrate !== undefined && data.aggregate.hashrate <= 0 && (
                    <p className="mt-2 text-xs text-zion-cyan/80">
                      {tr('poolDashboard', 'pool_hashrate_is_still_unavailable_on_th', lang)}
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
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'infrastructure', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-zion-gold" />
              {tr('poolDashboard', 'pool_servers', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'current_public_pool_host_and_stratum_end', lang)}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {(data?.servers ?? []).map((srv) => {
              const connected = srv.stats?.blockchain?.connected;
              const active = (srv.stats?.miners?.active ?? 0) > 0;
              return (
                <div key={srv.id} className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
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
                        <><XCircle className="h-3 w-3" /> {tr('poolDashboard', 'offline', lang)}</>
                      ) : connected && active ? (
                        <><CircleDot className="h-3 w-3" /> {tr('poolDashboard', 'mining', lang)}</>
                      ) : connected ? (
                        <><CircleDot className="h-3 w-3" /> {tr('poolDashboard', 'idle', lang)}</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> {tr('poolDashboard', 'disconnected', lang)}</>
                      )}
                    </span>
                  </div>
                  {srv.stats ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <MiniStat label="Hashrate" value={fmtHash(srv.stats.hashrate?.pool)} highlight />
                      <MiniStat label={tr('poolDashboard', 'active_total', lang)} value={`${srv.stats.miners?.active ?? 0} / ${srv.stats.miners?.total ?? 0}`} />
                      <MiniStat label={tr('poolDashboard', 'valid_shares', lang)} value={fmtNum(srv.stats.shares?.valid)} />
                      <MiniStat label={tr('poolDashboard', 'invalid', lang)} value={String(srv.stats.shares?.invalid ?? 0)} />
                      <MiniStat label={tr('poolDashboard', 'blocks_found', lang)} value={fmtNum(srv.stats.blocks?.found)} />
                      <MiniStat label="PPLNS Window" value={fmtNum(srv.stats.pplns_window_size)} />
                      <MiniStat label={tr('poolDashboard', 'height', lang)} value={fmtNum(srv.stats.blockchain?.height)} />
                      <MiniStat label="Uptime" value={fmtUptime(srv.stats.pool?.uptime_secs)} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{tr('poolDashboard', 'no_data_available', lang)}</p>
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
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'economics', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-purple-400" />
              {tr('poolDashboard', 'reward_distribution', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'pplns_pay_per_last_n_shares_fair_and_tra', lang)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple-400/10 mx-auto mb-4">
                <HardHat className="h-7 w-7 text-purple-400" />
              </div>
              <p className="text-4xl font-bold text-purple-400 font-mono">{data?.fee.miner_share ?? 89}%</p>
              <h3 className="mt-2 text-base font-semibold text-white">{tr('poolDashboard', 'miner_reward', lang)}</h3>
              <p className="mt-1 text-xs text-gray-500">{tr('poolDashboard', 'direct_to_your_wallet_every_payout_cycle', lang)}</p>
            </div>
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-pink-400/10 mx-auto mb-4">
                <Heart className="h-7 w-7 text-pink-400" />
              </div>
              <p className="text-4xl font-bold text-pink-400 font-mono">{data?.fee.humanitarian_tithe ?? 5}%</p>
              <h3 className="mt-2 text-base font-semibold text-white">Humanitarian Tithe</h3>
              <p className="mt-1 text-xs text-gray-500">Funding global humanitarian causes</p>
              {data?.fee.humanitarian_wallet && <p className="mt-2 text-[10px] font-mono text-gray-600 break-all">{data.fee.humanitarian_wallet}</p>}
            </div>
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-zion-gold/10 mx-auto mb-4">
                <Heart className="h-7 w-7 text-zion-gold" />
              </div>
              <p className="text-4xl font-bold text-zion-gold font-mono">{data?.fee.issobella_fund ?? 5}%</p>
              <h3 className="mt-2 text-base font-semibold text-white">Issobella Fund</h3>
              <p className="mt-1 text-xs text-gray-500">Reserved humanitarian and stewardship treasury allocation</p>
              {data?.fee.issobella_wallet && <p className="mt-2 text-[10px] font-mono text-gray-600 break-all">{data.fee.issobella_wallet}</p>}
            </div>
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-zion-cyan/10 mx-auto mb-4">
                <Shield className="h-7 w-7 text-zion-cyan" />
              </div>
              <p className="text-4xl font-bold text-zion-cyan font-mono">{data?.fee.pool_fee ?? 1}%</p>
              <h3 className="mt-2 text-base font-semibold text-white">Pool Fee</h3>
              <p className="mt-1 text-xs text-gray-500">Infrastructure maintenance &amp; development</p>
              {data?.fee.pool_fee_wallet && <p className="mt-2 text-[10px] font-mono text-gray-600 break-all">{data.fee.pool_fee_wallet}</p>}
            </div>
          </div>
        </motion.section>

        {/* ═══════ MINERS TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          id="miners"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'directory', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Users className="h-7 w-7 text-zion-cyan" />
              {tr('poolDashboard', 'active_miners', lang)} ({visibleMiners.length})
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'recent_miner_directory_from_the_live_poo', lang)}</p>
            <div className="mt-1 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveOnly(true)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${activeOnly ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-400 hover:text-white'}`}
              >
                {tr('poolDashboard', 'active_only', lang)}
              </button>
              <button
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${!activeOnly ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-400 hover:text-white'}`}
              >
                {tr('poolDashboard', 'all_miners', lang)}
              </button>
            </div>
          </div>

          <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">#</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'address', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'server', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'last_share', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'status', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMiners.map((m, i) => {
                    const isActive = now - m.last_share < 600;
                    const serverObj = data?.servers.find(s => s.id === m.server);
                    return (
                      <tr key={m.address} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
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
                            {isActive ? (tr('poolDashboard', 'active', lang)) : (tr('poolDashboard', 'inactive', lang))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleMiners.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">{tr('poolDashboard', 'live_backend_is_not_exposing_recent_mine', lang)}</td></tr>
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
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'ledger', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Box className="h-7 w-7 text-zion-gold" />
              {tr('poolDashboard', 'recent_network_blocks', lang)} ({data?.recent_blocks.length ?? 0})
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'latest_confirmed_chain_blocks_from_the_c', lang)}</p>
          </div>

          <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'height', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Hash</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'difficulty', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'reward', lang)}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Miner</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{tr('poolDashboard', 'time', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_blocks ?? []).map((b, i) => (
                    <tr key={`${b.height}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
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
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">{tr('poolDashboard', 'no_recent_chain_blocks_available', lang)}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ═══════ START MINING GUIDE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          id="start-mining"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'getting_started', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {tr('poolDashboard', 'start_mining_zion', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'follow_these_steps_to_begin_mining_in_mi', lang)}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Step 1 */}
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-purple-500/80 to-indigo-600/80">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{tr('poolDashboard', '1_get_a_zion_wallet', lang)}</h3>
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'generate_your_mining_address', lang)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{tr('poolDashboard', 'download_the_zion_desktop_wallet_or_use_', lang)}</p>
              <Link href="/download" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                {tr('poolDashboard', 'download_wallet', lang)} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-cyan/80 to-blue-600/80">
                  <Cpu className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{tr('poolDashboard', '2_choose_mining_software', lang)}</h3>
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'zion_native_miner_or_xmrig', lang)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-sm font-medium text-white flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-purple-400" /> ZION Native Miner</p>
                  <p className="text-xs text-gray-400 mt-1">{tr('poolDashboard', 'official_cosmic_harmony_algorithm_python', lang)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-sm font-medium text-white flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-orange-400" /> XMRig</p>
                  <p className="text-xs text-gray-400 mt-1">{tr('poolDashboard', 'industry_standard_cpu_optimized', lang)}</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500/80 to-teal-600/80">
                  <Terminal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{tr('poolDashboard', '3_configure_connect', lang)}</h3>
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'start_mining_with_one_command', lang)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">ZION Native Miner</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`python zion_native_miner_v2_9.py \\
  --pool ${SITE_POOL_PRIMARY} \\
  --wallet YOUR_ZION_ADDRESS`}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">XMRig</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`./xmrig -o stratum+tcp://${SITE_POOL_PRIMARY} \\
  -u YOUR_ZION_ADDRESS -p x`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-gold/80 to-amber-600/80">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{tr('poolDashboard', '4_monitor_earn', lang)}</h3>
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'track_your_rewards_in_real_time', lang)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{tr('poolDashboard', 'once_connected_monitor_your_mining_stats', lang)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'min_payout', lang)}</p>
                  <p className="text-lg font-bold text-white font-mono">0.1 ZION</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-gray-500">{tr('poolDashboard', 'reward_method', lang)}</p>
                  <p className="text-lg font-bold text-white">PPLNS</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ WHY MINE WITH US ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'features', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400" />
              {tr('poolDashboard', 'why_mine_with_us', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'fair_transparent_and_humanitarian_focuse', lang)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Zap className="h-5 w-5 text-white" />, color: "from-purple-500/80 to-indigo-600/80", title: tr('poolDashboard', 'cosmic_harmony_algorithm', lang), desc: tr('poolDashboard', 'native_zion_pow_algorithm_cpu_friendly_a', lang) },
              { icon: <Heart className="h-5 w-5 text-white" />, color: "from-pink-500/80 to-rose-600/80", title: tr('poolDashboard', 'humanitarian_mission', lang), desc: tr('poolDashboard', '5_humanitarian_5_issobella_fund_mining_f', lang) },
              { icon: <Globe className="h-5 w-5 text-white" />, color: "from-blue-500/80 to-cyan-600/80", title: tr('poolDashboard', 'primary_host_pool', lang), desc: tr('poolDashboard', 'public_stratum_access_runs_on_zion2_whil', lang) },
              { icon: <Shield className="h-5 w-5 text-white" />, color: "from-emerald-500/80 to-teal-600/80", title: tr('poolDashboard', 'pplns_rewards', lang), desc: tr('poolDashboard', 'fair_reward_distribution_based_on_your_c', lang) },
              { icon: <Signal className="h-5 w-5 text-white" />, color: "from-orange-500/80 to-amber-600/80", title: tr('poolDashboard', 'real_time_monitoring', lang), desc: tr('poolDashboard', 'live_hashrate_shares_and_earnings_tracki', lang) },
              { icon: <Cpu className="h-5 w-5 text-white" />, color: "from-zion-cyan/80 to-blue-600/80", title: tr('poolDashboard', 'xmrig_compatible', lang), desc: tr('poolDashboard', 'use_standard_mining_software_no_special_', lang) },
            ].map((f) => (
              <div key={f.title} className="group rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 hover:border-white/15 transition-all duration-200">
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
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('poolDashboard', 'pro_tools', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {tr('poolDashboard', 'operator_toolkit', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'failover_templates_profit_estimate_and_a', lang)}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('poolDashboard', 'profit_estimator', lang)}</p>
              <label className="text-xs text-gray-400">{tr('poolDashboard', 'your_hashrate_supports_k_m_g_t', lang)}</label>
              <input
                value={myHashrateInput}
                onChange={(e) => setMyHashrateInput(e.target.value)}
                placeholder={tr('poolDashboard', 'e_g_250m', lang)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 font-mono outline-none focus:border-zion-cyan/50"
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-500">{tr('poolDashboard', 'parsed_hashrate', lang)}</span><span className="text-white font-mono">{fmtHash(myHashrate)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{tr('poolDashboard', 'pool_share', lang)}</span><span className="text-zion-cyan font-mono">{mySharePct.toFixed(6)}%</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{tr('poolDashboard', 'observed_blocks_day', lang)}</span><span className="text-gray-200 font-mono">{blocksPerDay.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{tr('poolDashboard', 'reward_block', lang)}</span><span className="text-gray-200 font-mono">{rewardPerBlock.toFixed(4)} ZION</span></div>
                <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-emerald-200 text-xs uppercase tracking-wider">{tr('poolDashboard', 'estimated_daily_reward', lang)}</span>
                  <span className="text-emerald-300 font-bold font-mono">{myDailyZion.toFixed(4)} ZION</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('poolDashboard', 'failover_config', lang)}</p>
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{tr('poolDashboard', 'xmrig_primary_backup', lang)}</p>
                  <code className="block text-xs text-zion-cyan break-all">{xmrigFailoverCmd}</code>
                  <div className="mt-2"><CopyButton text={xmrigFailoverCmd} /></div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Native Miner failover</p>
                  <code className="block text-xs text-zion-cyan break-all">{nativeFailoverCmd}</code>
                  <div className="mt-2"><CopyButton text={nativeFailoverCmd} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('poolDashboard', 'automation_export', lang)}</p>
              <div className="space-y-2.5 text-sm">
                <a href="/api/pool/stats" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.05] transition">
                  <span className="text-gray-200 font-mono text-xs">/api/pool/stats</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/api/pool/miner/YOUR_ZION_ADDRESS" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.05] transition">
                  <span className="text-gray-200 font-mono text-xs">/api/pool/miner/&lt;address&gt;</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/monitoring" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.05] transition">
                  <span className="text-gray-200">Mission control</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200 flex items-start gap-2">
                  <Bell className="h-3.5 w-3.5 mt-0.5" />
                  <span>{tr('poolDashboard', 'set_alert_if_last_share_exceeds_10_minut', lang)}</span>
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
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-400 text-sm font-bold">?</span>
              {tr('poolDashboard', 'frequently_asked_questions', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('poolDashboard', 'answers_to_the_most_common_miner_questio', lang)}</p>
          </div>

          <div className="space-y-3">
            {[
              { q: tr('poolDashboard', 'what_algorithm_does_zion_use', lang), a: tr('poolDashboard', 'zion_uses_cosmic_harmony_a_custom_cpu_fr', lang) },
              { q: tr('poolDashboard', 'how_does_pplns_work', lang), a: tr('poolDashboard', 'pplns_pay_per_last_n_shares_rewards_mine', lang) },
              { q: tr('poolDashboard', 'what_is_the_minimum_payout', lang), a: tr('poolDashboard', 'the_minimum_payout_is_0_1_zion_payouts_h', lang) },
              { q: tr('poolDashboard', 'where_do_tithe_and_funds_go', lang), a: tr('poolDashboard', 'coinbase_distribution_89_miner_5_humanit', lang) },
              { q: tr('poolDashboard', 'can_i_use_xmrig_or_only_the_native_miner', lang), a: tr('poolDashboard', 'both_are_supported_xmrig_is_industry_sta', lang) },
              { q: tr('poolDashboard', 'what_does_pool_luck_mean', lang), a: tr('poolDashboard', 'pool_luck_shows_the_ratio_of_blocks_foun', lang) },
              { q: tr('poolDashboard', 'how_do_i_set_up_failover', lang), a: tr('poolDashboard', 'use_the_backup_pool_endpoint_in_your_xmr', lang) },
              { q: tr('poolDashboard', 'how_often_are_payouts_processed', lang), a: tr('poolDashboard', 'payouts_are_processed_after_every_block_', lang) },
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
          className="rounded-4xl border border-zion-cyan/30 bg-linear-to-r from-zion-cyan/20 via-zion-purple/10 to-zion-cyan/20 p-10 text-center"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{tr('poolDashboard', 'zion_mining_pool', lang)}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {tr('poolDashboard', 'mine_zion_with_cosmic_harmony_a_fair_tra', lang)}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · PPLNS · Launch Countdown to 31 December 2026
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#start-mining" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-cyan to-zion-purple px-6 py-3 text-sm font-semibold text-black">
              <Zap className="h-4 w-4" /> {tr('poolDashboard', 'start_mining', lang)}
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

        <p className="text-center text-xs text-gray-600">
          {cs ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Data v reálném čase z primárního stratum endpointu · primární host Zion2` : `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Real-time data from the primary stratum endpoint · Zion2 primary host`}
          {lastUpdate && <> · {tr('poolDashboard', 'last_update', lang)}: {lastUpdate.toLocaleTimeString(tr('poolDashboard', 'en_us', lang))}</>}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════ STAT CARD ═══════════════════════ */
function StatCard({ icon, color, bg, label, value, sub }: { icon: React.ReactNode; color: string; bg: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bg} mb-3 [&>svg]:h-4 [&>svg]:w-4 ${color}`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
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
