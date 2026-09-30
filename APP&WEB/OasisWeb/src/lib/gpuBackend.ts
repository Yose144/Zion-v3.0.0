'use client';

/**
 * GPU backend selection — first step of the GPUweb (WebGPU) preview.
 *
 * Backends:
 *   'webgpu' → three.js WebGPURenderer (TSL/node materials only — no raw
 *              ShaderMaterial, no @react-three/postprocessing)
 *   'webgl2' → classic WebGLRenderer (current production path)
 *
 * Mode resolution (?gpu= query → localStorage 'oasis.gpu' → 'auto'):
 *   - 'webgpu' → WebGPU when the adapter resolves, else WebGL2
 *   - 'webgl2' → WebGL2
 *   - 'auto'   → WebGL2 in G1 (WebGPU is opt-in preview; auto promotion
 *                lands in G2 once visual parity is proven)
 *
 * WebOasis.md §3 documents the architecture and rollout gates.
 */

import { createContext, useContext } from 'react';

export type GpuBackend = 'webgpu' | 'webgl2';
export type GpuMode = 'auto' | 'webgpu' | 'webgl2';

const STORAGE_KEY = 'oasis.gpu';
const QUERY_PARAM = 'gpu';

export const GpuBackendContext = createContext<GpuBackend>('webgl2');
export const useGpuBackend = () => useContext(GpuBackendContext);

interface GpuNavigator {
  gpu?: { requestAdapter(options?: unknown): Promise<unknown | null> };
}

/** Synchronous check — does the browser expose the WebGPU API at all. */
export function hasWebGpuApi(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as GpuNavigator).gpu;
}

/** Async check — API present AND an adapter can be acquired. */
export async function detectWebGpu(): Promise<boolean> {
  if (!hasWebGpuApi()) return false;
  try {
    const adapter = await (navigator as GpuNavigator).gpu!.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export function getGpuMode(): GpuMode {
  if (typeof window === 'undefined') return 'auto';
  const q = new URLSearchParams(window.location.search).get(QUERY_PARAM);
  if (q === 'webgpu' || q === 'webgl2' || q === 'auto') {
    try {
      window.localStorage.setItem(STORAGE_KEY, q);
    } catch {
      // storage may be blocked — query param still wins for this session
    }
    return q;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'webgpu' || stored === 'webgl2') return stored;
  } catch {
    // ignore
  }
  return 'auto';
}

let resolved: GpuBackend | null = null;

/**
 * Resolve once per page-load; the choice is immutable for the session
 * (canvas contexts can't switch backends mid-flight).
 */
export async function resolveGpuBackend(): Promise<GpuBackend> {
  if (resolved) return resolved;
  const mode = getGpuMode();
  resolved = mode === 'webgpu' && (await detectWebGpu()) ? 'webgpu' : 'webgl2';
  if (typeof window !== 'undefined') {
    (window as unknown as { __oasisBackend?: GpuBackend }).__oasisBackend = resolved;
    (window as unknown as { __oasisGpuMode?: GpuMode }).__oasisGpuMode = mode;
  }
  return resolved;
}

/** Called by the renderer factory when WebGPU init fails mid-boot —
 *  flips the session backend so React guards take the WebGL path. */
export function demoteToWebGL(reason?: unknown) {
  resolved = 'webgl2';
  if (typeof window !== 'undefined') {
    (window as unknown as { __oasisBackend?: GpuBackend }).__oasisBackend = 'webgl2';
  }
  if (reason !== undefined) {
    console.warn('[OASIS] WebGPU init failed — falling back to WebGL2', reason);
  }
}
