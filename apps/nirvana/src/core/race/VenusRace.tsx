'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CHECKPOINTS,
  LAPS,
  SAMPLES,
  TRACK_WIDTH,
  buildTrack,
  checkpointIndices,
  lateralOffset,
  nearestSample,
} from '@/core/race/track';

/**
 * VENUŠE — time trial na hovercraftu.
 *
 * Arkádová fyzika, ne simulace: plyn/vzduch/brzda, zatáčení úměrné rychlosti,
 * a trať, která tě sama drží na silnici (mimo ni tě zpomalí a přitáhne zpět).
 * Tři kola, tři checkpointy na kolo, čas se počítá od prvního plynu.
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
}

export interface RaceResult {
  totalSeconds: number;
  bestLap: number | null;
  laps: number;
}

const MAX_SPEED = 34;
const ACCEL = 22;
const DRAG = 3.4;
const STEER = 1.9;
const LATERAL_WALL = TRACK_WIDTH / 2 - 0.6;
const LATERAL_WARN = TRACK_WIDTH / 2 - 1.5;

export function VenusRace({
  running,
  onStats,
  onFinish,
}: {
  running: boolean;
  onStats: (stats: RaceStats) => void;
  onFinish: (result: RaceResult) => void;
}) {
  const { camera } = useThree();
  const track = useMemo(() => buildTrack(), []);
  const checkpoints = useMemo(() => checkpointIndices(), []);

  const craft = useRef({
    x: track[0]!.x,
    z: track[0]!.z,
    heading: Math.atan2(track[0]!.tx, track[0]!.tz),
    speed: 0,
    sample: 0,
  });
  const race = useRef({
    started: false,
    startTime: 0,
    lap: 1,
    lapStart: 0,
    lastLap: null as number | null,
    bestLap: null as number | null,
    nextCheckpoint: 1,
    finished: false,
    offTrack: false,
    impactAt: 0,
  });
  const keys = useRef(new Set<string>());
  const lastStats = useRef('');
  const craftGroup = useRef<THREE.Group>(null);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('raceDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__raceDebug = () => {
      const index = nearestSample(track, craft.current.x, craft.current.z, craft.current.sample);
      const point = track[index]!;
      return {
        x: Math.round(craft.current.x * 10) / 10,
        z: Math.round(craft.current.z * 10) / 10,
        sample: craft.current.sample,
        index,
        lateral: Math.round(lateralOffset(point, craft.current.x, craft.current.z) * 100) / 100,
        heading: Math.round(craft.current.heading * 100) / 100,
        speed: Math.round(craft.current.speed * 10) / 10,
        trackX: Math.round(point.x * 10) / 10,
        trackZ: Math.round(point.z * 10) / 10,
        offTrack: race.current.offTrack,
      };
    };
  }, [track]);

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
    craft.current = {
      x: track[0]!.x,
      z: track[0]!.z,
      heading: Math.atan2(track[0]!.tx, track[0]!.tz),
      speed: 0,
      sample: 0,
    };
    race.current = {
      started: false,
      startTime: 0,
      lap: 1,
      lapStart: 0,
      lastLap: null,
      bestLap: null,
      nextCheckpoint: 1,
      finished: false,
      offTrack: false,
      impactAt: 0,
    };
  }, [running, track]);

  // ── geometrie tratě ────────────────────────────────────────────────
  const road = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const a = track[i]!;
      const b = track[(i + 1) % SAMPLES]!;
      const ax = a.x + a.nx * (TRACK_WIDTH / 2);
      const az = a.z + a.nz * (TRACK_WIDTH / 2);
      const bx = b.x + b.nx * (TRACK_WIDTH / 2);
      const bz = b.z + b.nz * (TRACK_WIDTH / 2);
      const cx = b.x - b.nx * (TRACK_WIDTH / 2);
      const cz = b.z - b.nz * (TRACK_WIDTH / 2);
      const dx = a.x - a.nx * (TRACK_WIDTH / 2);
      const dz = a.z - a.nz * (TRACK_WIDTH / 2);

      const base = i * 4;
      positions.push(ax, 0.06, az, bx, 0.06, bz, cx, 0.06, cz, dx, 0.06, dz);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [track]);

  const edges = useMemo(() => {
    const positions: number[] = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < SAMPLES; i++) {
        const a = track[i]!;
        const b = track[(i + 1) % SAMPLES]!;
        positions.push(
          a.x + a.nx * side * (TRACK_WIDTH / 2),
          0.14,
          a.z + a.nz * side * (TRACK_WIDTH / 2),
          b.x + b.nx * side * (TRACK_WIDTH / 2),
          0.14,
          b.z + b.nz * side * (TRACK_WIDTH / 2),
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [track]);

  useEffect(() => () => {
    road.dispose();
    edges.dispose();
  }, [road, edges]);

  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    const now = performance.now();
    const state = race.current;
    const car = craft.current;

    const throttle =
      (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
      (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
    const steer =
      (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) -
      (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0);

    if (!state.started && throttle !== 0) {
      state.started = true;
      state.startTime = now;
      state.lapStart = now;
    }

    // zrychlení, odpor, zatáčení podle rychlosti
    car.speed += throttle * ACCEL * dt;
    car.speed -= car.speed * DRAG * dt * 0.32;
    car.speed = Math.max(-8, Math.min(MAX_SPEED, car.speed));

    const grip = Math.min(1, Math.abs(car.speed) / 8);
    car.heading += steer * STEER * dt * grip * (car.speed < 0 ? -1 : 1);

    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;

    // trať drží vozítko: mimo pás se zpomalí a přitáhne
    const index = nearestSample(track, car.x, car.z, car.sample);
    car.sample = index;
    const point = track[index]!;
    const lateral = lateralOffset(point, car.x, car.z);
    state.offTrack = Math.abs(lateral) > LATERAL_WARN;

    if (Math.abs(lateral) > LATERAL_WALL) {
      // okraj je zeď: náraz tě zpomalí jednou, pak po něm kloužeš (žádné trvalé brzdění)
      if (now - state.impactAt > 420) {
        state.impactAt = now;
        car.speed *= 0.82;
      }
      const clamped = Math.sign(lateral) * LATERAL_WALL;
      // podélný postup zachovat, opravit jen stranu — jinak auto zamrzne ve zdi
      const along = (car.x - point.x) * point.tx + (car.z - point.z) * point.tz;
      car.x = point.x + point.tx * along + point.nx * clamped;
      car.z = point.z + point.tz * along + point.nz * clamped;
      const tangentYaw = Math.atan2(point.tx, point.tz);
      const delta = ((tangentYaw - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      car.heading += delta * Math.min(1, dt * 3.2);
    }

    // checkpointy v pořadí
    if (state.started && !state.finished) {
      const target = checkpoints[state.nextCheckpoint % CHECKPOINTS]!;
      const distance = Math.min(
        Math.abs(index - target),
        SAMPLES - Math.abs(index - target),
      );
      if (distance <= 4) {
        state.nextCheckpoint += 1;
        if (state.nextCheckpoint > CHECKPOINTS) {
          // kolo hotové
          const lapSeconds = (now - state.lapStart) / 1000;
          state.lastLap = lapSeconds;
          state.bestLap = state.bestLap === null ? lapSeconds : Math.min(state.bestLap, lapSeconds);
          state.lapStart = now;
          state.nextCheckpoint = 1;
          state.lap += 1;
          if (state.lap > LAPS) {
            state.finished = true;
            onFinish({
              totalSeconds: (now - state.startTime) / 1000,
              bestLap: state.bestLap,
              laps: LAPS,
            });
          }
        }
      }
    }

    // kamera za vozítkem
    const forwardX = Math.sin(car.heading);
    const forwardZ = Math.cos(car.heading);
    const speedRatio = Math.abs(car.speed) / MAX_SPEED;
    camPos.set(
      car.x - forwardX * (9 + speedRatio * 3),
      4.2 + speedRatio * 0.8,
      car.z - forwardZ * (9 + speedRatio * 3),
    );
    camera.position.lerp(camPos, Math.min(1, dt * 4.5));
    camTarget.set(car.x + forwardX * 6, 1.2, car.z + forwardZ * 6);
    camera.lookAt(camTarget);

    if (craftGroup.current) {
      craftGroup.current.position.set(car.x, 0.55, car.z);
      craftGroup.current.rotation.y = car.heading;
      craftGroup.current.rotation.z = -steer * 0.12 * speedRatio;
    }

    const stats: RaceStats = {
      speed: Math.round(Math.abs(car.speed) * 3.6),
      lap: Math.min(LAPS, state.lap),
      laps: LAPS,
      elapsed: state.started ? Math.round((now - state.startTime) / 100) / 10 : 0,
      lastLap: state.lastLap,
      bestLap: state.bestLap,
      offTrack: state.offTrack,
      started: state.started,
    };
    const key = JSON.stringify(stats);
    if (key !== lastStats.current) {
      lastStats.current = key;
      onStats(stats);
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

      {/* silnice */}
      <mesh geometry={road}>
        <meshStandardMaterial color="#2b2233" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* okraje */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffb46a" transparent opacity={0.9} />
      </lineSegments>

      {/* checkpointy jako brány */}
      {checkpoints.map((index, order) => {
        const point = track[index]!;
        return (
          <group
            key={index}
            position={[point.x, 0, point.z]}
            rotation={[0, Math.atan2(point.tx, point.tz), 0]}
          >
            {[1, -1].map((side) => (
              <mesh
                key={side}
                position={[side * (TRACK_WIDTH / 2 + 0.6), 2, 0]}
                rotation={[0, 0, side * 0.12]}
              >
                <boxGeometry args={[0.3, 4, 0.3]} />
                <meshBasicMaterial color={order === 0 ? '#ffd166' : '#7fe3d4'} />
              </mesh>
            ))}
            <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[1.4, 0.06, 6, 24]} />
              <meshBasicMaterial color={order === 0 ? '#ffd166' : '#7fe3d4'} transparent opacity={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* hovercraft */}
      <group ref={craftGroup} position={[track[0]!.x, 0.55, track[0]!.z]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.5, 0.32, 3]} />
          <meshStandardMaterial color="#ffd166" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.42, -0.2]}>
          <boxGeometry args={[0.9, 0.34, 1.3]} />
          <meshStandardMaterial color="#2b2233" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.78, 0.1]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshBasicMaterial color="#7fe3d4" toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.3, -2]} intensity={4} color="#7fe3d4" distance={8} decay={2} />
      </group>
    </>
  );
}
