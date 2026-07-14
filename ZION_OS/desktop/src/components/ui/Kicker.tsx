import type { ReactNode } from 'react';

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`zion-kicker ${className}`}>{children}</span>;
}
