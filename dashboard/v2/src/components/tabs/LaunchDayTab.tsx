// ─── ZION Dashboard v2 — Launch Day Tab (v2.9 glass) ────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Rocket } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';

interface CheckItem {
  key: string;
  label: string;
  status: 'ok' | 'fail' | 'warn' | 'unknown';
  detail?: string;
}

const STATUS_CONFIG = {
  ok:      { icon: CheckCircle,   color: 'rgb(52,211,153)',  bg: 'rgba(5,150,105,0.12)',  border: 'rgba(52,211,153,0.3)',  label: 'OK' },
  fail:    { icon: XCircle,       color: 'rgb(248,113,113)', bg: 'rgba(127,29,29,0.15)',  border: 'rgba(248,113,113,0.3)', label: 'FAIL' },
  warn:    { icon: AlertTriangle, color: 'rgb(251,191,36)',  bg: 'rgba(120,53,15,0.15)',  border: 'rgba(251,191,36,0.3)',  label: 'WARN' },
  unknown: { icon: AlertTriangle, color: 'rgb(100,116,139)', bg: 'rgba(30,41,59,0.2)',    border: 'rgba(100,116,139,0.2)', label: '???' },
};

function StatusBadge({ status }: { status: CheckItem['status'] }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wider"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      {c.label}
    </span>
  );
}

export default function LaunchDayTab() {
  const [checks, setChecks]   = useState<CheckItem[]>([]);
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

  const allOk   = checks.length > 0 && fail === 0 && warn === 0;
  const readyPct = checks.length > 0 ? Math.round((ok / checks.length) * 100) : 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Rocket size={16} style={{ color: 'rgb(255,215,0)' }} />
          <h2 className="text-sm font-bold text-gradient tracking-wide">Launch Day Checklist</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={12} />
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Passed',   count: ok,   color: 'rgb(52,211,153)',  glow: 'rgba(52,211,153,0.2)',  bg: 'rgba(5,150,105,0.08)'  },
          { label: 'Warnings', count: warn, color: 'rgb(251,191,36)',  glow: 'rgba(251,191,36,0.2)',  bg: 'rgba(120,53,15,0.08)'  },
          { label: 'Failed',   count: fail, color: 'rgb(248,113,113)', glow: 'rgba(248,113,113,0.2)', bg: 'rgba(127,29,29,0.08)'  },
        ].map(t => (
          <div
            key={t.label}
            className="rounded-2xl p-4 text-center"
            style={{ background: t.bg, border: `1px solid ${t.glow}` }}
          >
            <p className="text-2xl font-bold font-mono" style={{ color: t.color }}>{t.count}</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Ready meter */}
      {checks.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: allOk ? 'rgba(5,150,105,0.08)' : 'rgba(7,10,20,0.4)',
            border: allOk ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Launch Readiness</span>
            <span style={{ color: allOk ? 'rgb(52,211,153)' : 'rgb(251,191,36)' }}>{readyPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${readyPct}%`,
                background: allOk
                  ? 'linear-gradient(90deg, rgb(5,150,105), rgb(52,211,153))'
                  : 'linear-gradient(90deg, rgb(147,51,234), rgb(6,182,212))',
              }}
            />
          </div>
        </div>
      )}

      {/* Checklist */}
      <Card accent={fail > 0 ? 'red' : warn > 0 ? 'gold' : 'green'}>
        {checks.length === 0 ? (
          <p className="text-sm text-center py-10 text-slate-500">
            No launch-day data available.
          </p>
        ) : (
          <div className="space-y-0">
            {checks.map((c, i) => {
              const Icon = STATUS_CONFIG[c.status].icon;
              const color = STATUS_CONFIG[c.status].color;
              return (
                <div
                  key={c.key}
                  className="flex items-start gap-3.5 py-3"
                  style={{
                    borderBottom: i < checks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                  }}
                >
                  <Icon size={14} className="shrink-0 mt-0.5" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-slate-200 capitalize font-medium">{c.label}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    {c.detail && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
}
