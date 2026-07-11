'use client';

/**
 * ZionDex Portfolio — user's LP positions and swap history
 */

import { useState, useEffect, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Droplets, Activity, Loader2 } from 'lucide-react';
import Link from 'next/link';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'http://localhost:8454';

interface SwapRecord {
  id: string;
  status: string;
  src_chain: string;
  dest_chain: string;
  amount_in: string;
  amount_out: string | null;
  created_at: string;
}

interface Position {
  pool: string;
  chain: string;
  token_a: string;
  token_b: string;
  liquidity: string;
  fee_tier: number;
  uncollected_fees: string;
}

export default function PortfolioPage() {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user's swap history
        const swapsResp = await fetch(`${ROUTER_URL}/swaps?limit=20`);
        if (swapsResp.ok) {
          const data = await swapsResp.json();
          setSwaps(Array.isArray(data) ? data : []);
        }

        // TODO: Fetch LP positions from ZionDexPoolManager
        // For now: placeholder
        setPositions([]);
      } catch {
        setSwaps([]);
        setPositions([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  // Calculate stats
  const totalSwaps = swaps.length;
  const completedSwaps = swaps.filter(s => s.status === 'completed').length;
  const totalVolume = swaps
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (parseFloat(s.amount_in) || 0), 0);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-white">Portfolio</h1>
            </div>
            <p className="text-zinc-400 text-sm">Your swap history and liquidity positions</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Total Swaps</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalSwaps}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Completed</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{completedSwaps}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">LP Positions</span>
            </div>
            <div className="text-2xl font-bold text-white">{positions.length}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Volume</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">${totalVolume.toFixed(2)}</div>
          </div>
        </div>

        {/* LP Positions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Liquidity Positions</h2>
          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            {positions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Droplets className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active liquidity positions</p>
                <Link href="/dex/liquidity" className="text-sm text-amber-400 hover:text-amber-300 mt-2 inline-block">
                  Add liquidity →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700/30">
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Pool</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Chain</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Liquidity</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => (
                    <tr key={i} className="border-b border-zinc-800/30">
                      <td className="px-4 py-3 text-sm text-white">{pos.token_a}/{pos.token_b}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{pos.chain}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{pos.liquidity}</td>
                      <td className="px-4 py-3 text-sm text-amber-400 text-right">{pos.uncollected_fees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Swap History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Swap History</h2>
          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as CSSProperties}>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-500" />
              </div>
            ) : swaps.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No swaps yet</p>
                <Link href="/dex" className="text-sm text-amber-400 hover:text-amber-300 mt-2 inline-block">
                  Start swapping →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700/30">
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Route</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Amount In</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Amount Out</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {swaps.map(swap => (
                    <tr key={swap.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <span className={
                          swap.status === 'completed' ? 'zion-badge zion-badge-green' :
                          swap.status === 'failed' ? 'zion-badge zion-badge-red' :
                          'zion-badge zion-badge-amber'
                        }>
                          {swap.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {swap.src_chain} → {swap.dest_chain}
                      </td>
                      <td className="px-4 py-3 text-sm text-white text-right">{swap.amount_in}</td>
                      <td className="px-4 py-3 text-sm text-amber-400 text-right">{swap.amount_out || '...'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 text-right">
                        {new Date(swap.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/dex" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
            ← Back to Swap
          </Link>
        </div>
      </div>
    </div>
  );
}
