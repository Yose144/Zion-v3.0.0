import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  accent?: 'gold' | 'purple' | 'cyan' | 'green' | 'red' | 'none';
  actions?: React.ReactNode;
}

const ACCENT_BORDER = {
  gold:   'border-t-2 border-(--color-zion-gold)',
  purple: 'border-t-2 border-(--color-zion-purple)',
  cyan:   'border-t-2 border-(--color-zion-cyan)',
  green:  'border-t-2 border-(--color-zion-green)',
  red:    'border-t-2 border-(--color-zion-red)',
  none:   '',
};

export function Card({ title, accent = 'none', actions, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`bg-(--color-bg-card) border border-(--color-border) rounded-lg overflow-hidden ${ACCENT_BORDER[accent]} ${className}`}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
          {title && <h3 className="text-sm font-semibold text-(--color-text)">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
