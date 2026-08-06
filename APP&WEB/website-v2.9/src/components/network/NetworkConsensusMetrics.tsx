'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Gauge,
  Clock,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

const NetworkConsensusMetricsCopy = {
  waitingForBlocks: { cs: `Čekání na bloky…`, en: `Waiting for blocks…` },
  finality: { cs: `finalita`, en: `finality` },
  consensus: { cs: `Konsenzus`, en: `Consensus` },
  consensusHealth: { cs: `Konsenzus zdraví`, en: `Consensus Health` },
  liveConsensusMetricsFinalityRe: { cs: `Živé metriky konsenzu: finalita, reorg detekce, indikátor forku, orphan rate a propagace bloků.`, en: `Live consensus metrics: finality, reorg detection, fork indicator, orphan rate, and block propagation.` },
  finality_2: { cs: `Finalita`, en: `Finality` },
  reorgs1h: { cs: `Reorg (1h)`, en: `Reorgs (1h)` },
  noReorgs: { cs: `Žádné reorg`, en: `No reorgs` },
  detected: { cs: `Detekováno!`, en: `Detected!` },
  fork: { cs: `Fork`, en: `Fork` },
  yes: { cs: `Ano`, en: `Yes` },
  no: { cs: `Ne`, en: `No` },
  altBlocks: { cs: `alt bloků`, en: `alt blocks` },
  orphanRate: { cs: `Orphan rate`, en: `Orphan Rate` },
  altTotalBlocks: { cs: `Alt / celkem bloků`, en: `Alt / total blocks` },
  diffAdj: { cs: `Diff adj.`, en: `Diff Adj.` },
  nextBlockEst: { cs: `Odhad dalšího bloku`, en: `Next block est.` },
  lastBlock: { cs: `Poslední blok`, en: `Last Block` },
  avg: { cs: `Průměr`, en: `Avg` },
  blockTimeline: { cs: `Časová osa bloků`, en: `Block Timeline` },
  finalized: { cs: `Finalizováno`, en: `Finalized` },
  pending: { cs: `Čeká`, en: `Pending` },
  height: { cs: `Výška`, en: `Height` },
  finalityFrom: { cs: `Finalita od`, en: `Finality from` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  blockTarget: { cs: `Cíl bloku`, en: `Block target` },
};

/* ═══════════════════════════════════════════════════════════
   Types — mirror /api/blockchain/stats
   ═══════════════════════════════════════════════════════════ */

interface ChainStats {
  block_height: number;
  top_block_hash: string;
  difficulty: number;
  cumulative_difficulty: number;
  target_block_time: number;
  avg_block_time: number;
  alt_blocks_count: number;
  total_connections: number;
  incoming_connections: number;
  outgoing_connections: number;
  tx_pool_size: number;
  pool_blocks_found: number;
  version: string;
  connected: boolean;
  last_block?: {
    height: number;
    hash: string;
    timestamp: number;
    difficulty: number;
    reward: number;
    num_txes: number;
    block_size: number;
  };
}

const SOFT_FINALITY_BLOCKS = 60;

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

function fmtLarge(n: number | undefined | null): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtAgo(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

/* ═══════════════════════════════════════════════════════════
   Stat card
   ═══════════════════════════════════════════════════════════ */

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  cs,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  cs: boolean;
}) {
  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Block timeline SVG
   ═══════════════════════════════════════════════════════════ */

function BlockTimeline({
  currentHeight,
  finalityBlocks,
  cs,
}: {
  currentHeight: number;
  finalityBlocks: number;
  cs: boolean;
}) {
  const W = 480;
  const H = 60;
  const PAD = { left: 10, right: 10, top: 10, bottom: 20 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  // Show last 30 blocks
  const showCount = 30;
  const startHeight = Math.max(0, currentHeight - showCount + 1);
  const blocks = Array.from({ length: Math.min(showCount, currentHeight + 1) }, (_, i) => {
    const h = startHeight + i;
    const isFinalized = h <= currentHeight - finalityBlocks;
    const isTip = h === currentHeight;
    return { height: h, isFinalized, isTip };
  });

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-gray-500">
        {NetworkConsensusMetricsCopy.waitingForBlocks[cs ? 'cs' : 'en']}
      </div>
    );
  }

  const blockW = cw / showCount;
  const finalityX = PAD.left + (blocks.length - finalityBlocks) * blockW + blockW / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* Finality line */}
      {currentHeight >= finalityBlocks && (
        <>
          <line
            x1={finalityX}
            y1={PAD.top}
            x2={finalityX}
            y2={PAD.top + ch}
            stroke="#22c55e"
            strokeWidth="1"
            strokeDasharray="3,2"
            opacity="0.6"
          />
          <text x={finalityX} y={H - 4} textAnchor="middle" fill="#22c55e" fontSize="7" fontFamily="monospace">
            {NetworkConsensusMetricsCopy.finality[cs ? 'cs' : 'en']}
          </text>
        </>
      )}
      {/* Blocks */}
      {blocks.map((b, i) => {
        const x = PAD.left + i * blockW + blockW / 2;
        const color = b.isTip ? '#d4af37' : b.isFinalized ? '#22c55e' : '#a855f7';
        return (
          <g key={b.height}>
            <rect
              x={x - blockW * 0.35}
              y={PAD.top + ch * 0.2}
              width={blockW * 0.7}
              height={ch * 0.6}
              fill={color}
              opacity={b.isTip ? 1 : b.isFinalized ? 0.5 : 0.8}
              rx={1}
            />
            {b.isTip && (
              <text x={x} y={PAD.top + 8} textAnchor="middle" fill="#d4af37" fontSize="6" fontFamily="monospace">
                tip
              </text>
            )}
          </g>
        );
      })}
      {/* Labels */}
      <text x={PAD.left} y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
        #{fmtNum(startHeight)}
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
        #{fmtNum(currentHeight)}
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */

