'use client';

import { type ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export default function GlassPanel({ children, className = '', title }: GlassPanelProps) {
  return (
    <div
      className={`rounded-3xl bg-gradient-to-r from-oasis-cyan/50 via-oasis-purple/50 to-oasis-gold/50 p-[1px] shadow-2xl transition-transform duration-300 hover:scale-[1.01] ${className}`}
    >
      <div className="h-full w-full rounded-3xl bg-oasis-black/70 p-5 backdrop-blur-md sm:p-6">
        {title && <h3 className="mb-4 text-lg font-bold text-oasis-cyan">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
