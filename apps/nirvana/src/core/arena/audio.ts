/**
 * Zvuk arény — jen jména, syntéza je v `core/audio/engine.ts`.
 *
 * Aréna měla vlastní `AudioContext` dřív, než existoval sdílený engine; tenhle
 * soubor drží původní API (`playRail()`, `unlockAudio()`), aby se nemusely
 * měnit desítky volání v `MarsArena`/`MarsMultiplayer`. Kdo přidává nový zvuk,
 * přidá ho do `engine.ts` (jedno místo, jeden kontext, jeden strop hlasů).
 */

import { play, playNoise, playTone, unlock } from '@/core/audio/engine';

/** Volat z gesta (klik / vstup do arény), aby prohlížeč dovolil zvuk. */
export function unlockAudio(): void {
  unlock();
}

/** Rail: krátký sykot s klesajícím tónem. */
export function playRail(): void {
  play('rail');
}

/** Raketa: tupý výstřel + syčení. */
export function playRocket(): void {
  play('rocket');
}

/** Exploze: šum s nízkým filtrem a dlouhým dozvukem. */
export function playExplosion(): void {
  play('explosion');
}

/** Zásah: krátké cvaknutí ve vysoké poloze. */
export function playHit(): void {
  play('hit');
}

/** Strojní puška: krátká dávka pod sebou. */
export function playMg(): void {
  play('mg');
}

/** Brokovnice (Q3): tupý náraz a široký šum — žádný jasný tón. */
export function playShotgun(): void {
  playTone({ freq: 170, to: 80, duration: 0.2, type: 'square', gain: 0.14 });
  playNoise({ duration: 0.26, gain: 0.1, cutoff: 1600 });
}

/** Blesk: krátký elektrický sykot, opakuje se s kadencí zbraně. */
export function playLightning(): void {
  playTone({ freq: 1600, to: 620, duration: 0.055, type: 'sawtooth', gain: 0.055 });
  playNoise({ duration: 0.05, gain: 0.045, cutoff: 5200, type: 'highpass' });
}

/** Plazma: měkký rostoucí tón, mezi raketou a laserem. */
export function playPlasma(): void {
  playTone({ freq: 520, to: 880, duration: 0.09, type: 'sine', gain: 0.06 });
}

/** Zabití bota: dva tóny dolů. */
export function playFrag(): void {
  play('frag');
}

/** Hráč dostal zásah. */
export function playHurt(): void {
  play('hurt');
}

/** Pickup: stoupající ping. */
export function playPickup(): void {
  play('pickup');
}

/** Smrt hráče. */
export function playDeath(): void {
  play('death');
}

/** Konec zápasu. */
export function playMatchEnd(): void {
  play('matchEnd');
}
