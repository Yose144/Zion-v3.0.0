import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  accent?: 'gold' | 'purple' | 'cyan' | 'green' | 'red' | 'none';
  actions?: React.ReactNode;
  /** Use glassmorphism panel style (default: true) */
  glass?: boolean;
  /** Add hover lift effect */
  hoverable?: boolean;
}

const ACCENT_GLOW: Record<string, string> = {
  gold:   'shadow-[0_0_0_1px_rgba(255,215,0,0.25),0_0_24px_rgba(255,215,0,0.12)]',
  purple: 'shadow-[0_0_0_1px_rgba(147,51,234,0.3),0_0_24px_rgba(147,51,234,0.15)]',
  cyan:   'shadow-[0_0_0_1px_rgba(6,182,212,0.3),0_0_24px_rgba(6,182,212,0.12)]',
  green:  'shadow-[0_0_0_1px_rgba(34,197,94,0.25),0_0_20px_rgba(34,197,94,0.1)]',
  red:    'shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_0_20px_rgba(239,68,68,0.1)]',
  none:   '',
};

const ACCENT_TITLE: Record<string, string> = {
  gold:   'text-gradient-soft',
  purple: 'text-purple-300',
  cyan:   'text-cyan-300',
  green:  'text-emerald-300',
  red:    'text-red-400',
  none:   'text-slate-200',
};

export function Card({
  title,
  accent = 'none',
  actions,
  children,
  className = '',
  glass = true,
  hoverable = false,
  ...rest
}: CardProps) {
  const base = glass ? 'zion-panel' : 'zion-panel-soft';
  const hover = hoverable ? 'zion-panel-hover' : '';
  const glow = ACCENT_GLOW[accent];

  return (
    <div
      className={`overflow-hidden ${base} ${hover} ${glow} ${className}`}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {title && (
            <h3 className={`text-sm font-semibold tracking-wide ${ACCENT_TITLE[accent]}`}>
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
