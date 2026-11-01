/**
 * Procedural PBR surfaces for the shared scenes.
 *
 * Everything is generated in the browser from deterministic noise: no binary textures,
 * no network requests, no licence questions. Each surface produces an albedo map and a
 * normal map derived from the same height field, so lighting shows grain instead of
 * flat colour. Results are cached by key; scenes ask for a preset, never for a file.
 *
 * Cost control: generation is ~30-60 ms per surface at 256 px. Keep hero surfaces at
 * 512, background surfaces at 256, and never generate a surface per frame.
 */

import { THREE } from '@genesis/runtime';

import { quality } from './quality';

export interface SurfaceMaps {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  /** Height field retained for callers that need it (bump, displacement). */
  size: number;
}

interface SurfaceSpec {
  key: string;
  size?: number;
  seed?: number;
  /** Height field in 0..1. */
  height: (x: number, y: number, noise: Noise) => number;
  /** Colour for a height value; return an [r,g,b] triple in 0..255. */
  color: (height: number, x: number, y: number, noise: Noise) => [number, number, number];
  normalStrength?: number;
  repeat?: number;
}

const cache = new Map<string, SurfaceMaps>();

/* ── deterministic value noise ─────────────────────────────────────── */

export interface Noise {
  fbm: (x: number, y: number, octaves?: number) => number;
  ridged: (x: number, y: number, octaves?: number) => number;
}

