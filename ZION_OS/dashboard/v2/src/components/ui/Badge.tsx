import React from 'react';
import type { HealthStatus } from '../../types/api';

const STATUS_STYLE: Record<HealthStatus, string> = {
  healthy:  'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]',
  degraded: 'bg-orange-950/60 text-orange-300 border border-orange-700/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]',
  down:     'bg-red-950/60 text-red-400 border border-red-700/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
  unknown:  'bg-white/5 text-slate-400 border border-white/10',
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'healthy'  ? 'dot-healthy pulse-live' :
        status === 'degraded' ? 'dot-degraded' :
        status === 'down'     ? 'dot-down' : 'dot-unknown'
      }`} />
      {status}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'purple' | 'cyan' | 'green' | 'red' | 'gray';
}

const BADGE_STYLE: Record<string, string> = {
  gold:   'bg-[rgba(255,215,0,0.1)] text-yellow-300 border border-[rgba(255,215,0,0.25)] zion-kicker',
  purple: 'bg-[rgba(147,51,234,0.12)] text-purple-300 border border-[rgba(147,51,234,0.3)] zion-kicker',
  cyan:   'bg-[rgba(6,182,212,0.1)] text-cyan-300 border border-[rgba(6,182,212,0.25)] zion-kicker',
  green:  'bg-[rgba(34,197,94,0.1)] text-emerald-300 border border-[rgba(34,197,94,0.25)] zion-kicker',
  red:    'bg-[rgba(239,68,68,0.1)] text-red-400 border border-[rgba(239,68,68,0.25)] zion-kicker',
  gray:   'bg-white/5 text-slate-400 border border-white/10 zion-kicker',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold ${BADGE_STYLE[variant]}`}>
      {children}
    </span>
  );
}
