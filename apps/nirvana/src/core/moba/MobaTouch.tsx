'use client';

import { useCallback, useEffect, useRef } from 'react';
import { SPELL_KEY, SPELL_LABEL } from './keys';
import type { SpellSlot } from './spells';

/**
 * DOTYKOVÉ OVLÁDÁNÍ MOBA (`/earth`).
 *
 * Hra čte tři věci: `keys` (WASD), `pointer` (kam míří, −1..1) a `queuedCast`
 * (které kouzlo). Nedává smysl přepisovat její vstupní smyčku — stačí jí
 * posílat **stejné události, jaké posílá klávesnice a myš**:
 *
 *  - joystick → syntetické `keydown`/`keyup` na `KeyW/A/S/D`,
 *  - kouzlo → `keydown` na klávesu ze `SPELL_KEY` (slot `W` je klávesa `F`,
 *    protože `W` patří pohybu vpřed),
 *  - PALBA → syntetický `pointerdown` na plátno (hra útočí na nejbližší cíl).
 *
 * Kouzlo se sesílá **na místo posledního klepnutí** — proto se před klávesou
 * pošle `pointermove`, který hře nastaví `pointer`. Bez toho by se kouzlo
 * seslalo na střed obrazovky bez ohledu na to, kam hráč kouká.
 */

/** Držení PALBY v ms — hra čte `attack` jednou za snímek, krátký ťuk by propadl. */
const ATTACK_HOLD_MS = 140;
const STICK_RADIUS = 46;
/** Mrtvá zóna, aby se hrdina nechoval, když se prst jen opře. */
const DEAD_ZONE = 0.28;

type Key = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD';

function sendKey(code: string, down: boolean) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
}

export function MobaTouch({ spells }: { spells: { slot: SpellSlot; name: string; color: string }[] }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const stickPointer = useRef<number | null>(null);
  const held = useRef<Set<Key>>(new Set());
  const aim = useRef<{ x: number; y: number } | null>(null);
  const attackTimer = useRef<number | null>(null);

  const canvas = () => document.querySelector<HTMLCanvasElement>('.moba-stage canvas');

  /** Rozdílová aktualizace — pošle jen klávesy, které se opravdu změnily. */
  const setHeld = useCallback((next: Set<Key>) => {
    for (const code of held.current) {
      if (!next.has(code)) sendKey(code, false);
    }
    for (const code of next) {
      if (!held.current.has(code)) sendKey(code, true);
    }
    held.current = next;
  }, []);

  const releaseAll = useCallback(() => {
    setHeld(new Set());
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
    stickPointer.current = null;
  }, [setHeld]);

  useEffect(() => {
    const release = () => {
      releaseAll();
      if (attackTimer.current !== null) {
        window.clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      releaseAll();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [releaseAll]);

  /**
   * Zamíření se jen **odposlouchává**, nesbírá: kdyby nad plátnem ležela
   * vrstva s `pointer-events: auto`, sežrala by klepnutí a hra by na ťuk
   * vůbec nezaútočila. Takhle jde klepnutí do canvasu a my si pamatujeme kam.
   */
  useEffect(() => {
    const record = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('.moba-touch-stick, .moba-touch-actions')) return;
      aim.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointerdown', record, true);
    return () => window.removeEventListener('pointerdown', record, true);
  }, []);

  const updateStick = useCallback(
    (clientX: number, clientY: number) => {
      const pad = stickRef.current;
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      let dx = clientX - (rect.left + rect.width / 2);
      let dy = clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;

      const forward = -dy / STICK_RADIUS;
      const strafe = dx / STICK_RADIUS;
      const next = new Set<Key>();
      if (forward > DEAD_ZONE) next.add('KeyW');
      if (forward < -DEAD_ZONE) next.add('KeyS');
      if (strafe > DEAD_ZONE) next.add('KeyD');
      if (strafe < -DEAD_ZONE) next.add('KeyA');
      setHeld(next);
    },
    [setHeld],
  );

  /** Kouzlo: nastav zamíření do posledního ťuku a zmáčkni klávesu slotu. */
  const cast = useCallback((slot: SpellSlot) => {
    const element = canvas();
    if (element && aim.current) {
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: aim.current.x,
          clientY: aim.current.y,
          bubbles: true,
        }),
      );
    }
    sendKey(SPELL_KEY[slot], true);
    window.setTimeout(() => sendKey(SPELL_KEY[slot], false), 60);
  }, []);

  /** PALBA: podrž `pointerdown` aspoň jeden snímek, jinak hra nestihne zaútočit. */
  const fire = useCallback(() => {
    const element = canvas();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = aim.current?.x ?? rect.left + rect.width / 2;
    const y = aim.current?.y ?? rect.top + rect.height / 2;
    element.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true }));
    if (attackTimer.current !== null) window.clearTimeout(attackTimer.current);
    attackTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      attackTimer.current = null;
    }, ATTACK_HOLD_MS);
  }, []);

  return (
    <div className="moba-touch" aria-hidden>
      <div
        ref={stickRef}
        className="moba-touch-stick"
        onPointerDown={(event) => {
          event.stopPropagation();
          stickPointer.current = event.pointerId;
          (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
          updateStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (stickPointer.current !== event.pointerId) return;
          aim.current = { x: event.clientX, y: event.clientY };
          updateStick(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          stickPointer.current = null;
          releaseAll();
        }}
        onPointerCancel={() => {
          stickPointer.current = null;
          releaseAll();
        }}
      >
        <span ref={knobRef} className="moba-touch-knob" />
      </div>

      <div className="moba-touch-actions">
        <div className="moba-touch-spells">
          {spells.map((spell) => (
            <button
              key={spell.slot}
              type="button"
              className="moba-touch-btn is-spell"
              style={{ borderColor: `${spell.color}aa`, color: spell.color }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                cast(spell.slot);
              }}
            >
              <b>{SPELL_LABEL[spell.slot]}</b>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="moba-touch-btn is-fire"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            fire();
          }}
        >
          ÚTOK
        </button>
      </div>
    </div>
  );
}
