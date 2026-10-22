"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Clock,
  Code,
  Coins,
  Command,
  Compass,
  FileCode,
  Globe,
  Hash,
  Layers,
  Loader2,
  Radio,
  Search,
  ShieldCheck,
  Signal,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";

const RECENT_KEY = "zion-explorer-search-recent";
const MAX_RECENT = 6;

type SearchResultType = "block" | "transaction" | "address";

interface SearchResult {
  type: SearchResultType;
  href: string;
  title: string;
  meta: string;
}

interface PaletteItem {
  id: string;
  kind: "result" | "recent" | "quick";
  type?: SearchResultType | string;
  href?: string;
  query?: string;
  label: string;
  meta?: string;
  icon: typeof Search;
  group: string;
}

const ExplorerCommandPaletteCopy = {
  search: { cs: `Hledat v ZION Exploreru…`, en: `Search ZION Explorer…` },
  loading: { cs: `Hledám…`, en: `Searching…` },
  noResults: { cs: `Nic nenalezeno`, en: `Nothing found` },
  trySearchTip: { cs: `Zkuste výšku bloku, hash transakce, hash bloku nebo adresu.`, en: `Try block height, transaction hash, block hash, or address.` },
  openFullResults: { cs: `Zobrazit všechny výsledky`, en: `Show all results` },
  recent: { cs: `Nedávné`, en: `Recent` },
  quickLinks: { cs: `Rychlé odkazy`, en: `Quick links` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  addresses: { cs: `Adresy`, en: `Addresses` },
  help: { cs: `Tipy:`, en: `Tips:` },
  helpLine: { cs: `výška bloku · 64-char tx hash · ZION adresa · prefixy block:/tx:/addr:`, en: `block height · 64-char tx hash · ZION address · block:/tx:/addr: prefixes` },
  cmdK: { cs: `Ctrl K`, en: `⌘ K` },
  press: { cs: `pro vyhledávání`, en: `to search` },
};

const quickLinks = (cs: boolean): PaletteItem[] => {
  const group = ExplorerCommandPaletteCopy.quickLinks[cs ? "cs" : "en"];
  return [
    { id: "q-explorer", kind: "quick", href: "/explorer", label: cs ? "Přehled" : "Dashboard", icon: Compass, group },
    { id: "q-blocks", kind: "quick", href: "/explorer/blocks", label: cs ? "Bloky" : "Blocks", icon: Layers, group },
    { id: "q-txs", kind: "quick", href: "/explorer/txs", label: cs ? "TX Seznam" : "TX List", icon: Activity, group },
    { id: "q-mempool", kind: "quick", href: "/explorer/mempool", label: "Mempool", icon: Boxes, group },
    { id: "q-tokens", kind: "quick", href: "/explorer/tokens", label: cs ? "Tokeny" : "Tokens", icon: Coins, group },
    { id: "q-richlist", kind: "quick", href: "/explorer/richlist", label: "Rich List", icon: TrendingUp, group },
    { id: "q-supply", kind: "quick", href: "/explorer/supply", label: cs ? "Emise" : "Supply", icon: BarChart3, group },
    { id: "q-charts", kind: "quick", href: "/explorer/charts", label: cs ? "Grafy" : "Charts", icon: BarChart3, group },
    { id: "q-miners", kind: "quick", href: "/explorer/miners", label: cs ? "Mineři" : "Miners", icon: ShieldCheck, group },
    { id: "q-status", kind: "quick", href: "/explorer/status", label: "Status", icon: Signal, group },
    { id: "q-network", kind: "quick", href: "/explorer/network-stats", label: cs ? "Síť" : "Network", icon: Globe, group },
    { id: "q-contracts", kind: "quick", href: "/explorer/contracts", label: cs ? "Kontrakty" : "Contracts", icon: FileCode, group },
    { id: "q-broadcast", kind: "quick", href: "/explorer/broadcast", label: "Broadcast", icon: Radio, group },
    { id: "q-api", kind: "quick", href: "/explorer/api-docs", label: "API", icon: Code, group },
  ];
};

const typeIcons: Record<SearchResultType, typeof Search> = {
  block: Hash,
  transaction: ArrowRightLeft,
  address: Wallet,
};

const typeColors: Record<string, { text: string; border: string; bg: string; group: string }> = {
  block: { text: "text-zion-gold", border: "border-zion-gold/20", bg: "bg-zion-gold/10", group: "blocks" },
  transaction: { text: "text-zion-cyan", border: "border-zion-cyan/20", bg: "bg-zion-cyan/10", group: "transactions" },
  address: { text: "text-zion-purple", border: "border-zion-purple/20", bg: "bg-zion-purple/10", group: "addresses" },
};

function labelForType(type: string, cs: boolean): string {
  if (type === "block") return ExplorerCommandPaletteCopy.blocks[cs ? "cs" : "en"];
  if (type === "transaction") return ExplorerCommandPaletteCopy.transactions[cs ? "cs" : "en"];
  if (type === "address") return ExplorerCommandPaletteCopy.addresses[cs ? "cs" : "en"];
  return type;
}

export default function ExplorerCommandPalette() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);

  // Load recent searches
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setRecent(parsed.filter(Boolean).slice(0, MAX_RECENT));
      }
    } catch {}
  }, []);

  const saveRecent = useCallback((q: string) => {
    if (typeof window === "undefined" || !q.trim()) return;
    setRecent((prev) => {
      const next = [q.trim(), ...prev.filter((r) => r !== q.trim())].slice(0, MAX_RECENT);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  // Fetch search results
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<{ query: string; results: SearchResult[] }>(
        `/blockchain/search?q=${encodeURIComponent(q.trim())}`
      );
      setResults(res?.results ?? []);
    } catch (e) {
      setError(ExplorerCommandPaletteCopy.noResults[cs ? "cs" : "en"]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [cs]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelected(0);
    if (!query.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void doSearch(query);
    }, 180);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    if (open) {
      // small delay to ensure focus after animation
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Build flat list for keyboard navigation
  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];
    if (!query.trim()) {
      list.push(...quickLinks(cs));
      recent.forEach((r, i) => {
        list.push({
          id: `recent-${i}-${r}`,
          kind: "recent",
          query: r,
          label: r,
          icon: Clock,
          meta: ExplorerCommandPaletteCopy.recent[cs ? "cs" : "en"],
          group: ExplorerCommandPaletteCopy.recent[cs ? "cs" : "en"],
        });
      });
      return list;
    }

    // if there are results, group them; otherwise "show all results" fallback
    if (results.length > 0) {
      const currentQuery = query.trim();
      results.forEach((r, i) => {
        const Icon = typeIcons[r.type] || Search;
        list.push({
          id: `result-${i}-${r.href}`,
          kind: "result",
          type: r.type,
          href: r.href,
          query: currentQuery,
          label: r.title,
          meta: r.meta,
          icon: Icon,
          group: labelForType(r.type, cs),
        });
      });
    }
    return list;
  }, [query, results, recent, cs]);

  useEffect(() => {
    if (items.length === 0) {
      setSelected(0);
    } else if (selected >= items.length) {
      setSelected(Math.max(items.length - 1, 0));
    }
  }, [items.length, selected]);

  const executeItem = useCallback((item: PaletteItem) => {
    if (item.kind === "quick" || item.kind === "result") {
      if (item.href) {
        setOpen(false);
        if (item.kind === "result" && item.query) saveRecent(item.query);
        router.push(item.href);
      }
    } else if (item.kind === "recent") {
      if (item.query) {
        setOpen(false);
        saveRecent(item.query);
        router.push(`/explorer/search?q=${encodeURIComponent(item.query)}`);
      }
    }
  }, [router, saveRecent]);

  // Keyboard navigation within palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selected];
      if (item) {
        executeItem(item);
      } else if (query.trim()) {
        setOpen(false);
        saveRecent(query);
        router.push(`/explorer/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }, [items, selected, query, router, saveRecent, executeItem]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setOpen(false);
    }
  };

  // Scroll selected into view
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 transition-all hover:border-white/25 hover:text-white hover:bg-white/10"
        aria-label={ExplorerCommandPaletteCopy.search[cs ? "cs" : "en"]}
      >
        <Search className="h-4 w-4 text-zion-cyan" />
        <span className="hidden md:inline text-sm">{ExplorerCommandPaletteCopy.search[cs ? "cs" : "en"]}</span>
        <kbd className="hidden xl:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500 font-mono">
          <Command className="h-2.5 w-2.5" />
          <span>K</span>
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-20 md:pt-28"
          >
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header / input */}
              <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3.5">
                {loading ? (
                  <Loader2 className="h-5 w-5 shrink-0 text-zion-cyan animate-spin" />
                ) : (
                  <Search className="h-5 w-5 shrink-0 text-zion-cyan" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={ExplorerCommandPaletteCopy.search[cs ? "cs" : "en"]}
                  className="flex-1 bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                {query ? (
                  <button
                    onClick={() => {
                      setQuery("");
                      setSelected(0);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg p-1 text-gray-500 hover:text-white hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-gray-500 hover:text-white hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Content */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {loading && results.length === 0 && (
                  <div className="flex items-center gap-3 px-4 py-8 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin text-zion-cyan" />
                    {ExplorerCommandPaletteCopy.loading[cs ? "cs" : "en"]}
                  </div>
                )}

                {!loading && query.trim() && results.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">{ExplorerCommandPaletteCopy.noResults[cs ? "cs" : "en"]}</p>
                    <p className="mt-1 text-xs text-gray-600 max-w-md mx-auto">{ExplorerCommandPaletteCopy.trySearchTip[cs ? "cs" : "en"]}</p>
                    <button
                      onClick={() => {
                        setOpen(false);
                        saveRecent(query);
                        router.push(`/explorer/search?q=${encodeURIComponent(query.trim())}`);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zion-cyan/20 bg-zion-cyan/5 px-4 py-2 text-sm font-medium text-zion-cyan hover:bg-zion-cyan/10 transition"
                    >
                      <Search className="h-4 w-4" />
                      {ExplorerCommandPaletteCopy.openFullResults[cs ? "cs" : "en"]}
                    </button>
                  </div>
                )}

                {/* Items */}
                {items.length > 0 && (
                  <div className="space-y-4 p-2">
                    {(() => {
                      // group items by `group`
                      const groups: Record<string, PaletteItem[]> = {};
                      items.forEach((it) => {
                        if (!groups[it.group]) groups[it.group] = [];
                        groups[it.group].push(it);
                      });
                      return Object.entries(groups).map(([groupName, groupItems]) => (
                        <div key={groupName}>
                          <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                            {groupName}
                          </h3>
                          <div className="space-y-1">
                            {groupItems.map((item) => {
                              const idx = items.findIndex((i) => i.id === item.id);
                              const isSelected = idx === selected;
                              const Icon = item.icon;
                              const colors = item.type ? typeColors[item.type as string] : undefined;
                              return (
                                <button
                                  key={item.id}
                                  ref={isSelected ? selectedRef : undefined}
                                  onClick={() => executeItem(item)}
                                  onMouseEnter={() => setSelected(idx)}
                                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                                    isSelected ? "bg-white/8" : "hover:bg-white/5"
                                  }`}
                                >
                                  <div className={`flex items-center justify-center h-9 w-9 shrink-0 rounded-xl ${colors ? colors.bg : (isSelected ? "bg-white/8" : "bg-white/5")} ${colors ? colors.border : "border-transparent"} border`}>
                                    <Icon className={`h-5 w-5 ${colors ? colors.text : (isSelected ? "text-zion-cyan" : "text-gray-500")}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate font-mono">{item.label}</p>
                                    {item.meta && <p className="text-[11px] text-gray-500 truncate">{item.meta}</p>}
                                  </div>
                                  {item.kind === "quick" && <span className="text-[10px] text-gray-600 uppercase tracking-wider">↵</span>}
                                  {item.kind === "recent" && <span className="text-[10px] text-gray-600 uppercase tracking-wider">↵</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {!query.trim() && recent.length === 0 && items.length > 0 && (
                  <div className="px-4 py-4 text-[10px] text-gray-600">
                    {ExplorerCommandPaletteCopy.help[cs ? "cs" : "en"]} {ExplorerCommandPaletteCopy.helpLine[cs ? "cs" : "en"]}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 bg-white/3 px-4 py-2.5 text-[10px] text-gray-500">
                <div className="hidden sm:flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 bg-white/5 px-1">↑</kbd> <kbd className="rounded border border-white/10 bg-white/5 px-1">↓</kbd> {cs ? "navigace" : "navigate"}</span>
                  <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 bg-white/5 px-1">↵</kbd> {cs ? "otevřít" : "open"}</span>
                  <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 bg-white/5 px-1">esc</kbd> {cs ? "zavřít" : "close"}</span>
                </div>
                <div className="ml-auto">
                  ZION TerraNova {SITE_RELEASE_LABEL} — {ExplorerCommandPaletteCopy.search[cs ? "cs" : "en"]}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
