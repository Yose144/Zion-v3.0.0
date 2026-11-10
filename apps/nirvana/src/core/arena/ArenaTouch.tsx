'use client';

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { getLookSensitivity } from './settings';

/**
 * DOTYKOVÉ OVLÁDÁNÍ ARÉNY (Mars).
 *
 * Proč vlastní vrstva: aréna je FPS s **pointer lockem** — na mobilu žádný
 * pointer lock neexistuje, takže bez tohohle by se hráč nemohl rozhlédnout
 * a hra by byla nehratelná. Klávesové události (jako v Merkuru) tu nestačí,
 * protože pohled potřebuje **spojitý pohyb**, ne stisk klávesy.
 *
 * Rozvržení (jedno pro sólo i multiplayer):
 *  - **levý spodní roh** = joystick (pohyb),
 *  - **pravá polovina** = tažení = rozhlížení,
 *  - **pravý spodní roh** = PALBA / SKOK / zbraň.
 *
 * Stav se předává refem, ne React state — jinak by se 60× za sekundu
 * překresloval celý 3D strom (stejná lekce jako u snapshotů).
 */

export interface ArenaTouchState {
  /** −1..1 doleva/doprava (strafe). */
  moveX: number;
  /** −1..1 dopředu/dozadu. */
  moveY: number;
  /** Nahromaděná změna pohledu od posledního snímku (radiány). */
  lookX: number;
  lookY: number;
  fire: boolean;
  jump: boolean;
  /** Jednorázový požadavek na přepnutí zbraně (index 0–5), jinak null. */
  weapon: number | null;
}

export function createTouchState(): ArenaTouchState {
  return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jump: false, weapon: null };
}

/** Úhel pohledu na pixel — základ; hráč si ho násobí v nastavení. */
const LOOK_BASE = 0.0034;
/** Poloměr joysticku v px (posun pro plnou výchylku). */
const STICK_RADIUS = 46;

export function ArenaTouchControls({ state }: { state: MutableRefObject<ArenaTouchState> }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stickPointer = useRef<number | null>(null);
  const lookPointer = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  /**
   * Poslední zvolený index zbraně. Drží se **tady**, protože `readTouch`
   * stav po přečtení nuluje — dřív se tlačítko ZB `(null ?? 0) + 1` vždy
   * přepnulo na druhou zbraň a dál už nikdy necinklo.
   */
  const weaponIndex = useRef(0);

  const updateStick = useCallback(
    (clientX: number, clientY: number) => {
      const pad = stickRef.current;
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      state.current.moveX = dx / STICK_RADIUS;
      // obrazovkové „dolů" = couvat
      state.current.moveY = -dy / STICK_RADIUS;
    },
    [state],
  );

  const resetStick = useCallback(() => {
    state.current.moveX = 0;
    state.current.moveY = 0;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  }, [state]);

  // uvolnění prstu kdekoli na obrazovce (nestane se, že by joystick „zůstal")
  useEffect(() => {
    const release = () => {
      stickPointer.current = null;
      lookPointer.current = null;
      resetStick();
      state.current.fire = false;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [resetStick, state]);

  return (
    <div className="arena-touch" aria-hidden>
      {/* pohled: pravá polovina obrazovky */}
      <div
        className="arena-touch-look"
        onPointerDown={(event) => {
          lookPointer.current = event.pointerId;
          lookLast.current = { x: event.clientX, y: event.clientY };
          (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (lookPointer.current !== event.pointerId) return;
          const dx = event.clientX - lookLast.current.x;
          const dy = event.clientY - lookLast.current.y;
          lookLast.current = { x: event.clientX, y: event.clientY };
          // citlivost se čte z nastavení (localStorage) — na tabletu je
          // výchozí hodnota pomalá a hráč si ji musí moct zvednout
          const factor = getLookSensitivity();
          state.current.lookX += dx * LOOK_BASE * factor;
          state.current.lookY += dy * LOOK_BASE * factor;
        }}
        onPointerUp={() => {
          lookPointer.current = null;
        }}
      />

      {/* joystick: levý spodní roh */}
      <div
        ref={stickRef}
        className="arena-touch-stick"
        onPointerDown={(event) => {
          event.stopPropagation();
          stickPointer.current = event.pointerId;
          (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
          updateStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (stickPointer.current !== event.pointerId) return;
          updateStick(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          stickPointer.current = null;
          resetStick();
        }}
        onPointerCancel={() => {
          stickPointer.current = null;
          resetStick();
        }}
      >
        <span ref={knobRef} className="arena-touch-knob" />
      </div>

      {/* akce: pravý spodní roh */}
      <div className="arena-touch-actions">
        <button
          type="button"
          className="arena-touch-btn is-small"
          onPointerDown={(event) => {
            event.stopPropagation();
            // Cyklus přes všechny zbraně hry (sólo má šest; multiplayer si
            // z toho vezme první tři). Prazdná zbraň se přeskočí až v simu.
            weaponIndex.current = (weaponIndex.current + 1) % 6;
            state.current.weapon = weaponIndex.current;
          }}
        >
          ZB
        </button>
        <button
          type="button"
          className="arena-touch-btn is-small"
          onPointerDown={(event) => {
            event.stopPropagation();
            state.current.jump = true;
          }}
          onPointerUp={() => {
            state.current.jump = false;
          }}
        >
          SKOK
        </button>
        <button
          type="button"
          className="arena-touch-btn is-fire"
          onPointerDown={(event) => {
            event.stopPropagation();
            state.current.fire = true;
          }}
          onPointerUp={() => {
            state.current.fire = false;
          }}
          onPointerLeave={() => {
            state.current.fire = false;
          }}
        >
          PALBA
        </button>
      </div>
    </div>
  );
}

/**
 * Přečte dotykový stav do stejných refů, které používá klávesnice —
 * hra tak nemusí mít dvě větve vstupu.
 */
export function readTouch(
  touch: MutableRefObject<ArenaTouchState> | undefined,
  view: MutableRefObject<{ yaw: number; pitch: number }>,
  onWeapon: (weapon: number) => void,
): { forward: number; strafe: number; fire: boolean; jump: boolean } {
  if (!touch) return { forward: 0, strafe: 0, fire: false, jump: false };
  const t = touch.current;

  if (t.lookX || t.lookY) {
    view.current.yaw -= t.lookX;
    const limit = Math.PI / 2 - 0.05;
    view.current.pitch = Math.max(-limit, Math.min(limit, view.current.pitch - t.lookY));
    t.lookX = 0;
    t.lookY = 0;
  }

  if (t.weapon !== null) {
    onWeapon(t.weapon);
    t.weapon = null;
  }

  return { forward: t.moveY, strafe: t.moveX, fire: t.fire, jump: t.jump };
}
