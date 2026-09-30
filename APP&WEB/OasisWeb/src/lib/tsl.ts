'use client';

/**
 * Lazy loader for the three.js TSL/WebGPU module (three.webgpu.js).
 *
 * `three/tsl` and `three/webgpu` resolve to the same bundle; keeping the
 * import dynamic means the ~700KB chunk is fetched only when the WebGPU
 * backend actually mounts a component — the default WebGL2 path never
 * downloads it (WebOasis.md §6 bundle budget).
 *
 * The module is untyped in three@0.169 — we hand it around as `any` and
 * keep all TSL usage inside src/components/gpu/*.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TslModule = any;

let cache: Promise<TslModule> | null = null;

export function loadTsl(): Promise<TslModule> {
  if (!cache) {
    cache = import('three/tsl').catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}
