"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, ChevronRight, Copy, Check, Loader2, X, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from "@/hooks/usePolling";
import { exportToCsv } from "@/lib/csv-export";

const ExplorerTransactionsTransactionsPageClientCopy = {
  payout: { cs: `výplata`, en: `payout` },
  transfer: { cs: `převod`, en: `transfer` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  loaded: { cs: `načteno`, en: `loaded` },
  exportCsv: { cs: `Export CSV`, en: `Export CSV` },
  addressFilter: { cs: `Filtr adresy:`, en: `Address filter:` },
  failedToLoadTransactions: { cs: `Chyba načítání transakcí`, en: `Failed to load transactions` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  type: { cs: `Typ`, en: `Type` },
  age: { cs: `Stáří`, en: `Age` },
  block: { cs: `Blok`, en: `Block` },
  amount: { cs: `Částka`, en: `Amount` },
  noTransactionsFound: { cs: `Nenalezeny žádné transakce`, en: `No transactions found` },
  clearFilter: { cs: `Zrušit filtr`, en: `Clear filter` },
  pending: { cs: `čeká`, en: `pending` },
  loading: { cs: `Načítám…`, en: `Loading…` },
  loadMoreTransactions: { cs: `Načíst další transakce`, en: `Load More Transactions` },
};

/* ── helpers ─────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-white/20 hover:text-white/60 transition-colors"
      aria-label={ok ? 'Copied' : 'Copy'}
      title={ok ? 'Copied' : 'Copy'}
    >
      {ok ? <Check className="w-3.5 h-3.5 text-zion-cyan" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "pending") return <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zion-gold opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zion-gold" /></span>;
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-zion-cyan" />;
}

function TypeBadge({ type, cs }: { type: string; cs: boolean }) {
  const map: Record<string, string> = { coinbase: "bg-zion-gold/15 text-zion-gold", payout: "bg-zion-cyan/15 text-zion-cyan", transfer: "bg-zion-cyan/15 text-zion-cyan" };
  const cls = map[type] || "bg-white/10 text-white/60";
  const label = type === 'coinbase' ? 'coinbase' : type === 'payout' ? (ExplorerTransactionsTransactionsPageClientCopy.payout[cs ? 'cs' : 'en']) : type === 'transfer' ? (ExplorerTransactionsTransactionsPageClientCopy.transfer[cs ? 'cs' : 'en']) : type;
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{label}</span>;
}

function timeAgo(ts: number, cs: boolean) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return cs ? `před ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `před ${Math.floor(s / 60)} min` : `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return cs ? `před ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `před ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
}

/* ── types ───────────────────────────────────────────────────── */

interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  timestamp: number;
  block_height: number | null;
  status: string;
  type?: string;
}

type TransactionsApiResponse =
  | Transaction[]
  | {
      transactions?: any[];
      items?: any[];
    };

/* ── component ───────────────────────────────────────────────── */

export default function TransactionsPageClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const searchParams = useSearchParams();
  const addressFilter = String(searchParams.get("address") || "").trim();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  usePolling(() => setNow(Date.now()), 1000);

  const loadTransactions = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const offset = (pageNum - 1) * 50;
      const addressQuery = addressFilter ? `&address=${encodeURIComponent(addressFilter)}` : "";
      const data = await apiClient<TransactionsApiResponse>(`/blockchain/transactions?limit=50&offset=${offset}${addressQuery}`);
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
          ? data.transactions
          : Array.isArray(data?.items)
            ? data.items
            : [];
      const newTxs: Transaction[] = rows.map((tx) => ({
        hash: String(tx.hash || tx.tx_hash || tx.id || tx.tx_id || ""),
        from: String(tx.from || tx.sender || ""),
        to: String(tx.to || tx.receiver || ""),
        amount: Number(tx.amount || 0),
        fee: Number(tx.fee || 0),
        timestamp: Number(tx.timestamp || 0),
        block_height: tx.block_height === null || tx.block_height === undefined ? null : Number(tx.block_height),
        status: String(tx.status || (tx.block_height ? "confirmed" : "pending")),
        type: String(tx.type || "transfer"),
      })).filter((tx) => tx.hash);
      if (append) setTransactions((prev) => [...prev, ...newTxs]);
      else setTransactions(newTxs);
      setHasMore(newTxs.length === 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [addressFilter]);

  useEffect(() => { setPage(1); loadTransactions(1, false); }, [addressFilter, loadTransactions]);

  const loadMore = () => { const next = page + 1; setPage(next); loadTransactions(next, true); };

  const handleExportCsv = () => {
    const headers = ["hash", "type", "block", "timestamp", "fee", "amount", "status"];
    const rows = transactions.map((tx) => [
      tx.hash,
      tx.type || "transfer",
      tx.block_height ?? "",
      tx.timestamp,
      tx.fee,
      tx.amount,
      tx.status,
    ]);
    exportToCsv(`zion-transactions-page-${page}.csv`, headers, rows);
  };

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-zion-purple/10 via-transparent to-transparent" />

      <div className="relative z-10 zion-container max-w-[1400px] py-8 pt-6">

        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">{ExplorerTransactionsTransactionsPageClientCopy.transactions[cs ? 'cs' : 'en']}</span>
          {addressFilter && <>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70 font-mono">{addressFilter.slice(0, 12)}…</span>
          </>}
        </nav>

        {/* title */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20 flex items-center justify-center">
            <ArrowRightLeft className="w-4.5 h-4.5 text-zion-cyan" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{ExplorerTransactionsTransactionsPageClientCopy.transactions[cs ? 'cs' : 'en']}</h1>
          <span className="text-[11px] text-white/30 font-mono tabular-nums ml-1">{transactions.length} {ExplorerTransactionsTransactionsPageClientCopy.loaded[cs ? 'cs' : 'en']}</span>
          <button
            onClick={handleExportCsv}
            disabled={transactions.length === 0}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Download className="w-3.5 h-3.5" />
            {ExplorerTransactionsTransactionsPageClientCopy.exportCsv[cs ? 'cs' : 'en']}
          </button>
        </div>

        {addressFilter && (
          <div className="flex items-center gap-2 mt-2 mb-4 px-3 py-2 rounded-xl bg-zion-cyan/5 border border-zion-cyan/10 w-fit">
            <span className="text-[11px] text-white/40">{ExplorerTransactionsTransactionsPageClientCopy.addressFilter[cs ? 'cs' : 'en']}</span>
            <span className="text-[11px] text-zion-cyan font-mono">{addressFilter}</span>
            <Link href="/explorer/transactions" className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></Link>
          </div>
        )}

        {/* error banner */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-2xl bg-zion-purple/10 border border-zion-purple/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-zion-purple shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zion-purple font-medium">{ExplorerTransactionsTransactionsPageClientCopy.failedToLoadTransactions[cs ? 'cs' : 'en']}</p>
              <p className="text-xs text-white/40 font-mono break-all">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setLoading(true); setPage(1); loadTransactions(1, false); }}
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition shrink-0"
            >
              {ExplorerTransactionsTransactionsPageClientCopy.retry[cs ? 'cs' : 'en']}
            </button>
          </div>
        )}

        {/* table card */}
        <div className="mt-6 zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          {/* table header */}
          <div className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] md:grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/6">
            <span />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTransactionsTransactionsPageClientCopy.type[cs ? 'cs' : 'en']}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTransactionsTransactionsPageClientCopy.age[cs ? 'cs' : 'en']}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerTransactionsTransactionsPageClientCopy.block[cs ? 'cs' : 'en']}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">Fee</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerTransactionsTransactionsPageClientCopy.amount[cs ? 'cs' : 'en']}</span>
          </div>

          {/* loading skeleton */}
          {loading && [...Array(12)].map((_, i) => (
            <div key={i} className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/3 animate-pulse">
              <div className="flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-white/10" /></div>
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
              <p className="text-white/30 text-sm">{ExplorerTransactionsTransactionsPageClientCopy.noTransactionsFound[cs ? 'cs' : 'en']}</p>
              {addressFilter && <Link href="/explorer/transactions" className="text-zion-cyan text-xs hover:underline">{ExplorerTransactionsTransactionsPageClientCopy.clearFilter[cs ? 'cs' : 'en']}</Link>}
            </div>
          )}

          {/* rows */}
          {!loading && transactions.map((tx, i) => (
            <Link
              key={`${tx.hash}-${i}`}
              href={`/explorer/tx?hash=${encodeURIComponent(tx.hash)}`}
              className="grid grid-cols-[32px_1fr_90px_80px_100px_80px_110px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors group"
            >
              {/* status */}
              <div className="flex items-center justify-center"><StatusDot status={tx.status} /></div>

              {/* hash */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-mono text-zion-cyan group-hover:text-cyan-200 truncate transition-colors">
                  {tx.hash.slice(0, 16)}…{tx.hash.slice(-8)}
                </span>
                <CopyBtn text={tx.hash} />
              </div>

              {/* type */}
              <div className="flex items-center"><TypeBadge type={tx.type || "transfer"} cs={cs} /></div>

              {/* age */}
              <div className="flex items-center text-[12px] text-white/40 tabular-nums">{timeAgo(tx.timestamp, cs)}</div>

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
                  <span className="text-[12px] text-zion-gold/60 italic">{ExplorerTransactionsTransactionsPageClientCopy.pending[cs ? 'cs' : 'en']}</span>
                )}
              </div>

              {/* fee */}
              <div className="flex items-center justify-end text-[12px] text-white/30 tabular-nums font-mono">
                {tx.fee > 0 ? tx.fee.toFixed(6) : "—"}
              </div>

              {/* amount */}
              <div className="flex items-center justify-end text-[13px] text-white font-semibold tabular-nums">
                {tx.amount > 0 ? `${tx.amount.toFixed(4)} ₿Z` : "—"}
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
                {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> {ExplorerTransactionsTransactionsPageClientCopy.loading[cs ? 'cs' : 'en']}</> : ExplorerTransactionsTransactionsPageClientCopy.loadMoreTransactions[cs ? 'cs' : 'en']}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
