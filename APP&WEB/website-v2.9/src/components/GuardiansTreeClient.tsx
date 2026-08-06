"use client";

import { useState } from 'react';
import ConsciousnessTreeKabbalah from '@/components/ConsciousnessTreeKabbalah';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';

type GuardianData = {
  total144k: number;
  limit: number;
  byTier: Record<string, number>;
  byConsciousnessLevel: Record<string, number>;
  recentGuardians: Array<{
    name: string;
    tier: string;
    amount: string;
    wallet: string;
    joined: string;
    cl: number;
  }>;
  lastUpdate: string;
};

export default function GuardiansTreeClient() {
  const [data, setData] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchGuardianStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/guardians/stats', { cache: 'no-store' });
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch');
      }
    } catch (err) {
      console.error('Error fetching guardian stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  usePolling(fetchGuardianStats, 60000);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-zion-gold" />
        <span className="ml-3 text-gray-400">Loading Guardians data...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="zion-rainbow-card p-8 text-center" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <p className="text-sm text-gray-400 mb-2">{error}</p>
        <p className="text-xs text-gray-500">
          The 144k Guardians registry is under development. Live data will appear once the registry contract is deployed.
        </p>
        <button
          onClick={fetchGuardianStats}
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Status Bar */}
      <div className="flex items-center justify-between zion-section px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="h-2 w-2 rounded-full bg-zion-cyan-400 animate-pulse" />
          <span>Live data · Auto-refresh 60s</span>
        </div>
        <button
          onClick={fetchGuardianStats}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh now
        </button>
      </div>

      {/* Main Tree Component */}
      {data && (
        <ConsciousnessTreeKabbalah
          guardianData={{
            total144k: data.total144k,
            byTier: data.byTier,
          }}
        />
      )}

      {/* Recent Guardians List */}
      {data?.recentGuardians && data.recentGuardians.length > 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-b from-black/80 to-black/60 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-zion-gold" />
            <h3 className="text-xl font-semibold text-white">Recent Guardians</h3>
          </div>
          <div className="space-y-3">
            {data.recentGuardians.map((guardian, idx) => {
              // Get gradient based on CL level
              const gradients = [
                'from-zion-purple-500/20 to-zion-purple-600/20', // CL8+
                'from-zion-cyan-400/20 to-zion-cyan-500/20',   // CL6-7
                'from-zion-gold-400/20 to-zion-gold-500/20',  // CL3-4
              ];
              const gradient = guardian.cl >= 8 ? gradients[0] : guardian.cl >= 6 ? gradients[1] : gradients[2];
              
              return (
                <div
                  key={guardian.wallet}
                  className={`flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r ${gradient} p-4 hover:border-white/20 transition-all animate-fadeIn`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-xl backdrop-blur-sm">
                      {guardian.cl >= 8 ? '⭐' : guardian.cl >= 6 ? '👑' : '🎨'}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{guardian.name}</div>
                      <div className="text-sm text-gray-400">
                        {guardian.tier} · {guardian.amount}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-zion-gold bg-black/40 px-2 py-1 rounded">CL{guardian.cl}</div>
                    <div className="text-xs text-gray-500 mt-1">{guardian.joined}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Last Update Time */}
      {lastRefresh && (
        <div className="text-center text-xs text-gray-500">
          Last update: {lastRefresh.toLocaleTimeString('cs-CZ')}
        </div>
      )}
    </div>
  );
}
