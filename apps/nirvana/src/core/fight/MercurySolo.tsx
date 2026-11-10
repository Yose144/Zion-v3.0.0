'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DuelCamera, DuelStage, RagdollBall3D } from './DuelStage';
import { RagdollBody } from './RagdollBody';
import {
  BALL_SECONDS,
  botInput,
  createRagdollMatch,
  makeBotMemory,
  resetRagdollMatch,
  stepRagdoll,
  type BotDifficulty,
  type FightMode,
  type RagdollBall,
  type RagdollEvent,
  type RagdollFighter,
  type RagdollMatch,
  type RagdollPhase,
} from './ragdoll';
import { createDuelSound } from './audio';
import { useFightKeys } from './useFightKeys';
import { DuelXr } from './FightXr';
import { avatarLook } from '../avatars/kit';

/**
 * MERKUR — sólo ragdoll (duel / ball / survival / practice).
 *
 * Simulace je **týž modul** co server (`ragdoll.ts`); liší se jen zdroj
 * vstupu soupeře (`botInput`). Krokujeme pevně 1/60 s, aby se chování
 * neměnilo podle fps — stejná lekce jako u Venuše.
 */

export interface DuelStats {
  mode: FightMode;
  round: number;
  phase: RagdollPhase;
  /** Zbývající čas kola / zápasu; u survivalu odehraný čas. */
  timer: number;
  countdown: number;
  selfHp: number;
  foeHp: number;
  selfWins: number;
  foeWins: number;
  winner: 'self' | 'foe' | null;
  scoreSelf: number;
  scoreFoe: number;
  wave: number;
  hits: number;
  bestHit: number;
}

export interface SoloFinish {
  mode: FightMode;
  winner: 'self' | 'foe' | null;
  selfWins: number;
  foeWins: number;
  scoreSelf: number;
  scoreFoe: number;
  wave: number;
  hits: number;
  bestHit: number;
  seconds: number;
}

const STEP = 1 / 60;
const RESTART_AFTER = 6;

/** Přežití ztěžuje soupeře s každou vlnou — obtížnost se posouvá vzhůru. */
function scaleDifficulty(base: BotDifficulty, wave: number): BotDifficulty {
  if (base === 'champion') return 'champion';
  if (wave >= 5) return 'champion';
  if (wave >= 3) return 'standard';
  if (wave >= 2 && base === 'gentle') return 'standard';
  return base;
}

function winnerOf(match: RagdollMatch): 'self' | 'foe' | null {
  if (match.phase !== 'matchEnd') return null;
  if (match.mode === 'ball') {
    if (match.a.score > match.b.score) return 'self';
    if (match.b.score > match.a.score) return 'foe';
    return null;
  }
  if (match.mode === 'survival') {
    if (match.a.hp > 0 && match.b.hp <= 0) return 'self';
    if (match.a.hp <= 0) return 'foe';
    return null;
  }
  if (match.a.wins > match.b.wins) return 'self';
  if (match.b.wins > match.a.wins) return 'foe';
  return null;
}

