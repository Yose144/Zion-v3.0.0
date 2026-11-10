'use client';

import { useEffect, useRef } from 'react';
import { NO_INPUT, type FightInput } from './ragdoll';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const JUMP = ['KeyW', 'ArrowUp', 'Space'];
const PUNCH = ['KeyJ', 'KeyF'];
const KICK = ['KeyK', 'KeyG'];
const BLOCK = ['KeyS', 'ArrowDown', 'ShiftLeft'];

function inGroup(code: string, group: string[]): boolean {
  return group.includes(code);
}

/**
 * Klávesový vstup duelu — jeden hook pro sólo i multiplayer.
 * Konvence: A/D nebo ←/→ pohyb, W/↑/mezerník skok, J nebo F pěst,
 * K nebo G kop, S/↓/LShift blok. Držené útoky se na serveru chovají jako
 * opakování v ochlazení — jako u držení spouště v aréně.
 */
export function useFightKeys(active: boolean) {
  const input = useRef<FightInput>({ ...NO_INPUT });

  useEffect(() => {
    if (!active) {
      input.current = { ...NO_INPUT };
      return;
    }
    const keys = new Set<string>();
    const recompute = () => {
      input.current = {
        move: (keys.has(RIGHT[0]) || keys.has(RIGHT[1]) ? 1 : 0) - (keys.has(LEFT[0]) || keys.has(LEFT[1]) ? 1 : 0),
        jump: JUMP.some((code) => keys.has(code)),
        punch: PUNCH.some((code) => keys.has(code)),
        kick: KICK.some((code) => keys.has(code)),
        block: BLOCK.some((code) => keys.has(code)),
      };
    };
    const clear = () => {
      keys.clear();
      recompute();
    };
    const down = (event: KeyboardEvent) => {
      keys.add(event.code);
      recompute();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      keys.delete(event.code);
      recompute();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      input.current = { ...NO_INPUT };
    };
  }, [active]);

  return input;
}
