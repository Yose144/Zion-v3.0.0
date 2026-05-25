// ─── ZION Dashboard v2 — Alerts Tab ─────────────────────────────────────────
import React from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useAlertStore } from '../../stores/alertStore';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDistanceToNow } from 'date-fns';
import type { AlertSeverity } from '../../types/api';

const SEV_VARIANT: Record<AlertSeverity, 'red' | 'gold' | 'cyan' | 'gray'> = {
  critical: 'red',
  error:    'red',
  warning:  'gold',
  info:     'cyan',
};

export default function AlertsTab() {
  const alerts   = useAlertStore(s => s.alerts);
  const dismiss  = useAlertStore(s => s.dismiss);
  const fetchAlerts = useAlertStore(s => s.fetchAlerts);

  const active   = alerts.filter(a => !a.dismissed);
  const archived = alerts.filter(a => a.dismissed);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Alerts</h2>
          {active.length > 0 && (
            <span className="bg-(--color-zion-red) text-white text-xs rounded-full px-2 py-0.5">{active.length}</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAlerts}><RefreshCw size={12} /></Button>
      </div>

      {active.length === 0 && (
        <Card accent="green">
          <p className="text-sm text-center py-6 text-(--color-zion-green)">✓ No active alerts</p>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(a => (
            <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${a.severity === 'critical' || a.severity === 'error' ? 'border-red-800/60 bg-red-950/20' : a.severity === 'warning' ? 'border-yellow-800/60 bg-yellow-950/20' : 'border-(--color-border) bg-(--color-bg-card)'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge>
                  <span className="text-xs text-(--color-text) font-medium">{a.title}</span>
                </div>
                <p className="text-xs text-(--color-text-muted)">{a.body}</p>
                <p className="text-[10px] text-(--color-text-muted) mt-1">
                  {formatDistanceToNow(new Date(a.ts), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text) shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <Card title={`Archived (${archived.length})`} accent="none">
          <div className="space-y-1.5">
            {archived.slice(0, 20).map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-(--color-text-muted) py-1 border-b border-(--color-border-dim) last:border-0">
                <Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge>
                <span className="flex-1 truncate">{a.title}</span>
                <span>{formatDistanceToNow(new Date(a.ts), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
