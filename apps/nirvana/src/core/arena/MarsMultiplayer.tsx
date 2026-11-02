'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_BOXES, ARENA_PICKUPS, PLAYER_SPAWN, type ArenaBox } from './map';
import { PLAYER, makeSolids, stepBody, type Body } from './physics';
import { WEAPONS } from './weapons';
import { readTouch, type ArenaTouchState } from './ArenaTouch';
import type { MutableRefObject } from 'react';
import type { ArenaStats } from './MarsArena';
import { useNet, type ArenaInputFrame } from '@/core/net/useNet';
import type {
  ArenaPlayerState,
  PickupView,
  RocketView,
  ServerMessage,
} from '@/core/net/protocol';
import { AvatarModel } from '@/core/avatars/AvatarModel';
import { avatarLook } from '@/core/avatars/kit';
import {
  playDeath,
  playFrag,
  playHurt,
  playMg,
  playPickup,
  playRail,
  playRocket,
  playMatchEnd,
  unlockAudio,
} from '@/core/arena/audio';

/**
 * MARS ARENA — multiplayer.
 *
 * Server je autorita: počítá pohyb, zásahy i skóre. Klient posílá jen vstup
 * a kreslí, co mu server pošle. Vlastní pohyb se **predikuje** stejnou fyzikou
 * (`physics.ts`), aby hra neodeznívala o ping; když se predikce rozejde se
 * serverem o víc než metr, srovná se.
 *
 * Ostatní hráči se interpolují mezi posledními snapshoty (15 Hz → 60 fps).
 */

export interface MpPlayerRow {
  id: string;
  name: string;
  frags: number;
  deaths: number;
  alive: boolean;
}

export interface MpStats extends ArenaStats {
  players: MpPlayerRow[];
  connected: boolean;
  ping: number | null;
  matchState: 'running' | 'ended' | 'countdown' | null;
}

const ROCKET_POOL = 8;
/** Vzdálenost, od které se predikce „srovná" na server (teleport). */
const SNAP_DISTANCE = 1.6;

interface Snapshot {
  at: number;
  players: ArenaPlayerState[];
  projectiles: RocketView[];
  pickups: PickupView[];
  state: 'running' | 'ended' | 'countdown';
}

