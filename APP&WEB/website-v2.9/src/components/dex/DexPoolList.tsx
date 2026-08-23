'use client';

/**
 * DexPoolList — live DEX pool reserves from zion-multichain
 */

import { useState, useEffect } from 'react';
import { Droplets, RefreshCw } from 'lucide-react';

interface PoolAsset {
  id: { chain: string; contract: string | null; ticker: string };
  decimals: number;
  name: string;
}

interface Pool {
  id: number;
  asset_a: PoolAsset;
  asset_b: PoolAsset;
  reserve_a: string;
  reserve_b: string;
  fee_bps: number;
}

const API_BASE = '/api/swap';

function formatReserve(amount: string, decimals: number): string {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const int = (value / divisor).toString();
  const frac = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${int}.${frac.slice(0, 6)}` : int;
}

function poolPrice(pool: Pool): string {
  const ra = BigInt(pool.reserve_a);
  const rb = BigInt(pool.reserve_b);
  if (ra === 0n) return '-';

  // price = (reserve_b / 10^decimals_b) / (reserve_a / 10^decimals_a)
  // compute with 6 decimal places of precision using BigInt to avoid float loss
  const scaleA = 10n ** BigInt(pool.asset_a.decimals);
  const scaleB = 10n ** BigInt(pool.asset_b.decimals);
  const precision = 10n ** 6n;
  const num = (rb * scaleA * precision) / (ra * scaleB);
  const s = num.toString().padStart(7, '0');
  const int = s.slice(0, -6) || '0';
  const frac = s.slice(-6).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

export default function DexPoolList() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/pools`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setPools(Array.isArray(data.pools) ? data.pools : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load pools');
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPools();
    const id = setInterval(fetchPools, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-zion-gold" />
          <h3 className="text-sm font-semibold text-white">DEX Pools</h3>
        </div>
        <button
          onClick={fetchPools}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-zion-purple mb-2">{error}</div>
      )}

      {pools.length === 0 ? (
        <div className="text-center py-6 text-zinc-600 text-sm">
          {loading ? 'Loading...' : 'No active pools'}
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-white">
                  {pool.asset_a.id.ticker} / {pool.asset_b.id.ticker}
                </span>
                <span className="text-zinc-500">{pool.fee_bps / 100}% fee</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>
                  {formatReserve(pool.reserve_a, pool.asset_a.decimals)} {pool.asset_a.id.ticker}
                </span>
                <span>
                  {formatReserve(pool.reserve_b, pool.asset_b.decimals)} {pool.asset_b.id.ticker}
                </span>
              </div>
              <div className="text-[10px] text-zion-gold/80 mt-1">
                1 {pool.asset_a.id.ticker} ≈ {poolPrice(pool)} {pool.asset_b.id.ticker}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
