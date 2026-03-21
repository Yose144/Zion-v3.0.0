'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, BarChart3, Cpu, Database, ExternalLink, Globe,
  HardDrive, Heart, Layers, Monitor, RefreshCw, Server, Sparkles, Zap,
} from 'lucide-react';
import { SITE_RELEASE_LABEL } from '@/lib/site';

/* ═══════════════════════ TYPES ═══════════════════════ */
interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface MonitoringData {
  chainHeight: number | null;
  peerCount: number | null;
  mempoolSize: number | null;
  blocksAccepted: number | null;
  poolActiveSessions: number | null;
  poolAcceptedTotal: number | null;
  poolRejectedTotal: number | null;
  poolAcceptRate: number | null;
  poolUptime: number | null;
  pplnsRegisteredMiners: number | null;
  pplnsWindowSize: number | null;
  templateHeight: number | null;
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt(n: number | null | undefined) {
  return n != null ? n.toLocaleString() : '—';
}

function fmtUptime(secs: number | null | undefined) {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

async function queryPrometheus(query: string): Promise<PrometheusResult[]> {
  const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

async function fetchMetrics(): Promise<MonitoringData> {
  const queries = [
    'zion_chain_height',
    'zion_peer_count',
    'zion_mempool_size',
    'zion_blocks_accepted_total',
    'zion_pool_active_sessions',
    'zion_pool_accepted_total',
    'zion_pool_rejected_total',
    'zion_pool_accept_rate_pct',
    'zion_pool_uptime_seconds',
    'zion_pplns_registered_miners',
    'zion_pplns_window_size',
    'zion_template_height',
  ];

  const results = await Promise.allSettled(queries.map(q => queryPrometheus(q)));
  const vals = results.map(r => {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      return parseFloat(r.value[0].value[1]);
    }
    return null;
  });

  return {
    chainHeight:          vals[0],
    peerCount:            vals[1],
    mempoolSize:          vals[2],
    blocksAccepted:       vals[3],
    poolActiveSessions:   vals[4],
    poolAcceptedTotal:    vals[5],
    poolRejectedTotal:    vals[6],
    poolAcceptRate:       vals[7],
    poolUptime:           vals[8],
    pplnsRegisteredMiners: vals[9],
    pplnsWindowSize:      vals[10],
    templateHeight:       vals[11],
  };
}

/* ═══════════════════════ COMPONENTS ═══════════════════════ */

function StatCard({ label, value, icon: Icon, accent = 'text-zion-cyan' }: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="zion-panel rounded-xl bg-black/60 border border-white/10 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
        <Icon className={`h-4 w-4 ${accent}`} />
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold ${accent}`}>{value}</div>
    </div>
  );
}

/* ═══════════════════════ MAIN ═══════════════════════ */

export default function MonitoringClient() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await fetchMetrics();
      setData(m);
      setLastUpdate(new Date());
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15_000);
    return () => clearInterval(iv);
  }, [refresh]);

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-emerald-500/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-panel rounded-3xl bg-black/60 p-6 md:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-400 uppercase">
                <Monitor className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · Monitoring
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                Network Monitoring
              </h1>
              <p className="text-gray-400 max-w-2xl text-sm md:text-base">
                Live Prometheus metrics from the V3 core node, mining pool, and infrastructure.
                Auto-refreshes every 15 seconds.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/grafana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                Open Grafana Dashboard
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:border-white/40 px-5 py-3 text-sm font-medium text-gray-300 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          {lastUpdate && (
            <div className="mt-4 text-xs text-gray-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </motion.section>

        {/* ═══════ CORE NODE METRICS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-zion-cyan" />
            Core Node
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Layers}   label="Chain Height"    value={fmt(data?.chainHeight)} accent="text-zion-gold" />
            <StatCard icon={Layers}   label="Template Height" value={fmt(data?.templateHeight)} accent="text-amber-400" />
            <StatCard icon={Globe}    label="Peers"           value={fmt(data?.peerCount)} accent="text-zion-cyan" />
            <StatCard icon={Database} label="Mempool"         value={fmt(data?.mempoolSize)} accent="text-purple-400" />
            <StatCard icon={Sparkles} label="Blocks Accepted" value={fmt(data?.blocksAccepted)} accent="text-emerald-400" />
            <StatCard icon={Activity} label="Node Status"     value={data?.chainHeight != null ? 'Online' : '—'} accent={data?.chainHeight != null ? 'text-emerald-400' : 'text-gray-500'} />
          </div>
        </motion.section>

        {/* ═══════ POOL METRICS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-zion-gold" />
            Mining Pool
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Zap}      label="Active Miners"    value={fmt(data?.poolActiveSessions)} accent="text-zion-gold" />
            <StatCard icon={Heart}    label="PPLNS Miners"     value={fmt(data?.pplnsRegisteredMiners)} accent="text-pink-400" />
            <StatCard icon={Sparkles} label="Accepted Shares"  value={fmt(data?.poolAcceptedTotal)} accent="text-emerald-400" />
            <StatCard icon={Activity} label="Rejected Shares"  value={fmt(data?.poolRejectedTotal)} accent="text-red-400" />
            <StatCard icon={BarChart3} label="Accept Rate"     value={data?.poolAcceptRate != null ? `${data.poolAcceptRate.toFixed(1)}%` : '—'} accent="text-emerald-400" />
            <StatCard icon={HardDrive} label="Pool Uptime"     value={fmtUptime(data?.poolUptime)} accent="text-zion-cyan" />
          </div>
        </motion.section>

        {/* ═══════ MONITORING STACK INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="zion-panel rounded-2xl bg-black/40 border border-white/10 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-emerald-400" />
            Monitoring Stack
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              { name: 'Prometheus', ver: 'v2.53.0', desc: 'Metrics collection & alerting', color: 'text-orange-400' },
              { name: 'Grafana', ver: 'v11.1.0', desc: '22-panel V3 dashboard', color: 'text-zion-gold' },
              { name: 'Node Exporter', ver: 'v1.8.1', desc: 'Host system metrics', color: 'text-zion-cyan' },
              { name: 'Redis Exporter', ver: 'v1.61.0', desc: 'Redis persistence metrics', color: 'text-red-400' },
              { name: 'Alertmanager', ver: 'v0.27.0', desc: 'Alert routing & notifications', color: 'text-purple-400' },
              { name: 'Core Metrics', ver: 'port 9115', desc: 'V3 node Prometheus endpoint', color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                <div className={`mt-0.5 h-2 w-2 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                <div>
                  <div className="font-medium text-white">
                    {s.name} <span className="text-gray-500 font-normal">{s.ver}</span>
                  </div>
                  <div className="text-gray-400 text-xs">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
