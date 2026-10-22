'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Box, Hash, Database, AlertCircle } from 'lucide-react';
import { useExplorerSSE } from '../hooks/useExplorerSSE';
import type { SseNewBlockEvent, SseStatsEvent } from '@/lib/explorer/types';
import { truncateHash, formatNumber, formatAge } from '@/lib/explorer/format';

interface BlockFeedItem extends SseNewBlockEvent {
  receivedAt: number;
  isNew: boolean;
}

export default function SseBlockFeed() {
  const { stats, lastNewBlock, connected, blockCount } = useExplorerSSE({ interval: 15, enabled: true });
  const [blocks, setBlocks] = useState<BlockFeedItem[]>([]);
  const [prevStats, setPrevStats] = useState<SseStatsEvent | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    if (stats && (!prevStats || stats.height !== prevStats.height)) {
      setPrevStats(stats);
    }
  }, [stats, prevStats]);

  useEffect(() => {
    if (!lastNewBlock) return;

    const item: BlockFeedItem = { ...lastNewBlock, receivedAt: Date.now(), isNew: true };
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.height !== item.height);
      const next = [item, ...filtered].slice(0, 25);
      return next;
    });

    // Mark as not-new after animation
    const timer = setTimeout(() => {
      setBlocks((prev) =>
        prev.map((b) => (b.height === item.height ? { ...b, isNew: false } : b))
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [lastNewBlock]);

  // Auto-scroll to top (newest blocks at top)
  useEffect(() => {
    if (feedRef.current && autoScroll.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [blocks]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop } = feedRef.current;
    autoScroll.current = scrollTop < 20;
  };

  return (
    <div className="zion-rainbow-card p-5 md:p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className="h-5 w-5 text-zion-gold" />
            {connected && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-zion-green animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Live Block Feed</h3>
            <p className="text-[11px] text-gray-500">New blocks via Server-Sent Events</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Chain height</div>
          <div className="text-lg font-bold text-zion-gold tabular-nums">
            {prevStats?.height ? formatNumber(prevStats.height) : '—'}
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        {connected ? (
          <>
            <span className="inline-flex h-2 w-2 rounded-full bg-zion-green" />
            <span className="text-zion-green">Connected</span>
            <span className="text-gray-600">· {blockCount} new block{blockCount !== 1 ? 's' : ''} since loaded</span>
          </>
        ) : (
          <>
            <span className="inline-flex h-2 w-2 rounded-full bg-zion-purple" />
            <span className="text-zion-purple">Connecting…</span>
          </>
        )}
      </div>

      {/* Block feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="max-h-[420px] overflow-y-auto pr-1 space-y-3"
      >
        <AnimatePresence initial={false}>
          {blocks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-white/5 bg-black/20 p-8 text-center"
            >
              <Activity className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {connected
                  ? 'Waiting for the next block…'
                  : 'Connecting to live feed…'}
              </p>
              {prevStats && (
                <p className="text-xs text-gray-600 mt-2">
                  Current tip: <span className="text-zion-gold">#{formatNumber(prevStats.height)}</span>
                </p>
              )}
            </motion.div>
          ) : (
            blocks.map((block, idx) => (
              <motion.div
                key={block.height}
                initial={{ opacity: 0, x: -20, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35 }}
                className={`
                  relative rounded-xl border p-4 transition-colors
                  ${block.isNew
                    ? 'border-zion-gold/40 bg-zion-gold/5'
                    : 'border-white/5 bg-black/20 hover:border-white/10'
                  }
                `}
              >
                {block.isNew && (
                  <div className="absolute right-3 top-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zion-gold/10 px-2 py-0.5 text-[10px] font-medium text-zion-gold">
                      <Zap className="h-3 w-3" /> NEW
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zion-gold/10">
                      <Box className="h-4 w-4 text-zion-gold" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Block <span className="text-zion-gold">#{formatNumber(block.height)}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {block.timestamp ? formatAge(block.timestamp) : 'just now'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-black/30 p-2.5">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <Hash className="h-3 w-3" /> Hash
                      </div>
                      <div className="font-mono text-zion-cyan truncate" title={block.hash}>
                        {truncateHash(block.hash, 8, 6)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2.5">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <Database className="h-3 w-3" /> TXs
                      </div>
                      <div className="font-mono text-white">
                        {block.tx_count ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
                    {block.difficulty > 0 && (
                      <span>Difficulty: <span className="text-gray-300">{formatNumber(block.difficulty)}</span></span>
                    )}
                    {block.reward > 0 && (
                      <span>Reward: <span className="text-zion-gold">{block.reward.toFixed(6)} ZION</span></span>
                    )}
                    {block.miner && (
                      <span className="truncate max-w-[200px]">Miner: <span className="text-gray-300">{truncateHash(block.miner, 6, 4)}</span></span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {!connected && blocks.length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zion-purple/20 bg-zion-purple/5 p-3 text-xs text-zion-purple">
          <AlertCircle className="h-4 w-4" />
          <span>Live feed disconnected. Reconnecting automatically…</span>
        </div>
      )}
    </div>
  );
}
