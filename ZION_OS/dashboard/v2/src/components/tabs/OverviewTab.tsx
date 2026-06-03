// ─── ZION Dashboard v2 — Overview Tab (website v2.9 style) ──────────────────
import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Users, Layers, Activity, TrendingUp, Server, Brain } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { useAlertStore } from '../../stores/alertStore';
import { HealthBadge } from '../ui/Badge';
import { ChecklistWidget } from '../ui/ChecklistWidget';
import type { HealthStatus } from '../../types/api';

const FADE_UP = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

// ── Stat card — same as website MiniMetric ──────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;         // e.g. 'text-zion-gold'
}) {
  const bgMap: Record<string, string> = {
    'text-zion-gold':   'bg-zion-gold/10',
    'text-zion-cyan':   'bg-zion-cyan/10',
    'text-zion-purple': 'bg-zion-purple/10',
    'text-green-400':   'bg-green-400/10',
  };
  const bg = bgMap[color] ?? 'bg-white/5';
  return (
    <div className="rounded-2xl border border-white/8 bg-black/60 backdrop-blur-2xl p-5 flex flex-col gap-3 hover:border-white/15 hover:bg-white/5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          {label}
        </span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon size={15} className={color} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold font-mono tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Resource bar ────────────────────────────────────────────────────────────
function ResourceBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const safeP = Math.min(100, Math.max(0, pct));
  const warn = safeP > 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500">{label}</span>
        <span className={`font-mono font-semibold ${warn ? 'text-red-400' : 'text-gray-300'}`}>
          {safeP.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${warn ? 'bg-red-500' : color}`}
          style={{ width: `${safeP}%` }}
        />
      </div>
    </div>
  );
}

// ── Service row ─────────────────────────────────────────────────────────────
function ServiceRow({ name, health, extra }: { name: string; health: HealthStatus; extra?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
      <span className="text-sm text-gray-300 font-mono">{name}</span>
      <div className="flex items-center gap-3">
        {extra && <span className="text-xs text-gray-500 font-mono tabular-nums">{extra}</span>}
        <HealthBadge status={health} />
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function OverviewTab() {
  const status    = useStatusStore(s => s.status);
  const health    = useStatusStore(s => s.health);
  const lastUpd   = useStatusStore(s => s.lastUpdated);
  const connected = useStatusStore(s => s.connected);
  const alerts    = useAlertStore(s => s.alerts);

  const node1 = status?.node1;
  const pool  = status?.pool;
  const miner = status?.miner;
  const res   = status?.resources;

  const cpuPct  = res?.cpu_percent ?? 0;
  const ramPct  = res ? (res.ram_used_mb / res.ram_total_mb) * 100 : 0;
  const diskPct = res ? (res.disk_used_gb / res.disk_total_gb) * 100 : 0;

  const activeAlerts = alerts.filter(
    a => !a.dismissed && (a.severity === 'error' || a.severity === 'critical')
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Connection banner */}
      {!connected && (
        <div className="rounded-2xl px-4 py-3 text-xs text-yellow-300 flex items-center gap-2.5 font-medium border border-yellow-500/20 bg-yellow-500/5">
          <Activity size={13} className="shrink-0 text-yellow-400" />
          WebSocket disconnected — using 5 s polling. Data may be slightly delayed.
        </div>
      )}

      {/* Critical alerts */}
      {activeAlerts.length > 0 && (
        <div className="rounded-2xl px-4 py-3 text-xs space-y-1 border border-red-500/20 bg-red-500/5">
          {activeAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2 text-red-300">
              <span className="font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-red-500/20 text-red-400">
                {a.severity}
              </span>
              <span>{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hero stat cards ── */}
      <motion.div
        {...FADE_UP}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="Block Height"
          value={node1?.block_height?.toLocaleString() ?? '—'}
          sub={node1?.syncing ? 'syncing…' : 'in sync'}
          icon={Layers}
          color="text-zion-gold"
        />
        <StatCard
          label="Hashrate"
          value={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : '—'}
          sub={miner?.running ? 'GPU mining' : 'stopped'}
          icon={Zap}
          color="text-zion-cyan"
        />
        <StatCard
          label="Peers"
          value={node1?.peers ?? '—'}
          sub="connected"
          icon={Users}
          color="text-zion-purple"
        />
        <StatCard
          label="CPU"
          value={`${cpuPct.toFixed(1)}%`}
          sub={res ? `${res.ram_used_mb} / ${res.ram_total_mb} MB RAM` : undefined}
          icon={Cpu}
          color="text-green-400"
        />
      </motion.div>

      {/* ── Services + Resources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Services panel */}
        <motion.div
          {...FADE_UP}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden lg:col-span-2"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Server size={15} className="text-zion-purple" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Services</h3>
              <p className="text-[11px] text-gray-500">Live health status</p>
            </div>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <ServiceRow name="node1"    health={health?.node1    ?? 'unknown'} extra={node1 ? `h:${node1.block_height}` : undefined} />
              <ServiceRow name="node2"    health={health?.node2    ?? 'unknown'} />
              <ServiceRow name="pool"     health={health?.pool     ?? 'unknown'} extra={pool ? `${pool.connected_miners} miners` : undefined} />
              <ServiceRow name="pool-edge" health={health?.['pool-edge'] ?? 'unknown'} />
              <ServiceRow name="miner"   health={health?.miner    ?? 'unknown'} extra={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : undefined} />
            </div>
            <div>
              <ServiceRow name="bridge"        health={health?.bridge        ?? 'unknown'} />
              <ServiceRow name="dao"           health={health?.dao           ?? 'unknown'} />
              <ServiceRow name="swap"          health={health?.swap          ?? 'unknown'} />
              <ServiceRow name="warp"          health={health?.warp          ?? 'unknown'} />
              <ServiceRow name="hiran"         health={health?.hiran         ?? 'unknown'} />
              <ServiceRow name="hiranyagarbha" health={health?.hiranyagarbha ?? 'unknown'} />
            </div>
          </div>
        </motion.div>

        {/* Resources panel */}
        <motion.div
          {...FADE_UP}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
              <Activity size={15} className="text-zion-cyan" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Resources</h3>
              <p className="text-[11px] text-gray-500">System utilisation</p>
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            <ResourceBar label="CPU"  pct={cpuPct}  color="bg-zion-cyan" />
            <ResourceBar label="RAM"  pct={ramPct}  color="bg-zion-purple" />
            <ResourceBar label="Disk" pct={diskPct} color="bg-zion-gold" />
            {miner?.gpu_temp && (
              <ResourceBar label={`GPU ${miner.gpu_temp}°C`} pct={(miner.gpu_temp / 100) * 100} color="bg-orange-500" />
            )}

            <div className="pt-3 border-t border-white/6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Mempool</p>
                <p className="text-xl font-mono font-bold text-zion-cyan">
                  {node1?.mempool_size ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Shares</p>
                <p className="text-xl font-mono font-bold text-zion-gold">
                  {pool?.accepted_shares?.toLocaleString() ?? '—'}
                </p>
              </div>
            </div>

            {lastUpd && (
              <p className="text-[10px] text-gray-600 text-right">
                Updated {new Date(lastUpd).toLocaleTimeString()}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Launch checklist ── */}
      <ChecklistWidget />

      {/* ── Pool metrics ── */}
      {pool && (
        <motion.div
          {...FADE_UP}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
              <TrendingUp size={15} className="text-zion-gold" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Pool Metrics</h3>
              <p className="text-[11px] text-gray-500">Real-time pool statistics</p>
            </div>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['Miners',   pool.connected_miners,                           'text-zion-gold',   'bg-zion-gold/10'],
              ['Hashrate', `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s`, 'text-zion-cyan',   'bg-zion-cyan/10'],
              ['Accepted', pool.accepted_shares?.toLocaleString(),          'text-green-400',   'bg-green-400/10'],
              ['Rejected', pool.rejected_shares?.toLocaleString(),          'text-red-400',     'bg-red-400/10'],
            ] as [string, string | number, string, string][]).map(([k, v, c, bg]) => (
              <div key={k} className={`rounded-2xl border border-white/8 ${bg} p-4 text-center`}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">{k}</p>
                <p className={`text-xl font-mono font-bold ${c}`}>{v ?? '—'}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Hiran AI status ── */}
      {(health?.hiran || health?.hiranyagarbha) && (
        <motion.div
          {...FADE_UP}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Brain size={15} className="text-zion-purple" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AI Layer</h3>
              <p className="text-[11px] text-gray-500">Hiran v2.2 + Hiranyagarbha</p>
            </div>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Hiran Inference</p>
              <HealthBadge status={health?.hiran ?? 'unknown'} />
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Hiranyagarbha</p>
              <HealthBadge status={health?.hiranyagarbha ?? 'unknown'} />
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}
