'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLDS } from '../domain/config/worlds';

const MAX_LINKS = 2;

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

export default function Hyperlanes() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  const { geometry, material } = useMemo(() => {
    const links = new Set<string>();
    const positions: number[] = [];
    const colors: number[] = [];

    const worldsWithPos = WORLDS.filter((w) => w.galaxyPosition);

    for (const w of worldsWithPos) {
      const others = worldsWithPos
        .filter((o) => o.id !== w.id)
        .map((o) => ({
          ...o,
          dist: new THREE.Vector3(o.galaxyPosition!.x, o.galaxyPosition!.y, o.galaxyPosition!.z).distanceTo(
            new THREE.Vector3(w.galaxyPosition!.x, w.galaxyPosition!.y, w.galaxyPosition!.z)
          ),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_LINKS);

      for (const o of others) {
        const key = [w.id, o.id].sort().join(':');
        if (links.has(key)) continue;
        links.add(key);

        const wp = w.galaxyPosition!;
        const op = o.galaxyPosition!;
        const color = new THREE.Color(CATEGORY_COLORS[w.category] || '#ffffff');

        positions.push(wp.x, wp.y, wp.z, op.x, op.y, op.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { geometry, material };
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.05 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }
  });

  return <lineSegments ref={linesRef} geometry={geometry} material={material} />;
}
