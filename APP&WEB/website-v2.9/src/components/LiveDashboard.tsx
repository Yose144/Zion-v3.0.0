'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Atom, Braces, Database, Gauge, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface BlockchainStats {
  // NOTE: Backend schema can vary across deployments.
  // Keep fields optional and use safe fallbacks in rendering.
  total_blocks?: number;
  total_supply?: number;
  circulating_supply?: number;
  max_supply?: number;
  total_transactions?: number;
  mempool_size?: number;
  difficulty?: number;
  block_height?: number;
  latest_block?: {
    height: number;
    hash: string;
    timestamp: number;
  };
}

const placeholderStats: BlockchainStats = {
  total_blocks: 0,
  total_supply: 0,
  total_transactions: 0,
  mempool_size: 0,
  difficulty: 0,
};

export default function LiveDashboard() {
  const [stats, setStats] = useState<BlockchainStats>(placeholderStats);
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchStats() {
      try {
        const data = await apiClient<BlockchainStats | null>('/blockchain/stats');
        if (!active) return;

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid blockchain stats payload');
        }

        setStats(data);
        setLoadedAtLeastOnce(true);
        setError(null);
      } catch (err) {
        if (!active) return;
        // Don't show error in dev mode, just use placeholder data
        if (process.env.NODE_ENV === 'development') {
          console.warn('API not available, using placeholder data');
          setLoadedAtLeastOnce(true);
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const supply = stats.total_supply ?? stats.circulating_supply ?? 0;
  const formattedSupply = (supply / 1e9).toFixed(2) + 'B';
  const formattedTimestamp = stats.latest_block?.timestamp
    ? new Date(stats.latest_block.timestamp * 1000).toLocaleString('cs-CZ')
    : '—';

  const highlightCards = [
    {
      label: 'Total Blocks',
      value: (stats.total_blocks ?? 0).toLocaleString(),
      icon: Database,
      accent: 'from-zion-gold/25 to-zion-purple/10',
    },
    {
      label: 'Total Supply',
      value: formattedSupply,
      icon: Gauge,
      accent: 'from-zion-purple/25 to-zion-cyan/10',
    },
    {
      label: 'Transactions',
      value: (stats.total_transactions ?? 0).toLocaleString(),
      icon: Atom,
      accent: 'from-zion-cyan/25 to-zion-gold/10',
    },
  ];

  const auxCards = [
    { label: 'Difficulty', value: (stats.difficulty ?? 0).toLocaleString(), icon: Shield },
    { label: 'Mempool Size', value: (stats.mempool_size ?? 0).toLocaleString(), icon: Braces },
  ];

  return (
    <section className="py-24 px-4">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2">
            <Activity className="w-5 h-5 text-zion-gold animate-pulse" />
            <span className="text-sm tracking-wide uppercase text-gray-300">Mission Console</span>
          </div>
          <div className="text-3xl font-semibold text-gradient">Live Network Telemetry</div>
          {error && (
            <span className="text-xs text-amber-300 bg-amber-500/10 rounded-full px-3 py-1 border border-amber-500/30">
              ⚠️ {error}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase text-gray-400 tracking-[0.4em]">Continuum status</p>
                <h3 className="text-2xl font-semibold text-white">Galactic network sync</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Updated {loadedAtLeastOnce ? 'live' : 'initializing'}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {highlightCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border border-white/10 bg-linear-to-br ${card.accent} p-4`}
                >
                  <card.icon className="w-5 h-5 text-white/70 mb-3" />
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-300">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {auxCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{card.label}</p>
                      <p className="text-xl font-semibold text-white">{card.value}</p>
                    </div>
                    <card.icon className="w-5 h-5 text-zion-gold" />
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-linear-to-r from-zion-gold via-zion-purple to-transparent" />
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-[28px] border border-white/10 bg-black/60 backdrop-blur-xl p-6 flex flex-col gap-6"
          >
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-[0.3em]">Latest block</p>
              <h3 className="text-3xl font-semibold text-white">
                #{stats.latest_block?.height ?? stats.block_height ?? '—'}
              </h3>
              <p className="text-sm text-gray-400">{formattedTimestamp}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-gray-400 mb-2">Hash</p>
              <p className="font-mono text-xs text-zion-cyan break-all">
                {stats.latest_block?.hash ?? 'Waiting for signal'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Mempool</p>
                <p className="text-xl font-semibold text-white">{(stats.mempool_size ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Difficulty</p>
                <p className="text-xl font-semibold text-white">{(stats.difficulty ?? 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-linear-to-br from-zion-purple/20 to-zion-cyan/10 p-4 text-sm text-gray-200">
              Blockchain telemetry pulled live from TestNet API every 12 s.
              3 seed nodes (Helsinki, Usa, Asia) synced and mining.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
