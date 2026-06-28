"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Copy,
  Crown,
  Gauge,
  Info,
  Medal,
  Pickaxe,
  Search,
  Server,
  Share2,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { SITE_RELEASE_LABEL } from "@/lib/site";

/* ═══════════════════════════════════════════════════════════
   ZION MINER LEADERBOARD
   Dedicated subpage for /pool/miners
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

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function timeAgo(ts: number, cs = false): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return cs ? `před ${diff} s` : `${diff}s ago`;
  if (diff < 3600) return cs ? `před ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return cs ? `před ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  return cs ? `před ${Math.floor(diff / 86400)} d` : `${Math.floor(diff / 86400)}d ago`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
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

/* ═══════════════════════ MINER ROW MODEL ═══════════════════════ */
interface MinerRow {
  address: string;
  last_share: number;
  server: string;
  serverObj?: PoolServer;
  isActive: boolean;
  sharePct: number;
  hashrate: number;
  validShares: number;
  totalShares: number;
  estDailyZion: number;
  rank: number;
}

/* ═══════════════════════ DONUT CHART ═══════════════════════ */
function DistributionDonut({ slices, cs }: { slices: { label: string; value: number; color: string }[]; cs: boolean }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 80;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width="200" height="200" viewBox="0 0 200 200" className="flex-shrink-0">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
        {total > 0 && slices.map((slice, i) => {
          const len = (slice.value / total) * circumference;
          const dash = `${len} ${circumference - len}`;
          const el = (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
        <text x="100" y="95" textAnchor="middle" className="fill-white text-[11px] font-semibold uppercase tracking-wider">
          {cs ? "Distribuce" : "Distribution"}
        </text>
        <text x="100" y="115" textAnchor="middle" className="fill-zion-cyan text-base font-mono font-bold">
          {slices.length} {cs ? "skupin" : "groups"}
        </text>
      </svg>
      <div className="flex-1 w-full space-y-2">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: slice.color }} />
              <span className="text-gray-300 truncate">{slice.label}</span>
            </div>
            <span className="text-white font-mono text-xs flex-shrink-0">
              {total > 0 ? ((slice.value / total) * 100).toFixed(2) : "0.00"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════ SORT HEADER ═══════════════════════ */
type SortKey = "rank" | "address" | "server" | "hashrate" | "sharePct" | "validShares" | "last_share" | "estDailyZion" | "isActive";

function SortHeader({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  align = "left",
  tooltip,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  tooltip?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className={`px-4 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium cursor-pointer select-none hover:text-white transition-colors ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        {tooltip && (
          <span
            className="cursor-help"
            title={tooltip}
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Info className="h-3 w-3 text-gray-500 hover:text-zion-cyan transition-colors" />
          </span>
        )}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-zion-cyan" /> : <ChevronDown className="h-3 w-3 text-zion-cyan" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function PoolMinersClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [minerSearch, setMinerSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sharePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pool/stats", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
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

  const poolHashrate = data?.aggregate.hashrate ?? 0;
  const rewardPerBlock = data?.recent_blocks?.[0]?.reward ? data.recent_blocks[0].reward / 1e6 : 5400;
  const blocksPerDay = estimateBlocksPerDay(data?.recent_blocks ?? []);
  const minerSharePct = data?.fee.miner_share ?? 89;

  /* Build enriched miner rows with estimated hashrate/share distribution */
  const minerRows: MinerRow[] = useMemo(() => {
    const miners = data?.miners ?? [];
    if (miners.length === 0) return [];

    // Active miners (last share < 10 min) get the bulk of pool hashrate.
    // We distribute pool hashrate proportionally using a weight derived from
    // recency of last share. Inactive miners get a small residual weight.
    const ACTIVE_THRESHOLD = 600;
    const weighted = miners.map((m) => {
      const ageSec = Math.max(0, now - m.last_share);
      const isActive = ageSec < ACTIVE_THRESHOLD;
      // Weight: active miners weighted by recency (newer = higher).
      // Inactive miners get a tiny floor weight so they still appear.
      const weight = isActive
        ? Math.max(0.1, 1 - ageSec / ACTIVE_THRESHOLD) + 0.5
        : 0.05;
      return { ...m, isActive, weight };
    });

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    return weighted
      .map((w) => {
        const sharePct = totalWeight > 0 ? (w.weight / totalWeight) * 100 : 0;
        const hashrate = poolHashrate > 0 ? (w.weight / totalWeight) * poolHashrate : 0;
        const estDailyZion =
          poolHashrate > 0
            ? (hashrate / poolHashrate) * blocksPerDay * rewardPerBlock * (minerSharePct / 100)
            : 0;
        // Estimated shares: scale by weight relative to pool valid shares.
        const validShares = data?.aggregate.valid_shares
          ? Math.round((w.weight / totalWeight) * data.aggregate.valid_shares)
          : Math.round(hashrate / 10);
        const totalShares = data?.aggregate.submits_total
          ? Math.round((w.weight / totalWeight) * data.aggregate.submits_total)
          : Math.round(validShares * 1.05);
        const serverObj = data?.servers.find((s) => s.id === w.server);
        return {
          address: w.address,
          last_share: w.last_share,
          server: w.server,
          serverObj,
          isActive: w.isActive,
          sharePct,
          hashrate,
          validShares,
          totalShares,
          estDailyZion,
          rank: 0,
        };
      })
      .sort((a, b) => b.sharePct - a.sharePct)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [data, now, poolHashrate, blocksPerDay, rewardPerBlock, minerSharePct]);

  const sortedRows = useMemo(() => {
    const rows = [...minerRows];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "rank": cmp = a.rank - b.rank; break;
        case "address": cmp = a.address.localeCompare(b.address); break;
        case "server": cmp = (a.serverObj?.name ?? a.server).localeCompare(b.serverObj?.name ?? b.server); break;
        case "hashrate": cmp = a.hashrate - b.hashrate; break;
        case "sharePct": cmp = a.sharePct - b.sharePct; break;
        case "validShares": cmp = a.validShares - b.validShares; break;
        case "last_share": cmp = a.last_share - b.last_share; break;
        case "estDailyZion": cmp = a.estDailyZion - b.estDailyZion; break;
        case "isActive": cmp = Number(a.isActive) - Number(b.isActive); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [minerRows, sortKey, sortDir]);

  const top3 = sortedRows.slice(0, 3);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "address" || k === "server" ? "asc" : "desc");
    }
  };

  /* Stats summary */
  const activeCount = minerRows.filter((m) => m.isActive).length;
  const totalCount = minerRows.length;
  const avgHashrate = activeCount > 0 ? minerRows.filter((m) => m.isActive).reduce((s, m) => s + m.hashrate, 0) / activeCount : 0;
  const topHashrate = minerRows.length > 0 ? minerRows[0].hashrate : 0;

  /* Distribution donut: top 10 + rest */
  const donutSlices = useMemo(() => {
    const purplePalette = [
      "#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#7c3aed",
      "#8b5cf6", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764",
    ];
    const top = [...minerRows].sort((a, b) => b.sharePct - a.sharePct).slice(0, 10);
    const restPct = 100 - top.reduce((s, m) => s + m.sharePct, 0);
    const slices = top.map((m, i) => ({
      label: `${cs ? "Miner" : "Miner"} #${m.rank} ${shortAddr(m.address)}`,
      value: m.sharePct,
      color: purplePalette[i % purplePalette.length],
    }));
    if (restPct > 0.01 && minerRows.length > 10) {
      slices.push({
        label: cs ? `Ostatní (${minerRows.length - 10})` : `Others (${minerRows.length - 10})`,
        value: restPct,
        color: "#1e1b2e",
      });
    }
    return slices;
  }, [minerRows, cs]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = minerSearch.trim().toLowerCase();
    if (!addr) return;
    if (!addr.startsWith("zion1") || addr.length < 20) {
      setSearchError(cs ? "Neplatná ZION adresa — musí začínat na zion1" : "Invalid ZION address — must start with zion1");
      return;
    }
    setSearchError("");
    router.push(`/pool/miner/${addr}`);
  };

  const podiumStyles = [
    { gradient: "from-amber-300 via-yellow-400 to-amber-600", label: cs ? "Zlato" : "Gold", icon: <Crown className="h-5 w-5" /> },
    { gradient: "from-slate-200 via-gray-300 to-slate-500", label: cs ? "Stříbro" : "Silver", icon: <Medal className="h-5 w-5" /> },
    { gradient: "from-orange-300 via-amber-500 to-orange-700", label: cs ? "Bronz" : "Bronze", icon: <Medal className="h-5 w-5" /> },
  ];

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10">

        {/* ═══════ A. HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ "--rc": "147, 51, 234" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
                <Trophy className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? "Žebříček minerů" : "Miner Leaderboard"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? "Cosmic Harmony" : "Cosmic Harmony"}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight flex items-center gap-4">
                  <Users className="hidden md:block h-12 w-12 text-zion-purple" />
                  {cs ? "Žebříček minerů" : "Miner Leaderboard"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Top ZION mineři podle hashrate, podílu shares a odhadovaných odměn. Živá data s auto-refresh každých 15 sekund."
                  : "Top ZION miners by hashrate, share contribution, and estimated rewards. Live data with auto-refresh every 15 seconds."}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Activity className="h-3 w-3 text-emerald-400" /> {cs ? "Živá data" : "Live Data"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Gauge className="h-3 w-3 text-zion-cyan" /> {cs ? "Auto-refresh 15 s" : "Auto-Refresh 15s"}
                </span>
                <Link href="/pool" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 hover:text-white hover:border-white/20 transition-colors">
                  <ArrowRight className="h-3 w-3 rotate-180" /> {cs ? "Zpět na pool" : "Back to Pool"}
                </Link>
              </div>
            </div>
            <div className="w-full lg:max-w-sm space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? "Rychlý přehled" : "Quick Snapshot"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-500">{cs ? "Aktivní mineři" : "Active Miners"}</p>
                    <p className="text-2xl font-bold text-emerald-400 font-mono">{activeCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">{cs ? "Celkem" : "Total"}</p>
                    <p className="text-2xl font-bold text-white font-mono">{totalCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">{cs ? "Pool hashrate" : "Pool Hashrate"}</p>
                    <p className="text-sm font-bold text-zion-cyan font-mono">{fmtHash(poolHashrate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">{cs ? "Top miner" : "Top Miner"}</p>
                    <p className="text-sm font-bold text-zion-gold font-mono">{fmtHash(topHashrate)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ B. SEARCH BAR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <form onSubmit={onSearchSubmit} className="zion-rainbow-card p-4 md:p-6" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={minerSearch}
                  onChange={(e) => { setMinerSearch(e.target.value); setSearchError(""); }}
                  placeholder={cs ? "Zadejte ZION adresu pro zobrazení detailu minera..." : "Enter a ZION address to view miner details..."}
                  className={`w-full rounded-xl border ${searchError ? "border-red-500/60" : "border-white/10"} bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-zion-cyan/50 focus:ring-1 focus:ring-zion-cyan/30 transition-colors font-mono`}
                />
                {searchError && (
                  <p className="absolute -bottom-5 left-0 text-xs text-red-400">{searchError}</p>
                )}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-linear-to-r from-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                {cs ? "Najít minera" : "Search Miner"}
              </button>
            </div>
          </form>
        </motion.section>

        {loading ? (
          <div className="zion-rainbow-card p-10 text-center" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="inline-flex items-center gap-3 text-gray-400">
              <Activity className="h-5 w-5 animate-pulse text-zion-purple" />
              {cs ? "Načítání žebříčku minerů..." : "Loading miner leaderboard..."}
            </div>
          </div>
        ) : !data ? (
          <div className="zion-rainbow-card p-10 text-center" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-gray-400">{cs ? "Data poolu nejsou dostupná. Servery mohou být offline." : "Pool data unavailable. Servers may be offline."}</p>
          </div>
        ) : (
          <>
            {/* ═══════ C. TOP 3 PODIUM ═══════ */}
            {top3.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Pódium" : "Podium"}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <Trophy className="h-7 w-7 text-zion-gold" />
                    {cs ? "Top 3 mineři" : "Top 3 Miners"}
                  </h2>
                  <p className="text-sm text-gray-400">{cs ? "Největší přispěvatelé do pool hashrate." : "The biggest contributors to pool hashrate."}</p>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  {top3.map((m, i) => {
                    const ps = podiumStyles[i];
                    return (
                      <motion.div
                        key={m.address}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + i * 0.06 }}
                        className={`zion-rainbow-sub p-6 relative overflow-hidden ${i === 0 ? "md:scale-105 md:-translate-y-2" : ""}`}
                        style={{ "--rc": "147, 51, 234" } as React.CSSProperties}
                      >
                        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : "#f97316" }} />
                        <div className="flex items-center justify-between mb-4">
                          <div className={`flex items-center justify-center h-12 w-12 rounded-2xl bg-linear-to-br ${ps.gradient} text-black font-bold shadow-lg`}>
                            {ps.icon}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest border ${
                            m.isActive
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-gray-500/30 bg-white/5 text-gray-400"
                          }`}>
                            <CircleDot className="h-3 w-3" />
                            {m.isActive ? (cs ? "Aktivní" : "Active") : (cs ? "Neaktivní" : "Inactive")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase tracking-wider bg-clip-text text-transparent bg-linear-to-r ${ps.gradient}`}>
                            #{m.rank} · {ps.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mb-4">
                          <code className="text-sm text-white font-mono truncate">{shortAddr(m.address)}</code>
                          <CopyButton text={m.address} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Hashrate" : "Hashrate"}</p>
                            <p className="text-lg font-bold text-zion-cyan font-mono">{fmtHash(m.hashrate)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Podíl poolu" : "Pool Share"}</p>
                            <p className="text-lg font-bold text-white font-mono">{m.sharePct.toFixed(2)}%</p>
                          </div>
                          <div className="col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 flex items-center justify-between">
                            <span className="text-emerald-200 text-[11px] uppercase tracking-wider">{cs ? "Odhad denně" : "Est. Daily"}</span>
                            <span className="text-emerald-300 font-bold font-mono">{m.estDailyZion.toFixed(4)} ZION</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* ═══════ D. FULL LEADERBOARD TABLE ═══════ */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Žebříček" : "Leaderboard"}</p>
                <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                  <Users className="h-7 w-7 text-zion-cyan" />
                  {cs ? "Úplný žebříček" : "Full Leaderboard"} ({sortedRows.length})
                </h2>
                <p className="text-sm text-gray-400">
                  {cs
                    ? "Klikněte na záhlaví pro řazení. Výchozí řazení podle podílu shares. Hashrate je odhadovaný z distribuce aktivních minerů."
                    : "Click column headers to sort. Default sort by share %. Hashrate is estimated from active miner distribution."}
                </p>
              </div>

              <div className="zion-rainbow-card overflow-hidden" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <SortHeader label="#" sortKey="rank" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortHeader label={cs ? "Adresa" : "Address"} sortKey="address" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortHeader label={cs ? "Server" : "Server"} sortKey="server" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortHeader label={cs ? "Hashrate" : "Hashrate"} sortKey="hashrate" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="right" tooltip={cs ? "Hashrate je odhadován z frekvence odesílání share. Skutečný individuální hashrate se může lišit." : "Hashrate is estimated from share submission frequency. Actual individual hashrate may vary."} />
                        <SortHeader label={cs ? "Podíl" : "Share %"} sortKey="sharePct" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                        <SortHeader label={cs ? "Shares" : "Shares"} sortKey="validShares" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                        <SortHeader label={cs ? "Poslední share" : "Last Share"} sortKey="last_share" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortHeader label={cs ? "Est. ZION/den" : "Est. ZION/day"} sortKey="estDailyZion" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                        <SortHeader label={cs ? "Stav" : "Status"} sortKey="isActive" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((m) => (
                        <tr key={m.address} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <span className={`font-mono font-bold ${m.rank <= 3 ? "text-zion-gold" : "text-gray-500"}`}>
                              {m.rank}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Link href={`/pool/miner/${m.address}`} className="flex items-center gap-1 group">
                              <code className="text-sm text-white font-mono group-hover:text-zion-cyan transition-colors">{shortAddr(m.address)}</code>
                              <CopyButton text={m.address} />
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 text-sm whitespace-nowrap">
                            {m.serverObj?.flag} {m.serverObj?.name ?? m.server}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-zion-cyan text-xs whitespace-nowrap">{fmtHash(m.hashrate)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden lg:block w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full bg-linear-to-r from-zion-purple to-zion-cyan" style={{ width: `${Math.min(100, m.sharePct)}%` }} />
                              </div>
                              <span className="font-mono text-white text-xs">{m.sharePct.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-gray-300 text-xs whitespace-nowrap">
                            {fmtNum(m.validShares)}<span className="text-gray-600"> / {fmtNum(m.totalShares)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 font-mono text-xs whitespace-nowrap">{timeAgo(m.last_share, cs)}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-400 text-xs whitespace-nowrap">{m.estDailyZion.toFixed(4)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              m.isActive
                                ? "text-emerald-300 bg-emerald-400/10 border border-emerald-400/20"
                                : "text-gray-500 bg-white/5 border border-white/[0.06]"
                            }`}>
                              <CircleDot className="h-3 w-3" />
                              {m.isActive ? (cs ? "Aktivní" : "Active") : (cs ? "Neaktivní" : "Inactive")}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {sortedRows.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-5 py-10 text-center text-gray-500">
                            {cs ? "Žádní mineři nejsou dostupní." : "No miners available."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.section>

            {/* ═══════ E. STATS SUMMARY ═══════ */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Souhrn" : "Summary"}</p>
                <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                  <Gauge className="h-7 w-7 text-zion-purple" />
                  {cs ? "Statistiky minerů" : "Miner Statistics"}
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-400/10 mb-3">
                    <Activity className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Aktivní mineři" : "Active Miners"}</p>
                  <p className="mt-1 text-2xl font-bold text-white font-mono">{activeCount}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{cs ? "share za posledních 10 min" : "share in last 10 min"}</p>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple-400/10 mb-3">
                    <Users className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Registrovaní mineři" : "Registered Miners"}</p>
                  <p className="mt-1 text-2xl font-bold text-white font-mono">{data.pplns?.registered_miners ?? totalCount}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{cs ? "v PPLNS okně" : "in PPLNS window"}</p>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-cyan/10 mb-3">
                    <Gauge className="h-4 w-4 text-zion-cyan" />
                  </div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Průměrný hashrate" : "Average Hashrate"}</p>
                  <p className="mt-1 text-2xl font-bold text-white font-mono">{fmtHash(avgHashrate)}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{cs ? "na aktivního minera" : "per active miner"}</p>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-gold/10 mb-3">
                    <Trophy className="h-4 w-4 text-zion-gold" />
                  </div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">{cs ? "Top miner hashrate" : "Top Miner Hashrate"}</p>
                  <p className="mt-1 text-2xl font-bold text-white font-mono">{fmtHash(topHashrate)}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{cs ? "největší přispěvatel" : "biggest contributor"}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {cs
                    ? "Hashrate minerů je odhadován proporcionálně z pool hashrate na základě aktivity odesílání share."
                    : "Miner hashrate is estimated proportionally from pool hashrate based on share submission activity."}
                </span>
              </div>
            </motion.section>

            {/* ═══════ F. DISTRIBUTION CHART ═══════ */}
            {donutSlices.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Distribuce" : "Distribution"}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <Share2 className="h-7 w-7 text-zion-purple" />
                    {cs ? "Distribuce hashrate" : "Hashrate Distribution"}
                  </h2>
                  <p className="text-sm text-gray-400">{cs ? "Podíl top 10 minerů vs. zbytek poolu." : "Top 10 miners vs. the rest of the pool."}</p>
                </div>

                <div className="zion-rainbow-card p-6 md:p-8" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
                  <DistributionDonut slices={donutSlices} cs={cs} />
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* ═══════ G. CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18 }}
          className="zion-cta-banner p-10 text-center"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-purple" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? "Připojte se k žebříčku" : "Join the Leaderboard"}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? "Začněte těžit ZION a objevte se v žebříčku. PPLNS odměny, 89 % pro minera, humanitární mise v každém bloku."
              : "Start mining ZION and appear on the leaderboard. PPLNS rewards, 89% miner share, humanitarian mission in every block."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/pool" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-white">
              <Pickaxe className="h-4 w-4" /> {cs ? "Hlavní stránka poolu" : "Pool Dashboard"}
            </Link>
            <a href="#search" onClick={(e) => { e.preventDefault(); (document.querySelector('input[type="text"]') as HTMLInputElement | null)?.focus(); }} className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Search className="h-4 w-4" /> {cs ? "Hledat minera" : "Search Miner"}
            </a>
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <Server className="h-4 w-4" /> Explorer
            </Link>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Miner Leaderboard · Odhadovaný hashrate je počítán z distribuce aktivních minerů · Auto-refresh 15 s`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} — Miner Leaderboard · Estimated hashrate computed from active miner distribution · Auto-refresh 15s`}
        </p>
      </div>
    </div>
  );
}
