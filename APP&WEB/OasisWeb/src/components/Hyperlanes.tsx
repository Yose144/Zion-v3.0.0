'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLDS } from '../domain/config/worlds';
import { createRandom } from '../domain/ports/random';

const MAX_LINKS = 2;
const PARTICLES_PER_LINK = 2;

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

interface Streamer {
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
  color: THREE.Color;
}

export default function Hyperlanes() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const { lineGeometry, lineMaterial, pointGeometry, pointMaterial, streamers } = useMemo(() => {
    const links = new Set<string>();
    const positions: number[] = [];
    const colors: number[] = [];
    const streamers: Streamer[] = [];

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

        const wp = new THREE.Vector3(w.galaxyPosition!.x, w.galaxyPosition!.y, w.galaxyPosition!.z);
        const op = new THREE.Vector3(o.galaxyPosition!.x, o.galaxyPosition!.y, o.galaxyPosition!.z);
        const color = new THREE.Color(CATEGORY_COLORS[w.category] || '#ffffff');

        positions.push(wp.x, wp.y, wp.z, op.x, op.y, op.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

        const rng = createRandom(
          w.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) +
          o.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) +
          137
        );

        for (let i = 0; i < PARTICLES_PER_LINK; i++) {
          streamers.push({
            start: wp,
            end: op,
            progress: rng.next(),
            speed: 0.05 + rng.next() * 0.15,
            color,
          });
        }
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
    });

    const pointPositions = new Float32Array(streamers.length * 3);
    const pointColors = new Float32Array(streamers.length * 3);

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { lineGeometry, lineMaterial, pointGeometry, pointMaterial, streamers };
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
      lineMaterial.opacity = 0.05 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }

    if (!pointsRef.current) return;

    const positions = pointGeometry.attributes.position.array as Float32Array;
    const colors = pointGeometry.attributes.color.array as Float32Array;

    for (let i = 0; i < streamers.length; i++) {
      const s = streamers[i];
      s.progress += s.speed * delta;
      if (s.progress >= 1) s.progress -= 1;

      const pos = new THREE.Vector3().lerpVectors(s.start, s.end, s.progress);
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      colors[i * 3] = s.color.r;
      colors[i * 3 + 1] = s.color.g;
      colors[i * 3 + 2] = s.color.b;
    }

    pointGeometry.attributes.position.needsUpdate = true;
    pointGeometry.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <lineSegments ref={linesRef} geometry={lineGeometry} material={lineMaterial} />
      <points ref={pointsRef} geometry={pointGeometry} material={pointMaterial} />
    </>
  );
}
