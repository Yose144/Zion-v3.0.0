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
  playLightning,
  playMg,
  playPickup,
  playPlasma,
  playQuad,
  playRail,
  playRocket,
  playShotgun,
  unlockAudio,
} from '@/core/arena/audio';
import * as THREE from 'three';
import {
  ARENA_BOXES,
  ARENA_SOLO_PICKUPS,
  BOT_SPAWNS,
  FRAG_LIMIT,
  MATCH_SECONDS,
  PLAYER_SPAWN,
  type ArenaBox,
} from '@/core/arena/map';
import { buildNavGrid } from '@/core/arena/nav';
import {
  BOT_BODY,
  PLAYER,
  makeSolids,
  raySolids,
  raySphere,
  stepBody,
  type Body,
  type Box4,
} from '@/core/arena/physics';
import { WEAPONS, ARMOR_ABSORB, MG_AMMO_PICKUP, BOT_FIRE, botWeaponFor, spreadVector, TARGET_RADIUS, TARGET_EYE_RATIO, pickTarget, aimVector, type WeaponId } from '@/core/arena/weapons';
import { createBotMemory, stepBot, driveBot, skillOptions, type BotMemory, type BotSkill, type BotTarget } from '@/core/arena/bot';
import { readTouch, type ArenaTouchState } from '@/core/arena/ArenaTouch';
import type { MutableRefObject } from 'react';
import { isGamePaused } from '@/core/games/pause';

/**
 * MARS ARENA — deathmatch v stylu Quake 3, celý procedurální.
 *
 * Co tam je: pohyb s kolizemi a skokem, rail (hitscan) a rakety (projektil +
 * splash), tři boti se strafováním a dostřelem, zdraví/armor pickupy, frag
 * limit 10 nebo 3 minuty. Co tam není: modely, animace, zvuk, síťová hra.
 *
 * Ovládání: WASD, myš (pointer lock), mezerník skok, 1/2/3 zbraň (rail/rakety/MG), klik střelba.
 */

