'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function GalaxyCore() {
  const coreRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.y = -state.clock.elapsedTime * 0.05;
      coreRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.03;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.2 + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
    }
  });

  return (
    <group ref={coreRef} position={[0, 0.4, 0]}>
      {/* Inner bright core */}
      <mesh>
        <sphereGeometry args={[0.38, 64, 64]} />
        <meshBasicMaterial
          color="#fff7d6"
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Warm gold corona */}
      <mesh>
        <sphereGeometry args={[0.72, 64, 64]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Broad purple-gold glow */}
      <mesh>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Volumetric light disk ( flattened ) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.15]}>
        <sphereGeometry args={[2.4, 64, 64]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight ref={lightRef} color="#fbbf24" intensity={2.2} distance={24} decay={1.2} position={[0, 0, 0]} />
      <pointLight color="#a855f7" intensity={0.8} distance={18} decay={1.5} position={[0, 0.4, 0]} />
    </group>
  );
}
