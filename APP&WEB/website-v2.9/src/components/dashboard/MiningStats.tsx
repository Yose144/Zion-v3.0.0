'use client';

/**
 * MiningStats — shows mining statistics for the user's wallet address.
 */

import { useState, useEffect, useCallback } from 'react';
import { Pickaxe, RefreshCw, Loader2, Activity, Zap, TrendingUp, Award } from 'lucide-react';

interface MiningStatsProps {
  address: string;
}

interface MinerData {
  address: string;
  worker_name?: string;
  algorithm?: string;
  hashrate?: number;
  shares_accepted?: number;
  shares_rejected?: number;
  shares_pending?: number;
  blocks_found?: number;
  total_earned?: number;
  last_share_time?: number;
  online?: boolean;
}

export default function MiningStats({ address }: MiningStatsProps) {
  const [miner, setMiner] = useState<MinerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMiner = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/miner/${address}`);
      if (res.status === 404) {
        setMiner(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch miner data');
      const data = await res.json();
      setMiner(data.miner ?? data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchMiner();
  }, [fetchMiner]);

  const formatHashrate = (hr?: number) => {
    if (!hr || hr === 0) return '0 H/s';
    if (hr >= 1000) return `${(hr / 1000).toFixed(2)} KH/s`;
    return `${hr.toFixed(1)} H/s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pickaxe className="h-5 w-5 text-zion-purple" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Mining Stats</h3>
        </div>
        <button
          onClick={fetchMiner}
          disabled={loading}
          className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zion-purple" />
          <span className="text-sm text-gray-500">Loading mining stats...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-zion-purple/20 bg-zion-purple/5 p-4 text-sm text-zion-purple">{error}</div>
      ) : !miner ? (
        /* Not mining */
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Pickaxe className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No mining activity found</p>
          <p className="text-xs text-gray-600 mb-4">
            Start mining to see your hashrate, shares, and earnings here.
          </p>
          <a
            href="/mining"
            className="inline-flex items-center gap-2 rounded-lg border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-sm font-medium text-zion-purple transition-all hover:bg-zion-purple/20"
          >
            <Pickaxe className="h-4 w-4" /> Start Mining
          </a>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Activity}
              label="Hashrate"
              value={formatHashrate(miner.hashrate)}
              color="cyan"
            />
            <StatCard
              icon={Zap}
              label="Shares Accepted"
              value={miner.shares_accepted?.toString() ?? '0'}
              color="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Shares Rejected"
              value={miner.shares_rejected?.toString() ?? '0'}
              color="red"
            />
            <StatCard
              icon={Award}
              label="Blocks Found"
              value={miner.blocks_found?.toString() ?? '0'}
              color="gold"
            />
          </div>

          {/* Details */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Status</span>
              <span className={`inline-flex items-center gap-1.5 ${miner.online ? 'text-zion-cyan' : 'text-gray-500'}`}>
                <span className={`h-2 w-2 rounded-full ${miner.online ? 'bg-zion-cyan animate-pulse' : 'bg-gray-600'}`} />
                {miner.online ? 'Online' : 'Offline'}
              </span>
            </div>
            {miner.worker_name && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Worker</span>
                <span className="text-gray-300 font-mono">{miner.worker_name}</span>
              </div>
            )}
            {miner.algorithm && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Algorithm</span>
                <span className="text-gray-300 font-mono">{miner.algorithm}</span>
              </div>
            )}
            {miner.total_earned !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Total Earned</span>
                <span className="text-zion-gold font-mono">{miner.total_earned.toFixed(8)} ZION</span>
              </div>
            )}
            {miner.last_share_time && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Last Share</span>
                <span className="text-gray-300">
                  {new Date(miner.last_share_time * 1000).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  color: 'cyan' | 'green' | 'red' | 'gold';
}) {
  const colors = {
    cyan: 'border-zion-cyan/20 bg-zion-cyan/5 text-zion-cyan',
    green: 'border-zion-cyan/20 bg-zion-cyan/5 text-zion-cyan',
    red: 'border-zion-purple/20 bg-zion-purple/5 text-zion-purple',
    gold: 'border-zion-gold/20 bg-zion-gold/5 text-zion-gold',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <Icon className="h-4 w-4 mb-2 opacity-70" />
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
