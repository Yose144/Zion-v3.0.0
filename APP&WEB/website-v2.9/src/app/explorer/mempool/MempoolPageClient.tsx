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
  Copy,
  Check,
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

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="text-white/20 hover:text-white/60 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Fee histogram (8 buckets, log-spaced by max fee)
   ───────────────────────────────────────────────────────────────── */
function FeeHistogram({ txs, cs }: { txs: MempoolTx[]; cs: boolean }) {
  const buckets = useMemo(() => {
    if (!txs.length) return [];
    const fees = txs.map((t) => t.fee).filter((f) => f >= 0);
    if (!fees.length) return [];
    const max = Math.max(...fees);
    const min = Math.min(...fees);
    const numBuckets = 8;
    const span = Math.max(max - min, 0.000001);
    const step = span / numBuckets;
    const out = Array.from({ length: numBuckets }, (_, i) => ({
      lo: min + step * i,
      hi: min + step * (i + 1),
      count: 0,
    }));
    for (const f of fees) {
      const idx = Math.min(numBuckets - 1, Math.max(0, Math.floor((f - min) / step)));
      out[idx].count++;
    }
    return out;
  }, [txs]);

  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  if (!buckets.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          {cs ? "Distribuce poplatků" : "Fee distribution"}
        </p>
        <span className="text-[10px] text-white/30">{cs ? "ZION za TX" : "ZION per TX"}</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {buckets.map((b, i) => {
          const heightPct = peak > 0 ? (b.count / peak) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${b.lo.toFixed(6)} – ${b.hi.toFixed(6)} ZION (${b.count})`}
            >
              <div className="text-[9px] text-white/40 tabular-nums">
                {b.count > 0 ? b.count : ""}
              </div>
              <div
                className="w-full rounded-t bg-linear-to-t from-amber-500/40 to-amber-400/80 group-hover:from-amber-400/60 group-hover:to-amber-300 transition-all"
                style={{ height: `${heightPct}%`, minHeight: b.count > 0 ? 4 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-white/30 mt-1 tabular-nums">
        <span>{buckets[0]?.lo.toFixed(6)}</span>
        <span>{buckets[buckets.length - 1]?.hi.toFixed(6)}</span>
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
      setError(cs ? "Mempool není dostupný" : "Mempool unavailable");
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
    <div className="zion-shell min-h-screen relative">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-amber-500/5 via-transparent to-transparent" />

      <div className="relative z-10 zion-container max-w-[1400px] py-8">
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
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mempool</h1>
          <span className="text-[11px] text-white/30 font-mono tabular-nums ml-1">
            {data?.count ?? 0} {cs ? "čekajících" : "pending"}
          </span>
          <div className="flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`h-2 w-2 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            <span className="text-[10px] text-white/50">
              {wsConnected ? (cs ? "WS živě" : "WS live") : (cs ? "polling 5 s" : "polling 5s")}
            </span>
          </div>
        </div>

        <p className="text-sm text-white/40 max-w-3xl mb-8">
          {cs
            ? "Transakce čekající na potvrzení v dalším bloku. Aktualizováno v reálném čase přes WebSocket + HTTP polling."
            : "Transactions waiting to be confirmed in the next block. Live updates via WebSocket + HTTP polling."}
        </p>

        {/* stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label={cs ? "Čekajících TX" : "Pending TX"}
            value={String(data?.count ?? 0)}
            icon={<Activity className="w-4 h-4 text-cyan-400" />}
            accent="cyan"
          />
          <StatCard
            label={cs ? "Velikost poolu" : "Pool size"}
            value={formatBytes(data?.pool_size_bytes ?? 0)}
            icon={<Hash className="w-4 h-4 text-purple-400" />}
            accent="purple"
          />
          <StatCard
            label={cs ? "Suma poplatků" : "Total fees"}
            value={`${(data?.total_fees ?? 0).toFixed(4)} ZION`}
            icon={<Flame className="w-4 h-4 text-amber-400" />}
            accent="amber"
          />
          <StatCard
            label={cs ? "Průměrný fee" : "Avg fee"}
            value={`${(data?.fee_stats.avg ?? 0).toFixed(6)} ZION`}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            accent="emerald"
          />
        </div>

        {/* histogram + fee stats */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <FeeHistogram txs={data?.transactions ?? []} cs={cs} />
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
              {cs ? "Statistika poplatků" : "Fee statistics"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FeeStat label="Min" value={data?.fee_stats.min ?? 0} />
              <FeeStat label="Max" value={data?.fee_stats.max ?? 0} />
              <FeeStat label={cs ? "Průměr" : "Average"} value={data?.fee_stats.avg ?? 0} />
              <FeeStat label="Median" value={data?.fee_stats.median ?? 0} />
            </div>
          </div>
        </div>

        {/* search + table */}
        <div className="zion-panel rounded-[28px] bg-black/60 overflow-hidden">
          {/* toolbar */}
          <div className="px-5 py-3 border-b border-white/6 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={cs ? "Hledat TX hash…" : "Search TX hash…"}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <span className="text-[10px] text-white/30 tabular-nums">
              {filteredAndSorted.length}/{data?.count ?? 0}
            </span>
          </div>

          {/* table header */}
          <div className="grid grid-cols-[32px_1fr_90px_100px_100px_120px] gap-3 px-5 py-3 border-b border-white/6">
            <span />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">
              TX Hash
            </span>
            <SortHeader
              label={cs ? "Stáří" : "Age"}
              active={sortKey === "age"}
              dir={sortDir}
              onClick={() => toggleSort("age")}
            />
            <SortHeader
              label={cs ? "Velikost" : "Size"}
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
              {cs ? "Status" : "Status"}
            </span>
          </div>

          {/* states */}
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          )}
          {error && !data && (
            <p className="text-center text-sm text-red-400/80 py-8">{error}</p>
          )}
          {!loading && data && filteredAndSorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Flame className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm">
                {search
                  ? cs ? "Žádné TX neodpovídají hledání." : "No TX matches your search."
                  : cs ? "Mempool je prázdný — vše potvrzeno ✓" : "Mempool is empty — all confirmed ✓"}
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
                className="grid grid-cols-[32px_1fr_90px_100px_100px_120px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors group"
              >
                {/* status dot */}
                <div className="flex items-center justify-center">
                  {tx.double_spend_seen ? (
                    <span title="double-spend seen">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    </span>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                    </span>
                  )}
                </div>

                {/* hash */}
                <div className="flex items-center gap-2 min-w-0">
                  <Hash className="w-3 h-3 text-white/30 shrink-0" />
                  <span className="text-[13px] font-mono text-amber-300 group-hover:text-amber-200 truncate transition-colors">
                    {truncate(tx.tx_hash)}
                  </span>
                  <CopyBtn text={tx.tx_hash} />
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
                <div className="flex items-center justify-end text-[12px] text-yellow-400 font-semibold tabular-nums">
                  {tx.fee > 0 ? tx.fee.toFixed(6) : "—"}
                </div>

                {/* status */}
                <div className="flex items-center justify-end gap-1">
                  {tx.double_spend_seen && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-500/15 text-red-400">
                      double-spend
                    </span>
                  )}
                  {tx.kept_by_block && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-300">
                      kept
                    </span>
                  )}
                  {tx.relayed && !tx.double_spend_seen && !tx.kept_by_block && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
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
    cyan: "border-cyan-500/20 bg-cyan-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
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
      <p className="text-sm font-mono text-amber-300 tabular-nums">{value.toFixed(6)}</p>
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
        active ? "text-amber-300" : "text-white/30 hover:text-white/60"
      } ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {label}
      <ArrowDownUp className={`w-3 h-3 ${active ? "opacity-100" : "opacity-30"} ${active && dir === "asc" ? "rotate-180" : ""}`} />
    </button>
  );
}
