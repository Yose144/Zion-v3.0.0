'use client';

/**
 * Brána — místo příjezdu. Volně v prostoru vedle planety, ne na povrchu.
 * Vstup do ekosystému je tak vidět dřív, než se kdokoli přiblíží.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GATE } from '@zion/world';

export function Gate({ onSelect }: { onSelect?: () => void }) {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ring.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.1) * 0.03;
    ring.current.scale.setScalar(pulse);
    ring.current.rotation.z = Math.sin(t * 0.25) * 0.14;
  });

  return (
    <group position={[GATE.position.x, GATE.position.y, GATE.position.z]}>
      <mesh
        ref={ring}
        onClick={onSelect}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <torusGeometry args={[GATE.radius, 0.018, 12, 96]} />
        <meshBasicMaterial color="#7aa7ff" transparent opacity={0.85} />
      </mesh>

      <mesh>
        <torusGeometry args={[GATE.radius * 0.72, 0.008, 8, 72]} />
        <meshBasicMaterial color="#c9d8ff" transparent opacity={0.4} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <pointLight color="#7aa7ff" intensity={1.4} distance={2.6} />
    </group>
  );
}
