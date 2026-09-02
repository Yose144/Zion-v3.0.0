'use client';

/**
 * ZionDex Portfolio — user's LP positions and swap history
 * Fetches swap history from the DEX API and AMM pair info from ZIONDexFactory.
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Droplets, Activity, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { fetchPools, getAmmPair, ZIONDEX_FACTORY } from '@/lib/dex-api';
import { CONTRACTS } from '@/lib/defi-contracts';
import TestingPhaseBanner from '@/components/TestingPhaseBanner';
import TokenIcon from '@/components/dex/TokenIcon';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://dex.zionterranova.com';

interface SwapRecord {
  id: string;
  status: string;
  src_chain: string;
  dest_chain: string;
  amount_in: string;
  amount_out: string | null;
  created_at: string;
}

interface LpPosition {
  pool: string;
  chain: string;
  token_a: string;
  token_b: string;
  pair_address: string;
  fee_tier: number;
  enabled: boolean;
}

// Known ZIONDex pair addresses (deployed on Base Mainnet)
const KNOWN_PAIRS: Record<string, string> = {
  'wZION/USDC': CONTRACTS.ZIONDexPairWZionUSDC,
  'tZION/tUSDT': CONTRACTS.ZIONDexPairTZionTUsdt,
};

export default function PortfolioPage() {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      // Fetch swap history
      const swapsResp = await fetch(`${ROUTER_URL}/swaps?limit=20`);
      if (swapsResp.ok) {
        const data = await swapsResp.json();
        setSwaps(Array.isArray(data) ? data : (data.swaps || []));
      }

      // Fetch pools and look up AMM pair addresses for each
      const poolData = await fetchPools();

      // For each pool, look up the on-chain AMM pair address
      const positions: LpPosition[] = [];
      for (const pool of poolData) {
        if (!pool.enabled) continue;
        try {
          // Check known pairs first (faster than API call)
          const poolKey = `${pool.token_a}/${pool.token_b}`;
          let pairAddr = KNOWN_PAIRS[poolKey] || '0x0';

          if (pairAddr === '0x0') {
            const pairRes = await getAmmPair(
              pool.chain || 'base',
              ZIONDEX_FACTORY,
              pool.token_a,
              pool.token_b,
            );
            pairAddr = pairRes.pair_address || '0x0';
          }

          positions.push({
            pool: `${pool.token_a}/${pool.token_b}`,
            chain: pool.chain || 'base',
            token_a: pool.token_a,
            token_b: pool.token_b,
            pair_address: pairAddr,
            fee_tier: pool.fee_bps,
            enabled: pool.enabled,
          });
        } catch {
          // skip on error
        }
      }

      // Also add known pairs that aren't in the API response
      for (const [poolKey, addr] of Object.entries(KNOWN_PAIRS)) {
        if (addr && !positions.some(p => p.pair_address === addr)) {
          const [tokenA, tokenB] = poolKey.split('/');
          positions.push({
            pool: poolKey,
            chain: 'base',
            token_a: tokenA,
            token_b: tokenB,
            pair_address: addr,
            fee_tier: 30, // 0.3% default
            enabled: true,
          });
        }
      }

      setLpPositions(positions);
    } catch {
      setSwaps([]);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    void fetchData();
    // Auto-refresh every 30s
    const interval = setInterval(() => void fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate stats
  const totalSwaps = swaps.length;
  const completedSwaps = swaps.filter(s => s.status === 'completed').length;
  const totalVolume = swaps
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (parseFloat(s.amount_in) || 0), 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-6 h-6 text-zion-gold" />
              <h1 className="text-2xl font-bold text-white">Portfolio</h1>
            </div>
            <p className="text-zinc-400 text-sm">Your swap history and liquidity positions</p>
          </motion.div>
        </div>
      </div>

      <TestingPhaseBanner type="dex" className="max-w-6xl mx-auto px-6 pt-4" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-zion-purple" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Total Swaps</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalSwaps}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-zion-cyan" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Completed</span>
            </div>
            <div className="text-2xl font-bold text-zion-cyan">{completedSwaps}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-zion-purple" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">AMM Pools</span>
            </div>
            <div className="text-2xl font-bold text-white">{lpPositions.length}</div>
          </div>

          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-zion-gold" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Volume</span>
            </div>
            <div className="text-2xl font-bold text-zion-gold">${totalVolume.toFixed(2)}</div>
          </div>
        </div>

        {/* LP Positions / AMM Pools */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">AMM Liquidity Pools</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Updated {lastRefresh.toLocaleTimeString()}</span>
              <button
                onClick={() => void fetchData()}
                className="p-1 hover:text-zion-gold transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-500" />
              </div>
            ) : lpPositions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Droplets className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active AMM pools found</p>
                <Link href="/dex/liquidity" className="text-sm text-zion-gold hover:text-zion-gold mt-2 inline-block">
                  Add liquidity →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700/30">
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Pool</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">Chain</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-400 uppercase">AMM Pair</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-400 uppercase">Fee</th>
                    <th className="text-center px-4 py-3 text-xs text-zinc-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lpPositions.map((pos, i) => (
                    <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        <div className="flex items-center gap-1.5">
                          <TokenIcon symbol={pos.token_a} size={18} />
                          <span>/{pos.token_b}</span>
                          <TokenIcon symbol={pos.token_b} size={18} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{pos.chain}</td>
                      <td className="px-4 py-3 text-sm text-zion-cyan font-mono">
                        {pos.pair_address !== '0x0' ? (
                          <span>{pos.pair_address.slice(0, 10)}…{pos.pair_address.slice(-6)}</span>
                        ) : (
                          <span className="text-zinc-600">Not deployed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                        {(pos.fee_tier / 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={pos.enabled ? 'zion-badge zion-badge-green' : 'zion-badge'}>
                          {pos.enabled ? 'Active' : 'Pending'}
                        </span>
                      </td>
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
          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-500" />
              </div>
            ) : swaps.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No swaps yet</p>
                <Link href="/dex" className="text-sm text-zion-gold hover:text-zion-gold mt-2 inline-block">
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
                      <td className="px-4 py-3 text-sm text-zion-gold text-right">{swap.amount_out || '...'}</td>
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
          <Link href="/dex" className="text-sm text-zinc-400 hover:text-zion-gold transition-colors">
            ← Back to Swap
          </Link>
        </div>
      </div>
    </div>
  );
}
