'use client';

import { useCallback, type ReactNode } from 'react';

/**
 * DOTYKOVÉ TLAČÍTKO = syntetická klávesa.
 *
 * Pro hry, které čtou klávesnici (Venuše, Merkur), je to nejmenší možný
 * zásah: tlačítko pošle `keydown`/`keyup` na `window`, takže hra nemusí mít
 * druhý vstup. Pro FPS (Mars) to nestačí — tam je potřeba spojitý pohyb
 * pohledu, proto má vlastní `ArenaTouch`.
 *
 * `stopPropagation` je důležité: bez něj by stisk v inputu rozjel hru
 * (přesně tahle chyba se stala u chatu na Venuši).
 */
export function TouchButton({
  code,
  children,
  className = '',
  onDown,
  onUp,
}: {
  code: string;
  children: ReactNode;
  className?: string;
  onDown?: () => void;
  onUp?: () => void;
}) {
  const send = useCallback(
    (down: boolean) => {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    },
    [code],
  );

  return (
    <button
      type="button"
      className={`touch-key ${className}`.trim()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        send(true);
        onDown?.();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        send(false);
        onUp?.();
      }}
      onPointerLeave={() => {
        send(false);
        onUp?.();
      }}
      onPointerCancel={() => {
        send(false);
        onUp?.();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Obal pro skupinu tlačítek — na dotyku se zobrazí, na myši ne. */
export function TouchPad({ children }: { children: ReactNode }) {
  return (
    <div className="touch-pad" aria-hidden>
      {children}
    </div>
  );
}
