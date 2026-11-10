'use client';

/**
 * PAUZA PRO CELOU NIRVANU.
 *
 * Hamburger menu (2026-11-10) je společný pro všechny hry, takže musí umět
 * hru pozastavit — jinak si hráč v aréně otevírá nastavení a mezitím ho
 * boti zabijí. Stav je **jeden modul**, ne prop v devíti komponentách:
 * menu ho přepne, herní smyčky se ptají `isGamePaused()`.
 *
 * Pravidla:
 *  1. **Pauza není ztlumení vstupu.** Když jen zahodíme klávesy, simulace
 *     běží dál (odpočty, boti, fyzika). Hry proto pauzu kontrolují ve
 *     svém hlavním `useFrame`/tiku a jen ho přeskočí.
 *  2. **Multiplayer se nepauzuje potichu.** Server běží dál a ostatní hráči
 *     na tebe čekat nebudou; menu to v MP jen pozastaví *klienta* (kamera
 *     a vstup), ne svět. UI to musí říct (viz `GameMenu`).
 *  3. **Restart stránky pauzu vynuluje.** Je to přechodový stav, ne volba.
 */

let paused = false;
const listeners = new Set<(paused: boolean) => void>();

export function isGamePaused(): boolean {
  return paused;
}

export function setGamePaused(next: boolean): void {
  if (paused === next) return;
  paused = next;
  for (const listener of listeners) listener(paused);
}

export function subscribeGamePaused(listener: (paused: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
