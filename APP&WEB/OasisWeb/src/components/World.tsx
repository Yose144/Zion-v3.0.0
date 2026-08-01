'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WorldProps {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  size: number;
  info: string;
  category: string;
}

export default function World({ name, color, position, size, info, category }: WorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
      // gentle pulsing of the whole node when hovered
      const scale = 1 + (hovered ? 0.08 : 0) * Math.sin(state.clock.elapsedTime * 6) * 0.03;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        setSelected((s) => !s);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[size * (hovered ? 1.1 : 1), 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.55 : hovered ? 0.35 : 0.12}
          roughness={0.3}
          metalness={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Soft glow aura */}
      <mesh>
        <sphereGeometry args={[size * 2.2, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.18 : 0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.6, size * 1.65, 64]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.7 : 0.28} side={THREE.DoubleSide} />
      </mesh>

      {/* Hover tooltip / selected data card */}
      {(hovered || selected) && (
        <Html distanceFactor={12} center position={[0, size + 0.55, 0]}>
          <div className="rounded-xl border border-white/15 bg-black/85 p-3 shadow-2xl backdrop-blur-md min-w-[200px] max-w-[280px] pointer-events-none select-none text-center">
            <div
              className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${color}30`, color }}
            >
              {category}
            </div>
            <h3 className="font-bold text-sm text-white" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>{name}</h3>
            {selected && <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{info}</p>}
            {!selected && <p className="mt-1 text-[10px] text-gray-400">Click to read more</p>}
          </div>
        </Html>
      )}
    </group>
  );
}
