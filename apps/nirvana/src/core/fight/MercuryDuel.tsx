'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { DuelCamera, DuelStage } from './DuelStage';
import { RagdollBody } from './RagdollBody';
import {
  P,
  applyPose,
  bodyCenterOf,
  makeRagdollFighter,
  type FightInput,
  type RagdollFighter,
} from './ragdoll';
import { clearFx, pushHitFx, pushTextFx, type DuelFloater } from './DuelFx';
import { useFightKeys } from './useFightKeys';
import { createDuelSound } from './audio';
import { DuelXr } from './FightXr';
import { useNet } from '@/core/net/useNet';
import type { FightPlayerState, ServerMessage } from '@/core/net/protocol';
import { avatarLook, type AvatarLook } from '../avatars/kit';
import { dampFactor } from '@/core/design/motion';

/**
 * MERKUR — online ragdoll duel. Server je autorita fyziky i zásahů; klient
 * posílá jen vstup (20 Hz) a **interpoluje pózy** ze snapshotů (15 Hz).
 *
 * Vlastní pohyb se nepredikuje schválně: ragdoll je chaotický, takže
 * predikce by se do 200 ms rozešla a loutka by poskakovala. Místo toho
 * klient plynule dohání serverovou pózu — u pomalého fyzikálního souboje
 * je 70 ms latence nevidět.
 */

export interface DuelMpStats {
  connected: boolean;
  ping: number | null;
  round: number;
  state: 'countdown' | 'running' | 'roundEnd' | 'matchEnd' | null;
  countdown: number;
  secondsLeft: number;
  /** Id vlastního bojovníka (serverový) — podle něj poznáme vítěze. */
  selfId: string;
  selfName: string;
  foeName: string;
  selfHp: number;
  foeHp: number;
  selfWins: number;
  foeWins: number;
  /** Soupeřovo sedlo zatím drží bot (čeká se na druhého člověka). */
  foeIsBot: boolean;
  /** Id vítěze zápasu po `duel_end`, jinak null. */
  matchWinner: string | null;
  /** Poslední kolo: 'ko' | 'time' | null. */
  lastRoundReason: 'ko' | 'time' | null;
  /** Výdrž krytu 0..1. */
  selfGuard: number;
  foeGuard: number;
  /** Série zásahů. */
  selfCombo: number;
  foeCombo: number;
}

/** Vzdálenost bodu, od které se póza „teleportuje“ (respawn), ne interpoluje. */
const SNAP_DISTANCE = 3;

const emptyFighter = (): RagdollFighter =>
  makeRagdollFighter({ id: 'pending', name: '…', avatarId: null }, -3.4, 1);

type PoseTarget = { pose: number[] | null };

function smoothPose(fighter: RagdollFighter, target: PoseTarget, k: number): void {
  const pose = target.pose;
  if (!pose || pose.length < 22) return;
  for (let i = 0; i < 11; i++) {
    const tx = pose[i * 2]!;
    const ty = pose[i * 2 + 1]!;
    const dx = tx - fighter.x[i]!;
    const dy = ty - fighter.y[i]!;
    if (Math.abs(dx) > SNAP_DISTANCE || Math.abs(dy) > SNAP_DISTANCE) {
      fighter.x[i] = tx;
      fighter.y[i] = ty;
    } else {
      fighter.x[i] = fighter.x[i]! + dx * k;
      fighter.y[i] = fighter.y[i]! + dy * k;
    }
    fighter.vx[i] = 0;
    fighter.vy[i] = 0;
  }
}

