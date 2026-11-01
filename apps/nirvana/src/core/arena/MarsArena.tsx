'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin, useXRInputSourceState } from '@react-three/xr';
import {
  playDeath,
  playExplosion,
  playFrag,
  playHit,
  playHurt,
  playMatchEnd,
  playPickup,
  playRail,
  playRocket,
  unlockAudio,
} from '@/core/arena/audio';
import * as THREE from 'three';
import {
  ARENA_BOXES,
  ARENA_PICKUPS,
  BOT_SPAWNS,
  FRAG_LIMIT,
  MATCH_SECONDS,
  PLAYER_SPAWN,
  type ArenaBox,
} from '@/core/arena/map';
import { buildNavGrid, cellCenter, cellIndex, findPath, nearestWalkable } from '@/core/arena/nav';
import {
  BOT_BODY,
  PLAYER,
  lineOfSight,
  makeSolids,
  raySolids,
  raySphere,
  stepBody,
  type Body,
  type Box4,
} from '@/core/arena/physics';

/**
 * MARS ARENA — deathmatch v stylu Quake 3, celý procedurální.
 *
 * Co tam je: pohyb s kolizemi a skokem, rail (hitscan) a rakety (projektil +
 * splash), tři boti se strafováním a dostřelem, zdraví/armor pickupy, frag
 * limit 10 nebo 3 minuty. Co tam není: modely, animace, zvuk, síťová hra.
 *
 * Ovládání: WASD, myš (pointer lock), mezerník skok, 1/2 zbraň, klik střelba.
 */

export interface ArenaStats {
  health: number;
  armor: number;
  frags: number;
  deaths: number;
  weapon: 'rail' | 'rocket';
  ammo: number;
  botsAlive: number;
  timeLeft: number;
  respawnIn: number;
}

interface XrHandle {
  firing: boolean;
  /** Zamíření paprskem z pravého ovladače (null = nedostupné). */
  aim: THREE.Vector3 | null;
  /** Levý thumbstick: −1..1 vpřed / vpravo. */
  forward: number;
  strafe: number;
}

export interface ArenaResult {
  frags: number;
  deaths: number;
  score: number;
  reason: 'frags' | 'time';
}

const RAIL_DAMAGE = 55;
const RAIL_COOLDOWN = 0.75;
const ROCKET_DAMAGE = 85;
const ROCKET_SPLASH = 60;
const ROCKET_RADIUS = 3.2;
const ROCKET_SPEED = 26;
const ROCKET_COOLDOWN = 0.85;
const ROCKET_AMMO = 12;
const RESPAWN_TIME = 2.4;
const BOT_RESPAWN = 3.2;

interface BotState {
  body: Body;
  yaw: number;
  health: number;
  alive: boolean;
  respawnAt: number;
  nextShot: number;
  nextJump: number;
  strafeDir: number;
  name: string;
  path: number[];
  pathIndex: number;
  nextRepath: number;
}

interface Rocket {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ttl: number;
}

interface Tracer {
  id: number;
  from: [number, number, number];
  to: [number, number, number];
  ttl: number;
}

const BOT_NAMES = ['VALLIS', 'NOCTIS', 'ARES'];

/**
 * VR vstup: pravý ovladač míří, spoušť střílí.
 * Pohyb po mapě ve VR zatím není — hráč stojí a brání se; boti přijdou.
 * (Pointer lock v headsetu neexistuje, takže myš tu nemá co dělat.)
 */
