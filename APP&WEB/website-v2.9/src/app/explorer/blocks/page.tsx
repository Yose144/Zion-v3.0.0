"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Box, ChevronDown, Copy, Check, ArrowLeft, Download, AlertCircle } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from "@/hooks/usePolling";
import { exportToCsv } from "@/lib/csv-export";
import { useExplorerSSE } from "@/components/explorer/v4/hooks/useExplorerSSE";
import LiveBadge from "@/components/explorer/v4/shared/LiveBadge";

const ExplorerBlocksCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  blockArchive: { cs: `Archiv bloku`, en: `Block Archive` },
  completeHistoryOfZionBlockchai: { cs: `Kompletní historie blockchainových bloků ZION`, en: `Complete history of ZION blockchain blocks` },
  live: { cs: `Živě`, en: `Live` },
  offline: { cs: `Offline`, en: `Offline` },
  failedToLoad: { cs: `Chyba načítání`, en: `Failed to load` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  height: { cs: `Výška`, en: `Height` },
  age: { cs: `Stáří`, en: `Age` },
  size: { cs: `Velikost`, en: `Size` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  reward: { cs: `Odměna`, en: `Reward` },
  exportCsv: { cs: `Export CSV`, en: `Export CSV` },
  loadMore: { cs: `Načíst další`, en: `Load More` },
};

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
      className="text-gray-600 hover:text-white transition ml-1.5 shrink-0"
      aria-label={ok ? 'Copied' : 'Copy'}
      title={ok ? 'Copied' : 'Copy'}>
      {ok ? <Check className="h-3 w-3 text-zion-cyan" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function BlocksPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = ExplorerBlocksCopy.enUs[cs ? 'cs' : 'en'];
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // SSE for real-time new block notifications
  const sse = useExplorerSSE({ interval: 15 });
  const knownHeights = useRef<Set<number>>(new Set());

  // When SSE reports a new block height higher than our top block, fetch + prepend it
  useEffect(() => {
    if (!sse.stats) return;
    const sseHeight = sse.stats.height;
    if (sseHeight <= 0) return;
    setBlocks(prev => {
      if (prev.length === 0) return prev; // wait for initial load
      const topHeight = prev[0]?.height ?? 0;
      if (sseHeight <= topHeight) return prev;
      // Collect heights we need to fetch (between topHeight+1 and sseHeight)
      const missing: number[] = [];
      for (let h = sseHeight; h > topHeight; h--) {
        if (!knownHeights.current.has(h)) missing.push(h);
      }
      if (missing.length === 0) return prev;
      // Fetch missing blocks asynchronously
      (async () => {
        try {
          // Fetch the most recent missing block (others will come on next tick)
          const h = missing[0];
          const data = await apiClient<any>(`/blockchain/block?height=${h}`);
          if (data && data.height) {
            const newBlock: Block = {
              height: data.height,
              hash: data.hash,
              timestamp: data.timestamp,
              num_txes: (data.num_txes ?? data.tx_count ?? 0) - 1,
              transactions: data.num_txes ?? data.tx_count ?? 0,
              reward: data.reward ?? 0,
              difficulty: data.difficulty ?? 0,
              block_size: data.block_size ?? 0,
              miner: data.miner ?? data.miner_address ?? '',
            };
            knownHeights.current.add(data.height);
            setBlocks(cur => {
              if (cur.some(b => b.height === newBlock.height)) return cur;
              const next = [newBlock, ...cur];
              return next.slice(0, 500); // cap at 500 rows
            });
          }
        } catch { /* ignore — next SSE tick will retry */ }
      })();
      return prev;
    });
  }, [sse.stats?.height]);

  const loadBlocks = useCallback(async (pageNum: number, append: boolean) => {
    try {
      setError(null);
      if (append) setLoadingMore(true);
      const offset = (pageNum - 1) * 50;
      const data = await apiClient<any[]>(`/blockchain/blocks?limit=50&offset=${offset}`);
      const arr = Array.isArray(data) ? data : [];
      if (append) setBlocks(prev => [...prev, ...arr]);
      else setBlocks(arr);
      arr.forEach(b => knownHeights.current.add(b.height));
      setHasMore(arr.length === 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load blocks');
      setHasMore(false);
    } finally { setLoading(false); setLoadingMore(false); }
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
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-zion-gold/10 via-transparent to-transparent" />

      <div className="relative z-10 zion-container py-10 pt-6 max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/explorer" className="text-gray-500 hover:text-white transition">Explorer</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">{ExplorerBlocksCopy.blocks[cs ? 'cs' : 'en']}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-2xl bg-zion-gold/10 flex items-center justify-center shrink-0">
            <Box className="h-6 w-6 text-zion-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{ExplorerBlocksCopy.blockArchive[cs ? 'cs' : 'en']}</h1>
            <p className="text-sm text-gray-500">{ExplorerBlocksCopy.completeHistoryOfZionBlockchai[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sse.connected ? (
              <LiveBadge label={ExplorerBlocksCopy.live[cs ? 'cs' : 'en']} />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-500" />
                </span>
                <span className="text-xs font-bold text-gray-500 tracking-wider">{ExplorerBlocksCopy.offline[cs ? 'cs' : 'en']}</span>
              </span>
            )}
            {sse.blockCount > 0 && (
              <span className="text-[10px] text-zion-cyan tabular-nums">
                {cs ? `+${sse.blockCount} nové` : `+${sse.blockCount} new`}
              </span>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="zion-rainbow-sub px-4 py-3 flex items-center gap-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <AlertCircle className="h-5 w-5 text-zion-purple shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zion-purple font-medium">{ExplorerBlocksCopy.failedToLoad[cs ? 'cs' : 'en']}</p>
              <p className="text-xs text-gray-500 font-mono break-all">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setLoading(true); loadBlocks(1, false); }}
              className="zion-button-secondary text-xs py-1.5 px-3 shrink-0"
            >
              {ExplorerBlocksCopy.retry[cs ? 'cs' : 'en']}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">{ExplorerBlocksCopy.height[cs ? 'cs' : 'en']}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">{ExplorerBlocksCopy.age[cs ? 'cs' : 'en']}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden md:table-cell">Hash</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">Txs</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden sm:table-cell">{ExplorerBlocksCopy.size[cs ? 'cs' : 'en']}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden lg:table-cell">{ExplorerBlocksCopy.difficulty[cs ? 'cs' : 'en']}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">{ExplorerBlocksCopy.reward[cs ? 'cs' : 'en']}</th>
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
                          <span className={`text-xs font-medium tabular-nums ${(block.num_txes || 0) > 0 ? "text-zion-cyan" : "text-gray-500"}`}>
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
                className="zion-button-secondary text-xs py-2 px-4"
              >
                <Download className="h-3.5 w-3.5" />
                {ExplorerBlocksCopy.exportCsv[cs ? 'cs' : 'en']}
              </button>
              {hasMore && (
                <button
                  onClick={() => { const np = page + 1; setPage(np); loadBlocks(np, true); }}
                  disabled={loadingMore}
                  className="zion-button-secondary text-xs py-2 px-4"
                >
                  {loadingMore ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {ExplorerBlocksCopy.loadMore[cs ? 'cs' : 'en']}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}