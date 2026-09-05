"use client";

/**
 * Mempool Explorer — full live view of pending transactions.
 *
 * Combines HTTP polling (every 5 s) with WebSocket PendingTransactions events
 * to keep the table reactive without overwhelming the node RPC.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  ChevronRight,
  Flame,
  Hash,
  Loader2,
  Search,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { usePendingTransactions } from "@/hooks/useWebSocketSubscription";
import ExplorerCopyButton from "@/components/explorer/v4/shared/ExplorerCopyButton";

const ExplorerMempoolMempoolPageClientCopy = {
  feeDistribution: { cs: `Distribuce poplatků`, en: `Fee Distribution` },
  flowersByte: { cs: `flowers / byte`, en: `flowers / byte` },
  mempoolUnavailable: { cs: `Mempool není dostupný`, en: `Mempool unavailable` },
  pending: { cs: `čekajících`, en: `pending` },
  wsLive: { cs: `WS živě`, en: `WS live` },
  polling5s: { cs: `polling 5 s`, en: `polling 5s` },
  transactionsWaitingToBeConfirm: { cs: `Transakce čekající na potvrzení v dalším bloku. Aktualizováno v reálném čase přes WebSocket + HTTP polling.`, en: `Transactions waiting to be confirmed in the next block. Live updates via WebSocket + HTTP polling.` },
  pendingTx: { cs: `Čekajících TX`, en: `Pending TX` },
  poolSize: { cs: `Velikost poolu`, en: `Pool size` },
  totalFees: { cs: `Suma poplatků`, en: `Total fees` },
  avgFee: { cs: `Průměrný fee`, en: `Avg fee` },
  feeStatistics: { cs: `Statistika poplatků`, en: `Fee statistics` },
  average: { cs: `Průměr`, en: `Average` },
  searchTxHash: { cs: `Hledat TX hash…`, en: `Search TX hash…` },
  age: { cs: `Stáří`, en: `Age` },
  size: { cs: `Velikost`, en: `Size` },
  status: { cs: `Status`, en: `Status` },
  noTxMatchesYourSearch: { cs: `Žádné TX neodpovídají hledání.`, en: `No TX matches your search.` },
  mempoolIsEmptyAllConfirmed: { cs: `Mempool je prázdný — vše potvrzeno ✓`, en: `Mempool is empty — all confirmed ✓` },
};

interface MempoolTx {
  tx_hash: string;
  size: number;
  fee: number;
  receive_time: number;
  age_seconds: number;
  double_spend_seen: boolean;
  kept_by_block?: boolean;
  relayed?: boolean;
}

interface FeeStats {
  min: number;
  max: number;
  avg: number;
  median: number;
}

interface MempoolResponse {
  count: number;
  pool_size_bytes: number;
  total_fees: number;
  fee_stats: FeeStats;
  transactions: MempoolTx[];
}

type SortKey = "age" | "fee" | "size";
type SortDir = "asc" | "desc";

function truncate(value: string, lead = 10, tail = 8) {
  if (!value) return "—";
  if (value.length <= lead + tail) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatAge(seconds: number, cs: boolean) {
  if (seconds < 60) return cs ? `${seconds} s` : `${seconds}s`;
  if (seconds < 3600) return cs ? `${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return cs ? `${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 3600)}h`;
  return cs ? `${Math.floor(seconds / 86400)} d` : `${Math.floor(seconds / 86400)}d`;
}

/* ─────────────────────────────────────────────────────────────────
   Fee histogram — SVG bar chart, fee rate in flowers/byte
   ───────────────────────────────────────────────────────────────── */
