"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
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
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";

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

  const fetchResults = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<{ query: string; results: SearchResult[] }>(
        `/blockchain/search?q=${encodeURIComponent(query)}`
      );
      setResults(res?.results ?? []);
    } catch (e) {
      setError(cs ? "Chyba při hledání" : "Search error");
    } finally {
      setLoading(false);
    }
  }, [query, cs]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const grouped: Record<string, SearchResult[]> = {
    block: results.filter((r) => r.type === "block"),
    transaction: results.filter((r) => r.type === "transaction"),
    address: results.filter((r) => r.type === "address"),
  };

  const icons = {
    block: Box,
    transaction: ArrowRightLeft,
    address: Wallet,
  };

  const colors: Record<string, { text: string; border: string; bg: string }> = {
    block: { text: "text-zion-gold", border: "border-zion-gold/20", bg: "bg-zion-gold/5" },
    transaction: { text: "text-zion-cyan", border: "border-zion-cyan/20", bg: "bg-zion-cyan/5" },
    address: { text: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/5" },
  };

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-10">
        {/* Back link */}
        <Link href="/explorer" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? "Zpět do průzkumníka" : "Back to Explorer"}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase mb-4">
            <Search className="h-4 w-4" />
            {SITE_RELEASE_LABEL} · {cs ? "Hledání" : "Search"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-gradient">
            {cs ? "Výsledky hledání" : "Search Results"}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <Hash className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-white font-mono">{query || "—"}</span>
            </div>
            {loading && <Loader2 className="h-5 w-5 text-zion-cyan animate-spin" />}
          </div>
        </motion.section>

        {/* Results */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-zion-cyan animate-spin" />
              <p className="text-sm text-gray-400">{cs ? "Hledám…" : "Searching…"}</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <X className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && results.length === 0 && query && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Search className="h-10 w-10 text-gray-600" />
              <p className="text-gray-400">{cs ? "Nic nebylo nalezeno" : "Nothing found"}</p>
              <p className="text-xs text-gray-600 max-w-md text-center">
                {cs
                  ? "Zkuste hledat podle výšky bloku, hashe transakce nebo ZION adresy."
                  : "Try searching by block height, transaction hash, or ZION address."}
              </p>
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
                      {type === "block" ? (cs ? "Bloky" : "Blocks")
                        : type === "transaction" ? (cs ? "Transakce" : "Transactions")
                        : (cs ? "Adresy" : "Addresses")}
                    </h2>
                    <span className="text-[10px] text-gray-500 ml-2">{items.length}</span>
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
          {cs ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Search` : `ZION TerraNova ${SITE_RELEASE_LABEL} — Search`}
        </p>
      </div>
    </div>
  );
}
