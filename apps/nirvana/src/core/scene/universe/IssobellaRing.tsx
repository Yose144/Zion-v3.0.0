'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextLabel } from './Label';
import * as THREE from 'three';
import { RING_R, RING_R2, ringPosition } from './positions';
import { IssobellaStation } from './IssobellaStation';
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
  const stations = useRef<THREE.InstancedMesh>(null);
  const stationData = useMemo(
    () =>
      worlds.map((w, i) => ({
        id: w.id,
        pos: ringPosition(w, i + 1, worlds.length + 1),
        color: new THREE.Color(layerColor(w.layer)),
      })),
    [worlds],
  );

  useLayoutEffect(() => {
    const m = stations.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    stationData.forEach((d, i) => {
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, d.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [stationData]);

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
      {/* vlajková stanice Issobella — procedurální model L6 */}
      <IssobellaStation
        position={[RING_R, 0, 0]}
        scale={4.4}
        onClick={portal ? () => onOpen(portal.id) : undefined}
      />
      {/* stanice L6 světů na prstenci — instancované */}
      {stationData.length > 0 && (
        <instancedMesh
          key={stationData.length}
          ref={stations}
          args={[undefined, undefined, stationData.length]}
          frustumCulled={false}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId != null) onSelectWorld(stationData[e.instanceId].id);
          }}
        >
          <octahedronGeometry args={[0.08, 0]} />
          <meshBasicMaterial />
        </instancedMesh>
      )}
      {portal && (
        <TextLabel
          text={`${portal.title.cs} · L6`}
          position={[0, 0.7, RING_R]}
          color="#ffe9b0"
          height={0.34}
          onClick={() => onOpen(portal.id)}
        />
      )}
    </group>
  );
}
