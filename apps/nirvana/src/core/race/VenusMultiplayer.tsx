'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import { LAPS, buildTrack, checkpointIndices } from './track';
import { MAX_SPEED, type Craft, spawnCraft, stepCraft } from './physics';
import { TrackStage } from './TrackStage';
import { CraftMesh, CraftSmoke, emptyCraftFx, type CraftFx } from './CraftMesh';
import { useNet } from '@/core/net/useNet';
import { play, startEngineLoop, unlock, type LoopHandle } from '@/core/audio/engine';
import { RaceXr } from './RaceXr';
import type { RacePlayerState, ServerMessage } from '@/core/net/protocol';
import { isGamePaused } from '@/core/games/pause';

/** Pořadí závodu: kdo dojel, pak vyšší kolo. Stejné pro kameru diváka i HUD. */
function byRacePlace(
  a: { finishedAtMs: number | null; lap: number },
  b: { finishedAtMs: number | null; lap: number },
): number {
  if (a.finishedAtMs !== null && b.finishedAtMs !== null) return a.finishedAtMs - b.finishedAtMs;
  if (a.finishedAtMs !== null) return -1;
  if (b.finishedAtMs !== null) return 1;
  return b.lap - a.lap;
}

function raceLeader(players: RacePlayerState[]): RacePlayerState | undefined {
  return [...players].sort(byRacePlace)[0];
}

/**
 * VENUŠE — multiplayer závod.
 *
 * Server simuluje vozítka stejnou fyzikou (`race/physics.ts`) a stejnou tratí;
 * klient posílá jen plyn, zatáčení, ruční brzdu a nitro. Vlastní pohyb se
 * predikuje, ostatní se interpolují. Odpočet, kola i cílovka jsou serverové —
 * klient je jen kreslí.
 */

export interface MpRaceRow {
  id: string;
  name: string;
  lap: number;
  finishedAtMs: number | null;
}

export interface MpRaceStats {
  speed: number;
  lap: number;
  laps: number;
  elapsed: number;
  position: number;
  total: number;
  standings: MpRaceRow[];
  countdown: number;
  state: 'countdown' | 'running' | 'ended' | null;
  connected: boolean;
  ping: number | null;
  /** Nádrž nitra 0..1 pro HUD. */
  nitro: number;
  drifting: boolean;
  boosting: boolean;
}

const MAX_REMOTE = 7;
const SNAP_DISTANCE = 3;

interface Snapshot {
  at: number;
  players: RacePlayerState[];
  state: 'countdown' | 'running' | 'ended';
  countdown: number;
  raceSeconds: number;
}

