'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RING_R, RING_R2, ringPosition } from './positions';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import { layerColor } from '@/lib/worlds';

const TILT: [number, number, number] = [Math.PI / 2 - 0.32, 0, 0.14];

export function IssobellaRing({
  worlds,
  portal,
  onOpen,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  portal: Portal | undefined;
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
}) {
  const ring = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (ring.current) ring.current.rotation.y += delta * 0.03;
    if (glow.current) glow.current.opacity = 0.16 + Math.sin(clock.getElapsedTime() * 1.1) * 0.05;
  });

  return (
    <group ref={ring} rotation={[0.32, 0, -0.14]}>
      {/* dva prstence Issobelly — orbitální science ring L6 */}
      <mesh rotation={TILT}>
        <torusGeometry args={[RING_R, 0.035, 8, 128]} />
        <meshBasicMaterial color="#f5f5f5" transparent opacity={0.55} />
      </mesh>
      <mesh rotation={TILT}>
        <torusGeometry args={[RING_R2, 0.02, 8, 128]} />
        <meshBasicMaterial ref={glow} color="#7ec8ff" transparent opacity={0.18} />
      </mesh>
      {/* stanice L6 na prstenci */}
      {worlds.map((w, i) => {
        const pos = ringPosition(w, i, worlds.length);
        return (
          <mesh
            key={w.id}
            position={pos}
            onClick={(e) => {
              e.stopPropagation();
              onSelectWorld(w.id);
            }}
          >
            <octahedronGeometry args={[0.08, 0]} />
            <meshBasicMaterial color={layerColor(w.layer)} />
          </mesh>
        );
      })}
      {portal && (
        <Html position={[0, 0.6, RING_R]} center distanceFactor={16} style={{ pointerEvents: 'none' }}>
          <span
            className="scene-label scene-label-ring"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onOpen(portal.id)}
          >
            {portal.title.cs} · L6
          </span>
        </Html>
      )}
    </group>
  );
}
