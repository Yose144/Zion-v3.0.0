/**
 * Ambient declarations for `three/webgpu` — three@0.169 ships the build
 * (build/three.webgpu.js) without TypeScript declarations. We only use
 * WebGPURenderer; declare the surface R3F + our DirectRenderer need.
 */

/** `three/tsl` ships the same untyped bundle as `three/webgpu` — all TSL
 *  node functions/materials live in it. Accessed only via loadTsl()
 *  which types it `any` deliberately (API surface changes per release). */
declare module 'three/tsl';

declare module 'three/webgpu' {
  import type { Camera, ColorRepresentation, Scene } from 'three';

  export class WebGPURenderer {
    constructor(params?: {
      canvas?: HTMLCanvasElement | OffscreenCanvas;
      antialias?: boolean;
      forceWebGL?: boolean;
      powerPreference?: 'default' | 'high-performance' | 'low-power';
    });
    /** Async init — must resolve before the first render. */
    init(): Promise<void>;
    render(scene: Scene, camera: Camera): void;
    renderAsync(scene: Scene, camera: Camera): Promise<void>;
    setClearColor(color: ColorRepresentation, alpha?: number): void;
    setSize(width: number, height: number): void;
    setPixelRatio(value: number): void;
    setAnimationLoop(callback: (() => void) | null): void;
    dispose(): void;
    toneMapping: number;
    toneMappingExposure: number;
    readonly domElement: HTMLCanvasElement;
    readonly isWebGPURenderer: true;
  }
}
