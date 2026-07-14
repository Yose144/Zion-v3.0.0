import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import { fetchSecurityStatus, type SecurityStatus } from '../lib/api';

export default function SecurityPanel() {
  const [data, setData] = useState<SecurityStatus | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchSecurityStatus();
    if (s) setData(s);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const summary = data?.summary;
  const checks = data?.checks ?? [];
  const critical = checks.filter(c => c.severity === 'critical' && !c.ok);
  const warnings = checks.filter(c => c.severity === 'warning' && !c.ok);

  if (!data) {
    return (
      <section className="zion-card">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-zion-cyan" />
          <h2 className="text-sm font-bold">Security</h2>
        </div>
        <div className="text-xs text-gray-500">Loading…</div>
      </section>
    );
  }

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-zion-cyan" />
          <h2 className="text-sm font-bold">Security</h2>
        </div>
        <span className={`zion-badge ${critical.length ? 'zion-badge-red' : warnings.length ? 'zion-badge-amber' : 'zion-badge-green'}`}>
          {critical.length ? `${critical.length} critical` : warnings.length ? `${warnings.length} warnings` : 'All OK'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-red-400">{summary?.open_blockers ?? critical.length}</div>
          <div className="text-[9px] text-gray-400">Blockers</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-amber-400">{summary?.warnings ?? warnings.length}</div>
          <div className="text-[9px] text-gray-400">Warnings</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">{summary?.ok ?? checks.filter(c => c.ok).length}</div>
          <div className="text-[9px] text-gray-400">OK</div>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {checks.slice(0, 20).map((c) => {
          const Icon = c.ok ? ShieldCheck : ShieldAlert;
          const color = c.ok ? 'text-emerald-400' : c.severity === 'critical' ? 'text-red-400' : 'text-amber-400';
          return (
            <div key={c.id} className="flex items-start gap-2 text-xs p-2 rounded bg-white/5 border border-white/5">
              <Icon size={12} className={`mt-0.5 ${color}`} />
              <div className="min-w-0">
                <div className="font-medium text-gray-200">{c.id}</div>
                <div className="text-[10px] text-gray-500 truncate">{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
