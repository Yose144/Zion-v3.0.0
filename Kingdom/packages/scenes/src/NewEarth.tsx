'use client';

/**
 * Nová Země (L5) — planeta. Jedna textura, jedno světlo, žádný post-processing.
 * Atmosférický obal je druhý sphere s aditivním materiálem (levné, bez shaderu).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { NEW_EARTH } from '@zion/world';

const TEXTURE_URL = '/textures/earth-blue-marble.webp';

export function NewEarth({ idle = true }: { idle?: boolean }) {
  const group = useRef<THREE.Group>(null);

  const texture = useLoader(THREE.TextureLoader, TEXTURE_URL);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  useFrame((_, delta) => {
    if (!idle || !group.current) return;
    group.current.rotation.y += delta * 0.035;
  });

  const atmosphere = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#5fa8ff',
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  return (
    <group ref={group}>
      {/* planeta musí blokovat raycast — jinak jdou klikat markery za jejím
          horizontem, které hráč nevidí */}
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
        }}
      >
        <sphereGeometry args={[NEW_EARTH.radius, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.86} metalness={0.03} />
      </mesh>

      <mesh material={atmosphere} scale={1.035}>
        <sphereGeometry args={[NEW_EARTH.radius, 32, 32]} />
      </mesh>
    </group>
  );
}
