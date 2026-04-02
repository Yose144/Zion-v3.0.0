'use client';

import { useState } from 'react';
import { usePolling } from '@/hooks/usePolling';

interface GuardiansStatsResponse {
  success: boolean;
  data: {
    total144k: number;
    limit: number;
    byTier: Record<string, number>;
    byConsciousnessLevel: Record<string, number>;
    recentGuardians: Array<{ name?: string; wallet?: string; level?: string }>;
    lastUpdate: string;
  } | null;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

export default function DaoStatsClient() {
  const [stats, setStats] = useState<GuardiansStatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/guardians/stats');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data: GuardiansStatsResponse = await response.json();
      
      if (data.success && data.data) {
        setStats(data.data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error('Invalid API response');
      }
    } catch (err) {
      console.error('Failed to fetch DAO stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  usePolling(fetchStats, REFRESH_INTERVAL);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
            <div className="h-4 bg-white/10 rounded mb-3"></div>
            <div className="h-8 bg-white/10 rounded mb-2"></div>
            <div className="h-3 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-red-400 text-sm">Failed to load DAO stats</p>
        <p className="text-gray-500 text-xs mt-2">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('cs-CZ').format(num);
  };

  const formatPercentage = (num: number) => {
    return num.toFixed(2) + '%';
  };

  return (
    <>
      {/* Real-time DAO Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Guardians initiated</p>
          <p className="mt-3 text-3xl font-semibold">{formatNumber(stats.total144k)}</p>
          <p className="text-sm text-zion-gold">{formatPercentage((stats.total144k / stats.limit) * 100)} of {formatNumber(stats.limit)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Top tier</p>
          <p className="mt-3 text-3xl font-semibold">CL9</p>
          <p className="text-sm text-zion-gold">{formatNumber(stats.byConsciousnessLevel.CL9 || 0)} guardians</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Consciousness levels</p>
          <p className="mt-3 text-3xl font-semibold">9 levels</p>
          <p className="text-sm text-zion-gold">CL1 → CL9 path</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Last update</p>
          <p className="mt-3 text-3xl font-semibold">{lastUpdate ? lastUpdate.toLocaleTimeString('cs-CZ') : '—'}</p>
          <p className="text-sm text-zion-gold">Live DAO ledger</p>
        </div>
      </section>
    </>
  );
}
