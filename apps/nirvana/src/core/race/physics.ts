/**
 * VENUŠE — fyzika závodního vozu.
 *
 * Jeden model pro hráče i pro soupeře. Kdyby měli boti vlastní „AI fyziku“,
 * nebyl by závod fér: rozdíl by dělala pravidla, ne um. Boti proto dostávají
 * jen jiné **rozhodování** (kdy brzdí, kudy řežou zatáčku), stejné integrátory.
 *
 * Model je arkádový, ne simulace: rychlost se drží jako **světový vektor**
 * (`vx`,`vz`) a každým krokem se rozkládá do osy vozu — dopředu (`vf`) a
 * stranou (`vl`). Pneumatiky boční složku potlačují (`LATERAL_GRIP`); ruční
 * brzda grip uvolní a yaw autorita vzroste, takže vůz zatáčí dřív, než
 * zdrží rychlost — to je drift. `speed` zůstává **dopředná** rychlost (to,
 * co ukazuje HUD a snapshot), ne velikost vektoru.
 *
 * Nitro je samostatná nádrž `nitro` 0..1: boost tlačítko (`input.boost`)
 * přidává tah a zvedá strop, dráha je na maximu. Nádrž se doplňuje pomalu
 * a **rychleji při driftu** — jako v Need for Speed.
 */

import { TRACK_WIDTH, lateralOffset, nearestSample, type TrackPoint } from './track';

/** Strop bez boostu (~187 km/h). */
export const MAX_SPEED = 52;
/** Strop s nitrem (~274 km/h). */
export const BOOST_SPEED = 76;
export const ACCEL = 32;
/** Brzda je výrazně silnější než plynovka — pozdní brzdný bod je playable. */
export const BRAKE = 60;
export const REVERSE_ACCEL = 18;
export const REVERSE_MAX = -14;
/** Odpor: lineární + kvadratický (druhý drží top speed pod `MAX_SPEED`). */
export const DRAG_LIN = 0.45;
export const DRAG_QUAD = 0.0032;
/** Tah navíc při nitru. */
export const BOOST_ACCEL = 26;
/** Nádrž nitra. */
export const NITRO_MAX = 1;
export const NITRO_DRAIN = 0.32;
export const NITRO_REGEN = 0.06;
/** Drift dobíjí nádrž — odměna za kontrolovaný smyk. */
export const NITRO_DRIFT = 0.18;
export const STEER = 2.4;
/** Kolaps boční rychlosti (1/s). Normál = pneu drží; ručka je pustí. */
export const LATERAL_GRIP = 9.0;
export const LATERAL_GRIP_DRIFT = 2.0;
/** Podélné zpomalení při držení ručky (u/s²). */
export const HANDRAKE_SCRUB = 4.0;
/** Násobek yaw autority při driftu — vůz se otočí dřív než zdrží. */
export const HANDRAKE_YAW = 1.5;
export const LATERAL_WALL = TRACK_WIDTH / 2 - 0.6;
export const LATERAL_WARN = TRACK_WIDTH / 2 - 1.5;

/** Po nárazu do okraje se další náraz nepočítá — jinak by zeď brzdila trvale. */
const IMPACT_COOLDOWN_MS = 420;

export interface Craft {
  x: number;
  z: number;
  heading: number;
  /** Rychlost **vpřed** (záporná = couvá). Pro HUD a snapshoty. */
  speed: number;
  /** Světová rychlost — drifty mají `vl` složku, kterou `speed` nevidí. */
  vx: number;
  vz: number;
  /** Nádrž nitra 0..1. */
  nitro: number;
  /** Index nejbližšího vzorku tratě (hint pro `nearestSample`). */
  sample: number;
  /** performance.now() posledního nárazu do okraje. */
  impactAt: number;
}

/** Plyn/brzda a zatáčení, každé v −1..1. */
export interface CraftInput {
  throttle: number;
  steer: number;
  /** Ruční brzda 0..1 — uvolní boky a roztočí auto do driftu. */
  handbrake?: number;
  /** Nitro 0..1 — táhne a zvedá strop, dokud je nádrž. */
  boost?: number;
}

