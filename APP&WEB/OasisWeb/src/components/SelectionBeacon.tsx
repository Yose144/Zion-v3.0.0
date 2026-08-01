'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SelectionBeaconProps {
  position: { x: number; y: number; z: number };
  color: string;
}

export default function SelectionBeacon({ position, color }: SelectionBeaconProps) {
  const beamRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.25;
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulse * 0.35;
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulse * 0.55;
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.08);
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh ref={beamRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.48, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
