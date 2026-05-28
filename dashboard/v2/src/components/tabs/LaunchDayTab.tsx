// ─── ZION Dashboard v2 — Launch Day Tab (v2.9 glass) ────────────────────────
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Rocket } from 'lucide-react';
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
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Rocket size={15} className="text-zion-purple" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Launch Day Checklist</h3>
              <p className="text-[11px] text-gray-500">Pre-launch system readiness checks</p>
            </div>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Summary tiles */}
        <div className="p-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Passed',   count: ok,   color: 'rgb(52,211,153)',  glow: 'rgba(52,211,153,0.2)',  bg: 'rgba(5,150,105,0.08)'  },
            { label: 'Warnings', count: warn, color: 'rgb(251,191,36)',  glow: 'rgba(251,191,36,0.2)',  bg: 'rgba(120,53,15,0.08)'  },
            { label: 'Failed',   count: fail, color: 'rgb(248,113,113)', glow: 'rgba(248,113,113,0.2)', bg: 'rgba(127,29,29,0.08)'  },
          ].map(t => (
            <div
              key={t.label}
              className="rounded-2xl bg-white/5 border border-white/8 p-4 text-center"
            >
              <p className="text-2xl font-bold font-mono" style={{ color: t.color }}>{t.count}</p>
              <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">{t.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Readiness Meter ── */}
      {checks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1 * 0.06 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Rocket size={15} className="text-zion-purple" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Launch Readiness</h3>
              <p className="text-[11px] text-gray-500">Overall system go/no-go status</p>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
              <div className="flex justify-between text-xs text-slate-400 mb-3">
                <span>Overall readiness</span>
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
          </div>
        </motion.div>
      )}

      {/* ── Checklist Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 2 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
            <Rocket size={15} className="text-zion-purple" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Check Details</h3>
            <p className="text-[11px] text-gray-500">{checks.length} checks · {ok} passed · {fail} failed · {warn} warnings</p>
          </div>
        </div>
        <div className="px-6 py-4">
          {checks.length === 0 ? (
            <div
              className="flex items-center justify-center py-12 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-sm text-center text-slate-500">
                No launch-day data available.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
              {checks.map((c) => {
                const Icon = STATUS_CONFIG[c.status].icon;
                const color = STATUS_CONFIG[c.status].color;
                return (
                  <div
                    key={c.key}
                    className="flex items-start gap-3.5 py-3 border-b border-white/4 last:border-0"
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
        </div>
      </motion.div>

    </div>
  );
}
