'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { World } from '../domain/types/world';

interface HyperlanesProps {
  worlds: World[];
  isMobile?: boolean;
}

const MAX_LINKS = 2;

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#fcd116',
  'planet': '#078930',
  'sector': '#e41e2b',
  'world': '#078930',
  'dimension': '#e41e2b',
};

export default function Hyperlanes({ worlds, isMobile = false }: HyperlanesProps) {
  const linesRef = useRef<THREE.LineSegments>(null);

  const { lineGeometry, lineMaterial } = useMemo(() => {
    const links = new Set<string>();
    const positions: number[] = [];
    const colors: number[] = [];

    const worldsWithPos = worlds.filter((w) => w.galaxyPosition);

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

        const wp = new THREE.Vector3(w.galaxyPosition!.x, w.galaxyPosition!.y, w.galaxyPosition!.z);
        const op = new THREE.Vector3(o.galaxyPosition!.x, o.galaxyPosition!.y, o.galaxyPosition!.z);
        const color = new THREE.Color(CATEGORY_COLORS[w.category] || '#ffffff');

        positions.push(wp.x, wp.y, wp.z, op.x, op.y, op.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    return { lineGeometry, lineMaterial };
  }, [worlds]);

  return <lineSegments ref={linesRef} geometry={lineGeometry} material={lineMaterial} />;
}