export function MarsMultiplayer({
  running,
  onStats,
  touch,
}: {
  running: boolean;
  onStats: (stats: MpStats) => void;
  /** Dotykové ovládání (mobil) — stejné refy jako klávesnice. */
  touch?: MutableRefObject<ArenaTouchState>;
}) {
  const { camera, gl } = useThree();
  const { subscribe, sendInput, joinArena, leaveRoom, youPlayerId, connected, rtt } = useNet();

  const solids = useMemo(() => makeSolids(ARENA_BOXES), []);
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  const local = useRef<Body>({
    x: PLAYER_SPAWN.x,
    y: 0.2,
    z: PLAYER_SPAWN.z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  });
  const view = useRef({ yaw: PLAYER_SPAWN.yaw, pitch: -0.05 });
  const keys = useRef(new Set<string>());
  /** 0 = rail, 1 = rakety, 2 = strojní puška (Q3 sestava). */
  const weapon = useRef<0 | 1 | 2>(0);
  const firing = useRef(false);

  const latest = useRef<Snapshot | null>(null);
  const previous = useRef<Snapshot | null>(null);
  const remoteRefs = useRef<(THREE.Group | null)[]>([]);
  const rocketRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pickupRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lastStats = useRef('');

  const health = useRef(100);
  const armor = useRef(0);
  const frags = useRef(0);
  const deaths = useRef(0);
  const alive = useRef(true);
  const timeLeft = useRef(180);
  /** Munici má vlastní server (snapshot) — klient jen zobrazuje. */
  const ammo = useRef(12);
  /** Místní cooldown zvuku — zvuk hraje klient, rány počítá server. */
  const soundCooldown = useRef(0);
  /** Poslední známé HP — pro zvuk zásahu (server posílá jen stav). */
  const lastHp = useRef(100);
  const matchState = useRef<'running' | 'ended' | 'countdown' | null>(null);
  const roster = useRef<Map<string, string>>(new Map());
  /** Kdo je v místnosti a jaký má avatar — mění se jen při změně obsazení. */
  const [slots, setSlots] = useState<{ id: string; avatarId: number | null }[]>([]);

  // ── připojení do místnosti ──────────────────────────────────────────
  useEffect(() => {
    // join až ve chvíli, kdy je socket opravdu otevřený — jinak se zpráva ztratí
    if (!running || !connected) return;
    unlockAudio(); // prohlížeč chce gesto — tlačítko „Multiplayer" jím je
    joinArena();
    return () => leaveRoom();
  }, [running, connected, joinArena, leaveRoom]);

  // ── data ze serveru (mimo React state, 15×/s) ───────────────────────
  useEffect(() => {
    return subscribe((message: ServerMessage) => {
      if (message.t === 'snapshot' && message.game === 'arena') {
        previous.current = latest.current;
        const next: Snapshot = {
          at: Date.now(),
          players: message.players as ArenaPlayerState[],
          projectiles: message.projectiles ?? [],
          pickups: message.pickups ?? [],
          // aréna zná jen tyhle tři; `roundEnd`/`matchEnd` chodí maximálně u fight snapshotů
          state: (message.state ?? 'running') as 'running' | 'ended' | 'countdown',
        };
        latest.current = next;
        matchState.current = next.state;
        timeLeft.current = message.secondsLeft ?? 0;
        for (const player of next.players) {
          roster.current.set(player.id, roster.current.get(player.id) ?? player.id);
        }
        // munice i zbraň jsou serverové — klient si je jen přepíše ze snapshotu
        const mine = next.players.find((player) => player.id === youPlayerId);
        if (mine) {
          ammo.current = mine.ammo ?? ammo.current;
          if (mine.weapon !== weapon.current && mine.alive) weapon.current = mine.weapon;
        }
        const nextSlots = next.players
          .filter((player) => player.id !== youPlayerId)
          .map((player) => ({ id: player.id, avatarId: player.avatarId ?? null }));
        setSlots((current) => {
          if (current.length !== nextSlots.length) return nextSlots;
          return current.every(
            (slot, index) =>
              slot.id === nextSlots[index]?.id && slot.avatarId === nextSlots[index]?.avatarId,
          )
            ? current
            : nextSlots;
        });
        return;
      }

      if (message.t === 'event') {
        const event = message.event;
        if (event.kind === 'match_end') {
          matchState.current = 'ended';
          playMatchEnd();
        }
        if (event.kind === 'match_start') matchState.current = 'running';
        if (event.kind === 'presence') {
          for (const member of event.members) roster.current.set(member.id, member.name);
        }
        // zvuk — stejné syntézy jako sólo, jen spouštěné událostmi serveru
        if (event.kind === 'kill') {
          if (event.killer === youPlayerId) playFrag();
          if (event.victim === youPlayerId) playDeath();
        }
        if (event.kind === 'pickup' && event.id === youPlayerId) playPickup();
        if (event.kind === 'respawn' && event.id === youPlayerId) playPickup();
      }
    });
  }, [subscribe]);

  // ── debug háček pro headless testy (jen s ?arenaDebug=1) ────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('arenaDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__mpDebug = () => ({
      you: youPlayerId,
      connected,
      players: (latest.current?.players ?? []).map((player) => ({
        id: player.id,
        name: player.name,
        avatarId: player.avatarId ?? null,
        isBot: player.isBot === true,
        weapon: player.weapon,
        ammo: player.ammo ?? 0,
        x: Math.round(player.x * 100) / 100,
        y: Math.round(player.y * 100) / 100,
        z: Math.round(player.z * 100) / 100,
        hp: player.hp,
        frags: player.frags,
        deaths: player.deaths,
        alive: player.alive,
      })),
      rockets: latest.current?.projectiles.length ?? 0,
      state: latest.current?.state ?? null,
    });
  }, [youPlayerId, connected]);

  // ── vstup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === 'Digit1') weapon.current = 0;
      if (event.code === 'Digit2') weapon.current = 1;
      if (event.code === 'Digit3') weapon.current = 2;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
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
    const canvas = gl.domElement;
    const onMouse = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      view.current.yaw -= event.movementX * 0.0022;
      view.current.pitch = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, view.current.pitch - event.movementY * 0.0022),
      );
    };
    const onDown = (event: PointerEvent) => {
      if (document.pointerLockElement === canvas && event.button === 0) firing.current = true;
    };
    const onUp = () => {
      firing.current = false;
    };
    const onClick = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
    };
    const onLockChange = () => {
      if (document.pointerLockElement !== canvas) firing.current = false;
    };
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [gl]);

  // ── smyčka ──────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(0.05, delta);
    const now = Date.now();

    // dotyk (mobil): pohled se aplikuje tady, pohyb jde do stejných čísel
    const touchInput = readTouch(touch, view, (next) => {
      weapon.current = next;
    });

    const forward = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0) + touchInput.forward;
    const strafe = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0) + touchInput.strafe;
    const jump = keys.current.has('Space') || touchInput.jump;
    const fire = firing.current || touchInput.fire;

    // 1) predikce vlastního pohybu stejnou fyzikou jako server
    if (alive.current) {
      stepBody(local.current, view.current.yaw, { forward, strafe, jump }, dt, solids);
    }

    // 2) srovnání se serverem
    const snapshot = latest.current;
    const me = snapshot?.players.find((player) => player.id === youPlayerId);
    if (me) {
      // zásah poznáme podle poklesu HP ve snapshotu (server je autorita)
      if (me.hp < lastHp.current && me.alive) playHurt();
      lastHp.current = me.hp;
      health.current = me.hp;
      armor.current = me.armor;
      frags.current = me.frags;
      deaths.current = me.deaths;
      alive.current = me.alive;
      if (!me.alive) {
        local.current.x = me.x;
        local.current.y = me.y;
        local.current.z = me.z;
        local.current.vx = 0;
        local.current.vz = 0;
      } else {
        const dx = me.x - local.current.x;
        const dy = me.y - local.current.y;
        const dz = me.z - local.current.z;
        if (Math.hypot(dx, dz) > SNAP_DISTANCE || Math.abs(dy) > 2) {
          local.current.x = me.x;
          local.current.y = me.y;
          local.current.z = me.z;
          local.current.vx = 0;
          local.current.vy = 0;
          local.current.vz = 0;
        } else {
          local.current.x += dx * 0.18;
          local.current.z += dz * 0.18;
        }
      }
    }

    // 3) kamera
    camera.position.set(
      local.current.x,
      local.current.y + PLAYER.eye + Math.sin(now / 520) * 0.012,
      local.current.z,
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.y = view.current.yaw;
    camera.rotation.x = view.current.pitch;
    camera.rotation.z = 0;

    // 4) ostatní hráči — interpolace mezi dvěma snapshoty
    const blend = snapshot && previous.current
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
        const targetX = before ? before.x + (player.x - before.x) * blend : player.x;
        const targetZ = before ? before.z + (player.z - before.z) * blend : player.z;
        group.position.set(targetX, before ? before.y + (player.y - before.y) * blend : player.y, targetZ);
        group.rotation.y = player.yaw;
        group.visible = player.alive;
      }
    }

    // 5) rakety a pickupy
    if (snapshot) {
      snapshot.projectiles.forEach((rocket, index) => {
        const mesh = rocketRefs.current[index];
        if (!mesh) return;
        mesh.visible = true;
        mesh.position.set(rocket.x, rocket.y, rocket.z);
      });
      for (let index = snapshot.projectiles.length; index < ROCKET_POOL; index++) {
        const mesh = rocketRefs.current[index];
        if (mesh) mesh.visible = false;
      }
      snapshot.pickups.forEach((pickup, index) => {
        const mesh = pickupRefs.current[index];
        if (!mesh) return;
        mesh.visible = !pickup.taken;
      });
    }

    // 6) vstup na server (20 Hz — `sendInput` to sám omezuje)
    const frame: ArenaInputFrame = {
      forward,
      strafe,
      yaw: view.current.yaw,
      pitch: view.current.pitch,
      jump,
      fire,
      weapon: weapon.current,
    };
    // zvuk výstřelu hraje klient lokálně (server je autorita zásahů, ne zvuku);
    // cooldown zrcadlí `WEAPONS`, aby se dávka nesekala do sebe
    if (fire && now > soundCooldown.current) {
      const spec = weapon.current === 0 ? WEAPONS.rail : weapon.current === 1 ? WEAPONS.rocket : WEAPONS.mg;
      soundCooldown.current = now + spec.cooldownMs;
      if (weapon.current === 0) playRail();
      else if (weapon.current === 1) playRocket();
      else playMg();
    }
    sendInput(frame);

    // 7) HUD
    const rows: MpPlayerRow[] = (snapshot?.players ?? [])
      .map((player) => ({
        id: player.id,
        name: player.name || roster.current.get(player.id) || player.id.slice(0, 8),
        frags: player.frags,
        deaths: player.deaths,
        alive: player.alive,
      }))
      .sort((a, b) => b.frags - a.frags || a.deaths - b.deaths);

    const stats: MpStats = {
      health: Math.round(health.current),
      armor: Math.round(armor.current),
      frags: frags.current,
      deaths: deaths.current,
      weapon: weapon.current === 1 ? 'rocket' : weapon.current === 2 ? 'mg' : 'rail',
      ammo: weapon.current === 1 || weapon.current === 2 ? ammo.current : 0,
      botsAlive: rows.filter((row) => row.alive && row.id !== youPlayerId).length,
      timeLeft: Math.round(timeLeft.current),
      respawnIn: alive.current ? 0 : 1,
      players: rows,
      connected,
      ping: rtt,
      matchState: matchState.current,
    };
    const key = JSON.stringify(stats);
    if (key !== lastStats.current) {
      lastStats.current = key;
      onStats(stats);
    }
  });

  return (
    <>
      <color attach="background" args={['#421d0e']} />
      <fog attach="fog" args={['#5a2611', 34, 130]} />
      <ambientLight intensity={0.95} color="#ffcaa0" />
      <hemisphereLight args={['#ffb27a', '#3a1408', 0.85]} />
      <directionalLight position={[18, 32, 12]} intensity={2.6} color="#ffd9b0" />
      <pointLight position={[0, 6, 0]} intensity={18} color="#ff8f5c" distance={28} decay={2} />

      {/* mapa */}
      {ARENA_BOXES.map((box: ArenaBox, index) => (
        <mesh
          key={index}
          geometry={boxGeometry}
          position={[box.x, box.y + box.h / 2, box.z]}
          scale={[box.w, box.h, box.d]}
        >
          <meshStandardMaterial
            color={
              box.kind === 'ground'
                ? '#8a3d22'
                : box.kind === 'rock'
                  ? '#a44a26'
                  : box.kind === 'metal'
                    ? '#6d5560'
                    : '#ffc077'
            }
            emissive={box.kind === 'trim' ? '#5a2a0d' : '#160704'}
            emissiveIntensity={box.kind === 'trim' ? 0.8 : 0.25}
            roughness={box.kind === 'metal' ? 0.62 : 0.92}
            metalness={box.kind === 'metal' ? 0.18 : 0.04}
          />
        </mesh>
      ))}

      {/* ostatní hráči — každý svým avatarem z OASIS rosteru */}
      {slots.map((slot, index) => (
        <group
          key={slot.id}
          ref={(node) => {
            remoteRefs.current[index] = node;
          }}
        >
          <AvatarModel look={avatarLook(slot.avatarId)} />
        </group>
      ))}

      {/* rakety */}
      {Array.from({ length: ROCKET_POOL }, (_, index) => (
        <mesh
          key={`rocket-${index}`}
          visible={false}
          ref={(node) => {
            rocketRefs.current[index] = node;
          }}
        >
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshBasicMaterial color="#ffb46a" toneMapped={false} />
        </mesh>
      ))}

      {/* pickupy */}
      {ARENA_PICKUPS.map((pickup, index) => (
        <mesh
          key={pickup.id}
          position={[pickup.x, pickup.y + 0.7, pickup.z]}
          ref={(node) => {
            pickupRefs.current[index] = node;
          }}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial
            color={pickup.kind === 'health' ? '#7fe3d4' : pickup.kind === 'ammo' ? '#ffb46a' : '#ffd166'}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* vlastní zbraň — jen náznak, ať je vidět, že držíš jinou */}
      <mesh position={[0.28, -0.26, -0.55]} rotation={[0.05, 0.2, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.62]} />
        <meshStandardMaterial
          color={weapon.current === 1 ? '#ff7a6b' : '#7fe3d4'}
          emissive={weapon.current === 1 ? '#ff7a6b' : '#7fe3d4'}
          emissiveIntensity={0.6}
        />
      </mesh>
    </>
  );
}
