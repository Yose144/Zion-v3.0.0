'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLDS } from '../domain/config/worlds';
import type { World, WorldCategory } from '../domain/types/world';
import WorldNode from './World';
import Hyperlanes from './Hyperlanes';

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

const CATEGORY_SIZES: Record<string, number> = {
  'star-system': 0.46,
  'planet': 0.28,
  'sector': 0.31,
  'world': 0.29,
  'dimension': 0.26,
};

const CORE = new THREE.Vector3(0, 0.4, 0);

interface GalaxyMapProps {
  activeCategories: WorldCategory[];
  selectedWorldId?: string | null;
  onWorldSelect?: (world: World) => void;
  isMobile?: boolean;
}

export default function GalaxyMap({ activeCategories, selectedWorldId, onWorldSelect, isMobile = false }: GalaxyMapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const visibleWorlds = useMemo(
    () => WORLDS.filter((w) => activeCategories.includes(w.category as WorldCategory) && w.galaxyPosition),
    [activeCategories]
  );

  const { lineGeometry, lineMaterial } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    for (const w of visibleWorlds) {
      if (!w.galaxyPosition) continue;
      const color = new THREE.Color(CATEGORY_COLORS[w.category] || '#ffffff');
      const p = w.galaxyPosition;

      positions.push(p.x, p.y, p.z, CORE.x, CORE.y, CORE.z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { lineGeometry: geometry, lineMaterial: material };
  }, [visibleWorlds]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.006;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Constellation lines to galactic core */}
      <lineSegments ref={linesRef} geometry={lineGeometry} material={lineMaterial} />

      {/* Inter-world hyperlane / warp-gate network */}
      <Hyperlanes isMobile={isMobile} />

      {visibleWorlds.map((w) => {
        const color = CATEGORY_COLORS[w.category] || '#ffffff';
        const size = CATEGORY_SIZES[w.category] || 0.28;
        const isSelected = w.id === selectedWorldId;

        return (
          <WorldNode
            key={w.id}
            id={w.id}
            name={w.name}
            color={color}
            position={[w.galaxyPosition!.x, w.galaxyPosition!.y, w.galaxyPosition!.z]}
            size={size}
            info={w.summary}
            category={w.category}
            showLabel={w.category === 'star-system' || isSelected}
            isSelected={isSelected}
            isMobile={isMobile}
            onSelect={() => onWorldSelect?.(w)}
          />
        );
      })}
    </group>
  );
}
