'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DuelCamera, DuelStage } from './DuelStage';
import { Fighter3D } from './Fighter3D';
import {
  botInput,
  createDuel,
  makeBotMemory,
  resetDuel,
  stepDuel,
  type BotDifficulty,
  type Duel,
  type Fighter,
} from './duel';
import { useFightKeys } from './useFightKeys';
import { avatarLook } from '../avatars/kit';
import type { Group } from 'three';

/**
 * MERKUR — sólo cvičení proti botovi. Simuluje TENTÝŽ `stepDuel` co server;
 * liší se jen zdroj vstupu soupeře (`botInput`).
 */

export interface DuelStats {
  round: number;
  phase: Duel['phase'];
  timer: number;
  countdown: number;
  selfHp: number;
  foeHp: number;
  selfWins: number;
  foeWins: number;
  winner: 'self' | 'foe' | null;
}

const RESTART_AFTER = 5;

export function MercurySolo({
  running,
  selfAvatarId,
  foeAvatarId,
  botDifficulty,
  onStats,
}: {
  running: boolean;
  selfAvatarId: number | null;
  foeAvatarId: number | null;
  botDifficulty: BotDifficulty;
  onStats: (stats: DuelStats) => void;
}) {
  const keys = useFightKeys(running);

  // jeden duel, jednomístní objekty — refy na `a`/`b` musí přežít restart
  const duelRef = useRef<Duel | null>(null);
  if (!duelRef.current) {
    duelRef.current = createDuel(
      { id: 'self', name: 'Ty', avatarId: selfAvatarId },
      { id: 'foe', name: 'Cvičný stín', avatarId: foeAvatarId },
    );
  }
  const duel = duelRef.current;
  const aRef = useRef<Fighter>(duel.a);
  const bRef = useRef<Fighter>(duel.b);

  const bot = useRef(makeBotMemory());
  const clock = useRef(0);
  const restartAt = useRef<number | null>(null);
  const lastStats = useRef('');
  const selfGroup = useRef<Group>(null);
  const foeGroup = useRef<Group>(null);

  const selfLook = useMemo(() => avatarLook(selfAvatarId), [selfAvatarId]);
  const foeLook = useMemo(() => avatarLook(foeAvatarId), [foeAvatarId]);

  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    clock.current += dt;
    const active = duel;
    active.a.avatarId = selfAvatarId;
    active.b.avatarId = foeAvatarId;

    stepDuel(active, keys.current, botInput(active, bot.current, active.b, active.a, clock.current, botDifficulty), dt, Date.now());

    if (active.phase === 'matchEnd') {
      if (restartAt.current === null) restartAt.current = clock.current + RESTART_AFTER;
      if (clock.current >= restartAt.current) {
        resetDuel(active);
        restartAt.current = null;
      }
    }

    if (selfGroup.current) selfGroup.current.position.set(active.a.x, active.a.y, 0);
    if (foeGroup.current) foeGroup.current.position.set(active.b.x, active.b.y, 0);

    const winner =
      active.phase === 'matchEnd'
        ? active.a.wins > active.b.wins
          ? 'self'
          : 'foe'
        : null;

    const stats: DuelStats = {
      round: active.round,
      phase: active.phase,
      timer: active.phase === 'fighting' ? Math.max(0, Math.ceil(active.timer)) : 0,
      countdown: active.phase === 'countdown' ? Math.max(0, Math.ceil(active.timer)) : 0,
      selfHp: active.a.hp,
      foeHp: active.b.hp,
      selfWins: active.a.wins,
      foeWins: active.b.wins,
      winner,
    };
    const key = JSON.stringify(stats);
    if (key !== lastStats.current) {
      lastStats.current = key;
      onStats(stats);
    }
  });

  return (
    <>
      <DuelStage />
      <DuelCamera a={aRef} b={bRef} />
      <group ref={selfGroup}>
        <Fighter3D state={aRef} look={selfLook} />
      </group>
      <group ref={foeGroup}>
        <Fighter3D state={bRef} look={foeLook} />
      </group>
    </>
  );
}
