'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import WarpGateVortex from './WarpGateVortex';
import GlowSprite from './GlowSprite';

export interface WorldNodeProps {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  size: number;
  info: string;
  category: string;
  showLabel?: boolean;
  isSelected?: boolean;
  isMobile?: boolean;
  onSelect?: (id: string) => void;
}

export default function World({
  id,
  name,
  color,
  position,
  size,
  info,
  category,
  showLabel = false,
  isSelected = false,
  isMobile = false,
  onSelect,
}: WorldNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gateRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const isStarSystem = category === 'star-system';
  const distance = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
  const isDistant = distance > 55;
  const displaySize = isDistant ? size * 1.6 : size;

  useLayoutEffect(() => {
    if (gateRef.current) {
      gateRef.current.lookAt(0, 0.4, 0);
    }
  }, []);

  const selected = isSelected;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
      if (hovered || selected) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.03;
        groupRef.current.scale.setScalar(pulse);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
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
        <sphereGeometry args={[displaySize * (hovered ? 1.12 : 1), 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Soft glow aura — only when hovered or selected to reduce overdraw */}
      {(hovered || selected) && (
        <mesh>
          <sphereGeometry args={[displaySize * 1.6, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={hovered ? 0.16 : 0.13}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Rotating ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[displaySize * 1.45, displaySize * 1.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hovered || selected ? 0.55 : 0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Warp gate ring (star systems + selected) */}
      {(isStarSystem || selected) && (!isMobile || hovered || selected) && (
        <group ref={gateRef}>
          <mesh>
            <torusGeometry args={[displaySize * (isStarSystem ? 2.4 : 2.0), displaySize * 0.07, 8, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={hovered || selected ? 0.55 : 0.25}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <WarpGateVortex color={color} size={displaySize} active={hovered || selected} />
          {(hovered || selected) && <GlowSprite color={color} size={displaySize * 3} opacity={0.45} fog={!isDistant} />}
        </group>
      )}

      {/* Permanent small label for selected / star systems */}
      {((showLabel || selected) && (!isMobile || selected)) && (
        <Html distanceFactor={isDistant ? undefined : 14} center position={[0, displaySize + 0.65, 0]}>
          <div className="pointer-events-none select-none rounded border border-white/10 bg-black/70 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
            <span className="text-[9px] font-semibold tracking-wide text-white/90" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{name}</span>
          </div>
        </Html>
      )}

      {/* Selected detail card only (no hover popup to reduce clutter) */}
      {selected && !showLabel && (
        <Html distanceFactor={isDistant ? undefined : 12} center position={[0, displaySize + 0.85, 0]}>
          <div className="min-w-[200px] max-w-[280px] pointer-events-none select-none rounded-xl border border-white/15 bg-black/85 p-3 shadow-2xl backdrop-blur-md text-center">
            <div
              className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${color}30`, color }}
            >
              {category}
            </div>
            <h3 className="text-sm font-bold text-white" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>{name}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{info}</p>
          </div>
        </Html>
      )}
    </group>
  );
}