export function MercurySolo({
  running,
  xr = false,
  mode,
  selfAvatarId,
  foeAvatarId,
  botDifficulty,
  onStats,
  onFinish,
}: {
  running: boolean;
  xr?: boolean;
  mode: FightMode;
  selfAvatarId: number | null;
  foeAvatarId: number | null;
  botDifficulty: BotDifficulty;
  onStats: (stats: DuelStats) => void;
  onFinish?: (result: SoloFinish) => void;
}) {
  const keys = useFightKeys(running);

  // jeden zápas, jednomístní objekty — renderer drží refy na `a`/`b`
  const matchRef = useRef<RagdollMatch | null>(null);
  if (!matchRef.current) {
    matchRef.current = createRagdollMatch(
      mode,
      { id: 'self', name: 'Ty', avatarId: selfAvatarId },
      { id: 'foe', name: 'Soupeř', avatarId: foeAvatarId },
    );
  }
  const match = matchRef.current;
  const aRef = useRef<RagdollFighter>(match.a);
  const bRef = useRef<RagdollFighter>(match.b);
  const ballRef = useRef<RagdollBall | null>(match.ball);

  const bot = useRef(makeBotMemory());
  const clock = useRef(0);
  const accumulator = useRef(0);
  const restartAt = useRef<number | null>(null);
  const finished = useRef(false);
  const lastStats = useRef('');
  const statsClock = useRef(0);
  const sound = useRef(createDuelSound());

  const selfLook = useMemo(() => avatarLook(selfAvatarId), [selfAvatarId]);
  const foeLook = useMemo(() => avatarLook(foeAvatarId), [foeAvatarId]);

  const handleEvents = (events: RagdollEvent[]) => {
    for (const event of events) {
      if (event.kind === 'fight_start') sound.current.event('fight_start');
      else if (event.kind === 'round_end') sound.current.event('round_end');
      else if (event.kind === 'match_end') {
        const winner = winnerOf(match);
        sound.current.event('match_end', winner === 'self');
        if (!finished.current && onFinish) {
          finished.current = true;
          onFinish({
            mode: match.mode,
            winner,
            selfWins: match.a.wins,
            foeWins: match.b.wins,
            scoreSelf: match.a.score,
            scoreFoe: match.b.score,
            wave: match.wave,
            hits: match.a.hits,
            bestHit: match.a.bestHit,
            seconds: match.elapsed,
          });
        }
      }
    }
  };

  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    clock.current += dt;
    accumulator.current = Math.min(accumulator.current + dt, STEP * 5);
    match.a.avatarId = selfAvatarId;
    match.b.avatarId = foeAvatarId;
    ballRef.current = match.ball;

    while (accumulator.current >= STEP) {
      accumulator.current -= STEP;
      const difficulty =
        match.mode === 'survival' ? scaleDifficulty(botDifficulty, match.wave) : botDifficulty;
      const foeInput = botInput(match, 'b', bot.current, difficulty, clock.current);
      const events = stepRagdoll(match, keys.current, foeInput, STEP, Date.now());
      handleEvents(events);
    }

    sound.current.step({
      self: match.a.hp,
      foe: match.b.hp,
      selfBlocking: match.a.guard,
      foeBlocking: match.b.guard,
    });

    if (match.phase === 'matchEnd') {
      if (restartAt.current === null) restartAt.current = clock.current + RESTART_AFTER;
      if (clock.current >= restartAt.current) {
        resetRagdollMatch(match);
        ballRef.current = match.ball;
        sound.current.reset();
        restartAt.current = null;
        finished.current = false;
      }
    }

    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const winner = winnerOf(match);
      const stats: DuelStats = {
        mode: match.mode,
        round: match.round,
        phase: match.phase,
        timer:
          match.mode === 'ball'
            ? Math.max(0, Math.ceil(BALL_SECONDS - match.elapsed))
            : match.mode === 'survival' || match.mode === 'practice'
              ? Math.floor(match.elapsed)
              : match.phase === 'playing'
                ? Math.max(0, Math.ceil(match.timer))
                : 0,
        countdown: match.phase === 'countdown' ? Math.max(0, Math.ceil(match.timer)) : 0,
        selfHp: Math.round(match.a.hp),
        foeHp: Math.round(match.b.hp),
        selfWins: match.a.wins,
        foeWins: match.b.wins,
        winner,
        scoreSelf: match.a.score,
        scoreFoe: match.b.score,
        wave: match.wave,
        hits: match.a.hits,
        bestHit: match.a.bestHit,
      };
      const key = JSON.stringify(stats);
      if (key !== lastStats.current) {
        lastStats.current = key;
        onStats(stats);
      }
    }
  });

  return (
    <>
      <DuelStage goals={mode === 'ball'} />
      <DuelCamera a={aRef} b={bRef} ball={ballRef} wide={mode === 'ball'} xr={xr} />
      {xr && <DuelXr active={running} />}
      <RagdollBody state={aRef} look={selfLook} />
      <RagdollBody state={bRef} look={foeLook} />
      {mode === 'ball' && <RagdollBall3D ball={ballRef} />}
    </>
  );
}
