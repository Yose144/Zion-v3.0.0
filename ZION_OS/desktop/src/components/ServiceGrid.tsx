import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ServiceHealth } from '../lib/api';
import { controlAction } from '../lib/api';

interface Props {
  services: ServiceHealth[];
}

function statusClass(s: ServiceHealth): string {
  const st = s.status || (s.alive ? 'running' : 'down');
  if (st === 'running' || st === 'online') return 'status-live';
  if (s.derived === 'degraded') return 'status-degraded';
  return 'status-down';
}

function statusText(s: ServiceHealth): string {
  const st = s.status || (s.alive ? 'running' : 'down');
  if (st === 'running' || st === 'online') return 'LIVE';
  if (s.derived === 'degraded') return 'DEGRADED';
  return 'DOWN';
}

function statusBadgeClass(s: ServiceHealth): string {
  const st = s.status || (s.alive ? 'running' : 'down');
  if (st === 'running' || st === 'online') return 'zion-badge-green';
  if (s.derived === 'degraded') return 'zion-badge-amber';
  return 'zion-badge-red';
}

function detailLine(s: ServiceHealth): string {
  if (s.kind === 'node' && s.meta?.chain_height != null) return `Height ${Number(s.meta.chain_height).toLocaleString()}`;
  if (s.kind === 'pool' && s.meta?.active_miners != null) return `${s.meta.active_miners} miners`;
  if (s.kind === 'miner' && s.meta?.hashrate != null) return `${(s.meta.hashrate as number).toFixed(2)} KH/s`;
  if (s.depends_on?.length) return `Needs ${s.depends_on.join(', ')}`;
  return '—';
}

export default function ServiceGrid({ services }: Props) {
  if (!services.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="zion-card animate-pulse h-28" />
        ))}
      </div>
    );
  }

  const order: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, L6: 6, Infra: 7 };
  const sorted = [...services].sort((a, b) => (order[a.level] || 9) - (order[b.level] || 9));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map(s => {
        const sc = statusClass(s);
        const st = statusText(s);
        const badgeClass = statusBadgeClass(s);
        const isLive = sc === 'status-live';
        const icon = s.icon || '⚙️';

        return (
          <div key={s.id} className={`zion-card zion-card-hover ${sc} relative overflow-hidden`}>
            <div className="flex items-start justify-between mb-2 relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{s.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{s.level || ''}{s.kind ? ` · ${s.kind}` : ''}</div>
                </div>
              </div>
              <span className={`zion-badge ${badgeClass}`}>{st}</span>
            </div>
            <div className="text-[10px] text-gray-300 font-mono mb-3 relative z-10">{detailLine(s)}</div>
            <div className="flex gap-1.5 relative z-10 flex-wrap">
              {s.actions?.map(a => (
                <button
                  key={a}
                  onClick={() => controlAction(a)}
                  className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition"
                >
                  {a}
                </button>
              ))}
              {s.log && (
                <button
                  onClick={() => window.open(`/api/service-log?id=${encodeURIComponent(s.id)}&lines=200`, '_blank')}
                  className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition"
                >
                  Log
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
