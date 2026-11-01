import type { ArenaBox } from './map';

/**
 * Fyzika arény — Quake 3 model, jeden soubor pro klienta i server.
 *
 * **Proč Q3 a ne „arkáda“:** v Quake 3 je pohyb složen ze tří čísel
 * (z `bg_pmove.c`, id-Software/Q3-Arena):
 *
 *  1. `PM_Friction` — tření se aplikuje **každý snímek na zemi**, i když
 *     držíš klávesu. Bez toho by hráč „klouzal“ a zrychlování by nemělo
 *     stabilní rychlost. Pod touto rychlostí se použije `pm_stopspeed`
 *     (kvůli mrtvému zastavení u cíle).
 *  2. `PM_Accelerate` — zrychlení se počítá **proti aktuální rychlosti ve
 *     směru pohybu**: `addspeed = wishspeed − (rychlost · směr)`. Proto
 *     můžeš otočit a zrychlit nad rychlost samotného pohybu (strafe jump)
 *     a proto není diagonála rychlejší.
 *  3. `PM_AirMove` — ve vzduchu je zrychlení `pm_airaccelerate` (1 proti 10
 *     na zemi) a žádné tření. Vzduch tedy „nese“ rychlost a umožňuje
 *     strafe jump; na zemi se rychlost zase ustálí.
 *
 * Měřítko: Q3 hráč je 56 jednotek ≈ 1,75 m → **1 jednotka = 0,03125 m**.
 * Q3 `pm_maxspeed` 320 u/s = 10 m/s, `g_gravity` 800 u/s² = 25 m/s²,
 * `JUMP_VELOCITY` 270 u/s = 8,44 m/s, `pm_stopspeed` 100 u/s = 3,13 m/s.
 *
 * Tělo je svislý AABB (válec aproximovaný krabicí). Pohyb se řeší po osách:
 * posun → nalezení překryvu → vytlačení na líc krabice. Díky tomu se
 * nedá projít zdí ani propadnout podlahou.
 */

export interface Body {
  x: number;
  y: number; // spodek (nohy)
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  /** Skok v Q3 vyžaduje **puštění** tlačítka (aby se nehopal). */
  jumpHeld?: boolean;
}

export const PLAYER = { radius: 0.42, height: 1.75, eye: 1.6 };
export const BOT_BODY = { radius: 0.45, height: 1.7 };

/** Q3 konstanty přepočtené na metry (1 u = 0,03125 m). */
export const Q3 = {
  /** `pm_maxspeed` 320 u/s. */
  maxSpeed: 10,
  /** `pm_stopspeed` 100 u/s — pod ní tření zabíjí rychlost razem. */
  stopSpeed: 3.125,
  /** `pm_friction` 6. */
  friction: 6,
  /** `pm_accelerate` 10 (zrychlení = accel · dt · wishspeed). */
  accel: 10,
  /** `pm_airaccelerate` 1. */
  airAccel: 1,
  /** `g_gravity` 800 u/s² = 25 m/s². */
  gravity: 25,
  /** `JUMP_VELOCITY` 270 u/s = 8,44 m/s. */
  jumpSpeed: 8.4375,
  /** Výška schodu, kterou hráč vyšoupne bez skoku (Q3 `step`). */
  stepHeight: 0.55,
} as const;

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

function anyOverlap(
  body: Body,
  radius: number,
  height: number,
  solids: Box4[],
): boolean {
  for (const box of solids) {
    if (overlaps(body, radius, height, box)) return true;
  }
  return false;
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

/**
 * Q3 „step up“: vejde-li se na hranu krabice, která je níž než `stepHeight`,
 * hráč na ni vyjde bez skoku. Bez toho se ve schodech zasekává.
 *
 * Hrana musí být **vedle hráče** (dotýkat se jeho obdélníku) — jinak by
 * hráč vyskočil na plošinu, která je metr od něj.
 */
function tryStepUp(
  body: Body,
  radius: number,
  height: number,
  solids: Box4[],
  stepHeight: number,
): boolean {
  for (const box of solids) {
    const rise = box.maxY - body.y;
    if (rise <= 0.02 || rise > stepHeight) continue;
    // musí na ni dosáhnout nohou
    const nearX = body.x + radius > box.minX && body.x - radius < box.maxX;
    const nearZ = body.z + radius > box.minZ && body.z - radius < box.maxZ;
    if (!nearX || !nearZ) continue;
    const probe: Body = { ...body, y: box.maxY + 0.001 };
    if (anyOverlap(probe, radius, height, solids)) continue;
    body.y = probe.y;
    body.vy = 0;
    return true;
  }
  return false;
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

/**
 * Jeden krok fyziky — Q3 model.
 *
 * Pořadí je jako v `bg_pmove.c`: tření → zrychlení → skok → gravitace →
 * pohyb po osách (se schodem).
 */
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
  const speedMul = input.speed ?? 1;
  const gravity = input.gravity ?? Q3.gravity;
  const jumpSpeed = input.jumpSpeed ?? Q3.jumpSpeed;

  // 1) tření (Q3 PM_Friction) — na zemi, každý snímek, i při stisknuté klávesě
  if (body.onGround) {
    const speed = Math.hypot(body.vx, body.vz);
    if (speed < 0.05) {
      body.vx = 0;
      body.vz = 0;
    } else {
      const control = Math.max(speed, Q3.stopSpeed);
      const drop = control * Q3.friction * step;
      const newspeed = Math.max(0, speed - drop);
      const scale = newspeed / speed;
      body.vx *= scale;
      body.vz *= scale;
    }
  }

  // 2) zrychlení (Q3 PM_Accelerate) — proti rychlosti ve směru pohybu
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const wishX = -sin * input.forward + cos * input.strafe;
  const wishZ = -cos * input.forward - sin * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);

  if (wishLen > 0.001) {
    const nx = wishX / wishLen;
    const nz = wishZ / wishLen;
    const wishSpeed = Q3.maxSpeed * speedMul;
    const current = body.vx * nx + body.vz * nz;
    const addspeed = wishSpeed - current;
    if (addspeed > 0) {
      const accel = body.onGround ? Q3.accel : Q3.airAccel;
      const accelSpeed = Math.min(accel * step * wishSpeed, addspeed);
      body.vx += accelSpeed * nx;
      body.vz += accelSpeed * nz;
    }
  }

  // 3) skok — Q3 vyžaduje puštění tlačítka (jinak se hopal donekonečna)
  if (!input.jump) body.jumpHeld = false;
  if (input.jump && !body.jumpHeld && body.onGround) {
    body.vy = jumpSpeed;
    body.onGround = false;
  }
  if (input.jump) body.jumpHeld = true;

  // 4) gravitace
  body.vy -= gravity * step;

  // 5) pohyb po osách + schod
  body.onGround = false;
  moveAxis(body, radius, height, 1, body.vy * step, solids);
  const blockedX = moveAxis(body, radius, height, 0, body.vx * step, solids);
  const blockedZ = moveAxis(body, radius, height, 2, body.vz * step, solids);
  if ((blockedX || blockedZ) && body.onGround) {
    tryStepUp(body, radius, height, solids, Q3.stepHeight);
  }

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

/** Nejbližší zásah stěny v daném směru (pro raily a lasery). */
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
