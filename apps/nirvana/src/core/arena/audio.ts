/**
 * Zvuk arény — jen jména, syntéza je v `core/audio/engine.ts`.
 *
 * Aréna měla vlastní `AudioContext` dřív, než existoval sdílený engine; tenhle
 * soubor drží původní API (`playRail()`, `unlockAudio()`), aby se nemusely
 * měnit desítky volání v `MarsArena`/`MarsMultiplayer`. Kdo přidává nový zvuk,
 * přidá ho do `engine.ts` (jedno místo, jeden kontext, jeden strop hlasů).
 */

import { play, unlock } from '@/core/audio/engine';

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
