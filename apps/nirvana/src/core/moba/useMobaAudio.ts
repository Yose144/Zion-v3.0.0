'use client';

/**
 * Zvuky ze snapshotů — jeden háček pro sólo i online.
 *
 * Simulace eventy neposílá (schválně: snapshot je jediný zdroj pravdy), takže
 * zvuk se odvozuje z **rozdílu dvou snapshotů**: spadlo mi HP → zásah,
 * změnil se vlastník uzlu → převzetí, přibyla vlna → vlna, skončil zápas →
 * konec. Když něco selže, hra běží dál (zvuk nikdy neblokuje).
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MobaSnapshot } from './sim';
import { mobaAudio } from './audio';

interface AudioState {
  hp: number;
  alive: boolean;
  wave: number;
  owners: string;
  ended: 'blue' | 'red' | null;
  items: number;
}

export function useMobaAudio(
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>,
  youId: string | null,
): void {
  const previous = useRef<AudioState | null>(null);

  useFrame(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    const you = snapshot.heroes.find((hero) => hero.id === youId) ?? snapshot.heroes[0];
    const owners = snapshot.nodes.map((node) => node.owner ?? '-').join('');
    const current: AudioState = {
      hp: you?.hp ?? 0,
      alive: you?.alive ?? true,
      wave: snapshot.wave,
      owners,
      ended: snapshot.ended,
      items: you?.items?.length ?? 0,
    };

    const last = previous.current;
    previous.current = current;
    if (!last) return;

    if (current.hp < last.hp) mobaAudio.hit();
    if (last.alive && !current.alive) mobaAudio.death();
    if (current.wave > last.wave) mobaAudio.wave();
    if (current.owners !== last.owners) mobaAudio.capture();
    if (current.items > last.items) mobaAudio.buy();
    if (!last.ended && current.ended) mobaAudio.end(current.ended === (you?.team ?? 'blue'));
  });
}
