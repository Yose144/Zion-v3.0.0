'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarLook } from './kit';

/**
 * Skutečný 3D model avatara (GLB s kostrou a klipem `idle`).
 *
 * Model se **klonuje** (`SkeletonUtils.clone`), protože každá animovaná instance
 * potřebuje vlastní skelet — ve hře se potká až osm postav. Sdílený originál
 * drží drei cache, takže geometrii ani texturu neuvolňujeme (dispose by rozbil
 * ostatní klony).
 *
 * Souřadnice: model je v metrech, chodidla na `y = 0`, pohled dopředu `+Z`;
 * `look.height` ho škáluje stejně jako proceduralní model.
 */
export function RiggedAvatar({
  look,
  url,
  animate = false,
  opacity = 1,
}: {
  look: AvatarLook;
  url: string;
  animate?: boolean;
  opacity?: number;
}) {
  const { scene, animations } = useGLTF(url);
  const model = useMemo(() => cloneSkeleton(scene), [scene]);
  const { actions } = useAnimations(animations, model);
  const group = useRef<THREE.Group>(null);
  const scale = look.height / 1.75;
  const transparent = opacity < 1;

  // Průhlednost pro duchy v multiplayeru — materiály jsou z GLB, jen se doplní.
  useEffect(() => {
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        material.transparent = transparent;
        material.opacity = opacity;
      }
    });
  }, [model, transparent, opacity]);

  useEffect(() => {
    const action = actions.idle ?? Object.values(actions)[0];
    if (!action) return;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [actions]);

  useFrame((state, delta) => {
    if (!animate || !group.current) return;
    group.current.rotation.y += delta * 0.35;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.02;
  });

  return (
    <group ref={group} scale={[scale, scale, scale]}>
      <primitive object={model} />
    </group>
  );
}
