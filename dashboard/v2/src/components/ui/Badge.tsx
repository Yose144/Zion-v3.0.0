import React from 'react';
import type { HealthStatus } from '../../types/api';

const STATUS_STYLE: Record<HealthStatus, string> = {
  healthy:  'bg-green-900/50 text-green-400 border border-green-800',
  degraded: 'bg-orange-900/50 text-orange-400 border border-orange-800',
  down:     'bg-red-900/50 text-red-400 border border-red-800',
  unknown:  'bg-gray-800 text-gray-400 border border-gray-700',
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'healthy' ? 'dot-healthy' : status === 'degraded' ? 'dot-degraded' : status === 'down' ? 'dot-down' : 'dot-unknown'}`} />
      {status}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'purple' | 'cyan' | 'green' | 'red' | 'gray';
}

const BADGE_STYLE = {
  gold:   'bg-yellow-900/40 text-yellow-300 border border-yellow-800/60',
  purple: 'bg-purple-900/40 text-purple-300 border border-purple-800/60',
  cyan:   'bg-cyan-900/40 text-cyan-300 border border-cyan-800/60',
  green:  'bg-green-900/40 text-green-300 border border-green-800/60',
  red:    'bg-red-900/40 text-red-300 border border-red-800/60',
  gray:   'bg-gray-800 text-gray-400 border border-gray-700',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BADGE_STYLE[variant]}`}>
      {children}
    </span>
  );
}
