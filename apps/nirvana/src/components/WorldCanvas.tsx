'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  GpuBackendContext,
  demoteToWebGL,
  resolveGpuBackend,
  type GpuBackend,
} from '@/lib/gpuBackend';
import { layerColor, worldPosition, type WorldPoint } from '@/lib/worlds';

/** Classic Three materials render on WebGPU only after the node library
 *  is keyed by material.type. Turbopack minifies class names, so the
 *  string keys are set directly (same fix as OasisScene). */
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
    [tsl.PointsNodeMaterial, 'PointsMaterial'],
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

const GATES: Array<{ id: string; color: string; position: [number, number, number] }> = [
  { id: 'mine', color: '#fcd116', position: [0, 0.15, 0] },
  { id: 'chain', color: '#7ec8ff', position: [1.35, 0.15, 0.2] },
  { id: 'harbor', color: '#066928', position: [-1.35, 0.15, 0.2] },
  { id: 'books', color: '#e41e2b', position: [0, 0.15, 1.35] },
  { id: 'market', color: '#c084fc', position: [0, 0.15, -1.35] },
];

function Catalog({
  worlds,
  onOpen,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
}) {
  return (
    <>
      <color attach="background" args={['#05060a']} />
      <ambientLight intensity={0.85} />
      {worlds.map((world, index) => (
        <mesh
          key={world.id}
          position={worldPosition(world, index, worlds.length)}
          onClick={(event) => {
            event.stopPropagation();
            onSelectWorld(world.id);
          }}
        >
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshBasicMaterial color={layerColor(world.layer)} />
        </mesh>
      ))}
      {GATES.map((gate) => (
        <mesh
          key={gate.id}
          position={gate.position}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(gate.id);
          }}
        >
          <torusGeometry args={[0.42, 0.06, 12, 28]} />
          <meshBasicMaterial color={gate.color} />
        </mesh>
      ))}
      <DirectRenderer />
    </>
  );
}

export function WorldCanvas({
  worlds,
  onOpen,
  onSelectWorld,
  label,
}: {
  worlds: WorldPoint[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  label: string;
}) {
  const [backend, setBackend] = useState<GpuBackend | null>(null);

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
        camera={{ position: [0, 4, 14], fov: 55 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={async (defaults) => {
          if (backend === 'webgpu') {
            try {
              const { WebGPURenderer } = await import('three/webgpu');
              const renderer = new WebGPURenderer({
                canvas: defaults.canvas as HTMLCanvasElement,
                antialias: false,
                powerPreference: 'high-performance',
              });
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1.1;
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
            antialias: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
          });
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          return renderer;
        }}
      >
        <Catalog worlds={worlds} onOpen={onOpen} onSelectWorld={onSelectWorld} />
      </Canvas>
    </GpuBackendContext.Provider>
  );
}
