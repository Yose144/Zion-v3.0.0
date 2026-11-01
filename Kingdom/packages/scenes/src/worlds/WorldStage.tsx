'use client';

/**
 * Jeviště světa.
 *
 * Scény z `@zion/scenes/worlds/*` jsou převzaté z `apps/shared/scenes` a nesou
 * si vlastní `ScenePresentation` (kamera, atmosféra, post-processing, intro).
 * Tady se jen postaví `<Canvas>`, připojí orbit rig a případné světlo scény.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitRig } from './OrbitRig';
import { worldById, type Lang } from './registry';

export function WorldStage({ worldId, locale }: { worldId: string; locale: Lang }) {
  const world = worldById(worldId);
  if (!world) return null;

  const Scene = world.scene;
  const Lighting = world.lighting;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={world.camera}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <OrbitRig {...world.controls} />
      {Lighting ? <Lighting /> : null}
      <Scene lang={locale} />
    </Canvas>
  );
}
