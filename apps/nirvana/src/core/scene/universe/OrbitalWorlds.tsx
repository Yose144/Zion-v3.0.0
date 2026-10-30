'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { orbitPosition } from './positions';
import type { WorldPoint } from '@/lib/worlds';
import { layerColor } from '@/lib/worlds';

/** L4 světy OASIS — vnitřní oběžná dráha pod prstencem Issobelly. */
export function OrbitalWorlds({
  worlds,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  onSelectWorld: (id: string) => void;
}) {
  const belt = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (belt.current) belt.current.rotation.y += delta * 0.05;
  });

  return (
    <group ref={belt}>
      {worlds.map((w, i) => (
        <mesh
          key={w.id}
          position={orbitPosition(w, i, worlds.length)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectWorld(w.id);
          }}
        >
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial color={layerColor(w.layer)} />
        </mesh>
      ))}
    </group>
  );
}
