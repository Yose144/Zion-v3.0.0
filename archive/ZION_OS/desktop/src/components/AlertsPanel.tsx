import { AlertTriangle, AlertCircle, Info, CheckCircle2, Zap } from 'lucide-react';
import type { AlertItem } from '../lib/api';
import { controlAction } from '../lib/api';

interface Props {
  alerts: AlertItem[];
}

const severityConfig = {
  critical: { icon: AlertTriangle, className: 'bg-red-900/20 border-red-500/30 text-red-300' },
  warning: { icon: AlertCircle, className: 'bg-amber-900/20 border-amber-500/30 text-amber-300' },
  info: { icon: Info, className: 'bg-blue-900/20 border-blue-500/30 text-blue-300' },
  success: { icon: CheckCircle2, className: 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300' },
};

export default function AlertsPanel({ alerts }: Props) {
  const critical = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-red-400" />
          <h2 className="text-sm font-bold">Alerts</h2>
        </div>
        {critical.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-600/30 text-red-300 text-[10px] font-bold">
            {critical.length}
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No alerts</div>
        ) : (
          alerts.map((a, i) => {
            const cfg = severityConfig[a.severity] || severityConfig.info;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${cfg.className}`}>
                <Icon size={14} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{a.title}</div>
                  <div className="text-[10px] text-gray-400 truncate">{a.detail}</div>
                </div>
                {a.action && (
                  <button
                    onClick={() => controlAction(a.action!)}
                    className="flex-shrink-0 text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition"
                  >
                    Fix
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
