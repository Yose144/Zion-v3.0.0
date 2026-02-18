"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { motion } from "framer-motion";
import { Box, ChevronRight, Copy, Check } from "lucide-react";

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  num_txes: number;
  transactions: number;
  reward: number;
  difficulty: number;
  block_size: number;
  nonce: number;
  orphan_status: boolean;
}

const fmtAge = (ts: number): string => {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const fmtSize = (b: number): string => {
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
};

const truncHash = (h: string, len = 8): string =>
  h ? `${h.slice(0, len)}…${h.slice(-len)}` : "—";

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
      className="text-gray-600 hover:text-white transition ml-1.5 flex-shrink-0"
      title="Copy hash"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function ProRecentBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchBlocks = useCallback(async () => {
    try {
      const json = await apiClient<any>("/blockchain/blocks?limit=15");
      setBlocks(Array.isArray(json) ? json : json.blocks || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
    const iv = setInterval(fetchBlocks, 10000);
    return () => clearInterval(iv);
  }, [fetchBlocks]);

  // Re-render ages every second
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-[28px] border border-white/[0.08] bg-black/60 backdrop-blur-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-gold/10">
            <Box className="h-4.5 w-4.5 text-zion-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Latest Blocks</h3>
            <p className="text-[11px] text-gray-500">Real-time block feed</p>
          </div>
        </div>
        <Link
          href="/explorer/blocks"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-zion-cyan transition-colors font-medium"
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">Height</th>
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Age</th>
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden md:table-cell">Hash</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Txs</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden sm:table-cell">Size</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden lg:table-cell">Difficulty</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">Reward</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-3 py-3 first:px-6 last:px-6">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : blocks.slice(0, 15).map((block, i) => (
                  <motion.tr
                    key={block.height}
                    initial={i === 0 ? { backgroundColor: "rgba(255,215,0,0.08)" } : {}}
                    animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                    transition={{ duration: 3 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/explorer/block?id=${block.height}`}
                        className="text-zion-cyan hover:text-white transition-colors font-mono font-semibold text-sm"
                      >
                        {block.height.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-gray-400 text-xs tabular-nums whitespace-nowrap">
                        {fmtAge(block.timestamp)}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex items-center">
                        <Link
                          href={`/explorer/block?id=${block.height}`}
                          className="text-gray-500 hover:text-gray-300 transition font-mono text-xs"
                        >
                          {truncHash(block.hash, 10)}
                        </Link>
                        <CopyBtn text={block.hash} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-medium tabular-nums ${block.num_txes > 0 ? "text-emerald-400" : "text-gray-500"}`}>
                        {block.num_txes > 0 ? `${block.num_txes + 1}` : "1"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-gray-500 text-xs tabular-nums">
                        {fmtSize(block.block_size)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell">
                      <span className="text-gray-500 text-xs font-mono tabular-nums">
                        {block.difficulty >= 1e9
                          ? `${(block.difficulty / 1e9).toFixed(2)}G`
                          : block.difficulty >= 1e6
                          ? `${(block.difficulty / 1e6).toFixed(2)}M`
                          : block.difficulty.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-zion-gold text-xs font-semibold tabular-nums">
                        {block.reward.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-gray-600 text-[10px] ml-1">ZION</span>
                    </td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!loading && blocks.length > 0 && (
        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-[11px] text-gray-600">
            Showing {Math.min(15, blocks.length)} latest blocks · Auto-refresh 10s
          </p>
          <Link
            href="/explorer/blocks"
            className="text-[11px] text-zion-cyan hover:text-white transition font-medium"
          >
            Full Block Archive →
          </Link>
        </div>
      )}
    </motion.div>
  );
}
