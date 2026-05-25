// ─── ZION Dashboard v2 — Explorer Tab ───────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock, Hash, Layers } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
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
    <div className="p-6 space-y-6">

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-(--color-bg-card) border border-(--color-border) rounded-lg px-3 py-2">
          <Search size={14} className="text-(--color-text-muted)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search block hash or height..."
            className="flex-1 bg-transparent outline-none text-sm text-(--color-text) placeholder:text-(--color-text-muted)"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Block list */}
        <Card
          title={`Latest Blocks`}
          accent="gold"
          className="xl:col-span-2"
          actions={<span className="text-xs text-(--color-text-muted)">{filtered.length} shown</span>}
        >
          {loading && blocks.length === 0 ? (
            <TableSkeleton rows={8} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-(--color-border) text-(--color-text-muted)">
                  <th className="text-left pb-2 pr-4 font-medium">Height</th>
                  <th className="text-left pb-2 pr-4 font-medium">Hash</th>
                  <th className="text-left pb-2 pr-4 font-medium">Txns</th>
                  <th className="text-left pb-2 pr-4 font-medium">Size</th>
                  <th className="text-left pb-2 font-medium">Age</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-(--color-text-muted)">
                      No blocks found
                    </td>
                  </tr>
                ) : (
                  filtered.map(b => (
                    <tr key={b.hash} className="border-b border-(--color-border-dim) hover:bg-(--color-bg-hover)/40 transition-colors">
                      <td className="py-2 pr-4 font-mono text-(--color-zion-gold) font-bold">
                        {b.height.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-(--color-text-dim)">
                        <span title={b.hash}>{b.hash.slice(0, 12)}…</span>
                      </td>
                      <td className="py-2 pr-4 text-(--color-text)">{b.txns}</td>
                      <td className="py-2 pr-4 text-(--color-text-muted)">{b.size ? `${(b.size / 1024).toFixed(1)} KB` : '—'}</td>
                      <td className="py-2 text-(--color-text-muted) flex items-center gap-1">
                        <Clock size={10} />
                        {b.ts ? formatDistanceToNow(new Date(b.ts * 1000), { addSuffix: true }) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </Card>

        {/* Mempool */}
        <Card
          title="Mempool"
          accent="cyan"
          actions={
            <span className="text-xs text-(--color-text-muted)">{mempoolCount} pending</span>
          }
        >
          {mempool.length === 0 ? (
            <div className="py-8 text-center text-(--color-text-muted) text-sm">Empty</div>
          ) : (
            <div className="space-y-1">
              {mempool.map(tx => (
                <div key={tx.txid} className="flex items-center justify-between py-1.5 border-b border-(--color-border-dim) last:border-0">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-(--color-text)" title={tx.txid}>
                      {tx.txid.slice(0, 10)}…
                    </span>
                    <span className="text-[10px] text-(--color-text-muted)">{tx.age_s}s ago</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-(--color-zion-cyan)">{tx.fee} fee</p>
                    <p className="text-[10px] text-(--color-text-muted)">{tx.size} B</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
