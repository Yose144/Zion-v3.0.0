'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import {
  LAPS,
  SAMPLES,
  TRACK_WIDTH,
  buildTrack,
  checkpointIndices,
  nearestSample,
} from '@/core/race/track';
import { MAX_SPEED, type Craft, spawnCraft, stepCraft } from '@/core/race/physics';
import { TrackStage } from '@/core/race/TrackStage';
import { play, startEngineLoop, unlock, type LoopHandle } from '@/core/audio/engine';
import { RaceXr } from './RaceXr';
import {
  PLAYER_ID,
  PLAYER_LATERAL,
  buildStandings,
  createRivals,
  newLapState,
  stepRival,
  advanceLap,
  type LapState,
  type Rival,
  type StandingRow,
} from '@/core/race/rivals';

/**
 * VENUŠE — tři kola proti třem soupeřům.
 *
 * Arkádová fyzika, ne simulace: plyn/brzda, zatáčení úměrné rychlosti a trať,
 * která tě sama drží na silnici. Hráč i boti jedou **stejný** `stepCraft`;
 * boti se liší jen rozhodováním (brzdný bod, stopa) — viz `rivals.ts`.
 */

export interface RaceStats {
  speed: number;
  lap: number;
  laps: number;
  elapsed: number;
  lastLap: number | null;
  bestLap: number | null;
  offTrack: boolean;
  started: boolean;
  position: number;
  standings: StandingRow[];
}

export interface RaceResult {
  totalSeconds: number;
  bestLap: number | null;
  laps: number;
  position: number;
  standings: StandingRow[];
}