export interface CraftStep {
  /** Nejbližší vzorek tratě po posunu. */
  index: number;
  /** Stranová odchylka od osy tratě v metrech (＋ = vlevo od středu). */
  lateral: number;
  /** Blíží se okraji (varování v HUD). */
  offTrack: boolean;
  /** Právě teď přišel náraz do okraje. */
  hitWall: boolean;
  /** Záměrný smyk (ručka + boční rychlost) — pro kouř, HUD a nitro regen. */
  drifting: boolean;
  /** Nitro právě táhne (tlačítko + nádrž > 0). */
  boosting: boolean;
  /** Boční složka rychlosti (＋ = uklouzl doprava) — pro náklon karoserie. */
  slide: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Úhel do (−π, π]. */
export function wrapAngle(angle: number): number {
  return ((angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Vozidlo na startu/roštu: na vzorku tratě, posunuté stranou. */
export function spawnCraft(track: TrackPoint[], sampleIndex: number, lateral = 0): Craft {
  const index = ((sampleIndex % track.length) + track.length) % track.length;
  const point = track[index]!;
  return {
    x: point.x + point.nx * lateral,
    z: point.z + point.nz * lateral,
    heading: Math.atan2(point.tx, point.tz),
    speed: 0,
    vx: 0,
    vz: 0,
    nitro: NITRO_MAX,
    sample: index,
    impactAt: 0,
  };
}

/**
 * Jeden krok fyziky. Mutuje `craft` a vrací, co se stalo (pro HUD a testy).
 *
 * Rychlost se drží jako světový vektor, takže zatáčení **neunáší** vektor
 * rychlosti — jen natočí osu vozu. Rozdíl mezi osami je `vl` (boční složka),
 * kterou pneumatiky potlačují (`LATERAL_GRIP`). To je celá podstata driftu:
 * auto se otočí, hmotnost jede dál.
 *
 * Okraj tratě je **zeď, ne pružina**: náraz zpomalí jednou, pak po něm vozidlo
 * klouže. Při klampování se zachovává podélný postup — bez toho auto ve zdi
 * zamrzne (přesně tahle chyba se stala při prvním pokusu).
 */
export function stepCraft(
  craft: Craft,
  input: CraftInput,
  track: TrackPoint[],
  dt: number,
  now: number,
): CraftStep {
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  const handbrake = clamp(input.handbrake ?? 0, 0, 1);
  const boost = clamp(input.boost ?? 0, 0, 1);

  // ── osa vozu (stará heading — yaw se mění až za silami) ──
  const fx = Math.sin(craft.heading);
  const fz = Math.cos(craft.heading);
  const rx = Math.cos(craft.heading);
  const rz = -Math.sin(craft.heading);

  // ── rozklad světové rychlosti do osy vozu ──
  let vf = craft.vx * fx + craft.vz * fz;
  let vl = craft.vx * rx + craft.vz * rz;

  // ── podélná dynamika ──
  const wantBoost = boost > 0 && craft.nitro > 0.02;
  const top = wantBoost ? BOOST_SPEED : MAX_SPEED;
  if (throttle > 0) {
    // měkký strop: plyn dotahuje jen do `top`, pak táhne jen odpor
    const room = top - vf;
    if (room > 0) vf += Math.min(ACCEL * throttle * dt, room);
    if (wantBoost) {
      const boostRoom = BOOST_SPEED - vf;
      if (boostRoom > 0) vf += Math.min(BOOST_ACCEL * dt, boostRoom);
    }
  } else if (throttle < 0) {
    // brzda nad ~1 m/s, couvání pod ním — plyn/brzda je jedno táhlo
    vf += (vf > 1 ? throttle * BRAKE : throttle * REVERSE_ACCEL) * dt;
  }
  vf -= vf * DRAG_LIN * dt;
  vf -= Math.sign(vf) * vf * vf * DRAG_QUAD * dt;
  if (handbrake > 0) vf -= Math.sign(vf) * HANDRAKE_SCRUB * handbrake * dt;
  vf = clamp(vf, REVERSE_MAX, BOOST_SPEED);

  // ── příčná: pneumatiky drží směr, ručka je pustí ──
  const grip = LATERAL_GRIP + (LATERAL_GRIP_DRIFT - LATERAL_GRIP) * handbrake;
  vl *= Math.exp(-grip * dt);

  // ── zatáčení: citlivost za snížené rychlosti, stabilita s rostoucí ──
  const speedAbs = Math.abs(vf);
  const authority = Math.min(1, speedAbs / 6) / (1 + speedAbs * 0.009);
  const driftAuthority = 1 + handbrake * (HANDRAKE_YAW - 1);
  craft.heading += steer * STEER * dt * authority * driftAuthority * (vf < 0 ? -1 : 1);

  // ── drift a nitro (nádrž se doplňuje, drift ji nabíjí) ──
  // Drift = záměrný smyk: ruční brzda + boční rychlost. Bez ručky se i prudké
  // zatáčení nepočítá — jinak by se nitro dalo farmit obyčejnou jízdou.
  const drifting = handbrake > 0.2 && Math.abs(vl) > 2 && speedAbs > 7;
  if (wantBoost) {
    craft.nitro = Math.max(0, craft.nitro - NITRO_DRAIN * boost * dt);
  } else {
    craft.nitro = Math.min(NITRO_MAX, craft.nitro + (NITRO_REGEN + (drifting ? NITRO_DRIFT : 0)) * dt);
  }

  // ── slož zpět do světa (stará osa — yaw vektor rychlosti netočí) ──
  craft.vx = fx * vf + rx * vl;
  craft.vz = fz * vf + rz * vl;
  craft.x += craft.vx * dt;
  craft.z += craft.vz * dt;

  // `speed` = dopředná složka v **nové** ose — přesně to, co ukazuje tachometr
  craft.speed = craft.vx * Math.sin(craft.heading) + craft.vz * Math.cos(craft.heading);

  // ── trať: nejbližší vzorek, zeď, varování ──
  const index = nearestSample(track, craft.x, craft.z, craft.sample);
  craft.sample = index;
  const point = track[index]!;
  const lateral = lateralOffset(point, craft.x, craft.z);

  let hitWall = false;
  if (Math.abs(lateral) > LATERAL_WALL) {
    if (now - craft.impactAt > IMPACT_COOLDOWN_MS) {
      craft.impactAt = now;
      craft.vx *= 0.8;
      craft.vz *= 0.8;
      hitWall = true;
    }
    const clamped = Math.sign(lateral) * LATERAL_WALL;
    const along = (craft.x - point.x) * point.tx + (craft.z - point.z) * point.tz;
    craft.x = point.x + point.tx * along + point.nx * clamped;
    craft.z = point.z + point.tz * along + point.nz * clamped;

    // zeď seškrábe jen složku rychlosti **do** ní — podél ní slizu smykem
    const vn = craft.vx * point.nx + craft.vz * point.nz;
    if (Math.sign(lateral) * vn > 0) {
      craft.vx -= point.nx * vn;
      craft.vz -= point.nz * vn;
    }

    const tangentYaw = Math.atan2(point.tx, point.tz);
    craft.heading += wrapAngle(tangentYaw - craft.heading) * Math.min(1, dt * 3.2);
    // po alignsHeading se `speed` přepočítá, ať tachometr nelže
    craft.speed = craft.vx * Math.sin(craft.heading) + craft.vz * Math.cos(craft.heading);
  }

  return {
    index,
    lateral,
    offTrack: Math.abs(lateral) > LATERAL_WARN,
    hitWall,
    drifting,
    boosting: wantBoost,
    slide: vl,
  };
}
