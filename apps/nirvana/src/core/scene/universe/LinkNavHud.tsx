'use client';

/**
 * LinkNavHud — ukazuje, kam je kamera právě zaměřená, a nabízí návrat.
 *
 * Je to jediné místo, kde uživatel vidí „označený bod“ bez otevřeného portálu.
 * `Escape` i tlačítko vrací k Zemi; stejnou cestou jde i klávesnice.
 * Stav čte z `LinkEngine` přes subscribe (ne polling) — změna fokusu je
 * vzácná událost, ne 60×/s.
 */

import { useEffect, useState } from 'react';
import { getGlobalLinkEngine } from './LinkEngine';
import type { LinkTarget } from './LinkEngine';

export function LinkNavHud() {
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  if (!target || id === 'earth') return null;

  return (
    <div className="link-nav-hud" role="status" aria-live="polite">
      <span
        className="link-nav-dot"
        style={{ ['--link-accent' as string]: target.accent || '#a6c8ff' } as React.CSSProperties}
      />
      <span className="link-nav-label">{target.label.cs}</span>
      <button type="button" className="link-nav-back" onClick={() => engine.flyTo('earth')}>
        ← Země
      </button>
    </div>
  );
}
