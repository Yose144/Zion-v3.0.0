'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLDS } from '../domain/config/worlds';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';
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
  'star-system': 0.34,
  'planet': 0.2,
  'sector': 0.22,
  'world': 0.21,
  'dimension': 0.19,
};

const CORE = new THREE.Vector3(0, 0.4, 0);

interface GalaxyMapProps {
  activeCategories: WorldCategory[];
  activeLayers?: WorldLayer[];
  selectedWorldId?: string | null;
  onWorldSelect?: (world: World) => void;
  isMobile?: boolean;
}

export default function GalaxyMap({ activeCategories, activeLayers, selectedWorldId, onWorldSelect, isMobile = false }: GalaxyMapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const visibleWorlds = useMemo(
    () => WORLDS.filter((w) => {
      const catOk = activeCategories.includes(w.category as WorldCategory);
      const layerOk = !activeLayers || activeLayers.length === 0 || activeLayers.includes(w.layer);
      return catOk && layerOk && w.galaxyPosition;
    }),
    [activeCategories, activeLayers]
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
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    return { lineGeometry: geometry, lineMaterial: material };
  }, [visibleWorlds]);

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
            showLabel={isSelected}
            isSelected={isSelected}
            isMobile={isMobile}
            onSelect={() => onWorldSelect?.(w)}
          />
        );
      })}
    </group>
  );
}
