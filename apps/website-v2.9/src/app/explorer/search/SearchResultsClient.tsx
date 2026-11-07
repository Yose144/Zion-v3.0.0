"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRightLeft,
  Box,
  Hash,
  Layers,
  Loader2,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { tx5, t5 } from '@/lib/i18n-tx';
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";

const ExplorerSearchSearchResultsClientCopy = {
  searchError: { cs: `Chyba při hledání`, en: `Search error` },
  search: { cs: `Hledání`, en: `Search` },
  searchResults: { cs: `Výsledky hledání`, en: `Search Results` },
  searching: { cs: `Hledám…`, en: `Searching…` },
  nothingFound: { cs: `Nic nebylo nalezeno`, en: `Nothing found` },
  trySearchingByBlockHeightTrans: { cs: `Zkuste hledat podle výšky bloku, hashe transakce nebo ZION adresy.`, en: `Try searching by block height, transaction hash, or ZION address.` },
  all: { cs: `Vše`, en: `All` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  addresses: { cs: `Adresy`, en: `Addresses` },
  filterByType: { cs: `Filtrovat podle typu`, en: `Filter by type` },
};

interface SearchResult {
  type: "block" | "transaction" | "address";
  href: string;
  title: string;
  meta: string;
  data?: Record<string, unknown>;
}

export default function SearchResultsClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'block' | 'transaction' | 'address'>('all');

  const fetchResults = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await apiClient<{ query: string; results: SearchResult[]; hint?: string }>(
        `/blockchain/search?q=${encodeURIComponent(query)}`
      );
      setResults(res?.results ?? []);
      setHint(res?.hint ?? null);
    } catch (e) {
      setError(tx5(ExplorerSearchSearchResultsClientCopy.searchError, lang));
    } finally {
      setLoading(false);
    }
  }, [query, cs]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const filteredResults = filter === "all" ? results : results.filter((r) => r.type === filter);

  const grouped: Record<string, SearchResult[]> = {
    block: filteredResults.filter((r) => r.type === "block"),
    transaction: filteredResults.filter((r) => r.type === "transaction"),
    address: filteredResults.filter((r) => r.type === "address"),
  };

  const counts: Record<string, number> = {
    all: results.length,
    block: results.filter((r) => r.type === "block").length,
    transaction: results.filter((r) => r.type === "transaction").length,
    address: results.filter((r) => r.type === "address").length,
  };

  const icons = {
    block: Box,
    transaction: ArrowRightLeft,
    address: Wallet,
  };

  const colors: Record<string, { text: string; border: string; bg: string }> = {
    block: { text: "text-zion-gold", border: "border-zion-gold/20", bg: "bg-zion-gold/5" },
    transaction: { text: "text-zion-cyan", border: "border-zion-cyan/20", bg: "bg-zion-cyan/5" },
    address: { text: "text-zion-purple", border: "border-zion-purple/20", bg: "bg-zion-purple/5" },
  };

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-10 pt-6">
        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase mb-4">
            <Search className="h-4 w-4" />
            {SITE_RELEASE_LABEL} · {tx5(ExplorerSearchSearchResultsClientCopy.search, lang)}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-gradient">
            {tx5(ExplorerSearchSearchResultsClientCopy.searchResults, lang)}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <Hash className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-white font-mono">{query || "—"}</span>
            </div>
            {loading && <Loader2 className="h-5 w-5 text-zion-cyan animate-spin" />}
          </div>

          {/* Type filter */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {(['all', 'block', 'transaction', 'address'] as const).map((f) => {
              const active = filter === f;
              const label = f === 'all' ? tx5(ExplorerSearchSearchResultsClientCopy.all, lang)
                : f === 'block' ? tx5(ExplorerSearchSearchResultsClientCopy.blocks, lang)
                : f === 'transaction' ? tx5(ExplorerSearchSearchResultsClientCopy.transactions, lang)
                : tx5(ExplorerSearchSearchResultsClientCopy.addresses, lang);
              const count = counts[f] ?? 0;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  disabled={count === 0 && !active}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'zion-rainbow-sub text-white'
                      : count === 0
                        ? 'border border-white/5 bg-white/3 text-gray-600 cursor-not-allowed'
                        : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                  }`}
                  style={active ? ({ '--rc': '6, 105, 40' } as React.CSSProperties) : undefined}
                >
                  <span>{label}</span>
                  <span className={`text-[11px] rounded-md px-1.5 py-0.5 ${active ? 'bg-black/30 text-white' : 'bg-white/5 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Results */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-zion-cyan animate-spin" />
              <p className="text-sm text-gray-400">{tx5(ExplorerSearchSearchResultsClientCopy.searching, lang)}</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-zion-purple/20 bg-zion-purple/5 p-6 text-center">
              <X className="h-6 w-6 text-zion-purple mx-auto mb-2" />
              <p className="text-sm text-zion-purple">{error}</p>
            </div>
          )}

          {!loading && !error && results.length === 0 && query && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Search className="h-10 w-10 text-gray-600" />
              <p className="text-gray-400">{tx5(ExplorerSearchSearchResultsClientCopy.nothingFound, lang)}</p>
              <p className="text-xs text-gray-600 max-w-md text-center">
                {hint || tx5(ExplorerSearchSearchResultsClientCopy.trySearchingByBlockHeightTrans, lang)}
              </p>
            </div>
          )}

          {!loading && !error && results.length > 0 && hint && (
            <div className="mb-4 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 px-4 py-3 text-xs text-zion-gold/80">
              {hint}
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(grouped).map(([type, items]) => {
              if (items.length === 0) return null;
              const Icon = icons[type as keyof typeof icons] || Search;
              const col = colors[type] || colors.block;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-4 w-4 ${col.text}`} />
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                      {type === "block" ? (tx5(ExplorerSearchSearchResultsClientCopy.blocks, lang))
                        : type === "transaction" ? (tx5(ExplorerSearchSearchResultsClientCopy.transactions, lang))
                        : (tx5(ExplorerSearchSearchResultsClientCopy.addresses, lang))}
                    </h2>
                    <span className="text-[11px] text-gray-500 ml-2">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-4 rounded-2xl border ${col.border} ${col.bg} p-4 hover:border-white/20 transition-colors`}
                      >
                        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${col.bg} border ${col.border}`}>
                          <Icon className={`h-5 w-5 ${col.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.meta}</p>
                        </div>
                        <Layers className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Search` : t5(`ZION TerraNova ${SITE_RELEASE_LABEL} — Search`, lang)}
        </p>
      </div>
    </div>
  );
}
