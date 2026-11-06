"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  Hash,
  Layers,
  Pickaxe,
  RefreshCw,
  Server,
  Shield,
  Signal,
  Sparkles,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import { usePolling } from '@/hooks/usePolling';
import ZisAvatar from '@/components/ZisAvatar';

const MinerDashboardCopy = {
  minerNotFound: { cs: `Miner nebyl nalezen`, en: `Miner not found` },
  failedToFetchMinerData: { cs: `Nepodarilo se nacist data minera`, en: `Failed to fetch miner data` },
  loadingMinerData: { cs: `Nacitam data minera...`, en: `Loading miner data...` },
  minerNotFound_2: { cs: `Miner nebyl nalezen`, en: `Miner Not Found` },
  makeSureTheAddressIsCorrectAnd: { cs: `Zkontrolujte, ze je adresa spravna a ze odeslala shares do poolu.`, en: `Make sure the address is correct and has submitted shares to the pool.` },
  backToPool: { cs: `Zpet do poolu`, en: `Back to Pool` },
  active: { cs: `Aktivní`, en: `Active` },
  recentlyActive: { cs: `Nedávno aktivní`, en: `Recently Active` },
  historical: { cs: `Historický`, en: `Historical` },
  inactive: { cs: `Neaktivní`, en: `Inactive` },
  pool: { cs: `Pool`, en: `Pool` },
  miner: { cs: `Miner`, en: `Miner` },
  lastShare: { cs: `poslední share`, en: `last share` },
  copyAddress: { cs: `Kopírovat adresu`, en: `Copy address` },
  active_2: { cs: `aktivních`, en: `active` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  paid: { cs: `Vyplaceno`, en: `Paid` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  minerStatistics: { cs: `Statistiky minera`, en: `Miner Statistics` },
  realTimeMetricsForThisMinerAcr: { cs: `Metriky tohoto minera v realnem case napric vsemi pool servery.`, en: `Real-time metrics for this miner across all pool servers.` },
  hashrate1h: { cs: `Hashrate 1h`, en: `Hashrate 1h` },
  hashrate24h: { cs: `Hashrate 24h`, en: `Hashrate 24h` },
  validShares: { cs: `Validni shares`, en: `Valid Shares` },
  invalidShares: { cs: `Neplatne shares`, en: `Invalid Shares` },
  efficiency: { cs: `Efektivita`, en: `Efficiency` },
  blocksFound: { cs: `Nalezene bloky`, en: `Blocks Found` },
  pending: { cs: `Čeká na payout`, en: `Pending` },
  totalPaid: { cs: `Celkem vyplaceno`, en: `Total Paid` },
  totalShares: { cs: `Shares celkem`, en: `Total Shares` },
  lastShare_2: { cs: `Poslední share`, en: `Last Share` },
  servers: { cs: `Servery`, en: `Servers` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  performance: { cs: `Výkon`, en: `Performance` },
  hashrateTimeline: { cs: `Vývoj hashrate`, en: `Hashrate Timeline` },
  liveHashrateSamplesCollectedEv: { cs: `Živé vzorky hashrate sbírané každých 15 sekund.`, en: `Live hashrate samples collected every 15 seconds.` },
  current: { cs: `Aktuálně:`, en: `Current:` },
  k24hAvg: { cs: `24h průměr:`, en: `24h avg:` },
  notEnoughDataForChart: { cs: `Pro graf zatím není dost dat`, en: `Not enough data for chart` },
  mining: { cs: `Těžba`, en: `Mining` },
  blocksFoundByThisMinerOnThePoo: { cs: `Bloky nalezené tímto minerem v poolu.`, en: `Blocks found by this miner on the pool.` },
  height: { cs: `Výška`, en: `Height` },
  reward: { cs: `Odměna`, en: `Reward` },
  time: { cs: `Čas`, en: `Time` },
  server: { cs: `Server`, en: `Server` },
  earnings: { cs: `Výdělky`, en: `Earnings` },
  payouts: { cs: `Payouty`, en: `Payouts` },
  historyOfPoolPayoutsToThisMine: { cs: `Historie pool payoutů tomuto minerovi.`, en: `History of pool payouts to this miner.` },
  noPayoutsYetMinimumPayout01Zio: { cs: `Zatím žádné payouty. Minimální payout: 0.1 ZION`, en: `No payouts yet. Minimum payout: 0.1 ZION` },
  pendingBalance: { cs: `Čekající zůstatek`, en: `Pending balance` },
  amount: { cs: `Částka`, en: `Amount` },
  status: { cs: `Stav`, en: `Status` },
  confirmed: { cs: `potvrzeno`, en: `confirmed` },
  pending_2: { cs: `ceka`, en: `pending` },
  advanced: { cs: `Rozšířené`, en: `Advanced` },
  advancedMetrics: { cs: `Rozšířené metriky`, en: `Advanced Metrics` },
  bestAvailableMinerTelemetryFro: { cs: `Nejlepší dostupná telemetrie minera z pool accounting a živých runtime dat.`, en: `Best available miner telemetry from pool accounting and live runtime data.` },
  loadingAdvancedMinerMetrics: { cs: `Načítám rozšířené metriky minera...`, en: `Loading advanced miner metrics...` },
  currentHashrateGauge: { cs: `Aktualni hashrate (Gauge)`, en: `Current hashrate (Gauge)` },
  k24hAverageHashrate: { cs: `24h průměrný hashrate`, en: `24h average hashrate` },
  validInvalidSharesCounter: { cs: `Validni / neplatne shares (Counter)`, en: `Valid / invalid shares (Counter)` },
  blocksFoundCounter: { cs: `Nalezene bloky (Counter)`, en: `Blocks found (Counter)` },
  pendingBalanceGauge: { cs: `Čekající zůstatek (Gauge)`, en: `Pending balance (Gauge)` },
  totalPaidGauge: { cs: `Celkem vyplaceno (Gauge)`, en: `Total paid (Gauge)` },
  activeConnectionsGauge: { cs: `Aktivní spojení (Gauge)`, en: `Active connections (Gauge)` },
  poolContext: { cs: `Kontext poolu`, en: `Pool Context` },
  poolHashrate: { cs: `Pool hashrate`, en: `Pool Hashrate` },
  pool24h: { cs: `Pool 24h`, en: `Pool 24h` },
  activeMiners: { cs: `Aktivních`, en: `Active Miners` },
  poolBlocks: { cs: `Pool bloky`, en: `Pool Blocks` },
  poolShare: { cs: `Podíl na poolu`, en: `Pool share` },
  lastScrape: { cs: `Posledni scrape`, en: `Last scrape` },
  updatedEvery15s: { cs: `aktualizace kazdych 15 s`, en: `Updated every 15s` },
  source: { cs: `Zdroj`, en: `Source` },
  runtimeFallback: { cs: `runtime fallback`, en: `runtime fallback` },
  endpoints: { cs: `Endpointy`, en: `Endpoints` },
  ok: { cs: `ok`, en: `ok` },
  down: { cs: `down`, en: `down` },
  backToPoolOverview: { cs: `Zpet na prehled poolu`, en: `Back to Pool Overview` },
  viewAllPoolStatisticsServerSta: { cs: `Zobrazte vsechny statistiky poolu, stav serveru a pripojte se k tezebni komunite.`, en: `View all pool statistics, server status, and join the mining community.` },
  poolDashboard: { cs: `Prehled poolu`, en: `Pool Dashboard` },
  explorer: { cs: `Explorer`, en: `Explorer` },
};

/* ═══════════════════════════════════════════════════════════
   MINER DASHBOARD — Per-miner metrics & charts
   Explorer design language (bg-black/60, rounded-3xl, motion.section)
   ═══════════════════════════════════════════════════════════ */

/* ═══════ TYPES ═══════ */
interface MinerData {
  ok: boolean;
  address: string;
  active: boolean;
  recently_active?: boolean;
  ever_active?: boolean;
  worker_name?: string | null;
  algorithm?: string;
  backend?: string;
  stats: {
    hashrate_1h: number;
    hashrate_24h: number;
    total_shares: number;
    valid_shares: number;
    invalid_shares: number;
    efficiency: string;
    blocks_found: number;
    total_paid: number;
    pending_balance: number;
    last_share_time: number;
  };
  payouts: Array<{
    amount: number;
    tx_id?: string;
    timestamp: number;
    status?: string;
  }>;
  blocks: Array<{
    height: number;
    hash: string;
    reward: number;
    timestamp: number;
    server?: string;
  }>;
  pool_stats?: {
    pool_hashrate: number;
    pool_hashrate_1h: number;
    pool_hashrate_24h: number;
    active_miners: number;
    total_miners: number;
    blocks_found: number;
    total_paid_atomic: number;
  } | null;
  servers: Array<{ id: string; connected: boolean }>;
}

interface PrometheusMinerData {
  ok: boolean;
  has_metrics: boolean;
  scrape_ts: number;
  source?: string;
  worker_name?: string | null;
  metrics: {
    hashrate: number;
    hashrate_24h?: number;
    shares_valid: number;
    shares_invalid: number;
    blocks_found: number;
    pending_balance_atomic: number;
    paid_total_atomic: number;
    connections_active: number;
    last_share_time?: number;
  };
  pool_context?: {
    pool_hashrate: number;
    pool_hashrate_24h: number;
    active_miners: number;
    total_blocks_found: number;
  } | null;
  servers: Array<{
    server: string;
    connected: boolean;
    metrics_available: boolean;
    values: {
      hashrate: number;
      shares_valid: number;
      shares_invalid: number;
      blocks_found: number;
      pending_balance_atomic: number;
      paid_total_atomic: number;
      connections_active: number;
    } | null;
  }>;
}

/* ═══════ HELPERS ═══════ */
function fmtHash(h: number): string {
  if (!h || h <= 0) return "0 H/s";
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function fmtZion(atomic: number): string {
  return (atomic / 1e6).toFixed(4);
}

function timeAgo(ts: number, lang: Lang): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always', style: 'narrow' });
  if (diff < 60) return rtf.format(-diff, 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}

function shortHash(h: string): string {
  if (h.length <= 16) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

/* ═══════ COPY BUTTON ═══════ */
function CopyBtn({ text, titleLabel = "Copy" }: { text: string; titleLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 text-gray-500 hover:text-white transition-colors"
      title={titleLabel}
    >
      {copied ? <Check className="h-4 w-4 text-zion-cyan" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ═══════ STAT CARD ═══════ */
function StatCard({ icon, label, value, sub, accent = "text-zion-cyan" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4 space-y-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
      <div className={`h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4 ${accent}`}>
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/* ═══════ SVG SPARKLINE ═══════ */
function HashrateSpark({ data, width = 600, height = 120, emptyLabel = "Not enough data for chart" }: { data: number[]; width?: number; height?: number; emptyLabel?: string }) {
  if (data.length < 2) return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - 10 - ((v - min) / range) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  const areaPath = `M0,${height} L${data.map((v, i) => {
    const x = i * step;
    const y = height - 10 - ((v - min) / range) * (height - 20);
    return `${x},${y}`;
  }).join(" L")} L${width},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(228,30,43,0.4)" />
          <stop offset="100%" stopColor="rgba(228,30,43,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <polyline fill="none" stroke="rgba(228,30,43,0.8)" strokeWidth="2" points={points} />
      {/* current value dot */}
      {data.length > 0 && (() => {
        const lastX = (data.length - 1) * step;
        const lastY = height - 10 - ((data[data.length - 1] - min) / range) * (height - 20);
        return <circle cx={lastX} cy={lastY} r="4" fill="#e41e2b" stroke="white" strokeWidth="1.5" />;
      })()}
    </svg>
  );
}

/* ═══════ MAIN COMPONENT ═══════ */
export default function MinerDashboard({ address }: { address: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<MinerData | null>(null);
  const [promMetrics, setPromMetrics] = useState<PrometheusMinerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hashHistory, setHashHistory] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [minerRes, promRes] = await Promise.all([
        fetch(`/api/pool/miner/${address}`, { cache: "no-store" }),
        fetch(`/api/pool/miner/${address}/metrics`, { cache: "no-store" }),
      ]);

      const json = await minerRes.json();
      if (json.ok) {
        setData(json);
        setError("");
        // Build hashrate history from accumulating samples
        setHashHistory((prev) => {
          const newArr = [...prev, json.stats.hashrate_1h];
          return newArr.slice(-60); // keep last 60 samples (15min at 15s refresh)
        });

        if (promRes.ok) {
          const promJson = await promRes.json();
          if (promJson?.ok) {
            setPromMetrics(promJson);
          }
        }
      } else {
        setError(json.error || (tx5(MinerDashboardCopy.minerNotFound, lang)));
      }
    } catch {
      setError(tx5(MinerDashboardCopy.failedToFetchMinerData, lang));
    } finally {
      setLoading(false);
    }
  }, [address, cs]);

  // Immediate initial fetch so the page loads even in headless / background tabs.
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(fetchData, 15_000, { runWhenHidden: true });

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>{tx5(MinerDashboardCopy.loadingMinerData, lang)}</span>
        </div>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (error || !data) {
    return (
      <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24">
        <div className="zion-container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="zion-rainbow-card p-8 md:p-12 text-center space-y-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div className="mx-auto h-16 w-16 rounded-2xl bg-zion-purple/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-zion-purple" />
            </div>
            <h1 className="text-2xl font-semibold text-white">{tx5(MinerDashboardCopy.minerNotFound_2, lang)}</h1>
            <p className="text-gray-400 max-w-md mx-auto">
              {error || (cs ? `Pro adresu ${shortAddr(address)} nebyla nalezena zadna tezebni data.` : t5(`No mining data found for address ${shortAddr(address)}.`, lang))}
              <br />{tx5(MinerDashboardCopy.makeSureTheAddressIsCorrectAnd, lang)}
            </p>
            <code className="block text-sm text-gray-500 font-mono break-all">{address}</code>
            <Link href="/pool" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors text-sm">
              <ArrowLeft className="h-4 w-4" /> {tx5(MinerDashboardCopy.backToPool, lang)}
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const s = data.stats;

  // Determine display status
  const isActive = data.active;
  const isRecentlyActive = !isActive && (data.recently_active || (s.last_share_time > 0 && Math.floor(Date.now() / 1000) - s.last_share_time < 86400));
  const hasHistory = (s.total_paid > 0 || s.valid_shares > 0 || data.payouts.length > 0 || data.blocks.length > 0);
  const statusColor = isActive ? 'bg-zion-cyan shadow-[0_0_8px_rgba(52,211,153,0.6)]' : isRecentlyActive ? 'bg-zion-gold' : hasHistory ? 'bg-zion-purple' : 'bg-zion-purple';
  const statusText = isActive ? 'text-zion-cyan' : isRecentlyActive ? 'text-zion-gold' : hasHistory ? 'text-zion-purple' : 'text-zion-purple';
  const statusLabel = isActive
    ? (tx5(MinerDashboardCopy.active, lang))
    : isRecentlyActive
      ? (tx5(MinerDashboardCopy.recentlyActive, lang))
      : hasHistory
        ? (tx5(MinerDashboardCopy.historical, lang))
        : (tx5(MinerDashboardCopy.inactive, lang));

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ BREADCRUMB + HEADER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/pool" className="hover:text-white transition-colors inline-flex items-center gap-1">
              <Pickaxe className="h-3.5 w-3.5" /> {tx5(MinerDashboardCopy.pool, lang)}
            </Link>
            <ArrowRight className="h-3 w-3" />
            <span className="text-gray-400">{tx5(MinerDashboardCopy.miner, lang)}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${statusColor}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${statusText}`}>
                  {statusLabel}
                </span>
                {s.last_share_time > 0 && (
                  <span className="text-xs text-gray-500">· {tx5(MinerDashboardCopy.lastShare, lang)} {timeAgo(s.last_share_time, lang)}</span>
                )}
                {data.worker_name && (
                  <span className="text-xs text-gray-500">· worker: <span className="text-zion-cyan font-mono">{data.worker_name}</span></span>
                )}
              </div>
              {!isActive && hasHistory && (
                <div className="flex items-start gap-2 text-xs text-zion-purple/90 bg-zion-purple/10 border border-zion-purple/20 rounded-lg px-3 py-2 mt-2 max-w-2xl">
                  <Activity className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {cs ? `Tento miner má těžební historii (${data.payouts.length} payoutů, ${fmtZion(s.total_paid)} ZION celkem vyplaceno), ale aktuálně není aktivní v poolu.` : t5(`This miner has mining history (${data.payouts.length} payouts, ${fmtZion(s.total_paid)} ZION total paid) but is not currently active in the pool.`, lang)}
                  </span>
                </div>
              )}
              {isActive && s.pending_balance > 0 && (
                <div className="flex items-start gap-2 text-xs text-zion-gold/90 bg-zion-gold/10 border border-zion-gold/20 rounded-lg px-3 py-2 mt-2 max-w-2xl">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {cs ? `Čekající zůstatek: ${fmtZion(s.pending_balance)} ZION. Payout bude odeslán při dosažení minima.` : t5(`Pending balance: ${fmtZion(s.pending_balance)} ZION. Payout will be sent when minimum is reached.`, lang)}
                  </span>
                </div>
              )}
              <h1 className="text-xl md:text-2xl font-mono text-white break-all leading-relaxed flex items-center gap-2">
                <ZisAvatar seed={address} size={34} className="rounded-lg shrink-0" initial="M" />
                {shortAddr(address)}
                <CopyBtn text={address} titleLabel={tx5(MinerDashboardCopy.copyAddress, lang)} />
              </h1>
              <div className="flex flex-wrap gap-2">
                {data.servers.filter((sv) => sv.connected).map((sv) => (
                  <span key={sv.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    <Server className="h-3 w-3 text-zion-cyan" /> {sv.id}
                  </span>
                ))}
                {data.pool_stats && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    <Pickaxe className="h-3 w-3 text-zion-gold" /> {tx5(MinerDashboardCopy.pool, lang)}: {fmtHash(data.pool_stats.pool_hashrate)} · {data.pool_stats.active_miners} {tx5(MinerDashboardCopy.active_2, lang)}
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Hashrate</p>
                <p className="text-2xl font-semibold text-zion-cyan">{fmtHash(s.hashrate_1h)}</p>
                {s.hashrate_24h > 0 && (
                  <p className="text-xs text-gray-500">24h: {fmtHash(s.hashrate_24h)}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{tx5(MinerDashboardCopy.blocks, lang)}</p>
                <p className="text-2xl font-semibold text-zion-gold">{fmtNum(s.blocks_found)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{tx5(MinerDashboardCopy.paid, lang)}</p>
                <p className="text-2xl font-semibold text-zion-cyan">{fmtZion(s.total_paid)}</p>
                <p className="text-xs text-gray-500">ZION</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(MinerDashboardCopy.telemetry, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {tx5(MinerDashboardCopy.minerStatistics, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.realTimeMetricsForThisMinerAcr, lang)}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <StatCard icon={<Zap />} label={tx5(MinerDashboardCopy.hashrate1h, lang)} value={fmtHash(s.hashrate_1h)} accent="text-zion-cyan" />
            <StatCard icon={<TrendingUp />} label={tx5(MinerDashboardCopy.hashrate24h, lang)} value={fmtHash(s.hashrate_24h)} accent="text-zion-purple" />
            <StatCard icon={<Layers />} label={tx5(MinerDashboardCopy.validShares, lang)} value={fmtNum(s.valid_shares)} accent="text-zion-cyan" />
            <StatCard icon={<XCircle />} label={tx5(MinerDashboardCopy.invalidShares, lang)} value={fmtNum(s.invalid_shares)} accent="text-zion-purple" />
            <StatCard icon={<Shield />} label={tx5(MinerDashboardCopy.efficiency, lang)} value={`${s.efficiency}%`} accent="text-zion-gold" />
            <StatCard icon={<Box />} label={tx5(MinerDashboardCopy.blocksFound, lang)} value={fmtNum(s.blocks_found)} accent="text-zion-gold" />
            <StatCard icon={<Wallet />} label={tx5(MinerDashboardCopy.pending, lang)} value={`${fmtZion(s.pending_balance)} ZION`} accent="text-zion-cyan" />
            <StatCard icon={<Sparkles />} label={tx5(MinerDashboardCopy.totalPaid, lang)} value={`${fmtZion(s.total_paid)} ZION`} accent="text-zion-cyan" />
            <StatCard icon={<Hash />} label={tx5(MinerDashboardCopy.totalShares, lang)} value={fmtNum(s.total_shares)} accent="text-gray-300" />
            <StatCard icon={<Clock />} label={tx5(MinerDashboardCopy.lastShare_2, lang)} value={s.last_share_time > 0 ? timeAgo(s.last_share_time, lang) : '—'} accent="text-gray-300" />
            <StatCard icon={<Server />} label={tx5(MinerDashboardCopy.servers, lang)} value={`${data.servers.filter(sv => sv.connected).length} / ${data.servers.length}`} accent="text-zion-purple" />
            <StatCard icon={<Cpu />} label={tx5(MinerDashboardCopy.algorithm, lang)} value="Cosmic Harmony" sub="v3 Multi-Algo" accent="text-zion-gold" />
          </div>
        </motion.section>

        {/* ═══════ HASHRATE CHART ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(MinerDashboardCopy.performance, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-purple" />
              {tx5(MinerDashboardCopy.hashrateTimeline, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.liveHashrateSamplesCollectedEv, lang)}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{tx5(MinerDashboardCopy.current, lang)}</span>
                <span className="text-lg font-semibold text-zion-cyan">{fmtHash(s.hashrate_1h)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{tx5(MinerDashboardCopy.k24hAvg, lang)}</span>
                <span className="text-lg font-semibold text-zion-purple">{fmtHash(s.hashrate_24h)}</span>
              </div>
            </div>
            <HashrateSpark data={hashHistory} emptyLabel={tx5(MinerDashboardCopy.notEnoughDataForChart, lang)} />
          </div>
        </motion.section>

        {/* ═══════ BLOCKS FOUND ═══════ */}
        {data.blocks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(MinerDashboardCopy.mining, lang)}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Box className="h-7 w-7 text-zion-gold" />
                {tx5(MinerDashboardCopy.blocksFound, lang)}
              </h2>
              <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.blocksFoundByThisMinerOnThePoo, lang)}</p>
            </div>
            <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 md:px-6 py-4">{tx5(MinerDashboardCopy.height, lang)}</th>
                      <th className="px-4 md:px-6 py-4">Hash</th>
                      <th className="px-4 md:px-6 py-4">{tx5(MinerDashboardCopy.reward, lang)}</th>
                      <th className="px-4 md:px-6 py-4">{tx5(MinerDashboardCopy.time, lang)}</th>
                      <th className="px-4 md:px-6 py-4">{tx5(MinerDashboardCopy.server, lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.blocks.map((b, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 md:px-6 py-3">
                          <Link href={`/explorer/block?height=${b.height}`} className="text-zion-cyan hover:text-white transition-colors font-mono">
                            #{fmtNum(b.height)}
                          </Link>
                        </td>
                        <td className="px-4 md:px-6 py-3 font-mono text-gray-400">{shortHash(b.hash)}</td>
                        <td className="px-4 md:px-6 py-3 text-zion-gold">{(b.reward / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ZION</td>
                        <td className="px-4 md:px-6 py-3 text-gray-400">{timeAgo(b.timestamp, lang)}</td>
                        <td className="px-4 md:px-6 py-3 text-gray-500">{b.server ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}

        {/* ═══════ PAYOUTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(MinerDashboardCopy.earnings, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-zion-cyan" />
              {tx5(MinerDashboardCopy.payouts, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.historyOfPoolPayoutsToThisMine, lang)}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            {data.payouts.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{tx5(MinerDashboardCopy.noPayoutsYetMinimumPayout01Zio, lang)}</p>
                <p className="text-xs mt-1">{tx5(MinerDashboardCopy.pendingBalance, lang)}: {fmtZion(s.pending_balance)} ZION</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">{tx5(MinerDashboardCopy.amount, lang)}</th>
                      <th className="px-4 py-3">TX ID</th>
                      <th className="px-4 py-3">{tx5(MinerDashboardCopy.time, lang)}</th>
                      <th className="px-4 py-3">{tx5(MinerDashboardCopy.status, lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-zion-cyan font-semibold">{fmtZion(p.amount)} ZION</td>
                        <td className="px-4 py-3 font-mono text-gray-400">
                          {p.tx_id ? (
                            <Link href={`/explorer/tx?hash=${encodeURIComponent(p.tx_id)}`} className="text-zion-cyan hover:text-white transition-colors">
                              {shortHash(p.tx_id)}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{timeAgo(p.timestamp, lang)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            p.status === 'confirmed' ? 'bg-zion-cyan/10 text-zion-cyan' : 'bg-zion-gold/10 text-zion-gold'
                          }`}>
                            {p.status ? (p.status === 'confirmed' ? (tx5(MinerDashboardCopy.confirmed, lang)) : p.status) : (tx5(MinerDashboardCopy.pending_2, lang))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>

        {/* ═══════ ADVANCED METRICS INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(MinerDashboardCopy.advanced, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Signal className="h-7 w-7 text-zion-cyan" />
              {tx5(MinerDashboardCopy.advancedMetrics, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.bestAvailableMinerTelemetryFro, lang)}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            {!promMetrics ? (
              <p className="text-sm text-gray-400">{tx5(MinerDashboardCopy.loadingAdvancedMinerMetrics, lang)}</p>
            ) : (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_hashrate{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtHash(promMetrics.metrics.hashrate)}</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.currentHashrateGauge, lang)}</p>
                  </div>
                  {promMetrics.metrics.hashrate_24h !== undefined && (
                    <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                      <p className="text-xs text-zion-cyan font-mono break-all">miner_hashrate_24h{`{address="..."}`}</p>
                      <p className="text-lg font-semibold text-white">{fmtHash(promMetrics.metrics.hashrate_24h ?? 0)}</p>
                      <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.k24hAverageHashrate, lang)}</p>
                    </div>
                  )}
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_shares_total{`{status="valid|invalid"}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.shares_valid)} / {fmtNum(promMetrics.metrics.shares_invalid)}</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.validInvalidSharesCounter, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_blocks_found_total{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.blocks_found)}</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.blocksFoundCounter, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_pending_balance_atomic{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtZion(promMetrics.metrics.pending_balance_atomic)} ZION</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.pendingBalanceGauge, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_paid_total_atomic{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtZion(promMetrics.metrics.paid_total_atomic)} ZION</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.totalPaidGauge, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_connections_active{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.connections_active)}</p>
                    <p className="text-xs text-gray-400">{tx5(MinerDashboardCopy.activeConnectionsGauge, lang)}</p>
                  </div>
                </div>

                {/* Pool context comparison */}
                {promMetrics.pool_context && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <Pickaxe className="h-4 w-4 text-zion-gold" /> {tx5(MinerDashboardCopy.poolContext, lang)}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-3 rounded-xl bg-white/5">
                        <p className="text-xs text-gray-500 uppercase">{tx5(MinerDashboardCopy.poolHashrate, lang)}</p>
                        <p className="text-lg font-semibold text-zion-cyan">{fmtHash(promMetrics.pool_context.pool_hashrate)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/5">
                        <p className="text-xs text-gray-500 uppercase">{tx5(MinerDashboardCopy.pool24h, lang)}</p>
                        <p className="text-lg font-semibold text-zion-purple">{fmtHash(promMetrics.pool_context.pool_hashrate_24h)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/5">
                        <p className="text-xs text-gray-500 uppercase">{tx5(MinerDashboardCopy.activeMiners, lang)}</p>
                        <p className="text-lg font-semibold text-zion-cyan">{promMetrics.pool_context.active_miners}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/5">
                        <p className="text-xs text-gray-500 uppercase">{tx5(MinerDashboardCopy.poolBlocks, lang)}</p>
                        <p className="text-lg font-semibold text-zion-gold">{fmtNum(promMetrics.pool_context.total_blocks_found)}</p>
                      </div>
                    </div>
                    {promMetrics.metrics.hashrate > 0 && promMetrics.pool_context.pool_hashrate > 0 && (
                      <p className="mt-3 text-xs text-gray-500 text-center">
                        {tx5(MinerDashboardCopy.poolShare, lang)}: {((promMetrics.metrics.hashrate / promMetrics.pool_context.pool_hashrate) * 100).toFixed(2)}%
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 text-xs text-gray-500 space-y-1">
                  <p>
                    {tx5(MinerDashboardCopy.lastScrape, lang)}: {promMetrics.scrape_ts > 0 ? timeAgo(promMetrics.scrape_ts, lang) : '—'} · {tx5(MinerDashboardCopy.updatedEvery15s, lang)}
                  </p>
                  <p>
                    {tx5(MinerDashboardCopy.source, lang)}: {promMetrics.source ?? (tx5(MinerDashboardCopy.runtimeFallback, lang))}
                    {promMetrics.worker_name && ` · worker: ${promMetrics.worker_name}`}
                  </p>
                  <p>
                    {tx5(MinerDashboardCopy.endpoints, lang)}: {promMetrics.servers.map((sv) => `${sv.server}:${sv.connected ? (tx5(MinerDashboardCopy.ok, lang)) : (tx5(MinerDashboardCopy.down, lang))}`).join(' · ')}
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.section>

        {/* ═══════ CTA FOOTER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <div className="relative rounded-3xl md:rounded-4xl p-px bg-linear-to-r from-zion-purple/60 via-white/10 to-zion-cyan/60">
            <div className="rounded-3xl md:rounded-4xl bg-black/90 backdrop-blur-xl p-8 md:p-12 text-center space-y-6">
              <h3 className="text-2xl md:text-3xl font-semibold text-gradient">{tx5(MinerDashboardCopy.backToPoolOverview, lang)}</h3>
              <p className="text-gray-300 max-w-lg mx-auto">
                {tx5(MinerDashboardCopy.viewAllPoolStatisticsServerSta, lang)}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/pool"
                  className="zion-button-primary group text-sm"
                  style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
                >
                  <Pickaxe className="h-4 w-4" /> {tx5(MinerDashboardCopy.poolDashboard, lang)}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/explorer"
                  className="zion-button-secondary text-sm"
                >
                  <ExternalLink className="h-4 w-4" /> {tx5(MinerDashboardCopy.explorer, lang)}
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
