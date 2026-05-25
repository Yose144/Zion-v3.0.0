// ─── ZION Dashboard v2 — Overview Tab ───────────────────────────────────────
import React from 'react';
import { Cpu, Zap, Users, Layers, HardDrive, Activity } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { useAlertStore } from '../../stores/alertStore';
import { Card } from '../ui/Card';
import { HealthBadge } from '../ui/Badge';
import { CardSkeleton } from '../ui/Skeleton';
import type { HealthStatus } from '../../types/api';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: 'gold' | 'purple' | 'cyan' | 'green';
}) {
  const COLORS = {
    gold:   'text-(--color-zion-gold)',
    purple: 'text-(--color-zion-purple)',
    cyan:   'text-(--color-zion-cyan)',
    green:  'text-(--color-zion-green)',
  };
  return (
    <Card accent={accent} className="flex-1 min-w-[140px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-(--color-text-muted) mb-1">{label}</p>
          <p className={`text-2xl font-bold font-mono ${COLORS[accent]}`}>{value}</p>
          {sub && <p className="text-xs text-(--color-text-muted) mt-0.5">{sub}</p>}
        </div>
        <Icon size={20} className={`${COLORS[accent]} opacity-50`} />
      </div>
    </Card>
  );
}

// ── Resource bar ──────────────────────────────────────────────────────────────

function ResourceBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const safeP = Math.min(100, Math.max(0, pct));
  const warn = safeP > 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-(--color-text-muted)">{label}</span>
        <span className={warn ? 'text-(--color-zion-red)' : 'text-(--color-text)'}>{safeP.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-(--color-border)">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${warn ? 'bg-(--color-zion-red)' : color}`}
          style={{ width: `${safeP}%` }}
        />
      </div>
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({ name, health, extra }: { name: string; health: HealthStatus; extra?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-(--color-border-dim) last:border-0">
      <span className="text-sm text-(--color-text) font-mono">{name}</span>
      <div className="flex items-center gap-3">
        {extra && <span className="text-xs text-(--color-text-muted)">{extra}</span>}
        <HealthBadge status={health} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  const cpuPct = res?.cpu_percent ?? 0;
  const ramPct = res ? (res.ram_used_mb / res.ram_total_mb) * 100 : 0;
  const diskPct = res ? (res.disk_used_gb / res.disk_total_gb) * 100 : 0;

  const activeAlerts = alerts.filter(a => !a.dismissed && (a.severity === 'error' || a.severity === 'critical'));

  return (
    <div className="p-6 space-y-6">

      {/* Connection status banner */}
      {!connected && (
        <div className="rounded-lg bg-yellow-900/30 border border-yellow-800/60 px-4 py-2 text-xs text-yellow-300 flex items-center gap-2">
          <Activity size={14} className="shrink-0" />
          WebSocket disconnected — using 5s polling. Data may be slightly delayed.
        </div>
      )}

      {/* Critical alerts banner */}
      {activeAlerts.length > 0 && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/60 px-4 py-2 text-xs text-red-300 space-y-0.5">
          {activeAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="font-semibold">[{a.severity.toUpperCase()}]</span>
              <span>{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hero stats */}
      {status === null ? (
        <div className="flex flex-wrap gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <StatCard
            label="Block Height"
            value={node1?.block_height?.toLocaleString() ?? '—'}
            sub={node1?.syncing ? 'syncing...' : 'in sync'}
            icon={Layers}
            accent="gold"
          />
          <StatCard
            label="Hashrate"
            value={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : '—'}
            sub={miner?.running ? 'mining' : 'stopped'}
            icon={Zap}
            accent="cyan"
          />
          <StatCard
            label="Peers"
            value={node1?.peers ?? '—'}
            sub="connected"
            icon={Users}
            accent="purple"
          />
          <StatCard
            label="CPU"
            value={`${cpuPct.toFixed(1)}%`}
            sub={res ? `${res.ram_used_mb} / ${res.ram_total_mb} MB RAM` : undefined}
            icon={Cpu}
            accent="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Services health */}
        <Card title="Services" accent="purple" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <div>
              <ServiceRow name="node1" health={health?.node1 ?? 'unknown'} extra={node1 ? `h:${node1.block_height}` : undefined} />
              <ServiceRow name="node2" health={health?.node2 ?? 'unknown'} />
              <ServiceRow name="pool"  health={health?.pool  ?? 'unknown'} extra={pool ? `${pool.connected_miners} miners` : undefined} />
              <ServiceRow name="pool-edge" health={health?.['pool-edge'] ?? 'unknown'} />
              <ServiceRow name="miner" health={health?.miner ?? 'unknown'} extra={miner ? `${(miner.hashrate_hs / 1000).toFixed(1)} KH/s` : undefined} />
            </div>
            <div>
              <ServiceRow name="bridge"       health={health?.bridge       ?? 'unknown'} />
              <ServiceRow name="dao"          health={health?.dao          ?? 'unknown'} />
              <ServiceRow name="swap"         health={health?.swap         ?? 'unknown'} />
              <ServiceRow name="warp"         health={health?.warp         ?? 'unknown'} />
              <ServiceRow name="hiran"        health={health?.hiran        ?? 'unknown'} />
              <ServiceRow name="hiranyagarbha" health={health?.hiranyagarbha ?? 'unknown'} />
            </div>
          </div>
        </Card>

        {/* Resources */}
        <Card title="Resources" accent="cyan">
          <div className="space-y-4">
            <ResourceBar label="CPU" pct={cpuPct} color="bg-(--color-zion-cyan)" />
            <ResourceBar label="RAM" pct={ramPct} color="bg-(--color-zion-purple)" />
            <ResourceBar label="Disk" pct={diskPct} color="bg-(--color-zion-gold)" />
            {miner?.gpu_temp && (
              <ResourceBar
                label={`GPU Temp (${miner.gpu_temp}°C)`}
                pct={(miner.gpu_temp / 100) * 100}
                color="bg-orange-500"
              />
            )}
          </div>

          {/* Mempool quick stat */}
          <div className="mt-4 pt-4 border-t border-(--color-border-dim) grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-(--color-text-muted)">Mempool</p>
              <p className="text-lg font-mono font-bold text-(--color-zion-gold)">{node1?.mempool_size ?? '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-(--color-text-muted)">Pool shares</p>
              <p className="text-lg font-mono font-bold text-(--color-zion-green)">{pool?.accepted_shares?.toLocaleString() ?? '—'}</p>
            </div>
          </div>

          {/* Last updated */}
          {lastUpd && (
            <p className="mt-3 text-[10px] text-(--color-text-muted) text-right">
              Updated {new Date(lastUpd).toLocaleTimeString()}
            </p>
          )}
        </Card>

      </div>

      {/* Pool detail */}
      {pool && (
        <Card title="Pool" accent="gold">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {([
              ['Miners', pool.connected_miners],
              ['Hashrate', `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s`],
              ['Accepted', pool.accepted_shares?.toLocaleString()],
              ['Rejected', pool.rejected_shares?.toLocaleString()],
            ] as [string, string | number][]).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-(--color-text-muted)">{k}</p>
                <p className="text-xl font-mono font-bold text-(--color-text)">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}
