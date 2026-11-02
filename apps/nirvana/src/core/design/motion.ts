/**
 * Jednotný návrhový systém pohybu — všechny přechody v aplikaci.
 *
 * Dřív měl každý povrch vlastní číslo: `dt*4.5` (Venuše), `0.15` (pouť),
 * `delta*9` (druhá kamera pouti), `k` (souboj), CSS `220ms` / `320ms` / `340ms`.
 * Výsledek: stejná akce („přiblížit / otevřít / přejet“) vypadala na každé
 * obrazovce jinak rychlá a jinak plynulá.
 *
 * Tenhle modul drží **jedna čísla**:
 *
 *   MOTION.fast/base/slow   … doby pro CSS přechody (ms přes `motionCss()`)
 *   MOTION.veil             … závoj mezi scénou a portálem
 *   MOTION.fly              … přelet kamery mezi body (LinkEngine)
 *   MOTION.followRate       … exponenciální dohánění pohyblivého cíle (1/s)
 *   easeOutCubic / easeInOutCubic … jedna easing křivka pro 3D
 *
 * `dampFactor(delta, rate)` je frame-rate independent: `1 - e^(-rate·Δt)`.
 * Nahrazuje `Math.min(1, dt * 4.5)` i `0.15` — při 60 fps dává stejný pocit
 * jako dřív, ale při 15 fps nezpomalí na polovinu.
 *
 * CSS protějšek je v `globals.css` (`--zion-motion-*`, `--zion-ease*`);
 * hodnoty musí zůstat v syncu (jedno místo = tenhle soubor + `:root`).
 */

export const MOTION = {
  /** Rychlé mikrointerakce: hover, fokus, chip. */
  fast: 0.16,
  /** Běžný přechod: panel, tlačítko, okno. */
  base: 0.24,
  /** Pomalejší, výraznější přechod. */
  slow: 0.36,
  /** Závoj při otevření/zavření portálu. */
  veil: 0.45,
  /** Přelet kamery mezi dvěma body vesmíru. */
  fly: 1.6,
  /** Rychlost dohánění pohyblivého cíle (1/s) — ~0,15 na snímek při 60 fps. */
  followRate: 9,
  /** CSS easing (odpovídá `--zion-ease`). */
  easeCss: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** CSS easing pro výjezdy (odpovídá `--zion-ease-out`). */
  easeOutCss: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/** Sekundy → CSS čas (`0.24` → `240ms`). */
export function motionCss(seconds: number): string {
  return `${Math.round(seconds * 1000)}ms`;
}

/** Frame-rate independent dohánění: kolik z rozdílu dohnat za `delta`. */
export function dampFactor(delta: number, rate: number = MOTION.followRate): number {
  return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, delta));
}

/** Skalární dohánění (pozice, rotace, opacity…). */
export function damp(current: number, target: number, delta: number, rate?: number): number {
  return current + (target - current) * dampFactor(delta, rate);
}

/** Vektorové dohánění do `target` (mutuje `current`, vrací ho). */
export function dampVec3(
  current: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  delta: number,
  rate?: number,
): { x: number; y: number; z: number } {
  const k = dampFactor(delta, rate);
  current.x += (target.x - current.x) * k;
  current.y += (target.y - current.y) * k;
  current.z += (target.z - current.z) * k;
  return current;
}

/** Ease-out kubická — pro přelety kamery. */
export function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - p, 3);
}

/** Ease-in-out kubická — pro symetrické přechody. */
export function easeInOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
