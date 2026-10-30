/**
 * three@0.169 ships WebGPURenderer without TypeScript declarations.
 * Surface used by the Nirvana shell canvas.
 */
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
