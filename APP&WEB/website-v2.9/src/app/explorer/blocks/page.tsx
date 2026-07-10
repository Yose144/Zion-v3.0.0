"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, ChevronDown, Copy, Check, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from "@/hooks/usePolling";
import { exportToCsv } from "@/lib/csv-export";

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  num_txes: number;
  transactions: number;
  reward: number;
  difficulty: number;
  block_size: number;
  miner?: string;
}

const fmtAge = (ts: number, cs: boolean): string => {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return cs ? `před ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `před ${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return cs ? `před ${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return cs ? `před ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
};
const fmtSize = (b: number): string => {
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
};
const fmtDiff = (d: number): string => {
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)}T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)}G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)}M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(1)}k`;
  return d.toLocaleString();
};

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-gray-600 hover:text-white transition ml-1.5 shrink-0">
      {ok ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function BlocksPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [, setTick] = useState(0);

  const loadBlocks = useCallback(async (pageNum: number, append: boolean) => {
    try {
      if (append) setLoadingMore(true);
      const offset = (pageNum - 1) * 50;
      const data = await apiClient<any[]>(`/blockchain/blocks?limit=50&offset=${offset}`);
      const arr = Array.isArray(data) ? data : [];
      if (append) setBlocks(prev => [...prev, ...arr]);
      else setBlocks(arr);
      setHasMore(arr.length === 50);
    } catch { setHasMore(false); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { loadBlocks(1, false); }, [loadBlocks]);

  usePolling(() => setTick((tick) => tick + 1), 1000);

  const handleExportCsv = () => {
    const headers = ["height", "timestamp", "hash", "txs", "size", "difficulty", "reward", "miner"];
    const rows = blocks.map((b) => [
      b.height,
      b.timestamp,
      b.hash,
      (b.num_txes || 0) + 1,
      b.block_size || 0,
      b.difficulty,
      b.reward,
      b.miner || "",
    ]);
    exportToCsv(`zion-blocks-page-${page}.csv`, headers, rows);
  };

  return (
    <div className="">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-zion-gold/10 via-transparent to-transparent" />

      <div className="relative z-10 zion-container py-10 max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/explorer" className="text-gray-500 hover:text-white transition">Explorer</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">{cs ? 'Bloky' : 'Blocks'}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-zion-gold/10 flex items-center justify-center shrink-0">
            <Box className="h-6 w-6 text-zion-gold" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{cs ? 'Archiv bloku' : 'Block Archive'}</h1>
            <p className="text-sm text-gray-500">{cs ? 'Kompletní historie blockchainových bloků ZION' : 'Complete history of ZION blockchain blocks'}</p>
          </div>
        </div>

        {/* Table */}
        <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">{cs ? 'Výška' : 'Height'}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">{cs ? 'Stáří' : 'Age'}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden md:table-cell">Hash</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">Txs</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden sm:table-cell">{cs ? 'Velikost' : 'Size'}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden lg:table-cell">{cs ? 'Obtížnost' : 'Difficulty'}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">{cs ? 'Odměna' : 'Reward'}</th>
                </tr>
              </thead>
              <tbody>
                {loading && blocks.length === 0
                  ? [...Array(20)].map((_, i) => (
                      <tr key={i} className="border-b border-white/3">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="px-3 py-3 first:px-6 last:px-6">
                            <div className="h-4 bg-white/5 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : blocks.map((block) => (
                      <tr key={block.height} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                        <td className="px-6 py-3">
                          <Link href={`/explorer/block?id=${block.height}`}
                            className="text-zion-cyan hover:text-white transition font-mono font-semibold text-sm">
                            {block.height.toLocaleString()}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-gray-400 text-xs tabular-nums whitespace-nowrap">{fmtAge(block.timestamp, cs)}</span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <div className="flex items-center">
                            <Link href={`/explorer/block?id=${block.height}`}
                              className="text-gray-500 hover:text-gray-300 transition font-mono text-xs">
                              {block.hash ? `${block.hash.slice(0, 10)}…${block.hash.slice(-8)}` : "—"}
                            </Link>
                            {block.hash && <CopyBtn text={block.hash} />}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-xs font-medium tabular-nums ${(block.num_txes || 0) > 0 ? "text-emerald-400" : "text-gray-500"}`}>
                            {(block.num_txes || 0) > 0 ? (block.num_txes + 1) : "1"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          <span className="text-gray-500 text-xs tabular-nums">{fmtSize(block.block_size || 0)}</span>
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">
                          <span className="text-gray-500 text-xs font-mono tabular-nums">{fmtDiff(block.difficulty)}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-zion-gold text-xs font-semibold tabular-nums">{block.reward.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
                          <span className="text-gray-600 text-[10px] ml-1">ZION</span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Footer / Load More */}
          <div className="px-6 py-4 border-t border-white/4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-[11px] text-gray-600">
              {cs ? `Zobrazeno ${blocks.length} bloků` : `Showing ${blocks.length} blocks`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                disabled={blocks.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 disabled:opacity-50 transition"
              >
                <Download className="h-3.5 w-3.5" />
                {cs ? 'Export CSV' : 'Export CSV'}
              </button>
              {hasMore && (
                <button
                  onClick={() => { const np = page + 1; setPage(np); loadBlocks(np, true); }}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 disabled:opacity-50 transition"
                >
                  {loadingMore ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {cs ? 'Načíst další' : 'Load More'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}