import { type ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
  lines?: number;
}

export default function Skeleton({ className = '', children, lines = 0 }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm ${className}`}
    >
      {lines > 0 ? (
        <div className="space-y-3">
          <div className="h-4 w-1/3 rounded bg-white/10" />
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-white/10" />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