export interface ArenaStats {
  health: number;
  armor: number;
  frags: number;
  deaths: number;
  weapon: 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma';
  ammo: number;
  botsAlive: number;
  timeLeft: number;
  respawnIn: number;
  /** Kolik sekund zbývá do konce Quad Damage (0 = neaktivní). */
  quadIn?: number;
  /** Kolik sekund zbývá do konce Haste (0 = neaktivní). */
  hasteIn?: number;
  /** Munice všech zbraní pro HUD (`rail` je −1 = nekonečno). */
  ammoByWeapon?: Partial<Record<WeaponId, number>>;
  /** Přesnost v procentech (zásahy / výstřely, jen hitscan). */
  accuracy?: number;
  /** Kill feed — poslední zásahy a smrti. */
  feed?: { id: number; text: string; kind: 'frag' | 'death' }[];
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

/** Zbraně bereme ze **sdíleného modulu** (`weapons.ts`) — solo a server musí
 *  shodně ubírat HP, jinak vznikne „trefil jsem ho a nic". Konkrétně Q3:
 *  rail 100, rakety 100+100 splash, MG 8, armor 66 %. */
const RESPAWN_TIME = 2.4;
const BOT_RESPAWN = 3.2;

interface BotState {
  body: Body;
  /** Směr pro vykreslení — plní ho `stepBot` (intention yaw). */
  yaw: number;
  health: number;
  alive: boolean;
  respawnAt: number;
  name: string;
  /** Sdílený botí mozek — stejný jako v MP. */
  memory: BotMemory;
  skill: BotSkill;
}

interface Rocket {
  id: number;
  /** `plasma` letí stejnou fyzikou jako raketa, jen slabší a rychlejší. */
  kind: 'rocket' | 'plasma';
  /** Poškození v době výstřelu (už vynásobené Quadem). */
  damage: number;
  splash: number;
  /** Kdo vystřelil — rozhoduje, koho splash smí zasáhnout. */
  owner: 'player' | 'bot';
  ownerName: string;
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
  /** Podle zbraně se barví stopa (rail modře, MG zlatě, brokovnice oranžově). */
  kind: WeaponId;
}

/** Barvy stop — jedna tabulka, ne `if` v renderu. */
const TRACER_COLOR: Partial<Record<WeaponId, string>> = {
  rail: '#9fe4ea',
  mg: '#ffe9a8',
  shotgun: '#ffb46a',
  lightning: '#7fe3ff',
  plasma: '#7fe3ff',
};

const BOT_NAMES = ['VALLIS', 'NOCTIS', 'ARES'];
/** Každý bot má jinou úroveň (Q3 styl) — jen těžko je zaměnit. */
const BOT_SKILL_BY_INDEX: BotSkill[] = ['easy', 'normal', 'hard'];

function makeBot(spawn: { x: number; z: number; yaw: number }, index: number): BotState {
  return {
    body: { x: spawn.x, y: 0.1, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false },
    yaw: spawn.yaw,
    health: 100,
    alive: true,
    respawnAt: 0,
    name: BOT_NAMES[index % BOT_NAMES.length]!,
    memory: createBotMemory(),
    skill: BOT_SKILL_BY_INDEX[index % BOT_SKILL_BY_INDEX.length]!,
  };
}

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
  touch,
  weaponRequest,
}: {
  running: boolean;
  xr?: boolean;
  onStats: (stats: ArenaStats) => void;
  onEnd: (result: ArenaResult) => void;
  /** Dotykové ovládání (mobil) — stejné refy jako klávesnice. */
  touch?: MutableRefObject<ArenaTouchState>;
  /** Klik na zbraň v HUD (Q3 lišta) — request, aplikuje se v herní smyčce. */
  weaponRequest?: MutableRefObject<WeaponId | null>;
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
  const weapon = useRef<'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma'>('rail');
  const ammo = useRef<number>(WEAPONS.rocket.ammo);
  const mgAmmo = useRef<number>(WEAPONS.mg.ammo);
  const shotgunAmmo = useRef<number>(WEAPONS.shotgun.ammo);
  const lightningAmmo = useRef<number>(WEAPONS.lightning.ammo);
  const plasmaAmmo = useRef<number>(WEAPONS.plasma.ammo);
  /** Quad Damage (Q3): do kdy platí ×3 poškození (ms). */
  const quadUntil = useRef(0);
  /** Haste (Q3): do kdy platí +30 % rychlosti (ms). */
  const hasteUntil = useRef(0);
  /** Munice podle id — jedno místo, ze kterého čte HUD i střelba. */
  const ammoOf = (id: 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma'): number =>
    id === 'rocket'
      ? ammo.current
      : id === 'mg'
        ? mgAmmo.current
        : id === 'shotgun'
          ? shotgunAmmo.current
          : id === 'lightning'
            ? lightningAmmo.current
            : id === 'plasma'
              ? plasmaAmmo.current
              : Number.POSITIVE_INFINITY;
  const spendAmmo = (id: 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma'): void => {
    if (id === 'rocket') ammo.current = Math.max(0, ammo.current - 1);
    else if (id === 'mg') mgAmmo.current = Math.max(0, mgAmmo.current - 1);
    else if (id === 'shotgun') shotgunAmmo.current = Math.max(0, shotgunAmmo.current - 1);
    else if (id === 'lightning') lightningAmmo.current = Math.max(0, lightningAmmo.current - 1);
    else if (id === 'plasma') plasmaAmmo.current = Math.max(0, plasmaAmmo.current - 1);
  };
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
    BOT_SPAWNS.map((spawn, index) => makeBot(spawn, index)),
  );
  const rockets = useRef<Rocket[]>([]);
  const tracers = useRef<Tracer[]>([]);
  const pickups = useRef(ARENA_SOLO_PICKUPS.map((pickup) => ({ ...pickup, until: 0 })));
  const nextId = useRef(1);
  /** Kill feed (Q3): poslední zásahy, 4,5 s viditelné. */
  const feed = useRef<{ id: number; text: string; kind: 'frag' | 'death'; until: number }[]>([]);
  /** Přesnost: zásahy / výstřely (počítá se jen hitscan, ne projektily). */
  const shots = useRef(0);
  const hits = useRef(0);
  /** Poslední botí výstřel — pro debug/test, že boti střídají zbraně. */
  const lastBotAttack = useRef<{ name: string; weapon: WeaponId } | null>(null);

  const botGroup = useRef<THREE.Group>(null);
  const rocketGroup = useRef<THREE.Group>(null);
  const tracerGroup = useRef<THREE.Group>(null);
  const pickupGroup = useRef<THREE.Group>(null);

  const lastStats = useRef('');
  /** HUD stats stačí 10×/s — `timeLeft`/`respawnIn` jsou celé sekundy,
   *  takže častější emit jen žere stringify a podněcuje zbytečné rendery. */
  const statsClock = useRef(0);
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
        weapon: weapon.current,
        quadUntil: quadUntil.current,
        hasteUntil: hasteUntil.current,
        ammo: ammo.current,
        mgAmmo: mgAmmo.current,
        shotgunAmmo: shotgunAmmo.current,
        lightningAmmo: lightningAmmo.current,
        plasmaAmmo: plasmaAmmo.current,
        accuracy: shots.current > 0 ? Math.round((hits.current / shots.current) * 100) : 0,
        shots: shots.current,
        hits: hits.current,
        feed: feed.current.map((entry) => entry.text),
        lastBotAttack: lastBotAttack.current,
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
      weapon: (next: 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma') => {
        weapon.current = next;
      },
      teleport: (x: number, z: number, y?: number) => {
        player.current.x = x;
        player.current.z = z;
        if (typeof y === 'number') {
          player.current.y = y;
          player.current.vy = 0;
          player.current.onGround = false;
        }
        player.current.vx = 0;
        player.current.vz = 0;
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
      if (event.code === 'Digit3' && mgAmmo.current > 0) weapon.current = 'mg';
      if (event.code === 'Digit4' && shotgunAmmo.current > 0) weapon.current = 'shotgun';
      if (event.code === 'Digit5' && lightningAmmo.current > 0) weapon.current = 'lightning';
      if (event.code === 'Digit6' && plasmaAmmo.current > 0) weapon.current = 'plasma';
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);

    // Kolečko přepíná zbraně stejně jako v Q3 (jen když je zamčený kurzor).
    const onWheel = (event: WheelEvent) => {
      if (!locked.current) return;
      event.preventDefault();
      const order = ['rail', 'rocket', 'mg', 'shotgun', 'lightning', 'plasma'] as const;
      const available = order.filter((id) => id === 'rail' || ammoOf(id) > 0);
      if (available.length === 0) return;
      const index = available.indexOf(weapon.current);
      const step = event.deltaY > 0 ? 1 : -1;
      weapon.current = available[(index + step + available.length) % available.length] ?? 'rail';
    };

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
    window.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
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
    ammo.current = WEAPONS.rocket.ammo;
    mgAmmo.current = WEAPONS.mg.ammo;
    shotgunAmmo.current = WEAPONS.shotgun.ammo;
    lightningAmmo.current = WEAPONS.lightning.ammo;
    plasmaAmmo.current = WEAPONS.plasma.ammo;
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
    pickups.current = ARENA_SOLO_PICKUPS.map((pickup) => ({ ...pickup, until: 0 }));
    feed.current = [];
    shots.current = 0;
    hits.current = 0;
    lastBotAttack.current = null;
    quadUntil.current = 0;
    hasteUntil.current = 0;
    bots.current = BOT_SPAWNS.map((spawn, index) => makeBot(spawn, index));
  }, [running]);

  // ── střelba ──────────────────────────────────────────────────────
  const fireVector = useMemo(() => new THREE.Vector3(), []);
  const fireEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  function fire(now: number, fromController = false) {
    if (now < deadUntil.current || cooldown.current > now) return;

    // ve VR střílíš z hlavy po paprsku ovladače
    const vrAim = fromController ? xrHandle.current.aim : null;
    const origin: [number, number, number] = [player.current.x, player.current.y + PLAYER.eye, player.current.z];

    let dir: THREE.Vector3;
    if (vrAim) {
      dir = fireVector.copy(vrAim).normalize();
    } else {
      fireEuler.set(view.current.pitch, view.current.yaw, 0);
      dir = fireVector.set(0, 0, -1).applyEuler(fireEuler).normalize();
    }

    const id = weapon.current;
    const quad = now < quadUntil.current ? 3 : 1;

    // ── paprskové zbraně: rail / MG / brokovnice / blesk ────────────
    if (id === 'rail' || id === 'mg' || id === 'shotgun' || id === 'lightning') {
      const spec =
        id === 'rail'
          ? WEAPONS.rail
          : id === 'mg'
            ? WEAPONS.mg
            : id === 'shotgun'
              ? WEAPONS.shotgun
              : WEAPONS.lightning;
      if (id !== 'rail' && ammoOf(id) <= 0) {
        weapon.current = 'rail';
        return;
      }
      cooldown.current = now + spec.cooldownMs / 1000;
      if (id !== 'rail') spendAmmo(id);

      const pellets = id === 'shotgun' ? WEAPONS.shotgun.pellets : 1;
      const spread = id === 'shotgun' ? WEAPONS.shotgun.spread : id === 'mg' ? WEAPONS.mg.spread : 0;
      const range = 'range' in spec ? spec.range : 120;
      let hitAny = false;
      shots.current += 1;

      for (let pellet = 0; pellet < pellets; pellet += 1) {
        // Brokovnice rozhazuje každý brok zvlášť, MG lehce, ostatní přesně.
        const shotDir = spread > 0 ? spreadVector(dir, spread) : dir;
        const wall = raySolids(origin[0], origin[1], origin[2], shotDir.x, shotDir.y, shotDir.z, solids, range);
        const wallDist = wall?.t ?? range;

        let bestBot: BotState | null = null;
        let bestT = wallDist;
        for (const bot of bots.current) {
          if (!bot.alive) continue;
          const t = raySphere(
            origin[0],
            origin[1],
            origin[2],
            shotDir.x,
            shotDir.y,
            shotDir.z,
            bot.body.x,
            bot.body.y + BOT_BODY.height * 0.6,
            bot.body.z,
            TARGET_RADIUS,
          );
          if (t !== null && t < bestT) {
            bestT = t;
            bestBot = bot;
          }
        }

        const end: [number, number, number] = [
          origin[0] + shotDir.x * bestT,
          origin[1] + shotDir.y * bestT,
          origin[2] + shotDir.z * bestT,
        ];
        tracers.current.push({
          id: nextId.current++,
          from: origin,
          to: end,
          ttl: now + (id === 'lightning' ? 60 : 140),
          kind: id,
        });

        if (bestBot) {
          hitAny = true;
          bestBot.health -= spec.damage * quad;
          if (bestBot.health <= 0) killBot(bestBot, now);
        }
      }

      if (hitAny) {
        hits.current += 1;
        playHit();
      }
      if (id === 'rail') playRail();
      else if (id === 'mg') playMg();
      else if (id === 'shotgun') playShotgun();
      else playLightning();

      if (id !== 'rail' && ammoOf(id) <= 0) weapon.current = 'rail';
      return;
    }

    // ── projektily: raketa / plazma ─────────────────────────────────
    const projectile = id === 'plasma' ? WEAPONS.plasma : WEAPONS.rocket;
    if (ammoOf(id) <= 0) {
      weapon.current = 'rail';
      return;
    }
    spendAmmo(id);
    cooldown.current = now + projectile.cooldownMs / 1000;
    if (id === 'plasma') playPlasma();
    else playRocket();
    rockets.current.push({
      id: nextId.current++,
      kind: id === 'plasma' ? 'plasma' : 'rocket',
      x: origin[0] + dir.x * 0.6,
      y: origin[1] + dir.y * 0.6,
      z: origin[2] + dir.z * 0.6,
      damage: projectile.damage * quad,
      splash: projectile.splash * quad,
      owner: 'player',
      ownerName: '',
      vx: dir.x * projectile.speed,
      vy: dir.y * projectile.speed,
      vz: dir.z * projectile.speed,
      ttl: now + projectile.ttlMs,
    });
  }

  function pushFeed(kind: 'frag' | 'death', text: string, now: number) {
    feed.current.push({ id: nextId.current++, text, kind, until: now + 4500 });
    // Strop 5 řádků — delší feed by zakryl obraz a nikdo ho nečte.
    if (feed.current.length > 5) feed.current.shift();
  }

  function killBot(bot: BotState, now: number) {
    bot.alive = false;
    bot.health = 0;
    bot.respawnAt = now + BOT_RESPAWN * 1000;
    frags.current += 1;
    pushFeed('frag', `You fragged ${bot.name}`, now);
    playFrag();
    if (frags.current >= FRAG_LIMIT && !finished.current) endMatch('frags');
  }

  function damagePlayer(amount: number, now: number, source?: string) {
    if (now < deadUntil.current) return;
    const absorbed = Math.min(armor.current, Math.round(amount * ARMOR_ABSORB));
    armor.current -= absorbed;
    health.current -= amount - absorbed;
    if (health.current > 0) playHurt();
    if (health.current <= 0) {
      health.current = 0;
      deaths.current += 1;
      deadUntil.current = now + RESPAWN_TIME * 1000;
      pushFeed('death', source ? `${source} fragged you` : 'You died', now);
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
    // Hamburger menu (2026-11-10) — pauza patří do modulu, ne do každé hry.
    if (isGamePaused()) return;
    const now = performance.now();
    const dt = Math.min(0.05, delta);

    // Klik na zbraň v HUD (Q3 lišta) — request z Reactu, aplikace v simu.
    const requested = weaponRequest?.current;
    if (requested) {
      weaponRequest!.current = null;
      if (requested === 'rail' || ammoOf(requested) > 0) weapon.current = requested;
    }

    timeLeft.current = Math.max(0, MATCH_SECONDS - (now - startedAt.current) / 1000);
    if (timeLeft.current <= 0 && !finished.current) endMatch('time');

    const dead = now < deadUntil.current;

    // hráč
    if (!dead) {
      // dotyk (mobil) — pohled se aplikuje tady, pohyb jde do stejných čísel
      // Dotykové ZB cyklí všech šest zbraní; na prázdnou se nepřepíná.
      const TOUCH_WEAPONS: WeaponId[] = ['rail', 'rocket', 'mg', 'shotgun', 'lightning', 'plasma'];
      const touchInput = readTouch(touch, view, (next) => {
        const id = TOUCH_WEAPONS[next] ?? 'rail';
        if (id === 'rail' || ammoOf(id) > 0) weapon.current = id;
      });

      const forward = xr
        ? xrHandle.current.forward
        : (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
          (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0) +
          touchInput.forward;
      const strafe = xr
        ? xrHandle.current.strafe
        : (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
          (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) +
          touchInput.strafe;

      // ve VR je „vpřed" tam, kam se dívá hlava — ne kam se dívala myš
      let moveYaw = view.current.yaw;
      if (xr) {
        camera.getWorldDirection(headDir);
        moveYaw = Math.atan2(-headDir.x, -headDir.z);
      }

      stepBody(
        player.current,
        moveYaw,
        {
          forward,
          strafe,
          jump: jumpQueued.current || (xr && keys.current.has('Space')) || touchInput.jump,
          // Haste (Q3): +30 % k maximální rychlosti, dokud běží.
          speed: now < hasteUntil.current ? 1.3 : 1,
        },
        dt,
        solids,
      );
      jumpQueued.current = false;

      if (xr) {
        if (xrHandle.current.firing) fire(now, true);
      } else if (firing.current || touchInput.fire) {
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

    // ── boti: jeden mozek jako v MP (sdílený `core/arena/bot.ts`) ────
    const playerTarget: BotTarget = {
      id: 'player',
      x: player.current.x,
      y: player.current.y,
      z: player.current.z,
      alive: !dead,
    };
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

      const options = skillOptions(bot.skill);
      const intent = stepBot(bot.memory, bot.body, [playerTarget], nav, solids, now, dt, options);
      bot.yaw = intent.yaw;
      driveBot(bot.memory, bot.body, intent, dt, solids, BOT_BODY.radius, BOT_BODY.height, options.speed);

      // dostřel: **stejná hitscan cesta jako server** (`pickTarget` proti
      // zásahové kouli), ne 42% pravděpodobnost — jinak by sólo boti byli
      // jiný typ nepřítele než ti v MP
      if (intent.fire && !dead) {
        const dir = aimVector(intent.yaw, intent.pitch);
        const origin = { x: bot.body.x, y: bot.body.y + PLAYER.eye, z: bot.body.z };
        const target = {
          id: 'player',
          x: player.current.x,
          y: player.current.y + PLAYER.height * TARGET_EYE_RATIO,
          z: player.current.z,
          radius: TARGET_RADIUS,
        };
        const distance = Math.hypot(player.current.x - bot.body.x, player.current.z - bot.body.z);
        // Bot volí zbraň podle vzdálenosti; raketu ne pokaždé (aby souboj
        // nebyl jen o výbuších a dal se číst).
        let weaponId = botWeaponFor(distance);
        if (weaponId === 'rocket' && Math.random() > BOT_FIRE.rocketChance) weaponId = 'mg';

        lastBotAttack.current = { name: bot.name, weapon: weaponId };
        if (weaponId === 'rocket') {
          playRocket();
          rockets.current.push({
            id: nextId.current++,
            kind: 'rocket',
            damage: WEAPONS.rocket.damage,
            splash: WEAPONS.rocket.splash,
            owner: 'bot',
            ownerName: bot.name,
            x: origin.x + dir.x * 0.8,
            y: origin.y + dir.y * 0.8,
            z: origin.z + dir.z * 0.8,
            vx: dir.x * WEAPONS.rocket.speed,
            vy: dir.y * WEAPONS.rocket.speed,
            vz: dir.z * WEAPONS.rocket.speed,
            ttl: now + WEAPONS.rocket.ttlMs,
          });
        } else {
          // Hitscan: rail přesně, MG dávkou, brokovnice kuželem. Počty jsou
          // v `BOT_FIRE` — AI nemá simulovat plnou kadenci ani 11 broků.
          const pelletCount =
            weaponId === 'shotgun' ? BOT_FIRE.shotgunPellets : weaponId === 'mg' ? BOT_FIRE.mgBurst : 1;
          const spread =
            weaponId === 'shotgun' ? WEAPONS.shotgun.spread : weaponId === 'mg' ? WEAPONS.mg.spread : 0;
          const damage =
            weaponId === 'shotgun'
              ? WEAPONS.shotgun.damage
              : weaponId === 'mg'
                ? WEAPONS.mg.damage
                : WEAPONS.rail.damage;
          const range =
            weaponId === 'shotgun' ? WEAPONS.shotgun.range : weaponId === 'mg' ? WEAPONS.mg.range : 120;

          for (let pellet = 0; pellet < pelletCount; pellet += 1) {
            const shotDir = spread > 0 ? spreadVector(dir, spread) : dir;
            const shot = pickTarget(origin, shotDir, solids, [target], range);
            const end = shot?.point ?? {
              x: origin.x + shotDir.x * range,
              y: origin.y + shotDir.y * range,
              z: origin.z + shotDir.z * range,
            };
            tracers.current.push({
              id: nextId.current++,
              from: [origin.x, origin.y, origin.z],
              to: [end.x, end.y, end.z],
              ttl: now + 90,
              kind: weaponId,
            });
            if (shot?.id === 'player') damagePlayer(damage, now, bot.name);
          }
          if (weaponId === 'shotgun') playShotgun();
          else if (weaponId === 'mg') playMg();
          else playRail();
        }
      }
    }

    // rakety
    if (rockets.current.length) {
      const survivors: Rocket[] = [];
      for (const rocket of rockets.current) {
        // Plazma letí stejnou fyzikou, jen má jiná čísla — jedno místo,
        // žádná druhá smyčka pro každý projektil.
        const spec = rocket.kind === 'plasma' ? WEAPONS.plasma : WEAPONS.rocket;
        const nx = rocket.x + rocket.vx * dt;
        const ny = rocket.y + rocket.vy * dt;
        const nz = rocket.z + rocket.vz * dt;
        rocket.x = nx;
        rocket.y = ny;
        rocket.z = nz;

        let exploded = now > rocket.ttl;

        // Přímý zásah: hráčova raketa hledá boty, botova hráče. Bez ohledu na
        // vlastníka by si bot hned na startu trefil vlastní projektil.
        if (rocket.owner === 'player') {
          for (const bot of bots.current) {
            if (!bot.alive) continue;
            const d = Math.hypot(
              rocket.x - bot.body.x,
              rocket.y - (bot.body.y + BOT_BODY.height * 0.5),
              rocket.z - bot.body.z,
            );
            if (d < 1.1) {
              bot.health -= rocket.damage;
              if (bot.health <= 0) killBot(bot, now);
              exploded = true;
              break;
            }
          }
        } else {
          const d = Math.hypot(
            rocket.x - player.current.x,
            rocket.y - (player.current.y + PLAYER.height * 0.5),
            rocket.z - player.current.z,
          );
          if (d < 1.1) {
            damagePlayer(rocket.damage, now, rocket.ownerName);
            exploded = true;
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
          if (rocket.owner === 'player') {
            for (const bot of bots.current) {
              if (!bot.alive) continue;
              const d = Math.hypot(
                rocket.x - bot.body.x,
                rocket.y - (bot.body.y + BOT_BODY.height * 0.5),
                rocket.z - bot.body.z,
              );
              if (d < spec.radius) {
                bot.health -= Math.round(rocket.splash * (1 - d / spec.radius));
                if (bot.health <= 0) killBot(bot, now);
              }
            }
            // Vlastní raketa bolí i tebe (Q3) — nutí to nestřílet na blízko.
            const selfDist = Math.hypot(
              rocket.x - player.current.x,
              rocket.y - (player.current.y + 1),
              rocket.z - player.current.z,
            );
            if (selfDist < spec.radius * 0.8) {
              damagePlayer(Math.round(rocket.splash * (1 - selfDist / (spec.radius * 0.8))), now);
            }
          } else {
            const d = Math.hypot(
              rocket.x - player.current.x,
              rocket.y - (player.current.y + 1),
              rocket.z - player.current.z,
            );
            if (d < spec.radius) {
              damagePlayer(Math.round(rocket.splash * (1 - d / spec.radius)), now, rocket.ownerName);
            }
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
      } else if (pickup.kind === 'powerup') {
        // Powerupy (Q3): Quad ×3 dmg / Haste +30 % rychlosti, 30 s.
        if (pickup.powerup === 'quad') {
          if (now < quadUntil.current) continue;
          quadUntil.current = now + 30_000;
          playQuad();
        } else if (pickup.powerup === 'haste') {
          if (now < hasteUntil.current) continue;
          hasteUntil.current = now + 30_000;
          playQuad();
        } else {
          continue;
        }
      } else if (pickup.kind === 'mega') {
        // Mega Health: doplní do 200; nad 100 se pak 1 HP/s vytrácí.
        if (health.current >= 200) continue;
        health.current = Math.min(200, Math.max(health.current, 100) + 100);
        playPickup();
      } else if (pickup.kind === 'ammo') {
        // Q3 ammo box dobije všechny typy, které nejsou plné. Když je plno
        // všude, pickup zůstane ležet — jinak by mizel bez užitku.
        const before =
          ammo.current + mgAmmo.current + shotgunAmmo.current + lightningAmmo.current + plasmaAmmo.current;
        ammo.current = Math.min(WEAPONS.rocket.ammo, ammo.current + 5);
        mgAmmo.current = Math.min(WEAPONS.mg.ammo, mgAmmo.current + MG_AMMO_PICKUP);
        shotgunAmmo.current = Math.min(WEAPONS.shotgun.ammo, shotgunAmmo.current + WEAPONS.shotgun.pickup);
        lightningAmmo.current = Math.min(WEAPONS.lightning.ammo, lightningAmmo.current + WEAPONS.lightning.pickup);
        plasmaAmmo.current = Math.min(WEAPONS.plasma.ammo, plasmaAmmo.current + WEAPONS.plasma.pickup);
        const after =
          ammo.current + mgAmmo.current + shotgunAmmo.current + lightningAmmo.current + plasmaAmmo.current;
        if (after === before) continue;
      } else {
        if (armor.current >= 100) continue;
        armor.current = Math.min(100, armor.current + 50);
      }
      pickup.until = now + pickup.respawn * 1000;
      playPickup();
    }

    // Mega Health: nad 100 se zdraví vytrácí (Q3 ~1 HP/s).
    if (health.current > 100) health.current = Math.max(100, health.current - dt);

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
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.color.set(rocket.kind === 'plasma' ? '#7fe3ff' : '#ffd166');
      });
    }

    if (tracerGroup.current) {
      const pool = tracerGroup.current.children;
      pool.forEach((child, index) => {
        const tracer = tracers.current[index];
        child.visible = Boolean(tracer);
        if (!tracer) return;
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.color.set(TRACER_COLOR[tracer.kind] ?? '#ffe9a8');
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

    // ── HUD (posílat jen při změně, max 10×/s) ──
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const stats: ArenaStats = {
        health: Math.max(0, Math.round(health.current)),
        armor: Math.max(0, Math.round(armor.current)),
        frags: frags.current,
        deaths: deaths.current,
        weapon: weapon.current,
        ammo: Number.isFinite(ammoOf(weapon.current)) ? ammoOf(weapon.current) : 0,
        botsAlive: bots.current.filter((bot) => bot.alive).length,
        timeLeft: Math.ceil(timeLeft.current),
        respawnIn: Math.max(0, Math.ceil((deadUntil.current - now) / 1000)),
        quadIn: Math.max(0, Math.ceil((quadUntil.current - now) / 1000)),
        hasteIn: Math.max(0, Math.ceil((hasteUntil.current - now) / 1000)),
        accuracy: shots.current > 0 ? Math.round((hits.current / shots.current) * 100) : 0,
        feed: feed.current
          .filter((entry) => entry.until > now)
          .map((entry) => ({ id: entry.id, text: entry.text, kind: entry.kind })),
        ammoByWeapon: {
          rail: -1,
          rocket: ammo.current,
          mg: mgAmmo.current,
          shotgun: shotgunAmmo.current,
          lightning: lightningAmmo.current,
          plasma: plasmaAmmo.current,
        },
      };
      const key = JSON.stringify(stats);
      if (key !== lastStats.current) {
        lastStats.current = key;
        onStats(stats);
      }
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
        {ARENA_SOLO_PICKUPS.map((pickup) => (
          <mesh key={pickup.id} visible={false}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshBasicMaterial
              color={
                pickup.kind === 'health' || pickup.kind === 'mega'
                  ? '#9cff8a'
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
      </group>
    </>
  );
}
