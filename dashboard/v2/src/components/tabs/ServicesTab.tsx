// ─── ZION Dashboard v2 — Services Tab (v2.9 aesthetic) ──────────────────────
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Activity } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { HealthBadge } from '../ui/Badge';
import type { HealthStatus, ServiceName } from '../../types/api';

const ALL_SERVICES: ServiceName[] = [
  'node1', 'node2', 'pool', 'pool-edge', 'miner',
  'bridge', 'dao', 'swap', 'warp', 'oasis',
  'hiran', 'hiranyagarbha', 'freeworld', 'space',
];

const SERVICE_PORTS: Partial<Record<ServiceName, string>> = {
  node1:          ':8443 RPC',
  node2:          ':8443 RPC',
  pool:           ':8444 Stratum',
  'pool-edge':    ':8444 Stratum',
  hiran:          ':8002 API',
  hiranyagarbha:  ':8001 API',
};

const SERVICE_LAYER: Partial<Record<ServiceName, string>> = {
  node1: 'L1', node2: 'L1', pool: 'L1', 'pool-edge': 'L1', miner: 'L1',
  bridge: 'L2', dao: 'L2', swap: 'L2',
  warp: 'L3',
  oasis: 'L4', space: 'L5', freeworld: 'L6',
  hiran: 'AI', hiranyagarbha: 'AI',
};

const LAYER_COLOR: Record<string, string> = {
  L1: 'rgba(255,215,0,0.15)',
  L2: 'rgba(147,51,234,0.12)',
  L3: 'rgba(6,182,212,0.12)',
  L4: 'rgba(249,115,22,0.1)',
  L5: 'rgba(34,197,94,0.1)',
  L6: 'rgba(168,85,247,0.1)',
  AI: 'rgba(6,182,212,0.15)',
};

function ServiceCard({ name, health }: { name: ServiceName; health: HealthStatus }) {
  const port = SERVICE_PORTS[name];
  const layer = SERVICE_LAYER[name] ?? '';
  const layerBg = LAYER_COLOR[layer] ?? 'rgba(255,255,255,0.04)';

  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/5 p-4 hover:border-white/15 hover:bg-white/8 transition-all duration-200"
      style={{ borderLeft: `2px solid ${layerBg.replace('0.', '0.4')}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-mono font-semibold text-slate-200 truncate">{name}</p>
          {port && <p className="text-[11px] text-slate-500 mt-0.5">{port}</p>}
        </div>
        {layer && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 shrink-0">
            {layer}
          </span>
        )}
      </div>
      <HealthBadge status={health} />
    </div>
  );
}

const STATUS_COLORS: Record<HealthStatus, string> = {
  healthy:  'rgb(34,197,94)',
  degraded: 'rgb(249,115,22)',
  down:     'rgb(239,68,68)',
  unknown:  'rgb(100,116,139)',
};

export default function ServicesTab() {
  const health      = useStatusStore(s => s.health);
  const fetchHealth = useStatusStore(s => s.fetchHealth);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await fetchHealth();
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = (['healthy', 'degraded', 'down', 'unknown'] as HealthStatus[]).map(s => ({
    status: s,
    count: health ? Object.values(health).filter(h => h === s).length : 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 space-y-6 max-w-[1600px] mx-auto"
    >

      {/* Main panel */}
      <div className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
            <Activity size={15} className="text-zion-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Service Health</p>
            <p className="text-[11px] text-slate-500">{ALL_SERVICES.length} services monitored</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Summary pills */}
          <div className="flex flex-wrap gap-3 p-3.5 rounded-2xl bg-white/3 border border-white/8">
            {counts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: STATUS_COLORS[status],
                    boxShadow: status !== 'unknown' ? `0 0 8px ${STATUS_COLORS[status]}80` : undefined,
                  }}
                />
                <span className="text-xs text-slate-400 font-medium">
                  <span className="font-bold text-slate-200">{count}</span> {status}
                </span>
              </div>
            ))}
          </div>

          {/* Service grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {ALL_SERVICES.map(svc => (
              <ServiceCard key={svc} name={svc} health={health?.[svc] ?? 'unknown'} />
            ))}
          </div>

        </div>
      </div>

      {/* Dependency graph panel */}
      <div className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
            <Activity size={15} className="text-zion-purple" />
          </div>
          <p className="text-sm font-semibold text-white">Dependency Graph</p>
        </div>
        <div className="p-6">
          <div className="rounded-2xl bg-white/5 border border-white/8 p-3">
            <div
              className="font-mono text-xs space-y-1.5 p-4 rounded-xl overflow-auto"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-gradient-soft font-bold mb-2">ZION Service Architecture</div>
              <div className="text-slate-400">
                <span className="text-yellow-400">node1</span>
                <span className="text-slate-600"> ←── </span>
                <span className="text-cyan-400">pool</span>
                <span className="text-slate-600"> ←── </span>
                <span className="text-violet-400">miner</span>
              </div>
              <div className="text-slate-400">
                <span className="text-yellow-400">node1</span>
                <span className="text-slate-600"> ←── </span>
                <span className="text-cyan-400">pool-edge</span>
                <span className="text-slate-600"> ←── (remote miners)</span>
              </div>
              <div className="text-slate-400">
                <span className="text-yellow-400">node1</span>
                <span className="text-slate-600"> ←── </span>
                <span className="text-purple-400">bridge / dao / swap</span>
                <span className="text-slate-600"> (L2)</span>
              </div>
              <div className="text-slate-400">
                <span className="text-yellow-400">node1</span>
                <span className="text-slate-600"> ←── </span>
                <span className="text-cyan-400">warp</span>
                <span className="text-slate-600"> (L3)</span>
              </div>
              <div className="text-slate-400">
                <span className="text-cyan-300">hiran</span>
                <span className="text-slate-600"> → </span>
                <span className="text-cyan-400">hiranyagarbha</span>
                <span className="text-slate-600"> → </span>
                <span className="text-yellow-400">node1</span>
              </div>
              <div className="text-slate-500 mt-2">node2 (edge) syncs from node1 via P2P · port 8333</div>
            </div>
          </div>
        </div>
      </div>

    </motion.div>
  );
}
