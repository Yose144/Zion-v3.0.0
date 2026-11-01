/**
 * VENUŠE — fyzika hovercraftu.
 *
 * Jeden model pro hráče i pro soupeře. Kdyby měli boti vlastní „AI fyziku“,
 * nebyl by závod fér: rozdíl by dělala pravidla, ne um. Boti proto dostávají
 * jen jiné **rozhodování** (kdy brzdí, kudy řežou zatáčku), stejné integrátory.
 */

import { TRACK_WIDTH, lateralOffset, nearestSample, type TrackPoint } from './track';

export const MAX_SPEED = 34;
export const ACCEL = 22;
export const DRAG = 3.4;
export const STEER = 1.9;
export const LATERAL_WALL = TRACK_WIDTH / 2 - 0.6;
export const LATERAL_WARN = TRACK_WIDTH / 2 - 1.5;

/** Po nárazu do okraje se další náraz nepočítá — jinak by zeď brzdila trvale. */
const IMPACT_COOLDOWN_MS = 420;

export interface Craft {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Index nejbližšího vzorku tratě (hint pro `nearestSample`). */
  sample: number;
  /** performance.now() posledního nárazu do okraje. */
  impactAt: number;
}

/** Plyn/brzda a zatáčení, každé v −1..1. */
export interface CraftInput {
  throttle: number;
  steer: number;
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
    sample: index,
    impactAt: 0,
  };
}

/**
 * Jeden krok fyziky. Mutuje `craft` a vrací, co se stalo (pro HUD a testy).
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

  // zrychlení, odpor, zatáčení podle rychlosti
  craft.speed += throttle * ACCEL * dt;
  craft.speed -= craft.speed * DRAG * dt * 0.32;
  craft.speed = clamp(craft.speed, -8, MAX_SPEED);

  const grip = Math.min(1, Math.abs(craft.speed) / 8);
  craft.heading += steer * STEER * dt * grip * (craft.speed < 0 ? -1 : 1);

  craft.x += Math.sin(craft.heading) * craft.speed * dt;
  craft.z += Math.cos(craft.heading) * craft.speed * dt;

  const index = nearestSample(track, craft.x, craft.z, craft.sample);
  craft.sample = index;
  const point = track[index]!;
  const lateral = lateralOffset(point, craft.x, craft.z);

  let hitWall = false;
  if (Math.abs(lateral) > LATERAL_WALL) {
    if (now - craft.impactAt > IMPACT_COOLDOWN_MS) {
      craft.impactAt = now;
      craft.speed *= 0.82;
      hitWall = true;
    }
    const clamped = Math.sign(lateral) * LATERAL_WALL;
    const along = (craft.x - point.x) * point.tx + (craft.z - point.z) * point.tz;
    craft.x = point.x + point.tx * along + point.nx * clamped;
    craft.z = point.z + point.tz * along + point.nz * clamped;
    const tangentYaw = Math.atan2(point.tx, point.tz);
    craft.heading += wrapAngle(tangentYaw - craft.heading) * Math.min(1, dt * 3.2);
  }

  return {
    index,
    lateral,
    offTrack: Math.abs(lateral) > LATERAL_WARN,
    hitWall,
  };
}
