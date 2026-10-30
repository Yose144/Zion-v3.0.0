'use client';

/**
 * GPU backend policy — ENGINE-WEB.md §3/§4.
 * Resolution order: ?gpu= → localStorage → default.
 * Default = WebGL2 (vizuálně ověřený render classic materiálů);
 * WebGPU = opt-in přes ?gpu=webgpu dokud neověříme konverzi.
 * XR sessions force WebGL2 — XRGPUBinding is still experimental
 * (Chrome does not expose it; Babylon/PlayCanvas docs agree).
 * A canvas cannot swap backends; `demoteToWebGL` forces a remount.
 */

import { createContext, useContext } from 'react';

export type GpuBackend = 'webgpu' | 'webgl2';
export type GpuMode = 'auto' | 'webgpu' | 'webgl2';

const STORAGE_KEY = 'nirvana.gpu';
const QUERY_PARAM = 'gpu';

export const GpuBackendContext = createContext<GpuBackend>('webgl2');
export const useGpuBackend = () => useContext(GpuBackendContext);

interface GpuNavigator {
  gpu?: { requestAdapter(options?: unknown): Promise<unknown | null> };
}

export function hasWebGpuApi(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as GpuNavigator).gpu;
}

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
    // webgpu = opt-in jen pro tuto session — neukládat, jinak testovací
    // hodnota přežije a podlehne konverzi classic materiálů (černé plátno)
    if (q !== 'webgpu') {
      try {
        window.localStorage.setItem(STORAGE_KEY, q);
      } catch {
        // storage may be blocked — the query param still wins this session
      }
    }
    return q;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // stored 'webgpu' ignorovat — zbytky starších testů by potichu
    // reaktivovaly rozbitý backend místo defaultního WebGL2
    if (stored === 'webgl2' || stored === 'auto') return stored;
  } catch {
    // ignore
  }
  return 'auto';
}

let resolved: GpuBackend | null = null;

export async function resolveGpuBackend(): Promise<GpuBackend> {
  if (resolved) return resolved;
  const mode = getGpuMode();
  // Default = WebGL2 — konverze classic materiálů pod WebGPU není
  // vizuálně ověřená (zahazuje map/emissiveMap → žlutá koule bez
  // textury). WebGPU = opt-in přes ?gpu=webgpu.
  const wantWebGpu = mode === 'webgpu';
  resolved = wantWebGpu && (await detectWebGpu()) ? 'webgpu' : 'webgl2';
  if (typeof window !== 'undefined') {
    (window as unknown as { __nirvanaBackend?: GpuBackend }).__nirvanaBackend = resolved;
    (window as unknown as { __nirvanaGpuMode?: GpuMode }).__nirvanaGpuMode = mode;
  }
  return resolved;
}

export function demoteToWebGL(reason?: unknown) {
  resolved = 'webgl2';
  if (typeof window !== 'undefined') {
    (window as unknown as { __nirvanaBackend?: GpuBackend }).__nirvanaBackend = 'webgl2';
  }
  if (reason !== undefined) {
    console.warn('[nirvana] WebGPU unavailable for this view — WebGL2 backend', reason);
  }
}

/** XR rule: immersive sessions always run on the WebGL2 backend. */
export function backendForXr(): GpuBackend {
  if (resolved !== 'webgl2') demoteToWebGL('xr-session');
  return 'webgl2';
}
