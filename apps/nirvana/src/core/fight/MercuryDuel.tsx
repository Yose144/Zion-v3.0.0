'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { DuelCamera, DuelStage } from './DuelStage';
import { Fighter3D } from './Fighter3D';
import { makeFighter, stepFighter, type Fighter, type FightInput } from './duel';
import { useFightKeys } from './useFightKeys';
import { createDuelSound } from './audio';
import { DuelXr } from './FightXr';
import { useNet } from '@/core/net/useNet';
import type { FightPlayerState, ServerMessage } from '@/core/net/protocol';
import { avatarLook, type AvatarLook } from '../avatars/kit';
import { isGamePaused } from '@/core/games/pause';

/**
 * MERKUR — online duel. Server je autorita zásahů i kol; klient predikuje
 * **vlastní pohyb** stejnou funkcí `stepFighter` a zbytek zrcadlí ze
 * snapshotů (15 Hz). Zásahy se na klientu nepočítají — ty velí server,
 * jinak by se „trefil jsem ho a nic" vracelo oknem zpátky.
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
}

/** Vzdálenost, od které se predikce srovná na server. */
const SNAP_DISTANCE = 0.8;

const emptyFighter = (): Fighter => makeFighter({ id: 'pending', name: '…', avatarId: null }, -4, 1);

export function MercuryDuel({
  running,
  xr = false,
  watch = null,
  onStats,
}: {
  running: boolean;
  xr?: boolean;
  /** Id místnosti, na kterou se jen díváme (`?watch=`); `null` = hrajeme. */
  watch?: string | null;
  onStats: (stats: DuelMpStats) => void;
}) {
  const { subscribe, sendInput, joinGame, spectateRoom, leaveRoom, youPlayerId, spectator, connected, rtt } = useNet();
  const keys = useFightKeys(running);

  const self = useRef<Fighter>(emptyFighter());
  const foe = useRef<Fighter>(emptyFighter());
  const serverSelf = useRef<{ x: number; y: number; at: number } | null>(null);

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
  });

  const selfGroup = useRef<Group>(null);
  const foeGroup = useRef<Group>(null);
  const lastStats = useRef('');
  /** `onStats` stačí 10×/s — `hud.current` se plní každý frame (debug háček),
   *  ale React state emituje zbytečně často, viz `VenusMultiplayer.statsClock`. */
  const statsClock = useRef(0);
  const sound = useRef(createDuelSound());

  // avatary přijdou až se snapshotty — look se počítá při změně `avatarId`
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
    target.id = wire.id;
    target.name = wire.name;
    target.avatarId = wire.avatarId;
    target.hp = wire.hp;
    target.wins = wire.wins;
    target.ko = wire.ko;
    target.stun = wire.stun;
    target.blocking = wire.blocking;
    target.facing = wire.facing;
    target.attack = wire.attack ? { kind: wire.attack.kind, elapsed: wire.attack.elapsed, hit: true } : null;

    if (lookIds.current[mine ? 'self' : 'foe'] !== wire.avatarId) {
      lookIds.current[mine ? 'self' : 'foe'] = wire.avatarId;
      const nextLook = avatarLook(wire.avatarId);
      setLooks((previous) => (mine ? { ...previous, self: nextLook } : { ...previous, foe: nextLook }));
    }

    if (mine) {
      serverSelf.current = { x: wire.x, y: wire.y, at: Date.now() };
    } else {
      // soupeřovu polohu nenecháme predikovat — jen cíl, ke kterému kloužeme
      target.x = wire.x;
      target.y = wire.y;
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
          hud.current.matchWinner = null; // nový zápas od serveru běží
          sound.current.reset();
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
    (window as unknown as Record<string, unknown>).__duelDebug = () => ({
      you: youPlayerId,
      connected,
      self: { ...self.current },
      foe: { ...foe.current },
      hud: { ...hud.current },
    });
  }, [youPlayerId, connected]);

  // ── smyčka ──────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!running) return;
    // Hamburger menu (2026-11-10) — pauza patří do modulu, ne do každé hry.
    if (isGamePaused()) return;
    const dt = Math.min(0.05, delta);
    const now = Date.now();

    const watching = Boolean(watch) || spectator;

    // 1) vlastní predikce — týž krok co server, ale bez resolutních zásahů.
    // Divák predikci nepočítá, bere polohy ze snapshotu.
    if (!watching) stepFighter(self.current, foe.current, keys.current, dt);

    // 2) srovnání se serverem
    const anchor = serverSelf.current;
    if (watching && anchor) {
      self.current.x = anchor.x;
      self.current.y = anchor.y;
      self.current.vx = 0;
    } else if (anchor) {
      const dx = anchor.x - self.current.x;
      const dy = anchor.y - self.current.y;
      if (Math.abs(dx) > SNAP_DISTANCE || Math.abs(dy) > 1) {
        self.current.x = anchor.x;
        self.current.y = anchor.y;
        self.current.vx = 0;
      } else {
        self.current.x += dx * 0.15;
      }
    }

    // 3) animace soupeře pokračuje i mezi snapshoty (elapsed dopocítáme lokálně)
    if (foe.current.attack) {
      foe.current.attack.elapsed += dt;
    }

    sound.current.step({
      self: self.current.hp,
      foe: foe.current.hp,
      selfBlocking: self.current.blocking,
      foeBlocking: foe.current.blocking,
    });

    // 4) pozice meshů — soupeř klouže za cílem (exponenciální vyhlazení)
    if (selfGroup.current) {
      selfGroup.current.position.set(self.current.x, self.current.y, 0);
    }
    if (foeGroup.current) {
      const k = Math.min(1, dt * 12);
      foeGroup.current.position.x += (foe.current.x - foeGroup.current.position.x) * k;
      foeGroup.current.position.y += (foe.current.y - foeGroup.current.position.y) * k;
    }

    // 5) vstup na server (20 Hz, `sendInput` omezuje sám). Divák ho neposílá.
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

    // 6) HUD — jedny čerstvá data pro `onStats` i pro debug háček
    const stats: DuelMpStats = {
      ...hud.current,
      connected,
      ping: rtt,
      selfId: self.current.id,
      selfName: self.current.name,
      foeName: foe.current.name,
      selfHp: self.current.hp,
      foeHp: foe.current.hp,
      selfWins: self.current.wins,
      foeWins: foe.current.wins,
      foeIsBot: (foe.current.id ?? '').startsWith('bot-'),
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
      <DuelCamera a={self as MutableRefObject<Fighter>} b={foe as MutableRefObject<Fighter>} xr={xr} />
      {xr && <DuelXr active={running} />}
      <group ref={selfGroup}>
        <Fighter3D state={self} look={looks.self} />
      </group>
      <group ref={foeGroup}>
        <Fighter3D state={foe} look={looks.foe} />
      </group>
    </>
  );
}
