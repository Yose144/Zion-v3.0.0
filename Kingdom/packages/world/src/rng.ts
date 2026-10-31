/**
 * Deterministická náhoda pro doménu světa.
 *
 * `Math.random` je v doméně zakázaný (check-boundaries.mjs) — scéna musí být
 * reprodukovatelná, jinak se nedá testovat ani synchronizovat.
 */

/** mulberry32 — malý, rychlý, deterministický PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pozice hvězd na kouli (x, y, z trojice v Float32Array).
 * Vrací data, ne objekty — renderer z toho udělá jediný instanced buffer.
 */
export function starField(count: number, seed: number, radius: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    // rovnoměrné rozložení na kouli (z = 2u-1, φ = 2πv)
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const dist = radius * (0.55 + rand() * 0.45);

    out[i * 3] = Math.cos(phi) * r * dist;
    out[i * 3 + 1] = z * dist;
    out[i * 3 + 2] = Math.sin(phi) * r * dist;
  }

  return out;
}

/** Jas hvězd 0..1 — stejný seed, stejná obloha. */
export function starBrightness(count: number, seed: number): Float32Array {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) out[i] = 0.35 + rand() * 0.65;
  return out;
}