export default function NetworkConsensusMetrics() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [stats, setStats] = useState<ChainStats | null>(null);

  // Reorg tracking: store block hashes seen at specific heights (refs — only accessed in callbacks)
  const hashHistory = useRef<Map<number, { hash: string; ts: number }>>(new Map());
  const reorgEvents = useRef<{ ts: number; height: number }[]>([]);
  const [reorgCount, setReorgCount] = useState(0);
  const [lastBlockAge, setLastBlockAge] = useState<number | null>(null);
  const [blockTimes, setBlockTimes] = useState<number[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/blockchain/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setStats(json);

      // Track reorgs: compare current hash at height vs previously seen
      const now = Date.now();
      if (json.last_block && json.last_block.hash) {
        const h = json.last_block.height;
        const prev = hashHistory.current.get(h);
        if (prev && prev.hash !== json.last_block.hash) {
          // Reorg detected at this height
          reorgEvents.current.push({ ts: now, height: h });
        }
        hashHistory.current.set(h, { hash: json.last_block.hash, ts: now });

        // Track block times
        if (json.last_block.timestamp) {
          setBlockTimes((prev) => [...prev, json.last_block.timestamp].slice(-20));
        }

        // Last block age
        setLastBlockAge(Math.max(0, Math.floor(now / 1000) - json.last_block.timestamp));
      }

      // Clean old reorg events (keep last hour)
      const oneHourAgo = now - 3600000;
      reorgEvents.current = reorgEvents.current.filter((e) => e.ts > oneHourAgo);
      // Clean old hash history (keep last 200 heights)
      if (hashHistory.current.size > 200) {
        const sortedHeights = Array.from(hashHistory.current.keys()).sort((a, b) => a - b);
        const toRemove = sortedHeights.slice(0, sortedHeights.length - 200);
        for (const h of toRemove) hashHistory.current.delete(h);
      }
      setReorgCount(reorgEvents.current.length);
    } catch { /* silent */ }
  }, []);

  usePolling(fetchStats, 15_000);

  /* ── Derived metrics ── */
  const metrics = useMemo(() => {
    if (!stats) return null;
    const height = stats.block_height ?? 0;
    const finalityHeight = Math.max(0, height - SOFT_FINALITY_BLOCKS);
    const pctToFinality = height > 0
      ? Math.min(100, ((height - finalityHeight) / SOFT_FINALITY_BLOCKS) * 100)
      : 0;

    // Block time variance
    const bts = blockTimes;
    let avgBt = stats.avg_block_time ?? 60;
    let variance = 0;
    if (bts.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < bts.length; i++) intervals.push(bts[i] - bts[i - 1]);
      if (intervals.length > 0) {
        avgBt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const mean = avgBt;
        variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
      }
    }
    const stdDev = Math.sqrt(variance);

    // Difficulty adjustment estimate (LWMA — every block, but estimate next change %)
    // Simplified: compare current difficulty to target-implied difficulty
    const targetBlockTime = stats.target_block_time ?? 60;
    const actualVsTarget = targetBlockTime > 0 ? (avgBt / targetBlockTime) : 1;
    const estNextChangePct = ((actualVsTarget - 1) * 100);

    // Orphan rate (rough estimate from alt_blocks_count)
    const altBlocks = stats.alt_blocks_count ?? 0;
    const orphanRate = height > 0 ? (altBlocks / (height + altBlocks)) * 100 : 0;

    return {
      height,
      finalityHeight,
      pctToFinality,
      avgBt,
      stdDev,
      estNextChangePct,
      altBlocks,
      orphanRate,
      forkDetected: altBlocks > 0,
    };
  }, [stats, blockTimes]);

  if (!stats || !metrics) {
    return (
      <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkConsensusMetricsCopy.consensus[cs ? 'cs' : 'en']}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <GitBranch className="h-7 w-7 text-zion-cyan" />
            {NetworkConsensusMetricsCopy.consensusHealth[cs ? 'cs' : 'en']}
          </h2>
        </div>
        <div className="flex items-center justify-center h-40">
          <Activity className="w-8 h-8 animate-spin text-zion-cyan" />
        </div>
      </section>
    );
  }

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkConsensusMetricsCopy.consensus[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <GitBranch className="h-7 w-7 text-zion-cyan" />
          {NetworkConsensusMetricsCopy.consensusHealth[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">
          {NetworkConsensusMetricsCopy.liveConsensusMetricsFinalityRe[cs ? 'cs' : 'en']}
        </p>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Finality Status */}
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.finality_2[cs ? 'cs' : 'en']}
          value={`${metrics.pctToFinality.toFixed(0)}%`}
          sub={cs ? `Soft ${SOFT_FINALITY_BLOCKS} bloků` : `Soft ${SOFT_FINALITY_BLOCKS} blocks`}
          color="text-emerald-400"
          cs={cs}
        />

        {/* Reorg Detection */}
        <StatCard
          icon={<GitBranch className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.reorgs1h[cs ? 'cs' : 'en']}
          value={`${reorgCount}`}
          sub={reorgCount === 0 ? (NetworkConsensusMetricsCopy.noReorgs[cs ? 'cs' : 'en']) : (NetworkConsensusMetricsCopy.detected[cs ? 'cs' : 'en'])}
          color={reorgCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
          cs={cs}
        />

        {/* Fork Indicator */}
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.fork[cs ? 'cs' : 'en']}
          value={metrics.forkDetected ? (NetworkConsensusMetricsCopy.yes[cs ? 'cs' : 'en']) : (NetworkConsensusMetricsCopy.no[cs ? 'cs' : 'en'])}
          sub={`${metrics.altBlocks} ${NetworkConsensusMetricsCopy.altBlocks[cs ? 'cs' : 'en']}`}
          color={metrics.forkDetected ? 'text-amber-400' : 'text-emerald-400'}
          cs={cs}
        />

        {/* Orphan Rate */}
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.orphanRate[cs ? 'cs' : 'en']}
          value={`${metrics.orphanRate.toFixed(2)}%`}
          sub={NetworkConsensusMetricsCopy.altTotalBlocks[cs ? 'cs' : 'en']}
          color={metrics.orphanRate > 1 ? 'text-amber-400' : 'text-emerald-400'}
          cs={cs}
        />

        {/* Difficulty Adjustment */}
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.diffAdj[cs ? 'cs' : 'en']}
          value={`${metrics.estNextChangePct > 0 ? '+' : ''}${metrics.estNextChangePct.toFixed(1)}%`}
          sub={NetworkConsensusMetricsCopy.nextBlockEst[cs ? 'cs' : 'en']}
          color={Math.abs(metrics.estNextChangePct) > 10 ? 'text-amber-400' : 'text-purple-400'}
          cs={cs}
        />

        {/* Block Propagation */}
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label={NetworkConsensusMetricsCopy.lastBlock[cs ? 'cs' : 'en']}
          value={lastBlockAge != null ? fmtAgo(lastBlockAge) : '—'}
          sub={`${NetworkConsensusMetricsCopy.avg[cs ? 'cs' : 'en']}: ${metrics.avgBt.toFixed(0)}s ±${metrics.stdDev.toFixed(0)}s`}
          color={lastBlockAge != null && lastBlockAge > 180 ? 'text-amber-400' : 'text-cyan-400'}
          cs={cs}
        />
      </div>

      {/* Block timeline with finality markers */}
      <div className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zion-cyan" />
            <span className="text-xs uppercase tracking-wider text-gray-500">
              {NetworkConsensusMetricsCopy.blockTimeline[cs ? 'cs' : 'en']}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-sm" />
              <span className="text-gray-500">{NetworkConsensusMetricsCopy.finalized[cs ? 'cs' : 'en']}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-sm" />
              <span className="text-gray-500">{NetworkConsensusMetricsCopy.pending[cs ? 'cs' : 'en']}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-zion-gold rounded-sm" />
              <span className="text-gray-500">Tip</span>
            </div>
          </div>
        </div>
        <BlockTimeline
          currentHeight={metrics.height}
          finalityBlocks={SOFT_FINALITY_BLOCKS}
          cs={cs}
        />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500">{NetworkConsensusMetricsCopy.height[cs ? 'cs' : 'en']}: </span>
            <span className="font-mono text-white">{fmtNum(metrics.height)}</span>
          </div>
          <div>
            <span className="text-gray-500">{NetworkConsensusMetricsCopy.finalityFrom[cs ? 'cs' : 'en']}: </span>
            <span className="font-mono text-emerald-400">#{fmtNum(metrics.finalityHeight)}</span>
          </div>
          <div>
            <span className="text-gray-500">{NetworkConsensusMetricsCopy.difficulty[cs ? 'cs' : 'en']}: </span>
            <span className="font-mono text-purple-400">{fmtLarge(stats.difficulty)}</span>
          </div>
          <div>
            <span className="text-gray-500">{NetworkConsensusMetricsCopy.blockTarget[cs ? 'cs' : 'en']}: </span>
            <span className="font-mono text-cyan-400">{stats.target_block_time ?? 60}s</span>
          </div>
        </div>
      </div>
    </section>
  );
}
