'use client';

/**
 * RecentSwaps — live feed of recent swaps from ZionDex Router
 */

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, ExternalLink } from 'lucide-react';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://zionterranova.com/dex-api';

interface SwapRecord {
  id: string;
  status: string;
  src_chain: string;
  dest_chain: string;
  amount_in: string;
  amount_out: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-zion-cyan-400 bg-zion-cyan-500/10',
  executing: 'text-zion-gold-400 bg-zion-gold-500/10',
  pending: 'text-zinc-400 bg-zinc-500/10',
  failed: 'text-zion-purple-400 bg-zion-purple-500/10',
  refunded: 'text-zion-gold-400 bg-zion-gold-500/10',
};

export default function RecentSwaps() {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSwaps = async () => {
    try {
      const resp = await fetch(`${ROUTER_URL}/swaps?limit=10`);
      if (!resp.ok) return;
      const data = await resp.json();
      setSwaps(Array.isArray(data) ? data : []);
    } catch {
      // Router not running — show empty state
      setSwaps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSwaps();
    const interval = setInterval(fetchSwaps, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-zion-gold-500" />
          <h3 className="text-sm font-semibold text-white">Recent Swaps</h3>
        </div>
        <button
          onClick={fetchSwaps}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {swaps.length === 0 ? (
        <div className="text-center py-6 text-zinc-600 text-sm">
          {loading ? 'Loading...' : 'No recent swaps'}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {swaps.map(swap => (
            <div
              key={swap.id}
              className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[swap.status] || STATUS_COLORS.pending}`}>
                  {swap.status}
                </span>
                <span className="text-xs text-white">
                  {swap.amount_in} {swap.src_chain}
                </span>
                <span className="text-zinc-500">→</span>
                <span className="text-xs text-white">
                  {swap.amount_out || '...'} {swap.dest_chain}
                </span>
              </div>
              <span className="text-xs text-zinc-600">
                {new Date(swap.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
