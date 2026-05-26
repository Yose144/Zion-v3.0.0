// ─── ZION Dashboard v2 — Explorer Tab (website v2.9 style) ──────────────────
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, Clock, Box, Layers } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';
import api from '../../api/client';
import type { BlockSummary, MempoolEntry } from '../../types/api';
import { formatDistanceToNow } from 'date-fns';

export default function ExplorerTab() {
  const [blocks, setBlocks]   = useState<BlockSummary[]>([]);
  const [mempool, setMempool] = useState<MempoolEntry[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [mempoolCount, setMempoolCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [b, m] = await Promise.all([
        api.blocks(20).catch(() => [] as BlockSummary[]),
        api.mempool().catch(() => ({ count: 0, entries: [] })),
      ]);
      setBlocks(b);
      setMempool(m.entries.slice(0, 30));
      setMempoolCount(m.count);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = blocks.filter(b =>
    !search || b.hash.includes(search) || String(b.height).includes(search)
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Search + refresh bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-3 py-2">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search block hash or height…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Latest Blocks panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden xl:col-span-2"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
                <Box size={15} className="text-zion-gold" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Latest Blocks</h3>
                <p className="text-[11px] text-gray-500">{filtered.length} shown</p>
              </div>
            </div>
          </div>

          {loading && blocks.length === 0 ? (
            <div className="px-6 py-4"><TableSkeleton rows={8} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/4">
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">Height</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Hash</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Txns</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden sm:table-cell">Size</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-600 text-sm">
                        No blocks found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b, i) => (
                      <motion.tr
                        key={b.hash}
                        initial={i === 0 ? { backgroundColor: 'rgba(255,215,0,0.06)' } : {}}
                        animate={{ backgroundColor: 'rgba(0,0,0,0)' }}
                        transition={{ duration: 3 }}
                        className="border-b border-white/3 hover:bg-white/3 transition-colors"
                      >
                        <td className="px-6 py-3 font-mono text-zion-gold font-semibold text-sm">
                          {b.height.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 font-mono text-gray-500 text-xs">
                          <span title={b.hash}>{b.hash.slice(0, 12)}…</span>
                        </td>
                        <td className="px-3 py-3 text-gray-300 text-xs">{b.txns}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs hidden sm:table-cell">
                          {b.size ? `${(b.size / 1024).toFixed(1)} KB` : '—'}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs flex items-center gap-1">
                          <Clock size={10} />
                          {b.ts ? formatDistanceToNow(new Date(b.ts * 1000), { addSuffix: true }) : '—'}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ── Mempool panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
              <Layers size={15} className="text-zion-cyan" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Mempool</h3>
              <p className="text-[11px] text-gray-500">{mempoolCount} pending</p>
            </div>
          </div>
          <div className="px-6 py-4">
            {mempool.length === 0 ? (
              <div className="py-8 text-center text-gray-600 text-sm">Empty</div>
            ) : (
              <div className="space-y-1">
                {mempool.map(tx => (
                  <div key={tx.txid} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-gray-300" title={tx.txid}>
                        {tx.txid.slice(0, 10)}…
                      </span>
                      <span className="text-[10px] text-gray-600">{tx.age_s}s ago</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-zion-cyan">{tx.fee} fee</p>
                      <p className="text-[10px] text-gray-600">{tx.size} B</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
