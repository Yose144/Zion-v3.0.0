"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { type LucideIcon, Search, Box, ArrowRightLeft, Wallet, Hash, X, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

type SearchType = "block_height" | "block_hash" | "tx_hash" | "address" | "unknown";

interface ParsedQuery {
  value: string;
  forcedType?: SearchType;
}

interface SearchPreview {
  type: SearchType;
  label: string;
  icon: LucideIcon;
  href: string;
  meta?: string;
}

function parseQuery(q: string): ParsedQuery {
  const s = q.trim();
  if (!s) return { value: "" };

  const m = /^([a-z]+)\s*:\s*(.+)$/i.exec(s);
  if (!m) return { value: s };

  const prefix = m[1].toLowerCase();
  const value = m[2].trim();
  if (!value) return { value: "" };

  if (prefix === "block" || prefix === "b") return { value, forcedType: "block_hash" };
  if (prefix === "tx" || prefix === "t") return { value, forcedType: "tx_hash" };
  if (prefix === "addr" || prefix === "address" || prefix === "a") return { value, forcedType: "address" };

  return { value: s };
}

function detectType(q: string, forcedType?: SearchType): SearchType {
  if (forcedType) {
    if (forcedType === "block_hash" && /^\d+$/.test(q)) return "block_height";
    return forcedType;
  }
  const s = q.trim();
  if (/^\d+$/.test(s)) return "block_height";
  if (/^[a-fA-F0-9]{64}$/.test(s)) return "tx_hash"; // Could be block or tx hash
  if (/^(zion|ZION|Z)[a-zA-Z0-9]{40,}$/i.test(s)) return "address";
  if (/^zion_txid_/i.test(s)) return "tx_hash";
  if (/^[a-fA-F0-9]{10,}$/i.test(s)) return "block_hash";
  return "unknown";
}

function buildPreviews(query: string, cs: boolean): SearchPreview[] {
  const parsed = parseQuery(query);
  const s = parsed.value;
  if (!s) return [];

  const type = detectType(s, parsed.forcedType);
  const previews: SearchPreview[] = [];

  switch (type) {
    case "block_height":
      previews.push({
        type: "block_height",
        label: `${cs ? "Blok" : "Block"} #${parseInt(s).toLocaleString(cs ? "cs-CZ" : "en-US")}`,
        icon: Box,
        href: `/explorer/block?id=${s}`,
        meta: cs ? "Hledat podle výšky bloku" : "Search by block height",
      });
      break;
    case "tx_hash":
      previews.push({
        type: "tx_hash",
        label: `TX ${s.slice(0, 12)}…${s.slice(-8)}`,
        icon: ArrowRightLeft,
        href: `/explorer/tx?hash=${s}`,
        meta: cs ? "Hledat jako hash transakce" : "Search as transaction hash",
      });
      if (!parsed.forcedType || parsed.forcedType === "block_hash") {
        previews.push({
          type: "block_hash",
          label: `${cs ? "Blok" : "Block"} ${s.slice(0, 12)}…${s.slice(-8)}`,
          icon: Box,
          href: `/explorer/block?id=${s}`,
          meta: cs ? "Hledat jako hash bloku" : "Search as block hash",
        });
      }
      break;
    case "address":
      previews.push({
        type: "address",
        label: `${cs ? "Adresa" : "Address"} ${s.slice(0, 12)}…${s.slice(-8)}`,
        icon: Wallet,
        href: `/explorer/address?addr=${s}`,
        meta: cs ? "Hledat ZION adresu" : "Search ZION address",
      });
      break;
    case "block_hash":
      previews.push({
        type: "block_hash",
        label: `${cs ? "Hash" : "Hash"} ${s.slice(0, 12)}…`,
        icon: Hash,
        href: `/explorer/block?id=${s}`,
        meta: cs ? "Hledat podle hashe" : "Search by hash",
      });
      break;
    default:
      if (s.length > 2) {
        previews.push({
          type: "unknown",
          label: `${cs ? "Hledat" : "Search"} "${s.length > 20 ? s.slice(0, 20) + "…" : s}"`,
          icon: Search,
          href: `/explorer/block?id=${s}`,
          meta: cs ? "Zkusit hledat jako blok nebo tx" : "Try searching as block/tx",
        });
      }
  }

  return previews;
}

