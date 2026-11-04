'use client';

/**
 * Tlačítko zvuku — jedno pro celou Nirvanu.
 *
 * Hudba ani zvuky se nikde nespouštějí samy, takže tohle je jediné místo, kde
 * jde zvuk vypnout. Volba se ukládá do `localStorage` (`nirvana.sound.v1`)
 * a platí napříč hrami, ne jen na stránce, kde ji člověk zmáčkl.
 *
 * Stav se čte až po mountu — server o `localStorage` neví, takže první
 * vykreslení musí být neutrální (jinak React hlásí hydration mismatch).
 */

import { useEffect, useState } from 'react';
import { isMuted, subscribeMuted, toggleMuted, unlock } from '@/core/audio/engine';

export function SoundToggle({ label }: { label?: { on: string; off: string } }) {
  const [muted, setLocalMuted] = useState<boolean | null>(null);

  useEffect(() => {
    setLocalMuted(isMuted());
    return subscribeMuted(setLocalMuted);
  }, []);

  const isOff = muted === true;
  const text = isOff ? (label?.off ?? 'zvuk vyp') : (label?.on ?? 'zvuk zap');

  return (
    <button
      type="button"
      className={`game-hud-chip is-sound${isOff ? ' is-off' : ''}`}
      aria-pressed={!isOff}
      title={text}
      onClick={() => {
        // klik je gesto — tady se smí otevřít AudioContext
        unlock();
        toggleMuted();
      }}
    >
      <em aria-hidden>{isOff ? '🔇' : '🔊'}</em>
    </button>
  );
}
