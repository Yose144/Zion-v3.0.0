'use client';

import type { CSSProperties, ReactNode } from 'react';

export type Lang = 'cs' | 'en';

export function Panel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} data-panel={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      {children}
    </section>
  );
}

export function PanelHeader({
  id,
  kicker,
  title,
  sub,
  rc,
}: {
  id: string;
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  rc: string;
}) {
  return (
    <div className="space-y-3">
      {kicker && (
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.32em]"
          style={{ color: `rgb(${rc})` }}
        >
          {kicker}
        </p>
      )}
      <h2
        id={`${id}-title`}
        tabIndex={-1}
        className="text-2xl font-bold text-white outline-none sm:text-3xl focus-visible:ring-2 focus-visible:ring-zion-gold/60 rounded-sm"
      >
        {title}
      </h2>
      {sub && <p className="max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">{sub}</p>}
    </div>
  );
}

export function AccentDot({ rc }: { rc: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: `rgb(${rc})` } as CSSProperties}
    />
  );
}