function FeeHistogram({ txs, cs }: { txs: MempoolTx[]; cs: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const buckets = useMemo(() => {
    if (!txs.length) return [] as { lo: number; hi: number; count: number }[];
    const rates = txs
      .map((t) => (t.size > 0 ? (t.fee * 1_000_000) / t.size : 0))
      .filter((r) => r >= 0);
    if (!rates.length) return [] as { lo: number; hi: number; count: number }[];
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    const numBuckets = 10;
    const span = Math.max(max - min, 0.001);
    const step = span / numBuckets;
    const out = Array.from({ length: numBuckets }, (_, i) => ({
      lo: min + step * i,
      hi: min + step * (i + 1),
      count: 0,
    }));
    for (const r of rates) {
      const idx = Math.min(numBuckets - 1, Math.max(0, Math.floor((r - min) / step)));
      out[idx].count++;
    }
    return out;
  }, [txs]);

  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  if (!buckets.length) return null;

  const W = 400, H = 160;
  const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const slot = chartW / buckets.length;
  const barW = slot * 0.72;

  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          {ExplorerMempoolMempoolPageClientCopy.feeDistribution[cs ? 'cs' : 'en']}
        </p>
        <span className="text-[10px] text-white/30">{ExplorerMempoolMempoolPageClientCopy.flowersByte[cs ? 'cs' : 'en']}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="feeBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e41e2b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e41e2b" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = PAD.top + chartH - pct * chartH;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
                {Math.round(peak * pct)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {buckets.map((b, i) => {
          const h = peak > 0 ? (b.count / peak) * chartH : 0;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = PAD.top + chartH - h;
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={barW} height={Math.max(h, b.count > 0 ? 2 : 0)}
                fill="url(#feeBarGrad)" rx="1.5"
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                className="transition-opacity"
                opacity={hovered === null || hovered === i ? 1 : 0.35}
              />
              {hovered === i && b.count > 0 && (
                <>
                  <rect x={Math.min(x + barW / 2 - 48, W - 100)} y={Math.max(y - 26, 2)} width="96" height="20" rx="5" fill="rgba(0,0,0,0.9)" stroke="#e41e2b" strokeWidth="0.5" />
                  <text x={Math.min(x + barW / 2, W - 52)} y={Math.max(y - 12, 13)} textAnchor="middle" fill="white" fontSize="7" fontWeight="600" fontFamily="monospace">
                    {b.count} tx · {b.lo.toFixed(1)}–{b.hi.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {/* X-axis labels (every other bucket) */}
        {buckets.map((b, i) => {
          if (i % 2 !== 0 && i !== buckets.length - 1) return null;
          const x = PAD.left + i * slot + slot / 2;
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7" fontFamily="monospace">
              {b.lo.toFixed(0)}
            </text>
          );
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-white/30 mt-1 tabular-nums">
        <span>{buckets[0]?.lo.toFixed(1)} fl/B</span>
        <span>{buckets[buckets.length - 1]?.hi.toFixed(1)} fl/B</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Page client
   ───────────────────────────────────────────────────────────────── */
export default function MempoolPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [data, setData] = useState<MempoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [, setNow] = useState(Date.now());

  // WS subscription: when a new pending TX arrives, trigger a fetch
  const { isConnected: wsConnected } = usePendingTransactions(true);

  const fetchMempool = useCallback(async () => {
    try {
      const result = await apiClient<MempoolResponse>("/blockchain/mempool", {
        cache: "no-store",
      });
      setData(result);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch mempool:", err);
      setError(ExplorerMempoolMempoolPageClientCopy.mempoolUnavailable[cs ? 'cs' : 'en']);
    } finally {
      setLoading(false);
    }
  }, [cs]);

  // Initial load + polling every 5 s
  useEffect(() => {
    fetchMempool();
  }, [fetchMempool]);
  usePolling(fetchMempool, 5_000);

  // Tick once per second for age display
  usePolling(() => setNow(Date.now()), 1_000);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "age" ? "desc" : "desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    if (!data) return [];
    let rows = data.transactions;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((t) => t.tx_hash.toLowerCase().includes(q));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "age") return (a.receive_time - b.receive_time) * dir;
      if (sortKey === "fee") return (a.fee - b.fee) * dir;
      if (sortKey === "size") return (a.size - b.size) * dir;
      return 0;
    });
  }, [data, search, sortKey, sortDir]);

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-zion-gold/5 via-transparent to-transparent" />

      <div className="relative z-10 zion-container max-w-[1400px] py-8 pt-6">
        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">
            Explorer
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">Mempool</span>
        </nav>

        {/* title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-zion-gold/10 border border-zion-gold/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-zion-gold" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mempool</h1>
          <span className="text-[11px] text-white/30 font-mono tabular-nums ml-1">
            {data?.count ?? 0} {ExplorerMempoolMempoolPageClientCopy.pending[cs ? 'cs' : 'en']}
          </span>
          <div className="flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`h-2 w-2 rounded-full ${wsConnected ? "bg-zion-cyan" : "bg-zion-gold"}`}
            />
            <span className="text-[10px] text-white/50">
              {wsConnected ? (ExplorerMempoolMempoolPageClientCopy.wsLive[cs ? 'cs' : 'en']) : (ExplorerMempoolMempoolPageClientCopy.polling5s[cs ? 'cs' : 'en'])}
            </span>
          </div>
        </div>

        <p className="text-sm text-white/40 max-w-3xl mb-8">
          {ExplorerMempoolMempoolPageClientCopy.transactionsWaitingToBeConfirm[cs ? 'cs' : 'en']}
        </p>

        {/* stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label={ExplorerMempoolMempoolPageClientCopy.pendingTx[cs ? 'cs' : 'en']}
            value={String(data?.count ?? 0)}
            icon={<Activity className="w-4 h-4 text-zion-cyan" />}
            accent="cyan"
          />
          <StatCard
            label={ExplorerMempoolMempoolPageClientCopy.poolSize[cs ? 'cs' : 'en']}
            value={formatBytes(data?.pool_size_bytes ?? 0)}
            icon={<Hash className="w-4 h-4 text-zion-purple" />}
            accent="purple"
          />
          <StatCard
            label={ExplorerMempoolMempoolPageClientCopy.totalFees[cs ? 'cs' : 'en']}
            value={`${(data?.total_fees ?? 0).toFixed(4)} ZION`}
            icon={<Flame className="w-4 h-4 text-zion-gold" />}
            accent="amber"
          />
          <StatCard
            label={ExplorerMempoolMempoolPageClientCopy.avgFee[cs ? 'cs' : 'en']}
            value={`${(data?.fee_stats.avg ?? 0).toFixed(6)} ZION`}
            icon={<TrendingUp className="w-4 h-4 text-zion-cyan" />}
            accent="emerald"
          />
        </div>

        {/* histogram + fee stats */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <FeeHistogram txs={data?.transactions ?? []} cs={cs} />
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
              {ExplorerMempoolMempoolPageClientCopy.feeStatistics[cs ? 'cs' : 'en']}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FeeStat label="Min" value={data?.fee_stats.min ?? 0} />
              <FeeStat label="Max" value={data?.fee_stats.max ?? 0} />
              <FeeStat label={ExplorerMempoolMempoolPageClientCopy.average[cs ? 'cs' : 'en']} value={data?.fee_stats.avg ?? 0} />
              <FeeStat label="Median" value={data?.fee_stats.median ?? 0} />
            </div>
          </div>
        </div>

        {/* search + table */}
        <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          {/* toolbar */}
          <div className="px-5 py-3 border-b border-white/6 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ExplorerMempoolMempoolPageClientCopy.searchTxHash[cs ? 'cs' : 'en']}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-zion-gold/50"
              />
            </div>
            <span className="text-[10px] text-white/30 tabular-nums">
              {filteredAndSorted.length}/{data?.count ?? 0}
            </span>
          </div>

          {/* table header */}
          <div className="grid grid-cols-[32px_1fr_90px_100px_100px_120px] min-w-[480px] gap-3 px-5 py-3 border-b border-white/6">
            <span />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">
              TX Hash
            </span>
            <SortHeader
              label={ExplorerMempoolMempoolPageClientCopy.age[cs ? 'cs' : 'en']}
              active={sortKey === "age"}
              dir={sortDir}
              onClick={() => toggleSort("age")}
            />
            <SortHeader
              label={ExplorerMempoolMempoolPageClientCopy.size[cs ? 'cs' : 'en']}
              active={sortKey === "size"}
              dir={sortDir}
              onClick={() => toggleSort("size")}
            />
            <SortHeader
              label="Fee"
              align="right"
              active={sortKey === "fee"}
              dir={sortDir}
              onClick={() => toggleSort("fee")}
            />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">
              {ExplorerMempoolMempoolPageClientCopy.status[cs ? 'cs' : 'en']}
            </span>
          </div>

          {/* states */}
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zion-gold" />
            </div>
          )}
          {error && !data && (
            <p className="text-center text-sm text-zion-purple/80 py-8">{error}</p>
          )}
          {!loading && data && filteredAndSorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Flame className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm">
                {search
                  ? ExplorerMempoolMempoolPageClientCopy.noTxMatchesYourSearch[cs ? 'cs' : 'en']
                  : ExplorerMempoolMempoolPageClientCopy.mempoolIsEmptyAllConfirmed[cs ? 'cs' : 'en']}
              </p>
            </div>
          )}

          {/* rows */}
          {filteredAndSorted.map((tx) => {
            const ageNow = Math.floor(Date.now() / 1000) - tx.receive_time;
            return (
              <Link
                key={tx.tx_hash}
                href={`/explorer/tx?hash=${encodeURIComponent(tx.tx_hash)}`}
                className="grid grid-cols-[32px_1fr_90px_100px_100px_120px] min-w-[480px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors group"
              >
                {/* status dot */}
                <div className="flex items-center justify-center">
                  {tx.double_spend_seen ? (
                    <span title="double-spend seen">
                      <AlertTriangle className="w-3.5 h-3.5 text-zion-purple" />
                    </span>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zion-gold opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zion-gold" />
                    </span>
                  )}
                </div>

                {/* hash */}
                <div className="flex items-center gap-2 min-w-0">
                  <Hash className="w-3 h-3 text-white/30 shrink-0" />
                  <span className="text-[13px] font-mono text-zion-gold group-hover:text-amber-200 truncate transition-colors">
                    {truncate(tx.tx_hash)}
                  </span>
                  <ExplorerCopyButton text={tx.tx_hash} iconSize={14} stopPropagation className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* age */}
                <div className="flex items-center text-[12px] text-white/50 tabular-nums">
                  {formatAge(ageNow, cs)}
                </div>

                {/* size */}
                <div className="flex items-center text-[12px] text-white/50 tabular-nums">
                  {formatBytes(tx.size)}
                </div>

                {/* fee */}
                <div className="flex items-center justify-end text-[12px] text-zion-gold font-semibold tabular-nums">
                  {tx.fee > 0 ? tx.fee.toFixed(6) : "—"}
                </div>

                {/* status */}
                <div className="flex items-center justify-end gap-1">
                  {tx.double_spend_seen && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-zion-purple/15 text-zion-purple">
                      double-spend
                    </span>
                  )}
                  {tx.kept_by_block && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-zion-cyan/15 text-zion-cyan">
                      kept
                    </span>
                  )}
                  {tx.relayed && !tx.double_spend_seen && !tx.kept_by_block && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-zion-cyan/15 text-zion-cyan">
                      relayed
                    </span>
                  )}
                  {!tx.relayed && !tx.double_spend_seen && !tx.kept_by_block && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-white/5 text-white/40">
                      pending
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Small components
   ───────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "cyan" | "purple" | "amber" | "emerald";
}) {
  const accentMap = {
    cyan: "border-zion-cyan/20 bg-zion-cyan/5",
    purple: "border-zion-purple/20 bg-zion-purple/5",
    amber: "border-zion-gold/20 bg-zion-gold/5",
    emerald: "border-zion-cyan/20 bg-zion-cyan/5",
  } as const;
  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function FeeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</p>
      <p className="text-sm font-mono text-zion-gold tabular-nums">{value.toFixed(6)}</p>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-medium transition-colors ${
        active ? "text-zion-gold" : "text-white/30 hover:text-white/60"
      } ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {label}
      <ArrowDownUp className={`w-3 h-3 ${active ? "opacity-100" : "opacity-30"} ${active && dir === "asc" ? "rotate-180" : ""}`} />
    </button>
  );
}
