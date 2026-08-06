"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRightLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { exportToCsv } from "@/lib/csv-export";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import { formatAge, formatZion, truncateHash } from "@/lib/explorer/format";
import { useExplorerSSE } from "@/components/explorer/v4/hooks/useExplorerSSE";
import LiveBadge from "@/components/explorer/v4/shared/LiveBadge";
import CopyButton from "@/components/explorer/v4/shared/CopyButton";

const ExplorerTxsTxsPageClientCopy = {
  payout: { cs: `výplata`, en: `payout` },
  transfer: { cs: `převod`, en: `transfer` },
  all: { cs: `Vše`, en: `All` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  liveFeed: { cs: `Živý feed`, en: `Live Feed` },
  transactionList: { cs: `Seznam transakcí`, en: `Transaction List` },
  completeTransactionListOnTheZi: { cs: `Kompletní seznam transakcí na ZION chainu s real-time SSE aktualizacemi, filtrováním a exportem.`, en: `Complete transaction list on the ZION chain with real-time SSE updates, filtering, and export.` },
  autoRefresh15s: { cs: `Auto-refresh 15s`, en: `Auto-Refresh 15s` },
  connected: { cs: `připojeno`, en: `connected` },
  connecting: { cs: `připojuje…`, en: `connecting…` },
  totalTx: { cs: `celkem TX`, en: `total TX` },
  live: { cs: `ŽIVĚ`, en: `LIVE` },
  currentHeight: { cs: `Aktuální výška`, en: `Current height` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  filter: { cs: `Filtr:`, en: `Filter:` },
  address: { cs: `Adresa:`, en: `Address:` },
  exportCsv: { cs: `Export CSV`, en: `Export CSV` },
  loaded: { cs: `načteno`, en: `loaded` },
  type: { cs: `Typ`, en: `Type` },
  age: { cs: `Stáří`, en: `Age` },
  block: { cs: `Blok`, en: `Block` },
  amount: { cs: `Částka`, en: `Amount` },
  noTransactionsFound: { cs: `Nenalezeny žádné transakce`, en: `No transactions found` },
  clearFilter: { cs: `Zrušit filtr`, en: `Clear filter` },
  pending: { cs: `čeká`, en: `pending` },
  loading: { cs: `Načítám…`, en: `Loading…` },
  loadMore: { cs: `Načíst další`, en: `Load More` },
  filtered: { cs: `filtrováno`, en: `filtered` },
};

/* ── helpers ─────────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  if (status === "pending")
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zion-gold opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zion-gold" />
      </span>
    );
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-zion-cyan" />;
}

function TypeBadge({ type, cs }: { type: string; cs: boolean }) {
  const map: Record<string, string> = {
    coinbase: "bg-zion-gold/15 text-zion-gold",
    payout: "bg-zion-cyan/15 text-zion-cyan",
    transfer: "bg-zion-cyan/15 text-zion-cyan",
  };
  const cls = map[type] || "bg-white/10 text-white/60";
  const label =
    type === "coinbase"
      ? "coinbase"
      : type === "payout"
        ? ExplorerTxsTxsPageClientCopy.payout[cs ? 'cs' : 'en']
        : type === "transfer"
          ? ExplorerTxsTxsPageClientCopy.transfer[cs ? 'cs' : 'en']
          : type;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

/* ── types ───────────────────────────────────────────────────── */

interface TxRow {
  hash: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  timestamp: number;
  block_height: number | null;
  status: string;
  type?: string;
  confirmations?: number;
}

type TxsApiResponse =
  | TxRow[]
  | { transactions?: any[]; items?: any[]; count?: number; total_tx_count?: number };

/* ── component ───────────────────────────────────────────────── */

export default function TxsPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const searchParams = useSearchParams();
  const addressFilter = String(searchParams.get("address") || "").trim();
  const typeFilter = String(searchParams.get("type") || "").trim();

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [total, setTotal] = useState<number | null>(null);

  // SSE live updates
  const sse = useExplorerSSE({ interval: 15, enabled: true });

  usePolling(() => setNow(Date.now()), 1000);

  const loadTransactions = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const offset = (pageNum - 1) * 50;
        const addressQuery = addressFilter
          ? `&address=${encodeURIComponent(addressFilter)}`
          : "";
        const typeQuery = typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : "";
        const data = await apiClient<TxsApiResponse>(
          `/blockchain/transactions?limit=50&offset=${offset}${addressQuery}${typeQuery}`,
        );
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.transactions)
            ? data.transactions
            : Array.isArray(data?.items)
              ? data.items
              : [];
        const newTxs: TxRow[] = rows
          .map((tx: any) => ({
            hash: String(tx.hash || tx.tx_hash || tx.id || tx.tx_id || ""),
            from: String(tx.from || tx.sender || ""),
            to: String(tx.to || tx.receiver || ""),
            amount: Number(tx.amount || 0),
            fee: Number(tx.fee || 0),
            timestamp: Number(tx.timestamp || 0),
            block_height:
              tx.block_height === null || tx.block_height === undefined
                ? null
                : Number(tx.block_height),
            status: String(
              tx.status || (tx.block_height ? "confirmed" : "pending"),
            ),
            type: String(tx.type || "transfer"),
            confirmations: Number(tx.confirmations || 0),
          }))
          .filter((tx) => tx.hash);
        if (append) setTransactions((prev) => [...prev, ...newTxs]);
        else setTransactions(newTxs);
        setHasMore(newTxs.length === 50);
        if (!append && data && !Array.isArray(data)) {
          setTotal(data.total_tx_count ?? data.count ?? null);
        }
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [addressFilter, typeFilter],
  );

  useEffect(() => {
    setPage(1);
    loadTransactions(1, false);
  }, [addressFilter, typeFilter, loadTransactions]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadTransactions(next, true);
  };

  const handleExportCsv = () => {
    const headers = ["hash", "type", "block", "timestamp", "fee", "amount", "status", "from", "to"];
    const rows = transactions.map((tx) => [
      tx.hash,
      tx.type || "transfer",
      tx.block_height ?? "",
      tx.timestamp,
      tx.fee,
      tx.amount,
      tx.status,
      tx.from,
      tx.to,
    ]);
    exportToCsv(`zion-txs-page-${page}.csv`, headers, rows);
  };

  const typeFilters = [
    { key: "", label: ExplorerTxsTxsPageClientCopy.all[cs ? 'cs' : 'en'] },
    { key: "coinbase", label: "coinbase" },
    { key: "transfer", label: ExplorerTxsTxsPageClientCopy.transfer[cs ? 'cs' : 'en'] },
    { key: "payout", label: ExplorerTxsTxsPageClientCopy.payout[cs ? 'cs' : 'en'] },
  ];

  const filteredCount = useMemo(() => transactions.length, [transactions]);

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-[1400px] space-y-10 pt-6 pb-8">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ "--rc": "7, 137, 48" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <ArrowRightLeft className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {ExplorerTxsTxsPageClientCopy.transactions[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {ExplorerTxsTxsPageClientCopy.liveFeed[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerTxsTxsPageClientCopy.transactionList[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {ExplorerTxsTxsPageClientCopy.completeTransactionListOnTheZi[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {ExplorerTxsTxsPageClientCopy.autoRefresh15s[cs ? 'cs' : 'en']}
                </span>
                {sse.connected ? (
                  <span className="zion-badge zion-badge-green">
                    <Zap className="h-3 w-3" /> SSE {ExplorerTxsTxsPageClientCopy.connected[cs ? 'cs' : 'en']}
                  </span>
                ) : (
                  <span className="zion-badge text-zion-gold border-zion-gold/40 bg-zion-gold/10">
                    SSE {ExplorerTxsTxsPageClientCopy.connecting[cs ? 'cs' : 'en']}
                  </span>
                )}
                {total !== null && (
                  <span className="zion-badge text-zion-gold border-zion-gold/40 bg-zion-gold/10">
                    {total.toLocaleString()} {ExplorerTxsTxsPageClientCopy.totalTx[cs ? 'cs' : 'en']}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <LiveBadge label={ExplorerTxsTxsPageClientCopy.live[cs ? 'cs' : 'en']} />
              {sse.stats && (
                <div className="zion-rainbow-sub p-4 rounded-2xl" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
                  <div className="text-xs text-gray-400 mb-1">{ExplorerTxsTxsPageClientCopy.currentHeight[cs ? 'cs' : 'en']}</div>
                  <div className="text-2xl font-bold text-zion-cyan tabular-nums">
                    #{sse.stats.height.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {ExplorerTxsTxsPageClientCopy.mempool[cs ? 'cs' : 'en']}: {sse.stats.mempool_size} TX
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ═══════ FILTERS BAR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="zion-rainbow-card rounded-2xl bg-black/60 p-4 flex flex-wrap items-center gap-3" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Filter className="h-4 w-4" />
              {ExplorerTxsTxsPageClientCopy.filter[cs ? 'cs' : 'en']}
            </div>
            {/* Type filter chips */}
            <div className="flex items-center gap-2">
              {typeFilters.map((tf) => {
                const active = typeFilter === tf.key;
                const href = tf.key
                  ? `/explorer/txs?type=${tf.key}${addressFilter ? `&address=${addressFilter}` : ""}`
                  : `/explorer/txs${addressFilter ? `?address=${addressFilter}` : ""}`;
                return (
                  <Link
                    key={tf.key || "all"}
                    href={href}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? "bg-zion-cyan/15 text-zion-cyan border border-zion-cyan/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {tf.label}
                  </Link>
                );
              })}
            </div>
            {/* Address filter display */}
            {addressFilter && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zion-cyan/5 border border-zion-cyan/10">
                <span className="text-[11px] text-white/40">{ExplorerTxsTxsPageClientCopy.address[cs ? 'cs' : 'en']}</span>
                <span className="text-[11px] text-zion-cyan font-mono">{truncateHash(addressFilter, 14, 6)}</span>
                <Link
                  href={typeFilter ? `/explorer/txs?type=${typeFilter}` : "/explorer/txs"}
                  className="text-white/30 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </Link>
              </div>
            )}
            {/* CSV export */}
            <button
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Download className="w-3.5 h-3.5" />
              {ExplorerTxsTxsPageClientCopy.exportCsv[cs ? 'cs' : 'en']}
            </button>
          </div>
        </motion.section>

        {/* ═══════ TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-zion-cyan" />
              <h2 className="text-2xl font-semibold text-white">
                {ExplorerTxsTxsPageClientCopy.transactions[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <span className="text-[11px] text-white/30 font-mono tabular-nums">
              {filteredCount} {ExplorerTxsTxsPageClientCopy.loaded[cs ? 'cs' : 'en']}
            </span>
          </div>

          <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
            {/* table header */}
            <div className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/6">
              <span />
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTxsTxsPageClientCopy.type[cs ? 'cs' : 'en']}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTxsTxsPageClientCopy.age[cs ? 'cs' : 'en']}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTxsTxsPageClientCopy.block[cs ? 'cs' : 'en']}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">Fee</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerTxsTxsPageClientCopy.amount[cs ? 'cs' : 'en']}</span>
            </div>

            {/* loading skeleton */}
            {loading &&
              [...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/3 animate-pulse"
                >
                  <div className="flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  </div>
                  <div className="h-4 bg-white/5 rounded w-48" />
                  <div className="h-4 bg-white/5 rounded w-16" />
                  <div className="h-4 bg-white/5 rounded w-12" />
                  <div className="h-4 bg-white/5 rounded w-16" />
                  <div className="h-4 bg-white/5 rounded w-10 ml-auto" />
                  <div className="h-4 bg-white/5 rounded w-20 ml-auto" />
                </div>
              ))}

            {/* empty */}
            {!loading && transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <ArrowRightLeft className="w-10 h-10 text-white/10" />
                <p className="text-white/30 text-sm">
                  {ExplorerTxsTxsPageClientCopy.noTransactionsFound[cs ? 'cs' : 'en']}
                </p>
                {(addressFilter || typeFilter) && (
                  <Link
                    href="/explorer/txs"
                    className="text-zion-cyan text-xs hover:underline"
                  >
                    {ExplorerTxsTxsPageClientCopy.clearFilter[cs ? 'cs' : 'en']}
                  </Link>
                )}
              </div>
            )}

            {/* rows */}
            {!loading &&
              transactions.map((tx, i) => (
                <Link
                  key={`${tx.hash}-${i}`}
                  href={`/explorer/tx?hash=${encodeURIComponent(tx.hash)}`}
                  className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors group"
                >
                  {/* status */}
                  <div className="flex items-center justify-center">
                    <StatusDot status={tx.status} />
                  </div>

                  {/* hash */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono text-zion-cyan group-hover:text-cyan-200 truncate transition-colors">
                      {tx.hash.slice(0, 16)}…{tx.hash.slice(-8)}
                    </span>
                    <CopyButton text={tx.hash} />
                  </div>

                  {/* type */}
                  <div className="flex items-center">
                    <TypeBadge type={tx.type || "transfer"} cs={cs} />
                  </div>

                  {/* age */}
                  <div className="flex items-center text-[12px] text-white/40 tabular-nums">
                    {formatAge(tx.timestamp, cs)}
                  </div>

                  {/* block */}
                  <div className="flex items-center">
                    {tx.block_height !== null ? (
                      <Link
                        href={`/explorer/block?height=${tx.block_height}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] text-zion-gold/80 hover:text-zion-gold tabular-nums transition-colors"
                      >
                        #{tx.block_height?.toLocaleString()}
                      </Link>
                    ) : (
                      <span className="text-[12px] text-zion-gold/60 italic">
                        {ExplorerTxsTxsPageClientCopy.pending[cs ? 'cs' : 'en']}
                      </span>
                    )}
                  </div>

                  {/* fee */}
                  <div className="flex items-center justify-end text-[12px] text-white/30 tabular-nums font-mono">
                    {tx.fee > 0 ? tx.fee.toFixed(6) : "—"}
                  </div>

                  {/* amount */}
                  <div className="flex items-center justify-end text-[13px] text-white font-semibold tabular-nums">
                    {tx.amount > 0 ? `${formatZion(tx.amount, 4)} ₿Z` : "—"}
                  </div>
                </Link>
              ))}

            {/* load more */}
            {hasMore && !loading && (
              <div className="flex justify-center py-5">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors text-sm text-white/60 hover:text-white/90 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {ExplorerTxsTxsPageClientCopy.loading[cs ? 'cs' : 'en']}
                    </>
                  ) : (
                    ExplorerTxsTxsPageClientCopy.loadMore[cs ? 'cs' : 'en']
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* ═══════ BREADCRUMB FOOTER ═══════ */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">
            Explorer
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">{ExplorerTxsTxsPageClientCopy.transactions[cs ? 'cs' : 'en']}</span>
          {(addressFilter || typeFilter) && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-zion-cyan">{ExplorerTxsTxsPageClientCopy.filtered[cs ? 'cs' : 'en']}</span>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
