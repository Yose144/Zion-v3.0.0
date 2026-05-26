// ─── Toast notification (v2.9 glass aesthetic) ───────────────────────────────
import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Info, AlertOctagon, CheckCircle } from 'lucide-react';
import type { Alert } from '../../types/api';

const ICONS = {
  info:     Info,
  warning:  AlertTriangle,
  error:    AlertOctagon,
  critical: AlertOctagon,
};

const ACCENT: Record<string, { border: string; icon: string; bg: string }> = {
  info:     { border: 'rgba(6,182,212,0.5)',  icon: 'rgb(34,211,238)',  bg: 'rgba(6,182,212,0.08)' },
  warning:  { border: 'rgba(255,215,0,0.5)',  icon: 'rgb(251,191,36)', bg: 'rgba(255,215,0,0.08)' },
  error:    { border: 'rgba(239,68,68,0.5)',  icon: 'rgb(248,113,113)', bg: 'rgba(239,68,68,0.1)' },
  critical: { border: 'rgba(239,68,68,0.7)',  icon: 'rgb(248,113,113)', bg: 'rgba(127,29,29,0.25)' },
};

interface ToastProps {
  alert: Alert;
  onDismiss: (id: string) => void;
}

export function Toast({ alert, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[alert.severity] ?? Info;
  const acc = ACCENT[alert.severity] ?? ACCENT.info;

  // Fade-in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const tid = setTimeout(() => onDismiss(alert.id), 6_000);
    return () => clearTimeout(tid);
  }, [alert.id, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 p-3.5 pr-4 w-80 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        background: `rgba(7,10,20,0.88)`,
        border: `1px solid ${acc.border}`,
        borderRadius: '1rem',
        backdropFilter: 'blur(20px) saturate(140%)',
        boxShadow: `0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)`,
        borderLeft: `3px solid ${acc.border}`,
        backgroundColor: acc.bg,
      }}
    >
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: acc.icon }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-100 truncate">{alert.title}</p>
        {alert.body && (
          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{alert.body}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded"
      >
        <X size={13} />
      </button>
    </div>
  );
}
