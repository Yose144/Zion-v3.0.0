/**
 * MOBA „PRVNÍ SVĚT" — zvuk.
 *
 * Všechno je **syntéza z oscilátorů a šumu** — v repu není jediný zvukový
 * soubor. Kontext i strop hlasů drží sdílený `core/audio/engine.ts`, aby
 * aréna, souboj i pouť nesbíraly vlastní `AudioContext`.
 *
 * Zvuk nikdy nerozhoduje o hře: hraje se z událostí, které už nastaly
 * (zásah = spadlo HP ve snapshotu). Když zvuk selže, hra běží dál.
 */

import { play, playNoise, playTone, unlock } from '@/core/audio/engine';

/** Otevři audio po prvním gestu (klik / klávesa). */
export function unlockMobaAudio(): void {
  unlock();
}

export const mobaAudio = {
  /** Zásah — krátký dutý úder. */
  hit(): void {
    play('hit');
  },
  /** Seslání kouzla — podle barvy postavy. */
  spell(color: string): void {
    const hue = color.replace('#', '');
    const base = 300 + (parseInt(hue.slice(0, 2), 16) % 200);
    playTone({ freq: base, to: base * 2.2, duration: 0.22, type: 'triangle', gain: 0.07 });
    playTone({ freq: base * 0.5, to: base, duration: 0.18, type: 'sine', gain: 0.05, delay: 0.02 });
  },
  /** Smrt hrdiny. */
  death(): void {
    play('death');
  },
  /** Převzetí uzlu L5. */
  capture(): void {
    play('open');
  },
  /** Nová vlna minionů. */
  wave(): void {
    playTone({ freq: 320, to: 420, duration: 0.16, type: 'triangle', gain: 0.05 });
  },
  /** Nákup v obchodě. */
  buy(): void {
    play('pickup');
  },
  /** Konec zápasu. */
  end(win: boolean): void {
    play(win ? 'victory' : 'defeat');
  },
};

/** Zvuk dopadu pro střety, které engine nepojmenovává (rezerva pro F24+). */
export function mobaImpact(): void {
  playNoise({ duration: 0.06, gain: 0.04, cutoff: 1200 });
}
