'use client';

/**
 * LinkNavHud — ukazuje, kam je kamera právě zaměřená, a nabízí navigaci po linkách.
 *
 * Tři věci na jednom místě:
 *   1. označený bod (label + akcent),
 *   2. „skoč na…“ tlačítka pro sousedy přes spoje (`LinkEngine.neighbors`),
 *   3. návrat `← Země` (stejně jako `Escape`).
 *
 * Stav čte z `LinkEngine` přes subscribe (změna fokusu je vzácná událost),
 * ne polling. Na Zemi se HUD schová.
 */

import { useEffect, useState } from 'react';
import { getGlobalLinkEngine } from './LinkEngine';
import type { LinkTarget } from './LinkEngine';

export function LinkNavHud({ onFocus }: { onFocus?: (id: string) => void }) {
  const engine = getGlobalLinkEngine();
  const [id, setId] = useState(engine.getCurrentFocus());
  const [target, setTarget] = useState<LinkTarget | null>(engine.getTarget(id) ?? null);

  useEffect(() => {
    const sync = () => {
      const next = engine.getCurrentFocus();
      setId(next);
      setTarget(engine.getTarget(next) ?? null);
    };
    sync();
    return engine.subscribe(sync);
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && engine.getCurrentFocus() !== 'earth') {
        engine.flyTo('earth');
        onFocus?.('earth');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, onFocus]);

  if (!target || id === 'earth') return null;

  const go = (next: string) => {
    engine.flyTo(next);
    onFocus?.(next);
  };

  const neighbors = engine
    .neighbors(id)
    .map((n) => engine.getTarget(n))
    .filter((t): t is LinkTarget => Boolean(t) && t!.id !== 'earth');

  return (
    <div className="link-nav-hud" role="status" aria-live="polite">
      <span
        className="link-nav-dot"
        style={{ ['--link-accent' as string]: target.accent || '#a6c8ff' } as React.CSSProperties}
      />
      <span className="link-nav-label">{target.label.cs}</span>
      {neighbors.map((n) => (
        <button
          key={n.id}
          type="button"
          className="link-nav-neighbor"
          onClick={() => go(n.id)}
          title={`Přiblížit: ${n.label.cs}`}
        >
          {n.label.cs}
        </button>
      ))}
      <button type="button" className="link-nav-back" onClick={() => go('earth')}>
        ← Země
      </button>
    </div>
  );
}
