'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_BOXES, ARENA_PICKUPS, PLAYER_SPAWN, type ArenaBox } from './map';
import { PLAYER, makeSolids, stepBody, type Body } from './physics';
import { WEAPONS, type WeaponId } from './weapons';
import { WeaponView } from './WeaponView';
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
  playGauntlet,
  playHurt,
  playLightning,
  playMg,
  playPlasma,
  playShotgun,
  playPickup,
  playRail,
  playRocket,
  playMatchEnd,
  unlockAudio,
} from '@/core/arena/audio';
import { isGamePaused } from '@/core/games/pause';

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
  /** Munice všech zbraní podle čísla na drátě (rail/pěst = −1). */
  ammoByIndex?: Record<number, number>;
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
  watch = null,
  onStats,
  touch,
  weaponRequest,
}: {
  running: boolean;
  /** Id místnosti, na kterou se jen díváme (`?watch=`); `null` = hrajeme. */
  watch?: string | null;
  onStats: (stats: MpStats) => void;
  /** Dotykové ovládání (mobil) — stejné refy jako klávesnice. */
  touch?: MutableRefObject<ArenaTouchState>;
  /** Klik na zbraň v HUD (Q3 lišta) — aplikuje se v herní smyčce. */
  weaponRequest?: MutableRefObject<number | null>;
}) {
  const { camera, gl } = useThree();
  const { subscribe, sendInput, joinArena, spectateRoom, leaveRoom, youPlayerId, spectator, connected, rtt } = useNet();

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
  const weapon = useRef<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
  const firing = useRef(false);
  /** Viewmodel: numerická zbraň → id a zpětný ráz (jen vizuál, server ne). */
  const MP_WEAPON_IDS: WeaponId[] = ['rail', 'rocket', 'mg', 'shotgun', 'lightning', 'plasma', 'gauntlet'];
  const weaponView = useMemo(
    () => ({
      get current(): WeaponId {
        return MP_WEAPON_IDS[weapon.current] ?? 'rail';
      },
    }),
    // `weapon` je ref — getter se čte živě, závislost se nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const deadUntilView = useMemo(
    () => ({
      get current(): number {
        return alive.current ? 0 : Number.MAX_SAFE_INTEGER;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const kick = useRef(0);
  const muzzleUntil = useRef(0);
  const lastLocalShot = useRef(0);

  const latest = useRef<Snapshot | null>(null);
  const previous = useRef<Snapshot | null>(null);
  const remoteRefs = useRef<(THREE.Group | null)[]>([]);
  const rocketRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pickupRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lastStats = useRef('');
  /** HUD stats stačí 10×/s — viz `VenusMultiplayer.statsClock`. */
  const statsClock = useRef(0);

  const health = useRef(100);
  const armor = useRef(0);
  /** Powerupy ze snapshotu (server je autorita). */
  const quadIn = useRef(0);
  const hasteIn = useRef(0);
  const frags = useRef(0);
  const deaths = useRef(0);
  const alive = useRef(true);
  const timeLeft = useRef(180);
  /** Munici má vlastní server (snapshot) — klient jen zobrazuje. */
  const ammo = useRef(12);
  /** Munice všech zbraní ze snapshotu (pro lištu v HUD). */
  const ammoByIndex = useRef<Record<number, number>>({ 0: -1, 1: 12, 2: 50, 3: 10, 4: 100, 5: 60, 6: -1 });
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
    // `watch` = dívat se na konkrétní rozehranou místnost (server nedá sedlo)
    if (watch) spectateRoom('arena', watch);
    else joinArena();
    return () => leaveRoom();
  }, [running, connected, joinArena, spectateRoom, leaveRoom, watch]);

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
          if (mine.ammoByWeapon) ammoByIndex.current = mine.ammoByWeapon;
          quadIn.current = mine.quadIn ?? 0;
          hasteIn.current = mine.hasteIn ?? 0;
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
      if (event.code === 'Digit4') weapon.current = 3;
      if (event.code === 'Digit5') weapon.current = 4;
      if (event.code === 'Digit6') weapon.current = 5;
      if (event.code === 'KeyQ') weapon.current = 6;
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(
          event.code,
        )
      ) {
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
    // Hamburger menu (2026-11-10) — pauza patří do modulu, ne do každé hry.
    if (isGamePaused()) return;
    const dt = Math.min(0.05, delta);
    const now = Date.now();

    // dotyk (mobil): pohled se aplikuje tady, pohyb jde do stejných čísel
    const watching = Boolean(watch) || spectator;
    const touchInput = watching
      ? { forward: 0, strafe: 0, fire: false, jump: false }
      : readTouch(touch, view, (next) => {
          // MP zná tři zbraně; dotykové kolečko jich cyklí šest.
          weapon.current = (next % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        });
    const forward = watching
      ? 0
      : (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0) + touchInput.forward;
    const strafe = watching
      ? 0
      : (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0) + touchInput.strafe;
    const jump = !watching && (keys.current.has('Space') || touchInput.jump);
    const fire = !watching && (firing.current || touchInput.fire);
    const requested = weaponRequest?.current;
    if (requested !== null && requested !== undefined) {
      weaponRequest!.current = null;
      weapon.current = requested as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }

    // Vizuální kadence: server má vlastní cooldown, ale zbraň nesmí kmitat
    // při každém snímku držené spouště.
    if (fire) {
      const spec = WEAPONS[MP_WEAPON_IDS[weapon.current] ?? 'rail'];
      const stamp = performance.now();
      if (stamp - lastLocalShot.current >= spec.cooldownMs) {
        lastLocalShot.current = stamp;
        kick.current = stamp;
        muzzleUntil.current = stamp + 70;
      }
    }

    // 1) predikce vlastního pohybu stejnou fyzikou jako server.
    // Divák ji nepočítá — jinak by jeho kamera i vstup hrály vlastní zápas.
    if (!watching && alive.current) {
      stepBody(local.current, view.current.yaw, { forward, strafe, jump }, dt, solids);
    }

    // 2) srovnání se serverem
    const snapshot = latest.current;
    const me = watching ? undefined : snapshot?.players.find((player) => player.id === youPlayerId);
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

    // 3) kamera — hráč z očí, divák z nadhledu na živého hráče ve snapshotu
    const watchTarget = watching
      ? snapshot?.players.find((player) => player.alive) ?? snapshot?.players[0]
      : undefined;
    if (watchTarget) {
      camera.position.set(watchTarget.x + 7, watchTarget.y + 5.5, watchTarget.z + 7);
      camera.lookAt(watchTarget.x, watchTarget.y + 1.2, watchTarget.z);
    } else {
      camera.position.set(
        local.current.x,
        local.current.y + PLAYER.eye + Math.sin(now / 520) * 0.012,
        local.current.z,
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.y = view.current.yaw;
      camera.rotation.x = view.current.pitch;
      camera.rotation.z = 0;
    }

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

    // 6) vstup na server (20 Hz — `sendInput` to sám omezuje). Divák ho neposílá.
    if (!watching) {
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
        const weaponId = MP_WEAPON_IDS[weapon.current] ?? 'rail';
        const spec = WEAPONS[weaponId];
        soundCooldown.current = now + spec.cooldownMs;
        if (weaponId === 'rail') playRail();
        else if (weaponId === 'rocket') playRocket();
        else if (weaponId === 'mg') playMg();
        else if (weaponId === 'shotgun') playShotgun();
        else if (weaponId === 'lightning') playLightning();
        else if (weaponId === 'plasma') playPlasma();
        else playGauntlet();
      }
      sendInput(frame);
    }

    // 7) HUD — stačí 10×/s, viz `statsClock`
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
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
        quadIn: quadIn.current,
        hasteIn: hasteIn.current,
        frags: frags.current,
        deaths: deaths.current,
        weapon: MP_WEAPON_IDS[weapon.current] ?? 'rail',
        ammo: ammo.current,
        botsAlive: rows.filter((row) => row.alive && row.id !== youPlayerId).length,
        timeLeft: Math.round(timeLeft.current),
        respawnIn: alive.current ? 0 : 1,
        players: rows,
        connected,
        ping: rtt,
        matchState: matchState.current,
        ammoByIndex: ammoByIndex.current,
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

      {/* zbraň v ruce — stejný model jako v sólu, jen tři zbraně */}
      <WeaponView
        weapon={weaponView}
        player={local}
        view={view}
        kick={kick}
        muzzleUntil={muzzleUntil}
        deadUntil={deadUntilView}
        hidden={Boolean(watch) || spectator}
      />

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
            color={
              pickup.kind === 'health' || pickup.kind === 'mega'
                ? '#9cff8a'
                : pickup.kind === 'shard'
                  ? '#bfe6ea'
                  : pickup.kind === 'ammo'
                    ? '#ffb46a'
                    : pickup.kind === 'powerup'
                      ? pickup.powerup === 'haste'
                        ? '#7fe3d4'
                        : '#ff5c5c'
                      : '#c8a2ff'
            }
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
