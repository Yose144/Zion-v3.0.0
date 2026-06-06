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

function statusColor(s: ServiceHealth): string {
  const st = s.status || (s.alive ? 'running' : 'down');
  if (st === 'running' || st === 'online') return 'text-emerald-400';
  if (s.derived === 'degraded') return 'text-amber-400';
  return 'text-red-400';
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
          <div key={i} className="zion-card animate-pulse h-28 bg-white/5" />
        ))}
      </div>
    );
  }

  const order: Record<string, number> = { L1: 1, L2: 2, L3: 3 };
  const sorted = [...services].sort((a, b) => (order[a.level] || 9) - (order[b.level] || 9));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map(s => {
        const sc = statusClass(s);
        const st = statusText(s);
        const stColor = statusColor(s);
        const isLive = sc === 'status-live';

        return (
          <div key={s.id} className={`zion-card zion-card-hover ${sc} relative overflow-hidden`}>
            <div className="flex items-start justify-between mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-base">{s.icon || '⚙️'}</span>
                <div>
                  <div className="text-xs font-semibold text-white">{s.name}</div>
                  <div className="text-[10px] text-gray-400">{s.level || ''}</div>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stColor} bg-black/30`}>{st}</span>
            </div>
            <div className="text-[10px] text-gray-300 font-mono mb-2 relative z-10">{detailLine(s)}</div>
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
