'use client';

/**
 * RADIÁLNÍ EMOTE MENU (jako v Mobile Legends).
 *
 * Otevře se z tlačítka v HUD (nebo klávesou `X`) a čtyři emoty sedí ve
 * čtvercích kolem kurzoru. Výběr je **klik** na sektor — na dotyku je to
 * nejspolehlivější cesta; držení a tažení by na malém displeji míchalo
 * s joystickem.
 *
 * Komponenta nic neposílá: jen vrátí index přes `onPick`. Odeslání jde přes
 * `useNet().sendEmote`, takže bublinu vidí celá místnost (server ji přeposílá).
 */

import { useEffect, useRef } from 'react';

const EMOTES = [
  { glyph: '👍', cs: 'Dobrá práce', en: 'Well played' },
  { glyph: '⚠️', cs: 'Pozor', en: 'Careful' },
  { glyph: '🎯', cs: 'Útok', en: 'Attack' },
  { glyph: '🛡️', cs: 'Kryj mě', en: 'Cover me' },
];

const RADIUS = 78;

export function MobaEmoteWheel({
  origin,
  language,
  onPick,
  onClose,
}: {
  origin: { x: number; y: number };
  language: 'cs' | 'en';
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  // Kolečko se otevírá u kurzoru/tlačítka, ale sektory mají 78 px od středu.
  // Bez clampu u spodního okraje (kde emote tlačítko je) půlka zmizí mimo
  // obrazovku — přesně to odhalil screenshot.
  //
  // Druhá chyba ze screenshotu: i po clampu seděly sektory **na HUD**
  // (lišta schopností, rychlý chat, nápověda) a nebylo vidět, co je pod nimi.
  // Proto má spodek větší rezervu než ostatní strany — kolečko se zvedne nad
  // HUD. Rezerva je relativní, aby v landscape na telefonu nezůstalo nahoře.
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const margin = RADIUS + 44;
  const reserveBottom = Math.min(300, Math.max(120, viewportHeight * 0.34));
  const originX = Math.min(Math.max(origin.x, margin), viewportWidth - margin);
  const originY = Math.min(
    Math.max(origin.y, margin),
    Math.max(margin, viewportHeight - reserveBottom),
  );

  // klik mimo nebo Esc zavře
  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose();
      const digit = /^Digit([1-4])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        onPick(Number(digit[1]) - 1);
      }
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [onClose, onPick]);

  return (
    <div
      ref={root}
      className="moba-emote-wheel"
      style={{ left: originX, top: originY }}
      role="menu"
      aria-label={language === 'cs' ? 'emoty' : 'emotes'}
    >
      {EMOTES.map((emote, index) => {
        const angle = (Math.PI / 4) * (index * 2 + 1);
        return (
          <button
            key={emote.glyph}
            type="button"
            role="menuitem"
            className="moba-emote-sector"
            style={{
              left: Math.cos(angle) * RADIUS,
              top: Math.sin(angle) * RADIUS,
            }}
            title={emote[language]}
            onClick={() => onPick(index)}
          >
            <span>{emote.glyph}</span>
            <small>{index + 1}</small>
          </button>
        );
      })}
      <div className="moba-emote-hint">{language === 'cs' ? 'emote' : 'emote'}</div>
    </div>
  );
}
