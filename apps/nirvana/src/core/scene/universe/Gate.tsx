'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GATE_POS } from './positions';
import type { Portal } from '@/core/portals/manifest';

/** Brána — IntroPage ve volném prostoru vedle planety. Přelet = vstup. */
export function Gate({ portal, onOpen }: { portal: Portal; onOpen: (id: string) => void }) {
  const ring = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (ring.current) {
      ring.current.rotation.y += delta * 0.35;
      ring.current.position.y = GATE_POS[1] + Math.sin(t * 0.7) * 0.18;
    }
    if (core.current) core.current.opacity = 0.35 + Math.sin(t * 2.4) * 0.12;
  });

  return (
    <group ref={ring} position={GATE_POS}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onOpen(portal.id);
        }}
      >
        <torusGeometry args={[1.35, 0.09, 12, 64]} />
        <meshBasicMaterial color="#fcd116" />
      </mesh>
      {/* světelný disk uvnitř brány */}
      <mesh>
        <circleGeometry args={[1.28, 48]} />
        <meshBasicMaterial ref={core} color="#c084fc" transparent opacity={0.38} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={20} style={{ pointerEvents: 'none' }}>
        <span className="scene-label scene-label-gate">{portal.title.cs}</span>
      </Html>
    </group>
  );
}
