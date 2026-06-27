'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';

interface NetworkMetrics {
  blockHeight: number;
  hashrate: number;
  activeMiners: number;
  timestamp: number;
}

export default function NetworkPulse() {
  const [metrics, setMetrics] = useState<NetworkMetrics[]>([]);
  const [currentHashrate, setCurrentHashrate] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  usePolling(() => {
    const newMetric: NetworkMetrics = {
      blockHeight: Math.floor(Math.random() * 1000) + 5000,
      hashrate: Math.random() * 100 + 50,
      activeMiners: Math.floor(Math.random() * 20) + 5,
      timestamp: Date.now(),
    };

    setMetrics((prev) => {
      const updated = [...prev, newMetric].slice(-20);

      if (updated.length >= 2) {
        const last = updated[updated.length - 1].hashrate;
        const previous = updated[updated.length - 2].hashrate;
        setTrend(last > previous ? 'up' : last < previous ? 'down' : 'stable');
      }

      return updated;
    });

    setCurrentHashrate(newMetric.hashrate);
  }, 3000);

  const maxHashrate = Math.max(...metrics.map((m) => m.hashrate), 100);
  const normalizedData = metrics.map((m) => (m.hashrate / maxHashrate) * 100);
  const latestMetric = metrics[metrics.length - 1];

  return (
    <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-5 h-5 text-zion-cyan" />
            <motion.span
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-zion-cyan/20"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Network Pulse</h3>
            <p className="text-xs text-gray-400">Real-time activity stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
          {trend === 'down' && <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />}
          <span className={`text-sm font-semibold ${
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {currentHashrate.toFixed(1)} H/s
          </span>
        </div>
      </div>

      {/* Mini sparkline graf */}
      <div className="relative h-16 rounded-lg bg-black/60 border border-white/5 overflow-hidden">
        <div className="absolute inset-0 flex items-end justify-between px-1 gap-[2px]">
          {normalizedData.map((value, idx) => (
            <motion.div
              key={idx}
              initial={{ height: 0 }}
              animate={{ height: `${value}%` }}
              transition={{ duration: 0.3 }}
              className={`flex-1 rounded-t ${
                idx === normalizedData.length - 1
                  ? 'bg-gradient-to-t from-zion-cyan to-zion-purple'
                  : 'bg-gradient-to-t from-zion-cyan/50 to-zion-purple/30'
              }`}
              style={{ minWidth: '2px' }}
            />
          ))}
        </div>

        {/* Overlay s grid linkami */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full flex flex-col justify-between py-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-full h-px bg-white/5" />
            ))}
          </div>
        </div>
      </div>

      {/* Statistiky */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="text-center">
          <p className="text-xs text-gray-400">Blocks</p>
          <p className="text-sm font-semibold text-white">
            {latestMetric?.blockHeight ? latestMetric.blockHeight.toLocaleString() : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Miners</p>
          <p className="text-sm font-semibold text-white">
            {latestMetric?.activeMiners ?? '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Updates</p>
          <div className="flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
            <p className="text-sm font-semibold text-white">3s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