export function VenusMultiplayer({
  running,
  xr = false,
  watch = null,
  onStats,
}: {
  running: boolean;
  xr?: boolean;
  /** Id místnosti, na kterou se jen díváme (`?watch=`); `null` = hrajeme. */
  watch?: string | null;
  onStats: (stats: MpRaceStats) => void;
}) {
  const { camera } = useThree();
  const { subscribe, sendInput, joinGame, spectateRoom, leaveRoom, youPlayerId, spectator, connected, rtt } = useNet();

  const track = useMemo(() => buildTrack(), []);
  const checkpoints = useMemo(() => checkpointIndices(), []);
  const craft = useRef<Craft>(spawnCraft(track, 0, -2.6));
  const craftGroup = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const latest = useRef<Snapshot | null>(null);
  const previous = useRef<Snapshot | null>(null);
  const remoteRefs = useRef<(THREE.Group | null)[]>([]);
  const lastStats = useRef('');
  /** HUD stats stačí 10×/s — snapshoty tečou 15×/s a `ping`/`speed`
   *  semifluidní, takže bez throttlu by se stránka překreslovala každý frame. */
  const statsClock = useRef(0);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const engine = useRef<LoopHandle | null>(null);
  const lastLap = useRef(1);
  const lastTick = useRef(-1);
  const finished = useRef(false);

  // ── vizuální šťáva: fx vozidla, kouř, shake, FOV ──
  const fx = useRef<CraftFx>(emptyCraftFx());
  const smokeLevel = useRef(0);
  const shake = useRef(0);
  const boostFx = useRef(0);
  const wasBoosting = useRef(false);
  /** Efekty vzdálených vozidel — plameny z `RacePlayerState.boost`. */
  const remoteFx = useRef<CraftFx[]>([]);

  // ── připojení ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || !connected) return;
    if (watch) spectateRoom('race', watch);
    else joinGame('race');
    return () => leaveRoom();
  }, [running, connected, joinGame, spectateRoom, leaveRoom, watch]);

  // ── motor ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    unlock();
    lastLap.current = 1;
    lastTick.current = -1;
    finished.current = false;
    shake.current = 0;
    boostFx.current = 0;
    wasBoosting.current = false;
    smokeLevel.current = 0;
    engine.current = startEngineLoop();
    return () => {
      engine.current?.stop();
      engine.current = null;
    };
  }, [running]);

  // ── data ze serveru ──────────────────────────────────────────────────
  useEffect(() => {
    return subscribe((message: ServerMessage) => {
      if (message.t !== 'snapshot' || message.game !== 'race') return;
      previous.current = latest.current;
      latest.current = {
        at: Date.now(),
        players: message.players as RacePlayerState[],
        state: (message.state as Snapshot['state']) ?? 'running',
        countdown: message.countdown ?? 0,
        raceSeconds: message.raceSeconds ?? 0,
      };
    });
  }, [subscribe]);

  // ── debug háček pro headless testy (jen s ?raceDebug=1) ─────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('raceDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__mpRaceDebug = () => ({
      you: youPlayerId,
      connected,
      state: latest.current?.state ?? null,
      countdown: latest.current?.countdown ?? 0,
      raceSeconds: latest.current?.raceSeconds ?? 0,
      players: (latest.current?.players ?? []).map((player) => ({
        id: player.id,
        name: player.name,
        x: Math.round(player.x * 100) / 100,
        z: Math.round(player.z * 100) / 100,
        speed: Math.round(player.speed * 100) / 100,
        nitro: player.nitro ?? null,
        boost: player.boost === true,
        lap: player.lap,
        finishedAtMs: player.finishedAtMs,
      })),
    });
  }, [youPlayerId, connected]);

  // ── vstup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ── smyčka ───────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!running) {
      smokeLevel.current = 0;
      return;
    }
    // Hamburger menu (2026-11-10) — pauza patří do modulu, ne do každé hry.
    if (isGamePaused()) {
      smokeLevel.current = 0;
      return;
    }
    const dt = Math.min(0.05, delta);
    const now = Date.now();
    const snapshot = latest.current;

    const watching = Boolean(watch) || spectator;
    const throttle = watching
      ? 0
      : (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
        (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
    const steer = watching
      ? 0
      : (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) -
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0);
    const handbrake = !watching && keys.current.has('Space') ? 1 : 0;
    const boost = !watching && (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) ? 1 : 0;

    const me = watching ? undefined : snapshot?.players.find((player) => player.id === youPlayerId);
    const lead = watching ? raceLeader(snapshot?.players ?? []) : undefined;
    const racing = !watching && snapshot?.state === 'running';

    // 1) predikce stejnou fyzikou (jen když se jede). Divák jen sleduje snapshot.
    let hitWall = false;
    let stepBoosting = false;
    let stepDrifting = false;
    let stepSlide = 0;
    let stepOffTrack = false;
    if (racing) {
      const step = stepCraft(craft.current, { throttle, steer, handbrake, boost }, track, dt, now);
      hitWall = step.hitWall;
      stepBoosting = step.boosting;
      stepDrifting = step.drifting;
      stepSlide = step.slide;
      stepOffTrack = step.offTrack;
    }
    if (hitWall) {
      play('wall');
      shake.current = Math.min(1, shake.current + 0.75);
    }
    if (stepBoosting && !wasBoosting.current) play('boost');
    wasBoosting.current = stepBoosting;
    if (stepDrifting && Math.abs(craft.current.speed) > 9) play('drift');
    engine.current?.setIntensity(Math.min(1, Math.abs(craft.current.speed) / MAX_SPEED + (stepBoosting ? 0.12 : 0)));

    boostFx.current += ((stepBoosting ? 1 : 0) - boostFx.current) * Math.min(1, dt * 7);
    smokeLevel.current = Math.min(
      1,
      (stepDrifting ? Math.abs(stepSlide) / 5 : 0) + (stepOffTrack && Math.abs(craft.current.speed) > 10 ? 0.35 : 0),
    );

    // odpočet: každé celé číslo jednou pípne, start gongem
    if (snapshot?.state === 'countdown') {
      const tick = Math.ceil(snapshot.countdown);
      if (tick !== lastTick.current) {
        lastTick.current = tick;
        if (tick > 0) play('countdown');
        else play('bell');
      }
    }
    if (me) {
      if (me.lap !== lastLap.current) {
        lastLap.current = me.lap;
        play('lap');
      }
      if (me.finishedAtMs !== null && !finished.current) {
        finished.current = true;
        play('finish');
        engine.current?.stop();
        engine.current = null;
      }
    }

    // 2) srovnání se serverem
    if (me) {
      const distance = Math.hypot(me.x - craft.current.x, me.z - craft.current.z);
      if (distance > SNAP_DISTANCE || !racing) {
        craft.current.x = me.x;
        craft.current.z = me.z;
        craft.current.heading = me.heading;
        craft.current.speed = me.speed;
        // vektor rychlosti aproximujeme jako sesouosý — drift se na snapu ztratí,
        // ale aspoň nesmie zůstat starý smyk z minuléPozice
        craft.current.vx = Math.sin(me.heading) * me.speed;
        craft.current.vz = Math.cos(me.heading) * me.speed;
        if (typeof me.nitro === 'number') craft.current.nitro = me.nitro;
      } else if (distance > 0.2) {
        craft.current.x += (me.x - craft.current.x) * 0.25;
        craft.current.z += (me.z - craft.current.z) * 0.25;
      }
    }

    // ── vizuální šťáva vlastního vozu ──
    const ownFx = fx.current;
    if (ownFx.brake) {
      const braking = throttle < 0 && craft.current.speed > 2;
      const target = braking ? 1 : 0.4;
      ownFx.brake.opacity += (target - ownFx.brake.opacity) * Math.min(1, dt * 12);
    }
    if (ownFx.flames) {
      ownFx.flames.visible = stepBoosting;
      if (stepBoosting) ownFx.flames.scale.setScalar(0.8 + Math.random() * 0.35);
    }
    if (ownFx.glow) {
      const target = stepBoosting ? 6 : 1.6;
      ownFx.glow.intensity += (target - ownFx.glow.intensity) * Math.min(1, dt * 8);
    }

    if (craftGroup.current) {
      craftGroup.current.visible = !watching;
      if (!watching) {
        const speedAbs = Math.abs(craft.current.speed);
        const speedRatio = Math.min(1.2, speedAbs / MAX_SPEED);
        const bob = Math.sin(now / 300) * 0.04 + Math.sin(now / 47) * 0.012 * speedRatio;
        craftGroup.current.position.set(craft.current.x, 0.55 + bob, craft.current.z);
        const roll = -steer * 0.09 * Math.min(1, speedRatio) - Math.max(-10, Math.min(10, stepSlide)) * 0.013;
        const pitch = -throttle * 0.05 * Math.min(1, speedAbs / 28);
        craftGroup.current.rotation.set(pitch, craft.current.heading, roll);
      }
    }

    // 3) kamera za vozítkem (ve VR ji drží headset a origin jede s lodí).
    // Divák jede za vedoucím jezdcem, ne za prvním záznamem ve snapshotu.
    const camCraft = lead ?? craft.current;
    const forwardX = Math.sin(camCraft.heading);
    const forwardZ = Math.cos(camCraft.heading);
    const speedRatio = Math.min(1.2, Math.abs(camCraft.speed) / MAX_SPEED);
    if (!xr) {
      camPos.set(
        camCraft.x - forwardX * (9 + speedRatio * 3.2),
        4.2 + speedRatio * 0.9,
        camCraft.z - forwardZ * (9 + speedRatio * 3.2),
      );
      const sh = shake.current;
      shake.current *= Math.exp(-dt * 4.5);
      const vibe = speedRatio > 0.9 ? 0.05 : 0;
      camPos.x += (Math.random() - 0.5) * (sh * 0.7 + vibe);
      camPos.y += (Math.random() - 0.5) * (sh * 0.5 + vibe * 0.5);
      camPos.z += (Math.random() - 0.5) * (sh * 0.7 + vibe);
      camera.position.lerp(camPos, dampFactor(dt));
      camTarget.set(camCraft.x + forwardX * 6, 1.2, camCraft.z + forwardZ * 6);
      camera.lookAt(camTarget);
      const persp = camera as THREE.PerspectiveCamera;
      const targetFov = 66 + speedRatio * 10 + boostFx.current * 9;
      persp.fov += (targetFov - persp.fov) * Math.min(1, dt * 5);
      if (Math.abs(targetFov - persp.fov) > 0.05) camera.updateProjectionMatrix();
      camera.rotateZ(
        -steer * 0.02 * speedRatio - Math.max(-10, Math.min(10, stepSlide)) * 0.0035 - (Math.random() - 0.5) * shake.current * 0.02,
      );
    }

    // 4) ostatní jezdci
    const blend =
      snapshot && previous.current && snapshot.at > previous.current.at
        ? Math.min(1, (now - snapshot.at) / (snapshot.at - previous.current.at || 60))
        : 1;
    let slot = 0;
    if (snapshot) {
      for (const player of snapshot.players) {
        if (player.id === youPlayerId) continue;
        const group = remoteRefs.current[slot];
        const rfx = (remoteFx.current[slot] ??= emptyCraftFx());
        slot += 1;
        if (!group) continue;
        const before = previous.current?.players.find((p) => p.id === player.id);
        group.position.set(
          before ? before.x + (player.x - before.x) * blend : player.x,
          0.55,
          before ? before.z + (player.z - before.z) * blend : player.z,
        );
        group.rotation.y = before ? before.heading + (player.heading - before.heading) * blend : player.heading;
        group.visible = true;
        // plameny nitra na vzdáleném vozidle — `boost` ze snapshotu
        if (rfx.flames) {
          const on = player.boost === true;
          rfx.flames.visible = on;
          if (on) rfx.flames.scale.setScalar(0.8 + Math.random() * 0.35);
        }
      }
    }
    for (; slot < MAX_REMOTE; slot++) {
      const group = remoteRefs.current[slot];
      if (group) group.visible = false;
      const rfx = remoteFx.current[slot];
      if (rfx?.flames) rfx.flames.visible = false;
    }

    // 5) vstup na server. Divák ho neposílá — jinak by rozjel vlastní vozítko.
    if (!watching) {
      sendInput({
        forward: throttle,
        strafe: steer,
        yaw: 0,
        pitch: 0,
        jump: false,
        fire: false,
        weapon: 0,
        handbrake: handbrake > 0,
        boost: boost > 0,
      });
    }

    // 6) HUD — stačí 10×/s, viz `statsClock`
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const rows: MpRaceRow[] = (snapshot?.players ?? [])
        .map((player) => ({
          id: player.id,
          name: player.name,
          lap: player.lap,
          finishedAtMs: player.finishedAtMs,
        }))
        .sort(byRacePlace);

      const leader = snapshot?.players.find((player) => player.id === rows[0]?.id);
      const subject = watching ? leader : me;
      const stats: MpRaceStats = {
        speed: Math.round(Math.abs(subject?.speed ?? (watching ? 0 : craft.current.speed)) * 3.6),
        lap: Math.min(LAPS, subject?.lap ?? (watching ? 0 : 1)),
        laps: LAPS,
        elapsed: snapshot?.raceSeconds ?? 0,
        position: watching ? (rows.length ? 1 : 0) : Math.max(1, rows.findIndex((row) => row.id === youPlayerId) + 1),
        total: rows.length,
        standings: rows,
        countdown: snapshot?.countdown ?? 0,
        state: snapshot?.state ?? null,
        connected,
        ping: rtt,
        nitro: Math.round((subject?.nitro ?? (watching ? 0 : craft.current.nitro)) * 100) / 100,
        drifting: !watching && racing && stepDrifting,
        boosting: !watching && racing && stepBoosting,
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
      <color attach="background" args={['#1a1030']} />
      <fog attach="fog" args={['#2a1a44', 60, 260]} />
      <ambientLight intensity={0.8} color="#c9b3ff" />
      <hemisphereLight args={['#ffd28a', '#2a1030', 0.7]} />
      <directionalLight position={[40, 60, 20]} intensity={2.2} color="#ffcf9a" />

      {/* povrch planety */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[180, 64]} />
        <meshStandardMaterial color="#4a2f1a" roughness={0.95} metalness={0.05} />
      </mesh>

      <TrackStage track={track} checkpoints={checkpoints} />
      {xr && <RaceXr craft={craft} active={running} />}
      <CraftSmoke craft={craft} level={smokeLevel} active={running && !watch} />

      {/* ostatní jezdci */}
      {Array.from({ length: MAX_REMOTE }, (_, index) => {
        const rfx = (remoteFx.current[index] ??= emptyCraftFx());
        return (
          <group
            key={`remote-${index}`}
            visible={false}
            ref={(node) => {
              remoteRefs.current[index] = node;
            }}
          >
            <CraftMesh body="#7fe3d4" accent="#ffd166" canopy="#0d0a16" fx={rfx} />
          </group>
        );
      })}

      {/* vlastní vozidlo */}
      <group ref={craftGroup}>
        <CraftMesh body="#ffd166" accent="#7fe3d4" canopy="#7fe3d4" fx={fx.current} />
      </group>
    </>
  );
}