function ArenaXrInput({ handle }: { handle: React.MutableRefObject<XrHandle> }) {
  const right = useXRInputSourceState('controller', 'right');
  const left = useXRInputSourceState('controller', 'left');
  const direction = useMemo(() => new THREE.Vector3(0, 0, -1), []);

  useFrame(() => {
    const trigger = right?.gamepad?.['xr-standard-trigger'];
    handle.current.firing = trigger?.state === 'pressed';
    const object = right?.object;
    if (object) {
      object.getWorldDirection(direction);
      handle.current.aim = direction;
    } else {
      handle.current.aim = null;
    }

    // pohyb levým thumbstickem (osa Y je v XR obráceně)
    const stick = left?.gamepad?.['xr-standard-thumbstick'];
    const dead = 0.18;
    const x = stick?.xAxis ?? 0;
    const y = stick?.yAxis ?? 0;
    handle.current.strafe = Math.abs(x) > dead ? x : 0;
    handle.current.forward = Math.abs(y) > dead ? -y : 0;
  });

  return null;
}

export function MarsArena({
  running,
  xr = false,
  onStats,
  onEnd,
}: {
  running: boolean;
  xr?: boolean;
  onStats: (stats: ArenaStats) => void;
  onEnd: (result: ArenaResult) => void;
}) {
  const { camera, gl } = useThree();
  const solids = useMemo<Box4[]>(() => makeSolids(ARENA_BOXES), []);
  const nav = useMemo(() => buildNavGrid(ARENA_BOXES), []);

  const player = useRef<Body>({
    x: PLAYER_SPAWN.x,
    y: 0.1,
    z: PLAYER_SPAWN.z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  });
  const view = useRef({ yaw: PLAYER_SPAWN.yaw, pitch: -0.05 });
  const health = useRef(100);
  const armor = useRef(0);
  const frags = useRef(0);
  const deaths = useRef(0);
  const weapon = useRef<'rail' | 'rocket'>('rail');
  const ammo = useRef(ROCKET_AMMO);
  const cooldown = useRef(0);
  const deadUntil = useRef(0);
  const timeLeft = useRef(MATCH_SECONDS);
  const finished = useRef(false);
  const startedAt = useRef(0);

  const keys = useRef(new Set<string>());
  const firing = useRef(false);
  const jumpQueued = useRef(false);
  const locked = useRef(false);

  const bots = useRef<BotState[]>(
    BOT_SPAWNS.map((spawn, index) => ({
      body: { x: spawn.x, y: 0.1, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false },
      yaw: spawn.yaw,
      health: 100,
      alive: true,
      respawnAt: 0,
      nextShot: 1 + index * 0.4,
      nextJump: 2 + index,
      strafeDir: index % 2 === 0 ? 1 : -1,
      name: BOT_NAMES[index]!,
      path: [],
      pathIndex: 0,
      nextRepath: 0,
    })),
  );
  const rockets = useRef<Rocket[]>([]);
  const tracers = useRef<Tracer[]>([]);
  const pickups = useRef(ARENA_PICKUPS.map((pickup) => ({ ...pickup, until: 0 })));
  const nextId = useRef(1);

  const botGroup = useRef<THREE.Group>(null);
  const rocketGroup = useRef<THREE.Group>(null);
  const tracerGroup = useRef<THREE.Group>(null);
  const pickupGroup = useRef<THREE.Group>(null);

  const lastStats = useRef('');
  const xrHandle = useRef<XrHandle>({ firing: false, aim: null, forward: 0, strafe: 0 });
  const xrOrigin = useRef<THREE.Group>(null);
  const headDir = useMemo(() => new THREE.Vector3(), []);

  // ── revizní háček pro testy: `?arenaDebug=1` ─────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('arenaDebug') !== '1') return;
    const api = {
      state: () => ({
        player: { ...player.current },
        frags: frags.current,
        health: health.current,
        bots: bots.current.map((bot) => ({
          x: bot.body.x,
          y: bot.body.y,
          z: bot.body.z,
          health: bot.health,
          alive: bot.alive,
        })),
      }),
      aimAt: (x: number, y: number, z: number) => {
        const dx = x - player.current.x;
        const dy = y - (player.current.y + PLAYER.eye);
        const dz = z - player.current.z;
        view.current.yaw = Math.atan2(-dx, -dz);
        view.current.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      },
      fire: () => fire(performance.now()),
      weapon: (next: 'rail' | 'rocket') => {
        weapon.current = next;
      },
    };
    (window as unknown as Record<string, unknown>).__arenaDebug = api;
    return () => {
      delete (window as unknown as Record<string, unknown>).__arenaDebug;
    };
  }, []);

  // ── vstup ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === 'Space') jumpQueued.current = true;
      if (event.code === 'Digit1') weapon.current = 'rail';
      if (event.code === 'Digit2') weapon.current = 'rocket';
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);

    const onMouseMove = (event: MouseEvent) => {
      if (!locked.current) return;
      view.current.yaw -= event.movementX * 0.0022;
      view.current.pitch -= event.movementY * 0.002;
      const limit = Math.PI / 2 - 0.05;
      view.current.pitch = Math.max(-limit, Math.min(limit, view.current.pitch));
    };

    const onClick = () => {
      unlockAudio();
      if (!locked.current) {
        void canvas.requestPointerLock?.();
        return;
      }
      firing.current = true;
      window.setTimeout(() => {
        firing.current = false;
      }, 90);
    };

    const onLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [gl]);

  // ── start / reset zápasu ─────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    unlockAudio();
    startedAt.current = performance.now();
    finished.current = false;
    timeLeft.current = MATCH_SECONDS;
    health.current = 100;
    armor.current = 0;
    frags.current = 0;
    deaths.current = 0;
    ammo.current = ROCKET_AMMO;
    weapon.current = 'rail';
    deadUntil.current = 0;
    player.current = {
      x: PLAYER_SPAWN.x,
      y: 0.1,
      z: PLAYER_SPAWN.z,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
    };
    view.current = { yaw: PLAYER_SPAWN.yaw, pitch: -0.05 };
    rockets.current = [];
    tracers.current = [];
    pickups.current = ARENA_PICKUPS.map((pickup) => ({ ...pickup, until: 0 }));
    bots.current = BOT_SPAWNS.map((spawn, index) => ({
      body: { x: spawn.x, y: 0.1, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false },
      yaw: spawn.yaw,
      health: 100,
      alive: true,
      respawnAt: 0,
      nextShot: 1 + index * 0.4,
      nextJump: 2 + index,
      strafeDir: index % 2 === 0 ? 1 : -1,
      name: BOT_NAMES[index]!,
      path: [],
      pathIndex: 0,
      nextRepath: 0,
    }));
  }, [running]);

  // ── střelba ──────────────────────────────────────────────────────
  const fireVector = useMemo(() => new THREE.Vector3(), []);
  const fireEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  function fire(now: number, fromController = false) {
    if (now < deadUntil.current || cooldown.current > now) return;

    // ve VR střílíš z hlavy po paprsku ovladače
    const vrAim = fromController ? xrHandle.current.aim : null;
    const origin: [number, number, number] = vrAim
      ? [player.current.x, player.current.y + PLAYER.eye, player.current.z]
      : [player.current.x, player.current.y + PLAYER.eye, player.current.z];

    let dir: THREE.Vector3;
    if (vrAim) {
      dir = fireVector.copy(vrAim).normalize();
    } else {
      fireEuler.set(view.current.pitch, view.current.yaw, 0);
      dir = fireVector.set(0, 0, -1).applyEuler(fireEuler).normalize();
    }

    if (weapon.current === 'rail') {
      cooldown.current = now + RAIL_COOLDOWN;
      const wall = raySolids(origin[0], origin[1], origin[2], dir.x, dir.y, dir.z, solids, 120);
      const wallDist = wall?.t ?? 120;

      let bestBot: BotState | null = null;
      let bestT = wallDist;
      for (const bot of bots.current) {
        if (!bot.alive) continue;
        const t = raySphere(
          origin[0],
          origin[1],
          origin[2],
          dir.x,
          dir.y,
          dir.z,
          bot.body.x,
          bot.body.y + BOT_BODY.height * 0.6,
          bot.body.z,
          0.62,
        );
        if (t !== null && t < bestT) {
          bestT = t;
          bestBot = bot;
        }
      }

      const end: [number, number, number] = [
        origin[0] + dir.x * bestT,
        origin[1] + dir.y * bestT,
        origin[2] + dir.z * bestT,
      ];
      tracers.current.push({ id: nextId.current++, from: origin, to: end, ttl: now + 140 });
      playRail();

      if (bestBot) {
        playHit();
        bestBot.health -= RAIL_DAMAGE;
        if (bestBot.health <= 0) killBot(bestBot, now);
      }
      return;
    }

    // raketa
    if (ammo.current <= 0) {
      weapon.current = 'rail';
      return;
    }
    ammo.current -= 1;
    cooldown.current = now + ROCKET_COOLDOWN;
    playRocket();
    rockets.current.push({
      id: nextId.current++,
      x: origin[0] + dir.x * 0.6,
      y: origin[1] + dir.y * 0.6,
      z: origin[2] + dir.z * 0.6,
      vx: dir.x * ROCKET_SPEED,
      vy: dir.y * ROCKET_SPEED,
      vz: dir.z * ROCKET_SPEED,
      ttl: now + 4000,
    });
  }

  function killBot(bot: BotState, now: number) {
    bot.alive = false;
    bot.health = 0;
    bot.respawnAt = now + BOT_RESPAWN * 1000;
    frags.current += 1;
    playFrag();
    if (frags.current >= FRAG_LIMIT && !finished.current) endMatch('frags');
  }

  function damagePlayer(amount: number, now: number) {
    if (now < deadUntil.current) return;
    const absorbed = Math.min(armor.current, Math.round(amount * 0.6));
    armor.current -= absorbed;
    health.current -= amount - absorbed;
    if (health.current > 0) playHurt();
    if (health.current <= 0) {
      health.current = 0;
      deaths.current += 1;
      deadUntil.current = now + RESPAWN_TIME * 1000;
      playDeath();
      window.setTimeout(() => {
        health.current = 100;
        armor.current = 0;
        player.current = {
          x: PLAYER_SPAWN.x,
          y: 0.2,
          z: PLAYER_SPAWN.z,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: false,
        };
        view.current = { yaw: PLAYER_SPAWN.yaw, pitch: -0.05 };
      }, RESPAWN_TIME * 1000);
    }
  }

  function endMatch(reason: 'frags' | 'time') {
    if (finished.current) return;
    finished.current = true;
    playMatchEnd();
    if (document.pointerLockElement) void document.exitPointerLock();
    onEnd({
      frags: frags.current,
      deaths: deaths.current,
      score: Math.max(0, frags.current * 100 - deaths.current * 25),
      reason,
    });
  }

  // ── hlavní smyčka ────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, delta);

    timeLeft.current = Math.max(0, MATCH_SECONDS - (now - startedAt.current) / 1000);
    if (timeLeft.current <= 0 && !finished.current) endMatch('time');

    const dead = now < deadUntil.current;

    // hráč
    if (!dead) {
      const forward = xr
        ? xrHandle.current.forward
        : (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
          (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
      const strafe = xr
        ? xrHandle.current.strafe
        : (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
          (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);

      // ve VR je „vpřed" tam, kam se dívá hlava — ne kam se dívala myš
      let moveYaw = view.current.yaw;
      if (xr) {
        camera.getWorldDirection(headDir);
        moveYaw = Math.atan2(-headDir.x, -headDir.z);
      }

      stepBody(
        player.current,
        moveYaw,
        { forward, strafe, jump: jumpQueued.current || (xr && keys.current.has('Space')) },
        dt,
        solids,
      );
      jumpQueued.current = false;

      if (xr) {
        if (xrHandle.current.firing) fire(now, true);
      } else if (firing.current) {
        fire(now);
      }

      if (xr) {
        // XR origin nese tělo; kamera (hlava) je vůči němu lokální
        if (xrOrigin.current) {
          xrOrigin.current.position.set(player.current.x, player.current.y, player.current.z);
        }
      } else {
        camera.position.set(
          player.current.x,
          player.current.y + PLAYER.eye,
          player.current.z,
        );
        camera.rotation.order = 'YXZ';
        camera.rotation.y = view.current.yaw;
        camera.rotation.x = view.current.pitch;
        camera.rotation.z = 0;
      }
    }

    // boti
    for (let index = 0; index < bots.current.length; index++) {
      const bot = bots.current[index]!;
      if (!bot.alive) {
        if (now >= bot.respawnAt) {
          const spawn = BOT_SPAWNS[index % BOT_SPAWNS.length]!;
          bot.alive = true;
          bot.health = 100;
          bot.body = { x: spawn.x, y: 0.2, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false };
        }
        continue;
      }

      const dx = player.current.x - bot.body.x;
      const dz = player.current.z - bot.body.z;
      const dist = Math.hypot(dx, dz);

      // cesta mřížkou (BFS), přepočet ~2× za sekundu
      if (now > bot.nextRepath) {
        bot.nextRepath = now + 480 + Math.random() * 220;
        const from = nearestWalkable(nav, cellIndex(bot.body.x, bot.body.z));
        const to = nearestWalkable(nav, cellIndex(player.current.x, player.current.z));
        bot.path = findPath(nav, from, to);
        bot.pathIndex = 0;
      }

      let goalX = player.current.x;
      let goalZ = player.current.z;
      if (bot.path.length > 0) {
        while (bot.pathIndex < bot.path.length) {
          const [cx, cz] = cellCenter(bot.path[bot.pathIndex]!);
          if (Math.hypot(cx - bot.body.x, cz - bot.body.z) < 0.7) bot.pathIndex += 1;
          else break;
        }
        const node = bot.path[Math.min(bot.pathIndex, bot.path.length - 1)]!;
        const [wx, wz] = cellCenter(node);
        goalX = wx;
        goalZ = wz;
      }

      const targetYaw = Math.atan2(-(goalX - bot.body.x), -(goalZ - bot.body.z));
      bot.yaw += ((targetYaw - bot.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 7);

      const sees = lineOfSight(
        bot.body.x,
        bot.body.y + BOT_BODY.height * 0.7,
        bot.body.z,
        player.current.x,
        player.current.y + PLAYER.eye * 0.8,
        player.current.z,
        solids,
      );

      // drží odstup: daleko = jde blíž, blízko = couvá, vždy strafuje
      const toGoal = Math.hypot(goalX - bot.body.x, goalZ - bot.body.z);
      const approach = toGoal > 1.2 ? 1 : dist > 11 ? 1 : dist < 5 ? -1 : 0;
      if (Math.random() < 0.01) bot.strafeDir *= -1;

      stepBody(
        bot.body,
        bot.yaw,
        {
          forward: approach,
          strafe: bot.strafeDir * (sees ? 0.9 : 0.4),
          jump: now > bot.nextJump && Math.random() < 0.02,
          speed: 0.62,
        },
        dt,
        solids,
        BOT_BODY.radius,
        BOT_BODY.height,
      );
      if (now > bot.nextJump) bot.nextJump = now + 1800 + Math.random() * 2200;

      // dostřel
      if (sees && !dead && now > bot.nextShot) {
        bot.nextShot = now + 850 + Math.random() * 900;
        if (Math.random() < 0.42) damagePlayer(11 + Math.round(Math.random() * 6), now);
        tracers.current.push({
          id: nextId.current++,
          from: [bot.body.x, bot.body.y + BOT_BODY.height * 0.7, bot.body.z],
          to: [
            player.current.x + (Math.random() - 0.5) * 1.2,
            player.current.y + PLAYER.eye + (Math.random() - 0.5) * 1.0,
            player.current.z + (Math.random() - 0.5) * 1.2,
          ],
          ttl: now + 90,
        });
      }
    }

    // rakety
    if (rockets.current.length) {
      const survivors: Rocket[] = [];
      for (const rocket of rockets.current) {
        const nx = rocket.x + rocket.vx * dt;
        const ny = rocket.y + rocket.vy * dt;
        const nz = rocket.z + rocket.vz * dt;
        rocket.x = nx;
        rocket.y = ny;
        rocket.z = nz;

        let exploded = now > rocket.ttl;

        // zásah botů
        for (const bot of bots.current) {
          if (!bot.alive) continue;
          const d = Math.hypot(
            rocket.x - bot.body.x,
            rocket.y - (bot.body.y + BOT_BODY.height * 0.5),
            rocket.z - bot.body.z,
          );
          if (d < 1.1) {
            bot.health -= ROCKET_DAMAGE;
            if (bot.health <= 0) killBot(bot, now);
            exploded = true;
            break;
          }
        }

        // zásah stěny
        if (!exploded) {
          for (const box of solids) {
            if (
              rocket.x > box.minX &&
              rocket.x < box.maxX &&
              rocket.y > box.minY &&
              rocket.y < box.maxY &&
              rocket.z > box.minZ &&
              rocket.z < box.maxZ
            ) {
              exploded = true;
              break;
            }
          }
        }

        if (exploded) {
          playExplosion();
          for (const bot of bots.current) {
            if (!bot.alive) continue;
            const d = Math.hypot(
              rocket.x - bot.body.x,
              rocket.y - (bot.body.y + BOT_BODY.height * 0.5),
              rocket.z - bot.body.z,
            );
            if (d < ROCKET_RADIUS) {
              bot.health -= Math.round(ROCKET_SPLASH * (1 - d / ROCKET_RADIUS));
              if (bot.health <= 0) killBot(bot, now);
            }
          }
          const selfDist = Math.hypot(
            rocket.x - player.current.x,
            rocket.y - (player.current.y + 1),
            rocket.z - player.current.z,
          );
          if (selfDist < ROCKET_RADIUS * 0.8) {
            damagePlayer(Math.round(28 * (1 - selfDist / (ROCKET_RADIUS * 0.8))), now);
          }
          continue;
        }
        survivors.push(rocket);
      }
      rockets.current = survivors;
    }

    // pickupy
    for (const pickup of pickups.current) {
      if (now < pickup.until) continue;
      const d = Math.hypot(
        pickup.x - player.current.x,
        pickup.y - player.current.y,
        pickup.z - player.current.z,
      );
      if (d > 1.5) continue;
      if (pickup.kind === 'health') {
        if (health.current >= 100) continue;
        health.current = Math.min(100, health.current + 25);
      } else {
        if (armor.current >= 100) continue;
        armor.current = Math.min(100, armor.current + 50);
      }
      pickup.until = now + pickup.respawn * 1000;
      playPickup();
    }

    tracers.current = tracers.current.filter((tracer) => tracer.ttl > now);

    // ── vizuální část: boti, rakety, trasy ──
    if (botGroup.current) {
      botGroup.current.children.forEach((child, index) => {
        const bot = bots.current[index];
        child.visible = Boolean(bot?.alive) && now >= deadUntil.current;
        if (!bot) return;
        child.position.set(bot.body.x, bot.body.y, bot.body.z);
        child.rotation.y = bot.yaw;
      });
    }

    if (rocketGroup.current) {
      const pool = rocketGroup.current.children;
      pool.forEach((child, index) => {
        const rocket = rockets.current[index];
        child.visible = Boolean(rocket);
        if (!rocket) return;
        child.position.set(rocket.x, rocket.y, rocket.z);
      });
    }

    if (tracerGroup.current) {
      const pool = tracerGroup.current.children;
      pool.forEach((child, index) => {
        const tracer = tracers.current[index];
        child.visible = Boolean(tracer);
        if (!tracer) return;
        const mesh = child as THREE.Mesh;
        const from = new THREE.Vector3(...tracer.from);
        const to = new THREE.Vector3(...tracer.to);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        mesh.position.copy(mid);
        const length = from.distanceTo(to);
        mesh.scale.set(1, Math.max(0.01, length), 1);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          to.clone().sub(from).normalize(),
        );
      });
    }

    if (pickupGroup.current) {
      pickupGroup.current.children.forEach((child, index) => {
        const pickup = pickups.current[index];
        if (!pickup) return;
        child.visible = now >= pickup.until;
        child.position.set(pickup.x, pickup.y + 0.7 + Math.sin(now / 400 + index) * 0.12, pickup.z);
        child.rotation.y = now / 600 + index;
      });
    }

    // ── HUD (posílat jen při změně) ──
    const stats: ArenaStats = {
      health: Math.max(0, Math.round(health.current)),
      armor: Math.max(0, Math.round(armor.current)),
      frags: frags.current,
      deaths: deaths.current,
      weapon: weapon.current,
      ammo: ammo.current,
      botsAlive: bots.current.filter((bot) => bot.alive).length,
      timeLeft: Math.ceil(timeLeft.current),
      respawnIn: Math.max(0, Math.ceil((deadUntil.current - now) / 1000)),
    };
    const key = JSON.stringify(stats);
    if (key !== lastStats.current) {
      lastStats.current = key;
      onStats(stats);
    }
  });

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <>
      <color attach="background" args={['#421d0e']} />
      <fog attach="fog" args={['#5a2611', 34, 130]} />
      <ambientLight intensity={0.95} color="#ffcaa0" />
      <hemisphereLight args={['#ffb27a', '#3a1408', 0.85]} />
      <directionalLight position={[18, 32, 12]} intensity={2.6} color="#ffd9b0" />
      <pointLight position={[0, 6, 0]} intensity={18} color="#ff8f5c" distance={28} decay={2} />

      {xr && <ArenaXrInput handle={xrHandle} />}
      {xr && <XROrigin ref={xrOrigin} />}

      {/* mapa */}
      {ARENA_BOXES.map((box: ArenaBox, index) => (
        <mesh
          key={index}
          geometry={boxGeometry}
          position={[box.x, box.y + box.h / 2, box.z]}
          scale={[box.w, box.h, box.d]}
          receiveShadow
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

      {/* boti */}
      <group ref={botGroup}>
        {BOT_NAMES.map((name) => (
          <group key={name}>
            <mesh position={[0, BOT_BODY.height * 0.5, 0]}>
              <capsuleGeometry args={[0.32, 0.7, 4, 10]} />
              <meshStandardMaterial color="#c9c2b6" roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0, BOT_BODY.height * 0.82, 0.18]}>
              <boxGeometry args={[0.36, 0.14, 0.1]} />
              <meshBasicMaterial color="#ff5b3c" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.34, 0.4, 0.1, 8]} />
              <meshStandardMaterial color="#3a2a24" roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* rakety */}
      <group ref={rocketGroup}>
        {Array.from({ length: 24 }, (_, index) => (
          <mesh key={index} visible={false}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshBasicMaterial color="#ffd166" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* trasy zásahů */}
      <group ref={tracerGroup}>
        {Array.from({ length: 40 }, (_, index) => (
          <mesh key={index} visible={false}>
            <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
            <meshBasicMaterial color="#ffe9a8" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* pickupy */}
      <group ref={pickupGroup}>
        {ARENA_PICKUPS.map((pickup) => (
          <mesh key={pickup.id} visible={false}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshBasicMaterial
              color={pickup.kind === 'health' ? '#7fe3d4' : '#c8a2ff'}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
