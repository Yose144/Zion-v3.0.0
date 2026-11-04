'use client';

/**
 * Sdílené VR pro všechny hry v Nirvaně.
 *
 * Každá hra měla vlastní `createXRStore`, vlastní tlačítko a vlastní čtení
 * ovladačů — a proto VR uměla jen pouť a Mars. Tady je jedno místo:
 *
 *  - `useXr()` … store + stav prezentace (jedno pravidlo pro všechny scény)
 *  - `VrButton` … tlačítko, které se schová, když session běží
 *  - `createVrKeys()` … mapování ovladačů na **syntetické klávesy**
 *
 * Syntetické klávesy nejsou zkratka: hry už čtou klávesnici (a dotyk to dělá
 * stejně — `TouchPad`/`MobaTouch`). Kdyby VR mělo vlastní vstupní větev,
 * rozešlo by se s tím, co dělá server, a opravovalo by se dvakrát.
 */

import { useEffect, useRef, useState } from 'react';
import { createXRStore, type XRStore } from '@react-three/xr';

export interface Xr {
  store: XRStore;
  /** Probíhá immersive session? (tlačítko se podle toho schová) */
  presenting: boolean;
}

export function useXr(): Xr {
  const [store] = useState<XRStore>(() => createXRStore({ foveation: 0.5 }));
  const [presenting, setPresenting] = useState(false);

  useEffect(() => store.subscribe((state) => setPresenting(Boolean(state.session))), [store]);

  return { store, presenting };
}

export interface VrKeys {
  /** Stisk/upuštění jedné klávesy (idempotentní). */
  set: (code: string, down: boolean) => void;
  /** Všechno pustit — při odchodu ze session nebo ztrátě fokusu. */
  clear: () => void;
}

/**
 * Syntetické klávesy pro ovladače.
 *
 * `held` drží skutečný stav, takže opakované volání `set(code, true)` každý
 * snímek neposílá další a další `keydown` (hry čítají stisk, ne opakování).
 */
export function createVrKeys(): VrKeys {
  const held = new Set<string>();

  const send = (code: string, down: boolean) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  };

  return {
    set(code, down) {
      if (down) {
        if (held.has(code)) return;
        held.add(code);
        send(code, true);
      } else {
        if (!held.has(code)) return;
        held.delete(code);
        send(code, false);
      }
    },
    clear() {
      for (const code of [...held]) {
        held.delete(code);
        send(code, false);
      }
    },
  };
}

/** Mrtvá zóna ovladače — malé výchylky palce nemají generovat pohyb. */
export const VR_DEADZONE = 0.18;

/** Pomocná funkce pro „osa → klávesa" se dvěma směry. */
export function axisKeys(
  keys: VrKeys,
  value: number,
  negative: string,
  positive: string,
  deadzone = VR_DEADZONE,
): void {
  keys.set(negative, value < -deadzone);
  keys.set(positive, value > deadzone);
}

/** Uvolní syntetické klávesy při unmountu (jinak by postava běžela dál). */
export function useVrKeys(): VrKeys {
  const keys = useRef<VrKeys | null>(null);
  if (!keys.current) keys.current = createVrKeys();
  useEffect(() => {
    const instance = keys.current!;
    const release = () => instance.clear();
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
      instance.clear();
    };
  }, []);
  return keys.current;
}
