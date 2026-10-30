'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { XR, createXRStore, type XRStore } from '@react-three/xr';
import * as THREE from 'three';
import {
  GpuBackendContext,
  demoteToWebGL,
  resolveGpuBackend,
  type GpuBackend,
} from './backends';
import { Universe } from './universe/Universe';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import type { Lang } from '@/core/i18n';

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
  useFrame(({ gl, scene, camera }) => {
    const anyGl = gl as unknown as {
      render: (s: THREE.Scene, c: THREE.Camera) => void;
      renderAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void>;
    };
    if (anyGl.renderAsync) void anyGl.renderAsync(scene, camera);
    else anyGl.render(scene, camera);
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
  lang,
  onToggleLang,
  vrSupported,
  onEnterVr,
  label,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  xr: boolean;
  lang: Lang;
  onToggleLang: () => void;
  vrSupported: boolean;
  onEnterVr: () => void;
  label: string;
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
        camera={{ position: [2.5, 5.5, 15.5], fov: 52 }}
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
              renderer.toneMappingExposure = 1.0;
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
          renderer.toneMappingExposure = 1.0;
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
              lang={lang}
              onToggleLang={onToggleLang}
              vrSupported={vrSupported}
              onEnterVr={onEnterVr}
            />
            <XrEntry store={xrStore} />
          </XR>
        ) : (
          <Universe
            worlds={worlds}
            portals={portals}
            onOpen={onOpen}
            onSelectWorld={onSelectWorld}
            lang={lang}
            onToggleLang={onToggleLang}
            vrSupported={vrSupported}
            onEnterVr={onEnterVr}
          />
        )}
        <DirectRenderer />
      </Canvas>
    </GpuBackendContext.Provider>
  );
}