function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function makeNoise(seed = 1): Noise {
  const value = (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
  const fbm = (x: number, y: number, octaves = 4): number => {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += value(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
  const ridged = (x: number, y: number, octaves = 4): number => {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += (1 - Math.abs(value(x * freq, y * freq) * 2 - 1)) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return sum / norm;
  };
  return { fbm, ridged };
}

/* ── canvas helpers ────────────────────────────────────────────────── */

function canvasOf(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function dataTexture(data: Uint8ClampedArray, size: number, srgb: boolean): THREE.Texture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = quality().anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function normalFromHeight(height: Float32Array, size: number, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // Normalise (-dx, -dy, 1) into the 0..1 encoding a normal map expects.
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Build (and cache) an albedo + normal pair from a height/colour description. */
export function surface(spec: SurfaceSpec): SurfaceMaps {
  const cached = cache.get(spec.key);
  if (cached) return cached;
  if (typeof document === 'undefined') {
    const empty: SurfaceMaps = { map: null, normalMap: null, size: 0 };
    cache.set(spec.key, empty);
    return empty;
  }
  const size = spec.size ?? 256;
  const noise = makeNoise(spec.seed ?? 1);
  const heights = new Float32Array(size * size);
  const albedo = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const h = Math.min(1, Math.max(0, spec.height(u, v, noise)));
      heights[y * size + x] = h;
      const [r, g, b] = spec.color(h, u, v, noise);
      const i = (y * size + x) * 4;
      albedo[i] = r;
      albedo[i + 1] = g;
      albedo[i + 2] = b;
      albedo[i + 3] = 255;
    }
  }
  const maps: SurfaceMaps = {
    map: dataTexture(albedo, size, true),
    normalMap: dataTexture(normalFromHeight(heights, size, spec.normalStrength ?? 2), size, false),
    size,
  };
  for (const texture of [maps.map, maps.normalMap]) {
    if (texture) texture.repeat.set(spec.repeat ?? 1, spec.repeat ?? 1);
  }
  cache.set(spec.key, maps);
  return maps;
}

/** Clone a cached texture with its own tiling, without re-uploading the pixels. */
export function tiled(texture: THREE.Texture | null, repeat: number): THREE.Texture | null {
  if (!texture) return null;
  const clone = texture.clone();
  clone.repeat.set(repeat, repeat);
  clone.needsUpdate = true;
  return clone;
}

export function disposeSurfaces(): void {
  for (const maps of cache.values()) {
    maps.map?.dispose();
    maps.normalMap?.dispose();
  }
  cache.clear();
}

/* ── presets ───────────────────────────────────────────────────────── */

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function ramp(h: number, stops: Array<[number, [number, number, number]]>): [number, number, number] {
  let previous = stops[0];
  for (const stop of stops) {
    if (h <= stop[0]) {
      const t = (h - previous[0]) / Math.max(1e-6, stop[0] - previous[0]);
      return [mix(previous[1][0], stop[1][0], t), mix(previous[1][1], stop[1][1], t), mix(previous[1][2], stop[1][2], t)];
    }
    previous = stop;
  }
  return previous[1];
}

const WHITE_MARBLE: Array<[number, [number, number, number]]> = [
  [0, [226, 224, 217]],
  [0.55, [240, 238, 232]],
  [0.82, [250, 249, 245]],
  [1, [255, 254, 251]],
];

const DARK_MARBLE: Array<[number, [number, number, number]]> = [
  [0, [92, 90, 88]],
  [0.6, [120, 116, 112]],
  [0.85, [146, 141, 135]],
  [1, [176, 170, 160]],
];

/** White marble with soft grey veining — Ekam, Amenti, Bodhi stonework. */
export const marble = (size = 512) =>
  surface({
    key: `marble-${size}`,
    size,
    seed: 7,
    normalStrength: 0.6,
    height: (x, y, n) => {
      const turb = n.fbm(x * 3.2, y * 3.2, 4);
      const vein = Math.abs(Math.sin((x * 4.4 + y * 1.2 + turb * 2.6) * Math.PI));
      return 0.5 + turb * 0.12 - Math.pow(vein, 12) * 0.16;
    },
    color: (h) => ramp(h, WHITE_MARBLE),
  });

/** Darker marble for plinths, framing and interior floors. */
export const marbleDark = (size = 256) =>
  surface({
    key: `marble-dark-${size}`,
    size,
    seed: 11,
    normalStrength: 1.6,
    height: (x, y, n) => {
      const turb = n.fbm(x * 3.6, y * 3.6, 4);
      const vein = Math.abs(Math.sin((x * 5.1 + y * 2.4 + turb * 3.1) * Math.PI));
      return 0.4 + turb * 0.3 + Math.pow(vein, 5) * 0.3;
    },
    color: (h) => ramp(h, DARK_MARBLE),
  });

/** Weathered limestone / sandstone for walls, steps and cliffs. */
export const stone = (size = 256, tint: 'warm' | 'cool' = 'warm') =>
  surface({
    key: `stone-${tint}-${size}`,
    size,
    seed: tint === 'warm' ? 21 : 23,
    normalStrength: 3.2,
    height: (x, y, n) => {
      const base = n.fbm(x * 5, y * 5, 5);
      const pits = n.ridged(x * 14, y * 14, 3);
      return base * 0.8 + (1 - pits) * 0.2;
    },
    color: (h, x, y, n) => {
      const grain = n.fbm(x * 22, y * 22, 2) * 0.12;
      return tint === 'warm'
        ? ramp(h + grain, [[0, [122, 108, 92]], [0.5, [164, 148, 126]], [0.8, [190, 176, 152]], [1, [214, 202, 178]]])
        : ramp(h + grain, [[0, [96, 102, 108]], [0.5, [134, 140, 146]], [0.8, [166, 172, 176]], [1, [196, 202, 204]]]);
    },
  });

/** Volcanic basalt / dark rock for Boa Esperança, LUMI, Uluru bases. */
export const basalt = (size = 256) =>
  surface({
    key: `basalt-${size}`,
    size,
    seed: 31,
    normalStrength: 3.8,
    height: (x, y, n) => n.ridged(x * 6, y * 6, 5) * 0.7 + n.fbm(x * 18, y * 18, 3) * 0.3,
    color: (h, x, y, n) => {
      const grain = n.fbm(x * 30, y * 30, 2) * 0.08;
      return ramp(h + grain, [[0, [38, 36, 38]], [0.45, [64, 60, 58]], [0.75, [92, 86, 80]], [1, [124, 116, 106]]]);
    },
  });

/** Loose sand and dune ripples for Giza and beach scenes. */
export const sand = (size = 256) =>
  surface({
    key: `sand-${size}`,
    size,
    seed: 41,
    normalStrength: 0.9,
    height: (x, y, n) => {
      const ripple = Math.sin((x * 18 + n.fbm(x * 3, y * 3, 3) * 7) * Math.PI) * 0.5 + 0.5;
      return n.fbm(x * 8, y * 8, 4) * 0.7 + ripple * 0.3;
    },
    color: (h, x, y, n) => {
      const grain = n.fbm(x * 26, y * 26, 2) * 0.1;
      return ramp(h + grain, [[0, [186, 160, 120]], [0.5, [214, 190, 148]], [0.8, [232, 212, 172]], [1, [245, 230, 198]]]);
    },
  });

/** Grass and scrub ground — Genesis, Te Pīko Ora, Bohemia, Kailash valleys. */
export const grass = (size = 256) =>
  surface({
    key: `grass-${size}`,
    size,
    seed: 53,
    normalStrength: 1.5,
    height: (x, y, n) => {
      const patches = n.fbm(x * 4, y * 4, 4);
      const blades = n.ridged(x * 24, y * 24, 2);
      return patches * 0.65 + blades * 0.35;
    },
    color: (h, x, y, n) => {
      const dry = n.fbm(x * 12 + 7, y * 12 + 3, 3);
      const base = ramp(h, [[0, [58, 78, 44]], [0.45, [86, 108, 58]], [0.75, [112, 130, 72]], [1, [138, 150, 92]]]);
      const t = Math.min(1, Math.max(0, (dry - 0.62) * 2.2));
      return [mix(base[0], 158, t), mix(base[1], 148, t), mix(base[2], 98, t)];
    },
  });

/** Lunar regolith — fine grey dust with micro-craters (Matrix). */
export const regolith = (size = 512) =>
  surface({
    key: `regolith-${size}`,
    size,
    seed: 61,
    normalStrength: 2.8,
    height: (x, y, n) => {
      const dust = n.fbm(x * 9, y * 9, 5);
      const pits = n.ridged(x * 26, y * 26, 3);
      return dust * 0.75 + (1 - pits) * 0.25;
    },
    color: (h, x, y, n) => {
      const grain = n.fbm(x * 34, y * 34, 2) * 0.12;
      return ramp(h + grain, [[0, [76, 74, 72]], [0.45, [112, 109, 105]], [0.75, [142, 138, 132]], [1, [176, 172, 166]]]);
    },
  });

/** Timber — planking for ships, halls and piers. */
export const wood = (size = 256, tone: 'light' | 'dark' = 'dark') =>
  surface({
    key: `wood-${tone}-${size}`,
    size,
    seed: tone === 'dark' ? 71 : 73,
    normalStrength: 2.4,
    repeat: 1,
    height: (x, y, n) => {
      const rings = Math.sin((y * 26 + n.fbm(x * 4, y * 2, 3) * 9) * Math.PI) * 0.5 + 0.5;
      const pores = n.fbm(x * 40, y * 8, 2);
      return rings * 0.6 + pores * 0.4;
    },
    color: (h, x, y, n) => {
      const streak = n.fbm(x * 30, y * 4, 2) * 0.1;
      return tone === 'dark'
        ? ramp(h + streak, [[0, [48, 32, 20]], [0.45, [84, 56, 34]], [0.75, [110, 74, 44]], [1, [136, 96, 58]]])
        : ramp(h + streak, [[0, [96, 72, 46]], [0.45, [138, 108, 70]], [0.75, [166, 134, 92]], [1, [194, 162, 118]]]);
    },
  });

/** Plaster and lime render for Mediterranean / island walls. */
export const plaster = (size = 256, tint: 'white' | 'ochre' = 'white') =>
  surface({
    key: `plaster-${tint}-${size}`,
    size,
    seed: tint === 'white' ? 81 : 83,
    normalStrength: 1.4,
    height: (x, y, n) => n.fbm(x * 7, y * 7, 4) * 0.7 + n.fbm(x * 28, y * 28, 2) * 0.3,
    color: (h, x, y, n) => {
      const stain = n.fbm(x * 5 + 11, y * 5 + 5, 3);
      const base = tint === 'white'
        ? ramp(h, [[0, [214, 208, 196]], [0.6, [236, 231, 220]], [1, [250, 247, 240]]])
        : ramp(h, [[0, [186, 152, 106]], [0.6, [212, 180, 132]], [1, [232, 206, 164]]]);
      const t = Math.min(0.25, Math.max(0, (stain - 0.7) * 1.2));
      return [base[0] * (1 - t), base[1] * (1 - t * 0.9), base[2] * (1 - t * 0.8)];
    },
  });

/** Snow crust for Kailash and high ridges. */
export const snow = (size = 256) =>
  surface({
    key: `snow-${size}`,
    size,
    seed: 91,
    normalStrength: 1.1,
    height: (x, y, n) => n.fbm(x * 6, y * 6, 4) * 0.6 + n.ridged(x * 20, y * 20, 2) * 0.4,
    color: (h, x, y, n) => {
      const shade = n.fbm(x * 16, y * 16, 3) * 0.1;
      return ramp(h + shade, [[0, [176, 192, 208]], [0.5, [214, 226, 238]], [1, [246, 250, 255]]]);
    },
  });

/** Foliage canopy noise; used as a colour break-up on tree crowns. */
export const foliage = (size = 128, tone: 'leaf' | 'olive' = 'leaf') =>  surface({
    key: `foliage-${tone}-${size}`,
    size,
    seed: tone === 'leaf' ? 101 : 103,
    normalStrength: 3,
    height: (x, y, n) => n.ridged(x * 16, y * 16, 4),
    color: (h, x, y, n) => {
      const light = n.fbm(x * 9, y * 9, 3);
      return tone === 'leaf'
        ? ramp(h * 0.7 + light * 0.3, [[0, [24, 52, 26]], [0.5, [46, 86, 38]], [0.8, [70, 112, 48]], [1, [104, 142, 66]]])
        : ramp(h * 0.7 + light * 0.3, [[0, [40, 52, 28]], [0.5, [68, 82, 40]], [0.8, [98, 112, 56]], [1, [132, 142, 78]]]);
    },
  });

/** Ripple normal map for water surfaces; the albedo is white and unused. */
export const ripple = (size = 256) =>
  surface({
    key: `ripple-${size}`,
    size,
    seed: 113,
    normalStrength: 7,
    height: (x, y, n) => {
      const swell = Math.sin((x * 6 + y * 4 + n.fbm(x * 2.5, y * 2.5, 3) * 4) * Math.PI) * 0.5 + 0.5;
      return n.fbm(x * 10, y * 10, 4) * 0.6 + swell * 0.4;
    },
    color: () => [255, 255, 255],
  });

