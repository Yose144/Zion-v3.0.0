'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ORBIT_R, orbitPosition } from './positions';
import type { WorldPoint } from '@/lib/worlds';
import { layerColor } from '@/lib/worlds';

const PICK_COUNT = 12;

/** L4 světy OASIS — vnitřní oběžná dráha pod prstencem Issobelly.
 *  Stovky světů → subtilní particle belt; klikatelná je jen
 *  rovnoměrná reprezentativní podmnožina (zbytek žije ve World portalu). */
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

  const { picked, beltGeo } = useMemo(() => {
    const step = Math.max(1, Math.ceil(worlds.length / PICK_COUNT));
    const pickedSet = new Set<number>();
    for (let i = 0; i < worlds.length; i += step) pickedSet.add(i);

    const positions = new Float32Array(worlds.length * 3);
    const colors = new Float32Array(worlds.length * 3);
    const c = new THREE.Color();
    worlds.forEach((w, i) => {
      const p = orbitPosition(w, i, worlds.length);
      positions[i * 3] = p[0];
      positions[i * 3 + 1] = p[1];
      positions[i * 3 + 2] = p[2];
      c.set(layerColor(w.layer));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { picked: worlds.filter((_, i) => pickedSet.has(i)), beltGeo: geo };
  }, [worlds]);

  const pickedIndex = useMemo(() => {
    const ids = new Map(worlds.map((w, i) => [w.id, i] as const));
    return picked.map((w) => ({ world: w, index: ids.get(w.id)! }));
  }, [worlds, picked]);

  return (
    <group ref={belt}>
      {/* vodící prstenec dráhy — jemný */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ORBIT_R + 0.35, 0.006, 6, 128]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.14} />
      </mesh>
      {/* particle belt — všechny světy jako prach */}
      <points geometry={beltGeo}>
        <pointsMaterial size={0.055} transparent opacity={0.55} sizeAttenuation depthWrite={false} vertexColors blending={THREE.AdditiveBlending} />
      </points>
      {/* klikatelná reprezentativní podmnožina */}
      {pickedIndex.map(({ world, index }) => (
        <mesh
          key={world.id}
          position={orbitPosition(world, index, worlds.length)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectWorld(world.id);
          }}
        >
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color={layerColor(world.layer)} />
        </mesh>
      ))}
    </group>
  );
}
