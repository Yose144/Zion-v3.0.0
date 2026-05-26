// ─── ZION Dashboard v2 — Checklist Widget (v2.9 glass) ──────────────────────
// Shows launch-day readiness checks inline in the Overview tab.
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/client';

interface CheckItem {
  key: string;
  label: string;
  status: 'ok' | 'fail' | 'warn' | 'unknown';
  detail?: string;
}

const S = {
  ok:      { icon: CheckCircle,   color: 'rgb(52,211,153)',  bg: 'rgba(5,150,105,0.12)'  },
  fail:    { icon: XCircle,       color: 'rgb(248,113,113)', bg: 'rgba(127,29,29,0.15)'  },
  warn:    { icon: AlertTriangle, color: 'rgb(251,191,36)',  bg: 'rgba(120,53,15,0.15)'  },
  unknown: { icon: AlertTriangle, color: 'rgb(100,116,139)', bg: 'rgba(30,41,59,0.1)'    },
};

export function ChecklistWidget() {
  const [checks,    setChecks]    = useState<CheckItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const raw = await api.launchDayStatus() as Record<string, unknown>;
      setChecks(Object.entries(raw).map(([k, v]) => ({
        key:    k,
        label:  k.replace(/_/g, ' '),
        status: v === true || v === 'ok' ? 'ok' : v === false || v === 'fail' ? 'fail' : 'warn',
        detail: typeof v === 'string' && v !== 'ok' && v !== 'fail' ? v : undefined,
      })));
    } catch { /* backend may not have this endpoint yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ok   = checks.filter(c => c.status === 'ok').length;
  const fail = checks.filter(c => c.status === 'fail').length;
  const pct  = checks.length ? Math.round((ok / checks.length) * 100) : 0;
  const allOk = checks.length > 0 && fail === 0;

  const borderColor = allOk
    ? 'rgba(52,211,153,0.25)'
    : fail > 0
      ? 'rgba(248,113,113,0.25)'
      : 'rgba(255,255,255,0.08)';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: 'rgba(7,10,20,0.5)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Launch Checklist
          </span>
          {checks.length > 0 && (
            <>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: allOk ? 'rgba(5,150,105,0.2)' : fail > 0 ? 'rgba(127,29,29,0.2)' : 'rgba(120,53,15,0.2)',
                  color: allOk ? 'rgb(52,211,153)' : fail > 0 ? 'rgb(248,113,113)' : 'rgb(251,191,36)',
                }}
              >
                {pct}%
              </span>
              {/* mini bar */}
              <div className="w-24 h-1.5 rounded-full overflow-hidden hidden sm:block" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: allOk
                      ? 'linear-gradient(90deg, rgb(5,150,105), rgb(52,211,153))'
                      : 'linear-gradient(90deg, rgb(147,51,234), rgb(6,182,212))',
                  }}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); load(); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : undefined} />
          </button>
          {collapsed
            ? <ChevronDown size={14} className="text-slate-600" />
            : <ChevronUp size={14} className="text-slate-600" />}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {checks.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">
              {loading ? 'Loading…' : 'No checklist data — backend may not support this endpoint.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-3">
              {checks.map(c => {
                const cfg  = S[c.status];
                const Icon = cfg.icon;
                return (
                  <div key={c.key} className="flex items-center gap-2.5 py-1.5">
                    <Icon size={12} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-xs text-slate-300 capitalize flex-1 truncate">{c.label}</span>
                    {c.detail && (
                      <span className="text-[10px] font-mono text-slate-600 truncate max-w-[80px]">
                        {c.detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
