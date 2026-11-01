/**
 * Render quality tiers for the shared project scenes.
 *
 * One detection pass decides how much renderer a device gets: DPR, post-processing,
 * shadow resolution and procedural texture size. Scenes read the result instead of
 * hard-coding numbers per canvas, so a phone and a desktop show the same art direction
 * at different costs.
 *
 * Override for reviews: `?quality=low|mid|high` (never persisted).
 */

export type QualityTier = 'A' | 'B' | 'C';

export interface QualitySettings {
  tier: QualityTier;
  /** Max device pixel ratio handed to the canvas. */
  dpr: number;
  post: boolean;
  bloom: boolean;
  smaa: boolean;
  shadowMapSize: number;
  /** Shadow map refreshes per second; 0 disables shadows entirely. */
  shadowRefreshHz: number;
  anisotropy: number;
  /** Edge size for procedural textures. */
  textureSize: number;
  /** Env map intensity multiplier. */
  envIntensity: number;
}

const SETTINGS: Record<QualityTier, QualitySettings> = {
  A: { tier: 'A', dpr: 1.75, post: true, bloom: true, smaa: true, shadowMapSize: 2048, shadowRefreshHz: 2, anisotropy: 8, textureSize: 512, envIntensity: 1 },
  B: { tier: 'B', dpr: 1.5, post: true, bloom: true, smaa: false, shadowMapSize: 1024, shadowRefreshHz: 2, anisotropy: 4, textureSize: 384, envIntensity: 1 },
  C: { tier: 'C', dpr: 1.25, post: false, bloom: false, smaa: false, shadowMapSize: 1024, shadowRefreshHz: 0, anisotropy: 2, textureSize: 256, envIntensity: 1 },
};

let cached: QualitySettings | null = null;

function override(): QualityTier | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('quality');
  if (value === 'high') return 'A';
  if (value === 'mid') return 'B';
  if (value === 'low') return 'C';
  return null;
}

function detect(): QualityTier {
  if (typeof window === 'undefined') return 'B';
  const forced = override();
  if (forced) return forced;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const saveData = nav.connection?.saveData === true;
  if (saveData) return 'C';
  if (coarse && (narrow || memory <= 4 || cores <= 4)) return 'C';
  if (memory <= 4 || cores <= 4 || (coarse && memory < 8)) return 'B';
  return 'A';
}

/** Resolved quality for this browser session (stable for the page lifetime). */
export function quality(): QualitySettings {
  if (!cached) cached = SETTINGS[detect()];
  return cached;
}

/** Force a tier (tests, comparisons); `null` restores detection. */
export function setQualityTier(tier: QualityTier | null): void {
  cached = tier ? SETTINGS[tier] : null;
}
