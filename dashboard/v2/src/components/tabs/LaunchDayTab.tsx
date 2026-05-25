// ─── ZION Dashboard v2 — Launch Day Tab ─────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';

interface CheckItem {
  key: string;
  label: string;
  status: 'ok' | 'fail' | 'warn' | 'unknown';
  detail?: string;
}

export default function LaunchDayTab() {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const raw = await api.launchDayStatus() as Record<string, unknown>;
      const items: CheckItem[] = Object.entries(raw).map(([k, v]) => ({
        key: k,
        label: k.replace(/_/g, ' '),
        status: v === true || v === 'ok' ? 'ok' : v === false || v === 'fail' ? 'fail' : 'warn',
        detail: typeof v === 'string' && v !== 'ok' && v !== 'fail' ? v : undefined,
      }));
      setChecks(items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ok   = checks.filter(c => c.status === 'ok').length;
  const fail = checks.filter(c => c.status === 'fail').length;
  const warn = checks.filter(c => c.status === 'warn').length;

  const Icon = ({ s }: { s: CheckItem['status'] }) => {
    if (s === 'ok')   return <CheckCircle size={15} className="text-(--color-zion-green) shrink-0" />;
    if (s === 'fail') return <XCircle size={15} className="text-(--color-zion-red) shrink-0" />;
    return <AlertTriangle size={15} className="text-(--color-zion-gold) shrink-0" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Launch Day Checklist</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {/* Summary */}
      <div className="flex gap-6">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle size={16} className="text-(--color-zion-green)" />
          <span className="text-(--color-text)">{ok} OK</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={16} className="text-(--color-zion-gold)" />
          <span className="text-(--color-text)">{warn} warn</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <XCircle size={16} className="text-(--color-zion-red)" />
          <span className="text-(--color-text)">{fail} fail</span>
        </div>
      </div>

      <Card accent={fail > 0 ? 'red' : warn > 0 ? 'gold' : 'green'}>
        {checks.length === 0 ? (
          <p className="text-sm text-center py-8 text-(--color-text-muted)">No launch-day data available.</p>
        ) : (
          <div className="space-y-2">
            {checks.map(c => (
              <div key={c.key} className="flex items-start gap-3 py-2 border-b border-(--color-border-dim) last:border-0">
                <Icon s={c.status} />
                <div>
                  <p className="text-sm text-(--color-text) capitalize">{c.label}</p>
                  {c.detail && <p className="text-xs text-(--color-text-muted) mt-0.5">{c.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
