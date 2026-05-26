// ─── ZION Dashboard v2 — Overview Tab (v2.9 aesthetic) ──────────────────────
import React from 'react';
import { Cpu, Zap, Users, Layers, Activity, TrendingUp } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { useAlertStore } from '../../stores/alertStore';
import { Card } from '../ui/Card';
import { HealthBadge } from '../ui/Badge';
import { CardSkeleton } from '../ui/Skeleton';
import type { HealthStatus } from '../../types/api';

// ── Hero stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
}) {
  return (
    <div
      className="zion-panel zion-panel-hover flex-1 min-w-[150px] p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: gradient, opacity: 0.85 }}
        >
          <Icon size={14} className="text-white" />
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold font-mono tracking-tight"
          style={{
            backgroundImage: gradient,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Resource bar ───────────────────────────────────────────────────────────────

function ResourceBar({
  label, pct, gradient,
}: {
  label: string;
  pct: number;
  gradient: string;
}) {
  const safeP = Math.min(100, Math.max(0, pct));
  const warn = safeP > 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className={`font-mono font-semibold ${warn ? 'text-red-400' : 'text-slate-300'}`}>
          {safeP.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-1.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{
            width: `${safeP}%`,
            background: warn ? 'rgb(239 68 68)' : gradient,
            boxShadow: warn ? '0 0 8px rgba(239,68,68,0.5)' : undefined,
          }}
        />
      </div>
    </div>
  );
}

// ── Service row ────────────────────────────────────────────────────────────────

function ServiceRow({ name, health, extra }: { name: string; health: HealthStatus; extra?: string }) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-sm text-slate-300 font-mono">{name}</span>
      <div className="flex items-center gap-3">
        {extra && <span className="text-xs text-slate-500 font-mono">{extra}</span>}
        <HealthBadge status={health} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

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
    <div className="p-6 space-y-6">

      {/* Connection status banner */}
      {!connected && (
        <div
          className="rounded-xl px-4 py-2.5 text-xs text-yellow-300 flex items-center gap-2.5 font-medium"
          style={{
            background: 'rgba(161,98,7,0.15)',
            border: '1px solid rgba(234,179,8,0.25)',
          }}
        >
          <Activity size={13} className="shrink-0 text-yellow-400" />
          WebSocket disconnected — using 5 s polling. Data may be slightly delayed.
        </div>
      )}

      {/* Critical alerts banner */}
      {activeAlerts.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-xs space-y-1"
          style={{
            background: 'rgba(127,29,29,0.25)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          {activeAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2 text-red-300">
              <span
                className="font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                style={{ background: 'rgba(239,68,68,0.2)', color: 'rgb(248 113 113)' }}
              >
                {a.severity}
              </span>
              <span className="text-red-200">{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hero stat cards ── */}
      {status === null ? (
        <div className="flex flex-wrap gap-4">
          {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <StatCard
            label="Block Height"
            value={node1?.block_height?.toLocaleString() ?? '—'}
            sub={node1?.syncing ? 'syncing…' : 'in sync'}
            icon={Layers}
            gradient="linear-gradient(135deg, rgb(255,215,0), rgb(251,191,36))"
          />
          <StatCard
            label="Hashrate"
            value={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : '—'}
            sub={miner?.running ? 'GPU mining' : 'stopped'}
            icon={Zap}
            gradient="linear-gradient(135deg, rgb(6,182,212), rgb(34,211,238))"
          />
          <StatCard
            label="Peers"
            value={node1?.peers ?? '—'}
            sub="connected"
            icon={Users}
            gradient="linear-gradient(135deg, rgb(147,51,234), rgb(168,85,247))"
          />
          <StatCard
            label="CPU"
            value={`${cpuPct.toFixed(1)}%`}
            sub={res ? `${res.ram_used_mb} / ${res.ram_total_mb} MB RAM` : undefined}
            icon={Cpu}
            gradient="linear-gradient(135deg, rgb(34,197,94), rgb(74,222,128))"
          />
        </div>
      )}

      {/* ── Services + Resources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Services health */}
        <Card title="Services" accent="purple" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <div>
              <ServiceRow name="node1"    health={health?.node1    ?? 'unknown'} extra={node1 ? `h:${node1.block_height}` : undefined} />
              <ServiceRow name="node2"    health={health?.node2    ?? 'unknown'} />
              <ServiceRow name="pool"     health={health?.pool     ?? 'unknown'} extra={pool ? `${pool.connected_miners} miners` : undefined} />
              <ServiceRow name="pool-edge" health={health?.['pool-edge'] ?? 'unknown'} />
              <ServiceRow name="miner"    health={health?.miner    ?? 'unknown'} extra={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : undefined} />
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
        </Card>

        {/* Resources */}
        <Card title="Resources" accent="cyan">
          <div className="space-y-4">
            <ResourceBar
              label="CPU"
              pct={cpuPct}
              gradient="linear-gradient(90deg, rgb(6,182,212), rgb(34,211,238))"
            />
            <ResourceBar
              label="RAM"
              pct={ramPct}
              gradient="linear-gradient(90deg, rgb(147,51,234), rgb(168,85,247))"
            />
            <ResourceBar
              label="Disk"
              pct={diskPct}
              gradient="linear-gradient(90deg, rgb(255,215,0), rgb(251,191,36))"
            />
            {miner?.gpu_temp && (
              <ResourceBar
                label={`GPU  ${miner.gpu_temp}°C`}
                pct={(miner.gpu_temp / 100) * 100}
                gradient="linear-gradient(90deg, rgb(249,115,22), rgb(251,146,60))"
              />
            )}
          </div>

          {/* Mempool + Pool shares */}
          <div
            className="mt-4 pt-4 grid grid-cols-2 gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Mempool</p>
              <p className="text-xl font-mono font-bold text-gradient-soft">
                {node1?.mempool_size ?? '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Shares</p>
              <p className="text-xl font-mono font-bold text-gradient-soft">
                {pool?.accepted_shares?.toLocaleString() ?? '—'}
              </p>
            </div>
          </div>

          {lastUpd && (
            <p className="mt-3 text-[10px] text-slate-600 text-right font-medium">
              Updated {new Date(lastUpd).toLocaleTimeString()}
            </p>
          )}
        </Card>

      </div>

      {/* ── Pool detail ── */}
      {pool && (
        <div className="zion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-gradient-soft">
              Pool Metrics
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {([
              ['Miners',   pool.connected_miners,                        'rgb(255,215,0)'],
              ['Hashrate', `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s`, 'rgb(6,182,212)'],
              ['Accepted', pool.accepted_shares?.toLocaleString(),       'rgb(34,197,94)'],
              ['Rejected', pool.rejected_shares?.toLocaleString(),       'rgb(239,68,68)'],
            ] as [string, string | number, string][]).map(([k, v, c]) => (
              <div key={k} className="zion-panel-soft rounded-xl py-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{k}</p>
                <p
                  className="text-xl font-mono font-bold"
                  style={{ color: c }}
                >
                  {v ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
