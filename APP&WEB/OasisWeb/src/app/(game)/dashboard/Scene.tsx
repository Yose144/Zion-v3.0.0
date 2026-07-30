'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import InteractiveObject from '@/components/InteractiveObject';
import { getZonePosition } from '@/lib/zones';

const zonePos = getZonePosition('dashboard');

export default function DashboardScene() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
  });

  return (
    <group ref={groupRef} position={zonePos}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        const r = 1.6 + Math.sin(i) * 0.15;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const colors = ['#22d3ee', '#a855f7', '#f59e0b', '#10b981'];
        const labels = ['XP', 'Streak', 'Blocks', 'Tithe'];
        return (
          <InteractiveObject
            key={i}
            label={labels[i]}
            hoverScale={1.2}
            onClick={() => {}}
            position={[x, 0.8 + Math.sin(i) * 0.3, z]}
          >
            <mesh>
              <octahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial
                color={colors[i]}
                emissive={colors[i]}
                emissiveIntensity={0.35}
                roughness={0.2}
                metalness={0.5}
              />
            </mesh>
          </InteractiveObject>
        );
      })}
    </group>
  );
}
