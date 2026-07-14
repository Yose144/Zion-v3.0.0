import { Activity, ExternalLink } from 'lucide-react';
import type { MonitoringStatus } from '../lib/api';

interface Props {
  monitoring: MonitoringStatus | null;
}

export default function MonitoringPanel({ monitoring }: Props) {
  const prom = monitoring?.prometheus;
  const graf = monitoring?.grafana;
  const allOk = prom?.alive && graf?.alive;

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-orange-400" />
          <h2 className="text-sm font-bold">Edge Monitoring</h2>
        </div>
        <span
          className={`zion-badge ${
            allOk
              ? 'zion-badge-green'
              : prom?.alive || graf?.alive
                ? 'zion-badge-amber'
                : 'zion-badge-red'
          }`}
        >
          {allOk ? 'ONLINE' : prom?.alive || graf?.alive ? 'PARTIAL' : 'OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="zion-panel-soft p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-orange-400">Prometheus</span>
            <span
              className={`w-2 h-2 rounded-full ${
                prom?.alive
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                  : 'bg-red-500'
              }`}
            />
          </div>
          <div className="text-xs text-gray-400 mb-1">
            Targets:{' '}
            <span className="text-white font-mono">
              {prom?.alive ? `${prom.targets_up}/${prom.targets_total} up` : '—'}
            </span>
          </div>
          <div className="text-xs text-gray-400 mb-2">
            Version: <span className="text-white font-mono">{prom?.version || '—'}</span>
          </div>
          {prom?.url && (
            <a
              href={prom.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded hover:bg-orange-500/20 transition"
            >
              <ExternalLink size={10} />
              Open Prometheus
            </a>
          )}
        </div>

        <div className="zion-panel-soft p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-cyan-400">Grafana</span>
            <span
              className={`w-2 h-2 rounded-full ${
                graf?.alive
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                  : 'bg-red-500'
              }`}
            />
          </div>
          <div className="text-xs text-gray-400 mb-1">
            Version:{' '}
            <span className="text-white font-mono">{graf?.version || '—'}</span>
          </div>
          <div className="text-xs text-gray-400 mb-2">
            Database:{' '}
            <span className="text-white font-mono">{graf?.database || '—'}</span>
          </div>
          {graf?.url && (
            <a
              href={graf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded hover:bg-cyan-500/20 transition"
            >
              <ExternalLink size={10} />
              Open Grafana
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
