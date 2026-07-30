'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GlassPanel from './GlassPanel';

interface InteractiveObjectProps {
  children: ReactNode | ((hovered: boolean) => ReactNode);
  label?: string;
  onClick?: () => void;
  hoverScale?: number;
  position?: [number, number, number];
}

export default function InteractiveObject({
  children,
  label,
  onClick,
  hoverScale = 1.12,
  position,
}: InteractiveObjectProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const target = hovered ? hoverScale : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
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
      {typeof children === 'function' ? children(hovered) : children}
      {hovered && label && (
        <Html distanceFactor={10} center className="pointer-events-none select-none">
          <GlassPanel className="px-3 py-1.5 text-xs text-white whitespace-nowrap">
            {label}
          </GlassPanel>
        </Html>
      )}
    </group>
  );
}
