// ─── Toast notification ──────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, CheckCircle, AlertOctagon } from 'lucide-react';
import type { Alert } from '../../types/api';

const ICONS = {
  info:     Info,
  warning:  AlertTriangle,
  error:    AlertOctagon,
  critical: AlertOctagon,
};

const COLORS = {
  info:     'border-l-4 border-(--color-zion-cyan)',
  warning:  'border-l-4 border-(--color-zion-gold)',
  error:    'border-l-4 border-(--color-zion-red)',
  critical: 'border-l-4 border-(--color-zion-red) bg-red-950/40',
};

interface ToastProps {
  alert: Alert;
  onDismiss: (id: string) => void;
}

export function Toast({ alert, onDismiss }: ToastProps) {
  const Icon = ICONS[alert.severity] ?? Info;

  useEffect(() => {
    const tid = setTimeout(() => onDismiss(alert.id), 6_000);
    return () => clearTimeout(tid);
  }, [alert.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3 pr-4 rounded-lg bg-(--color-bg-card) shadow-xl ${COLORS[alert.severity]} w-80`}
    >
      <Icon size={16} className="shrink-0 mt-0.5 text-(--color-text-muted)" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-(--color-text) truncate">{alert.title}</p>
        <p className="text-xs text-(--color-text-muted) line-clamp-2 mt-0.5">{alert.body}</p>
      </div>
      <button onClick={() => onDismiss(alert.id)} className="text-(--color-text-muted) hover:text-(--color-text)">
        <X size={14} />
      </button>
    </div>
  );
}
