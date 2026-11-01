import type { ArenaBox } from './map';

/**
 * Fyzika arény — dost malá na to, aby se dala přečíst.
 *
 * Hráč i boti jsou svislé AABB (válec aproximovaný krabicí). Pohyb se řeší
 * po osách: posun → nalezení překryvu → vytlačení na líc krabice. Díky tomu
 * se nedá projít zdí ani propadnout podlahou a schody jdou vyjít.
 */

export interface Body {
  x: number;
  y: number; // spodek (nohy)
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
}

export const PLAYER = { radius: 0.42, height: 1.75, eye: 1.6 };
export const BOT_BODY = { radius: 0.45, height: 1.7 };

export interface Box4 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function toBox(box: ArenaBox): Box4 {
  return {
    minX: box.x - box.w / 2,
    maxX: box.x + box.w / 2,
    minY: box.y,
    maxY: box.y + box.h,
    minZ: box.z - box.d / 2,
    maxZ: box.z + box.d / 2,
  };
}

export function makeSolids(boxes: ArenaBox[]): Box4[] {
  return boxes.map(toBox);
}

function overlaps(
  body: Body,
  radius: number,
  height: number,
  box: Box4,
): boolean {
  return (
    body.x + radius > box.minX &&
    body.x - radius < box.maxX &&
    body.y + height > box.minY &&
    body.y < box.maxY &&
    body.z + radius > box.minZ &&
    body.z - radius < box.maxZ
  );
}

/**
 * Posun o jednu osu s vytlačením. Vrací true, když došlo ke kolizi.
 * `axis` je 0=x, 1=y, 2=z.
 */
function moveAxis(
  body: Body,
  radius: number,
  height: number,
  axis: 0 | 1 | 2,
  delta: number,
  solids: Box4[],
): boolean {
  if (delta === 0) return false;
  if (axis === 0) body.x += delta;
  else if (axis === 1) body.y += delta;
  else body.z += delta;

  let hit = false;
  for (const box of solids) {
    if (!overlaps(body, radius, height, box)) continue;
    hit = true;
    if (axis === 0) {
      body.x = delta > 0 ? box.minX - radius - 0.0001 : box.maxX + radius + 0.0001;
      body.vx = 0;
    } else if (axis === 1) {
      if (delta > 0) {
        body.y = box.minY - height - 0.0001;
        body.vy = 0;
      } else {
        body.y = box.maxY + 0.0001;
        body.vy = 0;
        body.onGround = true;
      }
    } else {
      body.z = delta > 0 ? box.minZ - radius - 0.0001 : box.maxZ + radius + 0.0001;
      body.vz = 0;
    }
  }
  return hit;
}

export interface MoveInput {
  /** −1..1 vpřed (relativně k yaw). */
  forward: number;
  /** −1..1 doprava. */
  strafe: number;
  jump: boolean;
  /** Násobič rychlosti (boti chodí pomaleji). */
  speed?: number;
  gravity?: number;
  jumpSpeed?: number;
}

const GRAVITY = 24;
const JUMP = 7.4;
const ACCEL = 60;
const MAX_SPEED = 7.4;
const FRICTION = 9;

export function stepBody(
  body: Body,
  yaw: number,
  input: MoveInput,
  dt: number,
  solids: Box4[],
  radius = PLAYER.radius,
  height = PLAYER.height,
): void {
  const step = Math.min(0.033, dt);
  const speed = input.speed ?? 1;
  const gravity = input.gravity ?? GRAVITY;

  // vstup → světové souřadnice (kamera kouká po −Z při yaw 0)
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const wishX = -sin * input.forward + cos * input.strafe;
  const wishZ = -cos * input.forward - sin * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);

  if (wishLen > 0.001) {
    const nx = wishX / wishLen;
    const nz = wishZ / wishLen;
    body.vx += nx * ACCEL * step;
    body.vz += nz * ACCEL * step;
    const max = MAX_SPEED * speed;
    const current = Math.hypot(body.vx, body.vz);
    if (current > max) {
      body.vx = (body.vx / current) * max;
      body.vz = (body.vz / current) * max;
    }
  } else if (body.onGround) {
    const drop = Math.max(0, 1 - FRICTION * step);
    body.vx *= drop;
    body.vz *= drop;
  }

  if (input.jump && body.onGround) {
    body.vy = input.jumpSpeed ?? JUMP;
    body.onGround = false;
  }

  body.vy -= gravity * step;

  body.onGround = false;
  moveAxis(body, radius, height, 1, body.vy * step, solids);
  moveAxis(body, radius, height, 0, body.vx * step, solids);
  moveAxis(body, radius, height, 2, body.vz * step, solids);

  // ochrana proti propadnutí (kdyby se hráč dostal mimo mapu)
  if (body.y < -6) {
    body.y = 1;
    body.vy = 0;
  }
}

/** Vidí bod `b` z `a`? Vrací false, když stojí v cestě krabice. */
export function lineOfSight(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  solids: Box4[],
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.001) return true;

  for (const box of solids) {
    const t = rayBox(ax, ay, az, dx, dy, dz, box);
    if (t !== null && t > 0.02 && t < dist - 0.05) return false;
  }
  return true;
}

/** Parametr t průsečíku paprsku s krabicí (slab metoda), nebo null. */
export function rayBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: Box4,
): number | null {
  let tmin = 0;
  let tmax = Number.POSITIVE_INFINITY;

  const axes: Array<[number, number, number, number]> = [
    [ox, dx, box.minX, box.maxX],
    [oy, dy, box.minY, box.maxY],
    [oz, dz, box.minZ, box.maxZ],
  ];

  for (const [origin, dir, min, max] of axes) {
    if (Math.abs(dir) < 1e-8) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const inv = 1 / dir;
    let t1 = (min - origin) * inv;
    let t2 = (max - origin) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Nejblížší zásah stěny v daném směru (pro raily a lasery). */
export function raySolids(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  solids: Box4[],
  maxDist = 120,
): { t: number; point: [number, number, number] } | null {
  let best: number | null = null;
  for (const box of solids) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, box);
    if (t === null || t <= 0.02 || t > maxDist) continue;
    if (best === null || t < best) best = t;
  }
  if (best === null) return null;
  return { t: best, point: [ox + dx * best, oy + dy * best, oz + dz * best] };
}

/** Průsečík paprsku s koulí — pro zásah botů. */
export function raySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): number | null {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  const t0 = tca - thc;
  return t0 >= 0 ? t0 : tca + thc;
}
