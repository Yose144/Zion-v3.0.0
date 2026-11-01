'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildAvatarMesh } from './body';
import type { AvatarLook } from './kit';

/**
 * Procedurální avatar — postava z primitiv, zapečená do 1–3 draw callů.
 *
 * Nic se nenačítá (v repu nejsou modely); všechno plyne z `avatarLook()`.
 * Geometrii skládá `body.ts` (viz komentář tam: proč merged a ne 40 meshů).
 * Stejné id = stejná postava u tebe, u ostatních hráčů i na webu.
 *
 * Měřítko: postava stojí nohama na y = 0, referenční výška 1,75 m;
 * `look.height` ji škáluje.
 */
export function AvatarModel({
  look,
  animate = false,
  opacity = 1,
}: {
  look: AvatarLook;
  animate?: boolean;
  opacity?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const scale = look.height / 1.75;
  const mesh = useMemo(() => buildAvatarMesh(look), [look]);
  const transparent = opacity < 1;

  // Geometrie je reálná GPU paměť — po změně avatara ji musíme uvolnit.
  useEffect(
    () => () => {
      mesh.solid.dispose();
      mesh.metal?.dispose();
      mesh.glow?.dispose();
    },
    [mesh],
  );

  useFrame((_, delta) => {
    if (!animate || !group.current) return;
    group.current.rotation.y += delta * 0.35;
    group.current.position.y = Math.sin(performance.now() / 900) * 0.02;
  });

  return (
    <group ref={group} scale={[scale, scale, scale]}>
      <mesh geometry={mesh.solid}>
        <meshStandardMaterial
          vertexColors
          roughness={0.74}
          metalness={0.08}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {mesh.metal && (
        <mesh geometry={mesh.metal}>
          <meshStandardMaterial
            vertexColors
            metalness={0.74}
            roughness={0.3}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
      )}

      {mesh.glow && (
        <mesh geometry={mesh.glow}>
          <meshBasicMaterial
            vertexColors
            toneMapped={false}
            transparent
            opacity={0.85 * opacity}
          />
        </mesh>
      )}
    </group>
  );
}
