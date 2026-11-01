'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { XR, createXRStore, type XRStore } from '@react-three/xr';
import * as THREE from 'three';
import {
  GpuBackendContext,
  demoteToWebGL,
  resolveGpuBackend,
  type GpuBackend,
} from './backends';
import { Universe } from './universe/Universe';
import { quality } from '../../../../shared/scenes/kit/quality';
import { ScenePost, sceneRenderStats } from '../../../../shared/scenes/kit/post';
import type { Portal } from '@/core/portals/manifest';
import type { HiranState } from '@/core/hiran/presence';
import type { WorldPoint } from '@/lib/worlds';

/** Classic materials render on WebGPU only after the node library is keyed
 *  by material.type (Turbopack minifies class names — keys are set directly).
 *  TSL materials are the target; classic types stay as a safety net. */
async function registerNodeLibrary(renderer: {
  nodes?: {
    library?: {
      materialNodes?: Map<string, unknown>;
      lightNodes?: WeakMap<object, unknown> | Map<unknown, unknown>;
    };
  };
}) {
  const tsl = (await import('three/tsl')) as Record<string, unknown | undefined>;
  const lib = renderer.nodes?.library;
  if (!lib?.materialNodes) return;
  const materialTypes: Array<[unknown, string]> = [
    [tsl.MeshBasicNodeMaterial, 'MeshBasicMaterial'],
    [tsl.MeshStandardNodeMaterial, 'MeshStandardMaterial'],
    [tsl.PointsNodeMaterial, 'PointsMaterial'],
    [tsl.LineBasicNodeMaterial, 'LineBasicMaterial'],
    [tsl.SpriteNodeMaterial, 'SpriteMaterial'],
  ];
  for (const [cls, type] of materialTypes) {
    if (cls) lib.materialNodes.set(type, cls);
  }
}

function DirectRenderer() {
  // priority 1 → přebíráme render (jinak r3f rendruje sám = dvojí frame)
  useFrame(({ gl, scene, camera }) => {
    const anyGl = gl as unknown as {
      render: (s: THREE.Scene, c: THREE.Camera) => void;
      renderAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void>;
    };
    if (anyGl.renderAsync) void anyGl.renderAsync(scene, camera);
    else anyGl.render(scene, camera);
  }, 1);
  return null;
}

/** Publishes the same audit counters the project scenes use, so the universe is measurable. */
function UniverseAudit() {
  const { gl, size } = useThree();
  const start = useRef(0);
  const frames = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('sceneAudit') !== '1') return;
    start.current = performance.now();
    return () => { delete (window as unknown as Record<string, unknown>).__projectScene; };
  }, []);
  useFrame(() => {
    if (!start.current) return;
    frames.current++;
    const now = performance.now();
    (window as unknown as Record<string, unknown>).__projectScene = {
      frames: frames.current,
      fps: (frames.current * 1000) / Math.max(1, now - start.current),
      calls: sceneRenderStats.calls || gl.info.render.calls,
      triangles: sceneRenderStats.triangles || gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      invalidVertices: 0,
      tier: quality().tier,
      dpr: gl.getPixelRatio(),
      width: size.width,
      height: size.height,
    };
  });
  return null;
}

function XrEntry({ store }: { store: XRStore }) {
  useEffect(() => {
    void store.enterVR();
  }, [store]);
  return null;
}

export function SceneRoot({
  worlds,
  portals,
  onOpen,
  onSelectWorld,
  xr,
  label,
  focus,
  hiranState,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  xr: boolean;
  label: string;
  focus?: 'earth' | 'sun' | 'jupiter';
  hiranState?: HiranState;
}) {
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [xrStore] = useState<XRStore>(() => createXRStore({ foveation: 0.5 }));

  useEffect(() => {
    let live = true;
    resolveGpuBackend().then((next) => {
      if (live) setBackend(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!backend) return null;

  return (
    <GpuBackendContext.Provider value={backend}>
      <Canvas
        role="img"
        aria-label={label}
        camera={{ position: [24, 8, 31], fov: 50, far: 6000 }}
        dpr={[1, quality().dpr]}
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={async (defaults) => {
          if (backend === 'webgpu' && !xr) {
            try {
              const { WebGPURenderer } = await import('three/webgpu');
              const renderer = new WebGPURenderer({
                canvas: defaults.canvas as HTMLCanvasElement,
                antialias: true,
                powerPreference: 'high-performance',
              });
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1.15;
              await renderer.init();
              try {
                await registerNodeLibrary(
                  renderer as unknown as Parameters<typeof registerNodeLibrary>[0],
                );
              } catch (err) {
                console.warn('[nirvana] node library fixup failed', err);
              }
              return renderer as unknown as THREE.WebGLRenderer;
            } catch (err) {
              demoteToWebGL(err);
              setBackend('webgl2');
            }
          }
          const renderer = new THREE.WebGLRenderer({
            canvas: defaults.canvas,
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
          });
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.15;
          return renderer;
        }}
      >
        {xr ? (
          <XR store={xrStore}>
            <Universe
              worlds={worlds}
              portals={portals}
              onOpen={onOpen}
              onSelectWorld={onSelectWorld}
              focus={focus}
              hiranState={hiranState}
            />
            <XrEntry store={xrStore} />
          </XR>
        ) : (
          <Universe
            worlds={worlds}
            portals={portals}
            onOpen={onOpen}
            onSelectWorld={onSelectWorld}
            focus={focus}
            hiranState={hiranState}
          />
        )}
        <UniverseAudit />
        {backend === 'webgl2' && quality().post ? (
          <ScenePost bloom={0.42} threshold={0.82} exposure={1.1} vignette={0.5} grain={0.01} />
        ) : (
          <DirectRenderer />
        )}
      </Canvas>
    </GpuBackendContext.Provider>
  );
}
