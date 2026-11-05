/**
 * Stopa za lucernou (L-3) — čistá logika, žádné three.js.
 *
 * Proč samostatný modul: stopa se **nesmí** vzorkovat každým snímkem.
 * Na 60 fps by z ní bylo 0,3 s, na 20 fps tři sekundy — tedy jiná hra podle
 * výkonu stroje. Vzorkuje se proto **pohybem** (`TRAIL_STEP` jednotek) a
 * doznívá **časem** (`TRAIL_TTL`), a obojí se dá otestovat v Node.
 *
 * Scéna (`LumiScene.tsx`) z toho jen čte a kreslí; nic tady nezná React.
 */

export interface TrailPoint {
  x: number;
  y: number;
  /** Čas vzorku v hodinách scény (s). */
  t: number;
}

/** Kolik jisker stopa unese. Větší číslo = delší ohon, ale víc instancek. */
export const TRAIL_LEN = 24;
/** Minimální vzdálenost, po které se udělá nový vzorek (jednotky mapy). */
export const TRAIL_STEP = 0.55;
/** Jak dlouho jiskra svítí, než zhasne (s). */
export const TRAIL_TTL = 1.3;

export function createTrail(): TrailPoint[] {
  return [];
}

/**
 * Přidá vzorek, pokud se hráčka od posledního dost posunula.
 *
 * Vrací `true`, když se opravdu přidal — volající podle toho pozná, že má
 * překreslit instance. Stání ve vzduchu stopu **nezastaví**: dozníváním
 * (viz `pruneTrail`) se sama zkrátí.
 */
export function pushTrail(points: TrailPoint[], x: number, y: number, now: number): boolean {
  const last = points[points.length - 1];
  if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_STEP) return false;
  points.push({ x, y, t: now });
  while (points.length > TRAIL_LEN) points.shift();
  return true;
}

/** Zahodí jiskry starší než `TRAIL_TTL`. Vrací počet odebraných. */
export function pruneTrail(points: TrailPoint[], now: number): number {
  let removed = 0;
  while (points.length && now - points[0].t > TRAIL_TTL) {
    points.shift();
    removed += 1;
  }
  return removed;
}

/**
 * Jas jiskry 0–1 podle stáří. `1` = právě vznikla, `0` = zhaslá.
 *
 * Používá se jako násobek barvy (aditivní blending: černá = neviditelná),
 * takže se stopa rozpouští plynule a nemusí se měnit `opacity` materiálu
 * (ta je pro všechny instance společná).
 */
export function trailFade(point: TrailPoint, now: number): number {
  const age = (now - point.t) / TRAIL_TTL;
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.min(1, 1 - age));
}
