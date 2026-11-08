'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import { LAPS, buildTrack, checkpointIndices } from './track';
import { MAX_SPEED, type Craft, spawnCraft, stepCraft } from './physics';
import { TrackStage } from './TrackStage';
import { useNet } from '@/core/net/useNet';
import { play, startEngineLoop, unlock, type LoopHandle } from '@/core/audio/engine';
import { RaceXr } from './RaceXr';
import type { RacePlayerState, ServerMessage } from '@/core/net/protocol';

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
 * klient posílá jen plyn a zatáčení. Vlastní pohyb se predikuje, ostatní se
 * interpolují. Odpočet, kola i cílovka jsou serverové — klient je jen kreslí.
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
        lap: player.lap,
        finishedAtMs: player.finishedAtMs,
      })),
    });
  }, [youPlayerId, connected]);

  // ── vstup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
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
    if (!running) return;
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

    const me = watching ? undefined : snapshot?.players.find((player) => player.id === youPlayerId);
    const lead = watching ? raceLeader(snapshot?.players ?? []) : undefined;
    const racing = !watching && snapshot?.state === 'running';

    // 1) predikce stejnou fyzikou (jen když se jede). Divák jen sleduje snapshot.
    let hitWall = false;
    if (racing) {
      const step = stepCraft(craft.current, { throttle, steer }, track, dt, now);
      hitWall = step.hitWall;
    }
    if (hitWall) play('wall');
    engine.current?.setIntensity(Math.abs(craft.current.speed) / MAX_SPEED);

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
      } else if (distance > 0.2) {
        craft.current.x += (me.x - craft.current.x) * 0.25;
        craft.current.z += (me.z - craft.current.z) * 0.25;
      }
    }

    if (craftGroup.current) {
      craftGroup.current.visible = !watching;
      if (!watching) {
        craftGroup.current.position.set(craft.current.x, 0.55 + Math.sin(now / 300) * 0.04, craft.current.z);
        craftGroup.current.rotation.y = craft.current.heading;
        craftGroup.current.rotation.z = -steer * 0.12 * Math.min(1, Math.abs(craft.current.speed) / MAX_SPEED);
      }
    }

    // 3) kamera za vozítkem (ve VR ji drží headset a origin jede s lodí).
    // Divák jede za vedoucím jezdcem, ne za prvním záznamem ve snapshotu.
    const camCraft = lead ?? craft.current;
    const forwardX = Math.sin(camCraft.heading);
    const forwardZ = Math.cos(camCraft.heading);
    const speedRatio = Math.abs(camCraft.speed) / MAX_SPEED;
    if (!xr) {
      camPos.set(
        camCraft.x - forwardX * (9 + speedRatio * 3),
        4.2 + speedRatio * 0.8,
        camCraft.z - forwardZ * (9 + speedRatio * 3),
      );
      camera.position.lerp(camPos, dampFactor(dt));
      camTarget.set(camCraft.x + forwardX * 6, 1.2, camCraft.z + forwardZ * 6);
      camera.lookAt(camTarget);
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
      }
    }
    for (; slot < MAX_REMOTE; slot++) {
      const group = remoteRefs.current[slot];
      if (group) group.visible = false;
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

      {/* ostatní jezdci */}
      {Array.from({ length: MAX_REMOTE }, (_, index) => (
        <group
          key={`remote-${index}`}
          visible={false}
          ref={(node) => {
            remoteRefs.current[index] = node;
          }}
        >
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[1.5, 0.32, 3]} />
            <meshStandardMaterial color="#7fe3d4" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.42, -0.2]}>
            <boxGeometry args={[0.9, 0.34, 1.3]} />
            <meshStandardMaterial color="#2b2233" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.78, 0.1]}>
            <sphereGeometry args={[0.28, 12, 10]} />
            <meshBasicMaterial color="#ffd166" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* vlastní hovercraft */}
      <group ref={craftGroup}>
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
