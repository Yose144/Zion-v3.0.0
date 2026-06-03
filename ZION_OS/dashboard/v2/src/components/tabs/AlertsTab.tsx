// ─── ZION Dashboard v2 — Alerts Tab (v2.9 glass) ────────────────────────────
import React from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw, AlertTriangle, AlertOctagon, Info, CheckCircle, Bell } from 'lucide-react';
import { useAlertStore } from '../../stores/alertStore';
import { Badge } from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import type { AlertSeverity } from '../../types/api';

const SEV_VARIANT: Record<AlertSeverity, 'red' | 'gold' | 'cyan' | 'gray'> = {
  critical: 'red', error: 'red', warning: 'gold', info: 'cyan',
};

const SEV_ICON: Record<AlertSeverity, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  critical: AlertOctagon, error: AlertOctagon, warning: AlertTriangle, info: Info,
};

const SEV_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(127,29,29,0.3)',
  error:    'rgba(127,29,29,0.2)',
  warning:  'rgba(120,53,15,0.2)',
  info:     'rgba(3,105,161,0.15)',
};
const SEV_BORDER: Record<AlertSeverity, string> = {
  critical: 'rgba(239,68,68,0.45)',
  error:    'rgba(239,68,68,0.3)',
  warning:  'rgba(234,179,8,0.35)',
  info:     'rgba(6,182,212,0.3)',
};
const SEV_ICON_COLOR: Record<AlertSeverity, string> = {
  critical: 'rgb(248,113,113)', error: 'rgb(248,113,113)',
  warning: 'rgb(251,191,36)', info: 'rgb(34,211,238)',
};

export default function AlertsTab() {
  const alerts      = useAlertStore(s => s.alerts);
  const dismiss     = useAlertStore(s => s.dismiss);
  const fetchAlerts = useAlertStore(s => s.fetchAlerts);

  const active   = alerts.filter(a => !a.dismissed);
  const archived = alerts.filter(a => a.dismissed);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Active Alerts Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Bell size={15} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Active Alerts
                {active.length > 0 && (
                  <span
                    className="text-white text-xs rounded-full px-2.5 py-0.5 font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgb(239,68,68), rgb(220,38,38))',
                      boxShadow: '0 0 12px rgba(239,68,68,0.4)',
                    }}
                  >
                    {active.length}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-500">Real-time system alert feed</p>
            </div>
          </div>
          <button
            onClick={fetchAlerts}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* All clear */}
          {active.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3"
              style={{
                background: 'rgba(34,197,94,0.05)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <CheckCircle size={28} className="text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-300">All clear — no active alerts</p>
            </div>
          )}

          {/* Active alerts */}
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map(a => {
                const Icon = SEV_ICON[a.severity];
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3.5 p-4 rounded-2xl"
                    style={{
                      background: SEV_BG[a.severity],
                      border: `1px solid ${SEV_BORDER[a.severity]}`,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <Icon size={15} className="shrink-0 mt-0.5" style={{ color: SEV_ICON_COLOR[a.severity] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge>
                        <span className="text-xs text-slate-200 font-semibold">{a.title}</span>
                      </div>
                      <p className="text-xs text-slate-400">{a.body}</p>
                      <p className="text-[10px] text-slate-600 mt-1.5">
                        {formatDistanceToNow(new Date(a.ts), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => dismiss(a.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-colors shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Archived Panel ── */}
      {archived.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1 * 0.06 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={15} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Archived</h3>
              <p className="text-[11px] text-gray-500">{archived.length} dismissed alerts</p>
            </div>
          </div>

          {/* Rows */}
          <div className="px-6 py-4">
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
              {archived.slice(0, 20).map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-3 border-b border-white/4 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge>
                    <span className="text-sm text-slate-400 truncate">{a.title}</span>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0 ml-4">
                    {formatDistanceToNow(new Date(a.ts), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
