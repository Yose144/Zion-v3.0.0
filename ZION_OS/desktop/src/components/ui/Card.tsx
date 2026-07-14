import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', accent, noPadding }: CardProps) {
  const style: CSSProperties | undefined = accent ? ({ '--rc': accent } as CSSProperties) : undefined;
  return (
    <div className={`zion-panel ${noPadding ? '' : 'p-5'} ${className}`} style={style}>
      {children}
    </div>
  );
}
