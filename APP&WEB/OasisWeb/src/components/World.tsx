'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

interface WorldProps {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  size: number;
  info: string;
}

export default function World({ name, color, position, size, info }: WorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0.2 + Math.random() * 0.2);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01 * speedRef.current;
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
      <Sphere args={[size * (hovered ? 1.08 : 1), 64, 64]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.5 : hovered ? 0.25 : 0.08}
          roughness={0.4}
          metalness={0.3}
        />
      </Sphere>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 1.54, 64]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.6 : 0.25} side={THREE.DoubleSide} />
      </mesh>

      {(hovered || selected) && (
        <Html distanceFactor={10} center position={[0, size + 0.45, 0]}>
          <div className="rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-sm min-w-[180px] pointer-events-none select-none text-center">
            <h3 className="font-bold text-sm" style={{ color }}>{name}</h3>
            {selected && <p className="text-xs text-gray-300 mt-1">{info}</p>}
          </div>
        </Html>
      )}
    </group>
  );
}
