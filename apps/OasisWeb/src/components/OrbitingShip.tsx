'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FalconModel, XWingModel } from './StarFighterModels';

interface OrbitingShipProps {
  radius?: number;
  speed?: number;
  yAmp?: number;
  model?: 'falcon' | 'xwing';
  color?: string;
  scale?: number;
  tilt?: number;
}

export default function OrbitingShip({
  radius = 1.35,
  speed = 0.55,
  yAmp = 0.12,
  model = 'falcon',
  color = '#9ca3af',
  scale = 0.55,
  tilt = 0.18,
}: OrbitingShipProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * speed;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = Math.sin(t * 2.3) * yAmp;

    groupRef.current.position.set(x, y, z);

    // Orient the ship along the orbit tangent with a gentle bank.
    const target = new THREE.Vector3(
      Math.cos(t + 0.08) * radius,
      y + Math.cos(t * 2.3) * yAmp * 0.3,
      Math.sin(t + 0.08) * radius
    );
    groupRef.current.lookAt(target);
    groupRef.current.rotateZ(tilt * Math.sin(t));

    // Subtle roll wobble.
    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(t * 3) * 0.08;
    }
  });

  const ShipModel = model === 'falcon' ? FalconModel : XWingModel;

  return (
    <group ref={groupRef}>
      <group ref={meshRef} scale={scale} rotation={[-Math.PI / 2, 0, 0]}>
        <ShipModel color={color} speed={4} boostLevel={1.2} />
      </group>
      {/* Engine glow trail behind the ship */}
      <mesh position={[0, 0, -0.12]} scale={[1, 1, 2.8]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial
          color="#00f88a"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