async function resolveTarget(query: string, fallbackHref?: string): Promise<string | undefined> {
  const parsed = parseQuery(query);
  const s = parsed.value;
  if (!s) return fallbackHref;

  const type = detectType(s, parsed.forcedType);

  if (type === "block_height") return `/explorer/block?id=${s}`;
  if (type === "address") return `/explorer/address?addr=${encodeURIComponent(s)}`;
  if (parsed.forcedType === "tx_hash") return `/explorer/tx?hash=${s}`;
  if (parsed.forcedType === "block_hash") return `/explorer/block?id=${s}`;

  // For 64-char hex: try to resolve via API; if ambiguous, go to search results
  if (/^[a-fA-F0-9]{64}$/.test(s)) {
    try {
      const tx = await apiClient<{ tx_hash?: string }>(`/blockchain/transactions?hash=${s}`);
      if (tx?.tx_hash) return `/explorer/tx?hash=${s}`;
    } catch {}

    try {
      const block = await apiClient<{ hash?: string }>(`/blockchain/block?hash=${s}`);
      if (block?.hash) return `/explorer/block?id=${s}`;
    } catch {}

    // Neither block nor tx found exactly — show search results
    return `/explorer/search?q=${encodeURIComponent(s)}`;
  }

  return fallbackHref || `/explorer/search?q=${encodeURIComponent(s)}`;
}

export default function ProSearchBar() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const previews = buildPreviews(query, cs);

  const handleSubmit = useCallback(
    async (href?: string) => {
      setLoading(true);
      try {
        const fallback = href || previews[selected]?.href;
        const target = await resolveTarget(query, fallback);
        if (!target) return;
        setFocused(false);
        router.push(target);
      } finally {
        setTimeout(() => setLoading(false), 400);
      }
    },
    [previews, selected, router, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, previews.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`relative flex items-center rounded-2xl border transition-all duration-300 ${
          focused
            ? "border-zion-cyan/40 bg-black/80 shadow-lg shadow-zion-cyan/5"
            : "border-white/10 bg-white/5 hover:border-white/20"
        }`}
      >
        <div className="flex items-center justify-center pl-4">
          {loading ? (
            <Loader2 className="h-4.5 w-4.5 text-zion-cyan animate-spin" />
          ) : (
            <Search className={`h-4.5 w-4.5 transition-colors ${focused ? "text-zion-cyan" : "text-gray-500"}`} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={cs ? "Hledat podle výšky bloku, hashe tx nebo adresy…" : "Search by block height, tx hash, or address…"}
          className="w-full bg-transparent px-3 py-3.5 text-sm text-white placeholder:text-gray-500 
            focus:outline-none font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSelected(0);
              inputRef.current?.focus();
            }}
            className="pr-3 text-gray-500 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="pr-3">
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 
            text-[10px] text-gray-500 font-mono bg-white/5">
            /
          </kbd>
        </div>
      </div>

      {/* Preview dropdown */}
      <AnimatePresence>
        {focused && previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/95 
              backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {previews.map((p, i) => (
              <button
                key={p.href}
                onClick={() => handleSubmit(p.href)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i === selected ? "bg-white/6" : "hover:bg-white/3"
                } ${i > 0 ? "border-t border-white/4" : ""}`}
              >
                <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${
                  i === selected ? "bg-zion-cyan/15" : "bg-white/5"
                }`}>
                  <p.icon className={`h-4 w-4 ${i === selected ? "text-zion-cyan" : "text-gray-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate font-mono">{p.label}</p>
                  <p className="text-[11px] text-gray-500">{p.meta}</p>
                </div>
                <span className="text-[10px] text-gray-600 uppercase tracking-wider shrink-0">
                  {i === selected ? (cs ? "Enter ↵" : "Enter ↵") : ""}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
        {[
          { label: "block:123456", value: "block:123456" },
          { label: cs ? "tx:<hash>" : "tx:<hash>", value: "tx:" },
          { label: cs ? "addr:<adresa>" : "addr:<address>", value: "addr:" },
        ].map((hint) => (
          <button
            key={hint.label}
            type="button"
            onClick={() => {
              setQuery(hint.value);
              setFocused(true);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10 transition"
          >
            {hint.label}
          </button>
        ))}
      </div>
    </div>
  );
}
