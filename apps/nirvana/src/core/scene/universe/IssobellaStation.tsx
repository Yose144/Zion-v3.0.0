'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Issobella — orbitální stanice L6. Procedurální model přenesený
 * z apps/website-v2.9 HolographicEarth (habitat ring + parkland +
 * biodomy + hub + spire + solární křídla). Škáluje se parametrem —
 * na prstenci jako vlajková stanice i malé stanice světů.
 */
export function IssobellaStation({
  position = [0, 0, 0],
  scale = 1,
  low = false,
  onClick,
}: {
  position?: [number, number, number];
  scale?: number;
  low?: boolean;
  onClick?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.35;
    groupRef.current.rotation.z += delta * 0.1;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <group scale={scale}>
        {/* Habitat ring — trup */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.028, 10, low ? 24 : 40]} />
          <meshStandardMaterial color="#c8d2de" emissive="#fcd116" emissiveIntensity={0.35} roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Parkland pás na prstenci */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
          <torusGeometry args={[0.16, 0.02, 8, low ? 24 : 40]} />
          <meshStandardMaterial color="#22c55e" emissive="#066928" emissiveIntensity={0.6} roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Biodomy na prstenci */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.035, Math.sin(a) * 0.16]}>
            <sphereGeometry args={[0.022, low ? 8 : 12, low ? 6 : 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#dbeafe" emissive="#fcd116" emissiveIntensity={0.9} transparent opacity={0.85} roughness={0.1} metalness={0.1} />
          </mesh>
        ))}
        {/* Centrální hub + dome */}
        <mesh>
          <sphereGeometry args={[0.055, low ? 10 : 16, low ? 10 : 16]} />
          <meshStandardMaterial color="#066928" emissive="#066928" emissiveIntensity={1.2} roughness={0.2} metalness={0.5} />
        </mesh>
        {/* Spire */}
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.004, 0.012, 0.14, 8]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#fcd116" emissiveIntensity={0.5} roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Solární křídla */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.24, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.16, 0.004, 0.06]} />
              <meshStandardMaterial color="#1e3a8a" emissive="#3b82f6" emissiveIntensity={0.4} roughness={0.25} metalness={0.6} />
            </mesh>
            <mesh position={[s * -0.1, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 0.012]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.8} />
            </mesh>
          </group>
        ))}
        {/* Issobella glow */}
        <mesh scale={2.5}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color="#fcd116" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