export function MercuryDuel({
  running,
  xr = false,
  watch = null,
  onStats,
  floaters,
  cameraRef,
}: {
  running: boolean;
  xr?: boolean;
  /** Id místnosti, na kterou se jen díváme (`?watch=`); `null` = hrajeme. */
  watch?: string | null;
  onStats: (stats: DuelMpStats) => void;
  /** Plovoucí čísla — v online se odvozují z poklesu HP mezi snapshoty. */
  floaters?: MutableRefObject<DuelFloater[]>;
  cameraRef?: MutableRefObject<THREE.Camera | null>;
}) {
  const { subscribe, sendInput, joinGame, spectateRoom, leaveRoom, youPlayerId, spectator, connected, rtt } = useNet();
  const keys = useFightKeys(running);

  const self = useRef<RagdollFighter>(emptyFighter());
  const foe = useRef<RagdollFighter>(emptyFighter());
  const selfTarget = useRef<PoseTarget>({ pose: null });
  const foeTarget = useRef<PoseTarget>({ pose: null });
  const selfSnapped = useRef(false);

  const hud = useRef<DuelMpStats>({
    connected: false,
    ping: null,
    round: 1,
    state: null,
    countdown: 0,
    secondsLeft: 0,
    selfId: '',
    selfName: '…',
    foeName: '…',
    selfHp: 100,
    foeHp: 100,
    selfWins: 0,
    foeWins: 0,
    foeIsBot: true,
    matchWinner: null,
    lastRoundReason: null,
    selfGuard: 1,
    foeGuard: 1,
    selfCombo: 0,
    foeCombo: 0,
  });

  const lastStats = useRef('');
  const statsClock = useRef(0);
  const sound = useRef(createDuelSound());

  const [looks, setLooks] = useState<{ self: AvatarLook; foe: AvatarLook }>(() => ({
    self: avatarLook(null),
    foe: avatarLook(null),
  }));
  const lookIds = useRef<{ self: number | null; foe: number | null }>({ self: null, foe: null });

  // ── připojení ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || !connected) return;
    if (watch) spectateRoom('fight', watch);
    else joinGame('fight');
    return () => leaveRoom();
  }, [running, connected, joinGame, spectateRoom, leaveRoom, watch]);

  // ── data ze serveru ─────────────────────────────────────────────────
  const applyWire = (wire: FightPlayerState, mine: boolean) => {
    const target = mine ? self.current : foe.current;
    const poseTarget = mine ? selfTarget.current : foeTarget.current;
    const beforeHp = target.hp;
    const wasKo = target.ko;
    const beforeGuard = target.guardMeter;
    target.id = wire.id;
    target.name = wire.name;
    target.avatarId = wire.avatarId;
    target.hp = wire.hp;
    target.wins = wire.wins;
    target.ko = wire.ko;
    target.stun = wire.stun;
    target.guard = wire.blocking;
    target.facing = wire.facing;
    target.guardMeter = typeof wire.guard === 'number' ? wire.guard : 1;
    target.combo = typeof wire.combo === 'number' ? wire.combo : 0;
    poseTarget.pose = Array.isArray(wire.pose) ? wire.pose : null;
    if (mine && !selfSnapped.current && poseTarget.pose) {
      applyPose(self.current, poseTarget.pose);
      selfSnapped.current = true;
    }

    // online nemá damage eventy — čísla vznikají rozdílem HP mezi snapshoty
    if (floaters) {
      const center = bodyCenterOf(target);
      const now = performance.now();
      if (typeof wire.guard === 'number' && beforeGuard >= 0.02 && wire.guard < 0.02) {
        pushTextFx(floaters.current, center.x, center.y + 0.8, 'GUARD BREAK', 'guard', now);
      }
      if (beforeHp - wire.hp >= 1) {
        pushHitFx(floaters.current, center.x, center.y + 0.15, beforeHp - wire.hp, mine ? 'in' : 'out', now);
      }
      if (wire.ko && !wasKo) {
        pushTextFx(floaters.current, center.x, center.y + 0.95, 'K.O.', 'ko', now);
      }
    }

    if (lookIds.current[mine ? 'self' : 'foe'] !== wire.avatarId) {
      lookIds.current[mine ? 'self' : 'foe'] = wire.avatarId;
      const nextLook = avatarLook(wire.avatarId);
      setLooks((previous) => (mine ? { ...previous, self: nextLook } : { ...previous, foe: nextLook }));
    }
  };

  useEffect(() => {
    return subscribe((message: ServerMessage) => {
      if (message.t === 'snapshot' && message.game === 'fight') {
        const players = message.players as unknown as FightPlayerState[];
        const watchingNow = Boolean(watch) || spectator;
        if (watchingNow) {
          if (players[0]) applyWire(players[0], true);
          if (players[1]) applyWire(players[1], false);
        } else {
          const me = players.find((player) => player.id === youPlayerId);
          const other = players.find((player) => player.id !== youPlayerId);
          if (me) applyWire(me, true);
          if (other) applyWire(other, false);
        }

        const state = message.state ?? 'countdown';
        if (state === 'countdown' && hud.current.matchWinner !== null) {
          hud.current.matchWinner = null;
          sound.current.reset();
          selfSnapped.current = false;
          if (floaters) clearFx(floaters.current);
        }
        hud.current.state = state as DuelMpStats['state'];
        hud.current.round = message.round ?? 1;
        hud.current.countdown = message.countdown ?? 0;
        hud.current.secondsLeft = message.secondsLeft ?? 0;
        return;
      }

      if (message.t === 'event') {
        const event = message.event;
        if (event.kind === 'duel_end') {
          hud.current.matchWinner = event.winner;
          sound.current.event('match_end', event.winner === youPlayerId);
        } else if (event.kind === 'round_start') {
          hud.current.lastRoundReason = null;
          sound.current.event('fight_start');
        } else if (event.kind === 'round_end') {
          hud.current.lastRoundReason = event.reason;
          sound.current.event('round_end');
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, youPlayerId, watch, spectator]);

  // ── debug háček pro headless testy (?duelDebug=1) ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('duelDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__duelDebug = () => {
      const selfCenter = bodyCenterOf(self.current);
      const foeCenter = bodyCenterOf(foe.current);
      return {
        you: youPlayerId,
        connected,
        self: {
          id: self.current.id,
          name: self.current.name,
          x: selfCenter.x,
          y: selfCenter.y,
          hp: self.current.hp,
          ko: self.current.ko,
          facing: self.current.facing,
          guard: self.current.guard,
        },
        foe: {
          id: foe.current.id,
          name: foe.current.name,
          x: foeCenter.x,
          y: foeCenter.y,
          hp: foe.current.hp,
          ko: foe.current.ko,
          facing: foe.current.facing,
          guard: foe.current.guard,
        },
        hud: { ...hud.current },
      };
    };
  }, [youPlayerId, connected]);

  // ── smyčka ──────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    const watching = Boolean(watch) || spectator;

    const k = watching ? 0.5 : dampFactor(dt);
    smoothPose(self.current, selfTarget.current, k);
    smoothPose(foe.current, foeTarget.current, k);

    sound.current.step({
      self: self.current.hp,
      foe: foe.current.hp,
      selfBlocking: self.current.guard,
      foeBlocking: foe.current.guard,
    });

    // vstup na server (20 Hz, `sendInput` omezuje sám); divák neposílá
    if (!watching) {
      const input: FightInput = keys.current;
      sendInput({
        forward: 0,
        strafe: input.move,
        yaw: 0,
        pitch: 0,
        jump: input.jump,
        fire: input.punch || input.kick,
        weapon: input.kick && !input.punch ? 1 : 0,
        block: input.block,
      });
    }

    const stats: DuelMpStats = {
      ...hud.current,
      connected,
      ping: rtt,
      selfId: self.current.id,
      selfName: self.current.name,
      foeName: foe.current.name,
      selfHp: Math.round(self.current.hp),
      foeHp: Math.round(foe.current.hp),
      selfWins: self.current.wins,
      foeWins: foe.current.wins,
      foeIsBot: (foe.current.id ?? '').startsWith('bot-'),
      selfGuard: Math.round(self.current.guardMeter * 100) / 100,
      foeGuard: Math.round(foe.current.guardMeter * 100) / 100,
      selfCombo: self.current.combo,
      foeCombo: foe.current.combo,
    };
    hud.current = stats;
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const key = JSON.stringify(stats);
      if (key !== lastStats.current) {
        lastStats.current = key;
        onStats(stats);
      }
    }
  });

  return (
    <>
      <DuelStage />
      <DuelCamera
        a={self as MutableRefObject<RagdollFighter>}
        b={foe as MutableRefObject<RagdollFighter>}
        xr={xr}
        cameraRef={cameraRef ?? null}
      />
      {xr && <DuelXr active={running} />}
      <RagdollBody state={self} look={looks.self} />
      <RagdollBody state={foe} look={looks.foe} />
    </>
  );
}
