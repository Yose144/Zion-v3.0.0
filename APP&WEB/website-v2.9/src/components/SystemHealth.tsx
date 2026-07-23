'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Activity } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

const SystemHealthCopy = {
  healthy: { cs: `zdravý`, en: `healthy` },
  degraded: { cs: `omezený`, en: `degraded` },
  unknown: { cs: `neznámý`, en: `unknown` },
  loadingSystemHealth: { cs: `Načítám stav systému...`, en: `Loading system health...` },
  systemHealth: { cs: `Stav systému`, en: `System Health` },
  status: { cs: `Stav`, en: `Status` },
  version: { cs: `Verze`, en: `Version` },
  uptime: { cs: `Doba běhu`, en: `Uptime` },
  dependencies: { cs: `Závislosti`, en: `Dependencies` },
  rpcNode: { cs: `RPC uzel`, en: `RPC Node` },
  miningPool: { cs: `Těžební pool`, en: `Mining Pool` },
};

interface HealthData {
  status: string;
  version: string;
  environment: string;
  uptime_seconds: number;
  dependencies?: {
    rpc?: { healthy: boolean; host: string; port: number };
    mining_pool?: { healthy: boolean; host: string; port: number };
  };
}

export default function SystemHealth() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({
        status: 'unknown',
        version: 'v2.9.6',
        environment: 'production',
        uptime_seconds: 0
      });
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchHealth, 15_000);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return cs ? `${hours} h ${minutes} min` : `${hours}h ${minutes}m`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return SystemHealthCopy.healthy[cs ? 'cs' : 'en'];
      case 'degraded':
        return SystemHealthCopy.degraded[cs ? 'cs' : 'en'];
      case 'unknown':
        return SystemHealthCopy.unknown[cs ? 'cs' : 'en'];
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <section className="mt-12">
        <div className="animate-pulse text-gray-400">{SystemHealthCopy.loadingSystemHealth[cs ? 'cs' : 'en']}</div>
      </section>
    );
  }

  // Always show health, even if degraded
  if (!health) return null;

  return (
    <section className="mt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8"
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-green-400" />
          <h2 className="text-3xl font-bold">{SystemHealthCopy.systemHealth[cs ? 'cs' : 'en']}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{SystemHealthCopy.status[cs ? 'cs' : 'en']}</div>
            <div className="flex items-center gap-2">
              {health.status === 'ok' || health.status === 'healthy' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : health.status === 'degraded' ? (
                <Activity className="w-5 h-5 text-yellow-400 animate-pulse" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className="text-lg font-semibold capitalize">{getStatusLabel(health.status)}</span>
            </div>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{SystemHealthCopy.version[cs ? 'cs' : 'en']}</div>
            <div className="text-lg font-semibold text-zion-purple">{health.version}</div>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{SystemHealthCopy.uptime[cs ? 'cs' : 'en']}</div>
            <div className="text-lg font-semibold text-zion-cyan">
              {formatUptime(health.uptime_seconds)}
            </div>
          </div>
        </div>

        {health.dependencies && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-4">{SystemHealthCopy.dependencies[cs ? 'cs' : 'en']}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {health.dependencies.rpc && (
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{SystemHealthCopy.rpcNode[cs ? 'cs' : 'en']}</span>
                    {health.dependencies.rpc.healthy ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {health.dependencies.rpc.host}:{health.dependencies.rpc.port}
                  </div>
                </div>
              )}

              {health.dependencies.mining_pool && (
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{SystemHealthCopy.miningPool[cs ? 'cs' : 'en']}</span>
                    {health.dependencies.mining_pool.healthy ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {health.dependencies.mining_pool.host}:{health.dependencies.mining_pool.port}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
