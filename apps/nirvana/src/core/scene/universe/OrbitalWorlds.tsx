'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
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

  const pickedMesh = useRef<THREE.InstancedMesh>(null);
  const pickedData = useMemo(() => {
    const ids = new Map(worlds.map((w, i) => [w.id, i] as const));
    return picked.map((w) => ({
      id: w.id,
      pos: orbitPosition(w, ids.get(w.id)!, worlds.length),
      color: new THREE.Color(layerColor(w.layer)),
    }));
  }, [worlds, picked]);

  useLayoutEffect(() => {
    const m = pickedMesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    pickedData.forEach((d, i) => {
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, d.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pickedData]);

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
      {/* klikatelná reprezentativní podmnožina — instancovaná */}
      {pickedData.length > 0 && (
        <instancedMesh
          key={pickedData.length}
          ref={pickedMesh}
          args={[undefined, undefined, pickedData.length]}
          frustumCulled={false}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId != null) onSelectWorld(pickedData[e.instanceId].id);
          }}
        >
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial />
        </instancedMesh>
      )}
    </group>
  );
}