function trackLength(track: { x: number; z: number }[]): number {
  let total = 0;
  for (let i = 0; i < track.length; i++) {
    const a = track[i]!;
    const b = track[(i + 1) % track.length]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

export function VenusRace({
  running,
  xr = false,
  onStats,
  onFinish,
}: {
  running: boolean;
  xr?: boolean;
  onStats: (stats: RaceStats) => void;
  onFinish: (result: RaceResult) => void;
}) {
  const { camera } = useThree();
  const track = useMemo(() => buildTrack(), []);
  const checkpoints = useMemo(() => checkpointIndices(), []);
  const metresPerProgress = useMemo(() => trackLength(track) / SAMPLES, [track]);

  const player = useRef<Craft>(spawnCraft(track, 0, PLAYER_LATERAL));
  const playerLap = useRef<LapState>(newLapState());
  const rivals = useRef<Rival[]>(createRivals(track));

  const race = useRef({
    started: false,
    startTime: 0,
    finished: false,
    offTrack: false,
  });
  /**
   * Simulované hodiny (ms). Fyzika má `dt` zastropované na 50 ms, aby se na
   * pomalém stroji neskákalo okny; měřit čas skutečnými hodinami by proto na
   * 15 fps nafouklo kolo o čtvrtinu a tabule by nebyla srovnatelná.
   */
  const clock = useRef(0);
  const keys = useRef(new Set<string>());
  const lastStats = useRef('');
  /** Stats do HUD stačí 10×/s — tabule i pozice v `stats` semifluidní,
   *  takže bez throttlu by se stránka překreslovala 60× za sekundu. */
  const statsClock = useRef(0);
  const craftGroup = useRef<THREE.Group>(null);
  const rivalGroups = useRef<(THREE.Group | null)[]>([]);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  /** Motor hučí po celý závod; `null` = WebAudio není (hra jede dál). */
  const engine = useRef<LoopHandle | null>(null);

  const standings = () =>
    buildStandings({
      playerLap: playerLap.current,
      rivals: rivals.current,
      startTime: race.current.startTime,
      metresPerProgress,
    });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('raceDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__raceDebug = () => {
      const car = player.current;
      const index = nearestSample(track, car.x, car.z, car.sample);
      const point = track[index]!;
      const rows = standings();
      return {
        x: Math.round(car.x * 10) / 10,
        z: Math.round(car.z * 10) / 10,
        sample: car.sample,
        index,
        lateral: Math.round(((car.x - point.x) * point.nx + (car.z - point.z) * point.nz) * 100) / 100,
        heading: Math.round(car.heading * 100) / 100,
        speed: Math.round(car.speed * 10) / 10,
        trackX: Math.round(point.x * 10) / 10,
        trackZ: Math.round(point.z * 10) / 10,
        offTrack: race.current.offTrack,
        lap: playerLap.current.lap,
        nextCheckpoint: playerLap.current.nextCheckpoint,
        finishedAt: playerLap.current.finishedAt,
        standings: rows.map((row) => ({
          id: row.id,
          lap: row.lap,
          gap: row.gap,
          totalSeconds: row.totalSeconds === null ? null : Math.round(row.totalSeconds * 100) / 100,
        })),
        rivals: rivals.current.map((rival) => ({
          id: rival.spec.id,
          speed: Math.round(rival.craft.speed * 10) / 10,
          sample: rival.craft.sample,
          lap: rival.lap.lap,
          done: rival.lap.finishedAt !== null,
        })),
      };
    };
  }, [track, checkpoints, metresPerProgress]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
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

  useEffect(() => {
    if (!running) return;
    player.current = spawnCraft(track, 0, PLAYER_LATERAL);
    playerLap.current = newLapState();
    rivals.current = createRivals(track);
    race.current = { started: false, startTime: 0, finished: false, offTrack: false };
    lastStats.current = '';
    // motor startuje se závodem a zmlkne při odchodu (i při předčasném Menu)
    unlock();
    engine.current = startEngineLoop();
    return () => {
      engine.current?.stop();
      engine.current = null;
    };
  }, [running, track]);

  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    clock.current += dt * 1000;
    const now = clock.current;
    const state = race.current;
    const car = player.current;
    const lap = playerLap.current;

    const throttle =
      (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
      (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
    const steer =
      (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) -
      (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0);

    if (!state.started && throttle !== 0) {
      state.started = true;
      state.startTime = now;
      lap.lapStart = now;
      for (const rival of rivals.current) rival.lap.lapStart = now;
    }

    const step = stepCraft(car, { throttle, steer }, track, dt, now);
    state.offTrack = step.offTrack;
    if (step.hitWall) play('wall');

    // motor: výška a jas podle rychlosti — hráč slyší zrychlení bez pohledu na HUD
    engine.current?.setIntensity(Math.abs(car.speed) / MAX_SPEED);

    if (state.started && !state.finished) {
      const lapStep = advanceLap(lap, step.index, checkpoints, now);
      if (lapStep.lapDone && !lapStep.finished) play('lap');
      if (lapStep.finished) {
        state.finished = true;
        play('finish');
        engine.current?.stop();
        engine.current = null;
        const rows = standings();
        const position = Math.max(1, rows.findIndex((row) => row.id === PLAYER_ID) + 1);
        onFinish({
          totalSeconds: lap.finishedAt === null ? 0 : (lap.finishedAt - state.startTime) / 1000,
          bestLap: lap.bestLap,
          laps: LAPS,
          position,
          standings: rows,
        });
      }
    }

    // soupeři jedou, jen když závod začal (do té doby stojí na roštu)
    if (state.started) {
      for (const rival of rivals.current) stepRival(rival, track, checkpoints, dt, now);
    }

    // kamera za vozítkem — ve VR kameru drží headset, origin jede s vozítkem (RaceXr)
    const forwardX = Math.sin(car.heading);
    const forwardZ = Math.cos(car.heading);
    const speedRatio = Math.abs(car.speed) / MAX_SPEED;
    if (!xr) {
      camPos.set(
        car.x - forwardX * (9 + speedRatio * 3),
        4.2 + speedRatio * 0.8,
        car.z - forwardZ * (9 + speedRatio * 3),
      );
      camera.position.lerp(camPos, dampFactor(dt));
      camTarget.set(car.x + forwardX * 6, 1.2, car.z + forwardZ * 6);
      camera.lookAt(camTarget);
    }

    const bob = Math.sin(now * 0.003) * 0.04;
    if (craftGroup.current) {
      craftGroup.current.position.set(car.x, 0.55 + bob, car.z);
      craftGroup.current.rotation.y = car.heading;
      craftGroup.current.rotation.z = -steer * 0.12 * speedRatio;
    }

    rivals.current.forEach((rival, index) => {
      const group = rivalGroups.current[index];
      if (!group) return;
      group.position.set(rival.craft.x, 0.55 + Math.sin(now * 0.0026 + index) * 0.04, rival.craft.z);
      group.rotation.y = rival.craft.heading;
    });

    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const rows = standings();
      const position = Math.max(1, rows.findIndex((row) => row.id === PLAYER_ID) + 1);
      const stats: RaceStats = {
        speed: Math.round(Math.abs(car.speed) * 3.6),
        lap: Math.min(LAPS, lap.lap),
        laps: LAPS,
        elapsed: state.started ? Math.round((now - state.startTime) / 100) / 10 : 0,
        lastLap: lap.lastLap,
        bestLap: lap.bestLap,
        offTrack: state.offTrack,
        started: state.started,
        position,
        standings: rows,
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
      {xr && <RaceXr craft={player} active={running} />}

      {/* soupeři */}
      {rivals.current.map((rival, index) => (
        <group
          key={rival.spec.id}
          ref={(node) => {
            rivalGroups.current[index] = node;
          }}
          position={[rival.craft.x, 0.55, rival.craft.z]}
          rotation={[0, rival.craft.heading, 0]}
        >
          <CraftMesh body={rival.spec.color} canopy="#141020" />
        </group>
      ))}

      {/* hovercraft hráče */}
      <group ref={craftGroup} position={[track[0]!.x + track[0]!.nx * PLAYER_LATERAL, 0.55, track[0]!.z + track[0]!.nz * PLAYER_LATERAL]}>
        <CraftMesh body="#ffd166" canopy="#7fe3d4" />
        <pointLight position={[0, 0.3, -2]} intensity={4} color="#7fe3d4" distance={8} decay={2} />
      </group>
    </>
  );
}

/** Stejný trup pro hráče i soupeře — liší se jen barvou. */
function CraftMesh({ body, canopy }: { body: string; canopy: string }) {
  return (
    <>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 0.32, 3]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.42, -0.2]}>
        <boxGeometry args={[0.9, 0.34, 1.3]} />
        <meshStandardMaterial color="#2b2233" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.78, 0.1]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshBasicMaterial color={canopy} toneMapped={false} />
      </mesh>
    </>
  );
}
