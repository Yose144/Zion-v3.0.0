'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { DuelCamera, DuelStage, RagdollBall3D } from './DuelStage';
import { RagdollBody } from './RagdollBody';
import {
  BALL_SECONDS,
  P,
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
import { clearFx, pushHitFx, pushTextFx, type DuelFloater } from './DuelFx';
import { createDuelSound } from './audio';
import { useFightKeys } from './useFightKeys';
import { DuelXr } from './FightXr';
import { avatarLook } from '../avatars/kit';

/**
 * MERKUR — sólo ragdoll (duel / ball / survival / practice / koth).
 *
 * Simulace je **týž modul** co server (`ragdoll.ts`); liší se jen zdroj
 * vstupu soupeře (`botInput`). Krokujeme pevně 1/60 s, aby se chování
 * neměnilo podle fps — stejná lekce jako u Venuše.
 */

export interface DuelStats {
  mode: FightMode;
  round: number;
  phase: RagdollPhase;
  /** Zbývající čas kola / zápasu; u survivalu a tréninku odehraný čas. */
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
  /** Výdrž krytu 0..1 (1 = plný). */
  selfGuard: number;
  foeGuard: number;
  /** Aktuální série zásahů. */
  selfCombo: number;
  foeCombo: number;
  /** King of the Hill — o kolik sekund kdo držel kopec. */
  selfHill: number;
  foeHill: number;
  /** Fotbal: kdo právě dělá výkop (střelec je na chvíli zmrazený). */
  kickoff: 'self' | 'foe' | null;
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
  selfHill: number;
  foeHill: number;
  seconds: number;
}

const STEP = 1 / 60;
const RESTART_AFTER = 6;
/** Zpomalení po KO — jen v sólu (server v online jede dál). */
const KO_SLOW_SCALE = 0.34;
const KO_SLOW_SECONDS = 0.85;

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
  if (match.mode === 'koth') {
    if (match.hill.a > match.hill.b) return 'self';
    if (match.hill.b > match.hill.a) return 'foe';
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
  floaters,
  cameraRef,
}: {
  running: boolean;
  xr?: boolean;
  mode: FightMode;
  selfAvatarId: number | null;
  foeAvatarId: number | null;
  botDifficulty: BotDifficulty;
  onStats: (stats: DuelStats) => void;
  onFinish?: (result: SoloFinish) => void;
  /** Plovoucí čísla zásahů (kreslí se v `DuelFxOverlay` nad plátnem). */
  floaters?: MutableRefObject<DuelFloater[]>;
  cameraRef?: MutableRefObject<THREE.Camera | null>;
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
  const slowUntil = useRef(0);
  const finished = useRef(false);
  const lastStats = useRef('');
  const statsClock = useRef(0);
  const sound = useRef(createDuelSound());

  const selfLook = useMemo(() => avatarLook(selfAvatarId), [selfAvatarId]);
  const foeLook = useMemo(() => avatarLook(foeAvatarId), [foeAvatarId]);

  const handleEvents = (events: RagdollEvent[]) => {
    const fx = floaters?.current;
    const now = performance.now();
    for (const event of events) {
      if (event.kind === 'fight_start') sound.current.event('fight_start');
      else if (event.kind === 'round_end') sound.current.event('round_end');
      else if (event.kind === 'hit') {
        if (fx) pushHitFx(fx, event.x, event.y, event.damage, event.on === 'self' ? 'in' : 'out', now);
      } else if (event.kind === 'combo') {
        if (fx && event.combo >= 3) {
          pushTextFx(fx, event.x, event.y + 0.7, `×${event.combo}`, 'combo', now);
        }
      } else if (event.kind === 'guard_break') {
        const fighter = event.id === 'self' ? match.a : match.b;
        if (fx) {
          pushTextFx(fx, fighter.x[P.CHEST]!, fighter.y[P.CHEST]! + 0.8, 'GUARD BREAK', 'guard', now);
        }
      } else if (event.kind === 'ko') {
        const loser = event.loser === 'self' ? match.a : match.b;
        if (fx) pushTextFx(fx, loser.x[P.CHEST]!, loser.y[P.CHEST]! + 0.9, 'K.O.', 'ko', now);
        slowUntil.current = clock.current + KO_SLOW_SECONDS;
      } else if (event.kind === 'hill_win') {
        if (fx) pushTextFx(fx, 0, 2.4, 'HILL', 'hill', now);
      } else if (event.kind === 'match_end') {
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
            selfHill: match.hill.a,
            foeHill: match.hill.b,
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
    const slow = clock.current < slowUntil.current;
    accumulator.current = Math.min(accumulator.current + dt * (slow ? KO_SLOW_SCALE : 1), STEP * 5);
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
        if (floaters) clearFx(floaters.current);
        ballRef.current = match.ball;
        sound.current.reset();
        restartAt.current = null;
        slowUntil.current = 0;
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
        selfGuard: Math.round(match.a.guardMeter * 100) / 100,
        foeGuard: Math.round(match.b.guardMeter * 100) / 100,
        selfCombo: match.a.combo,
        foeCombo: match.b.combo,
        selfHill: Math.round(match.hill.a * 10) / 10,
        foeHill: Math.round(match.hill.b * 10) / 10,
        kickoff: match.kickoff.side ? (match.kickoff.side === 'a' ? 'self' : 'foe') : null,
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
      <DuelStage goals={mode === 'ball'} hill={mode === 'koth'} />
      <DuelCamera
        a={aRef}
        b={bRef}
        ball={ballRef}
        wide={mode === 'ball'}
        xr={xr}
        cameraRef={cameraRef ?? null}
      />
      {xr && <DuelXr active={running} />}
      <RagdollBody state={aRef} look={selfLook} />
      <RagdollBody state={bRef} look={foeLook} />
      {mode === 'ball' && <RagdollBall3D ball={ballRef} />}
    </>
  );
}
