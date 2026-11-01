'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SAMPLES, TRACK_WIDTH, type TrackPoint } from './track';

/**
 * Vizuál tratě Venuše — pás, okraje, startovní čára a brány.
 *
 * Sdílí to sólo závod i multiplayer, aby obě scény vypadaly stejně
 * a nemusely se opravovat dvakrát.
 */
export function TrackStage({
  track,
  checkpoints,
}: {
  track: TrackPoint[];
  checkpoints: number[];
}) {
  const road = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const a = track[i]!;
      const b = track[(i + 1) % SAMPLES]!;
      const ax = a.x + a.nx * (TRACK_WIDTH / 2);
      const az = a.z + a.nz * (TRACK_WIDTH / 2);
      const bx = b.x + b.nx * (TRACK_WIDTH / 2);
      const bz = b.z + b.nz * (TRACK_WIDTH / 2);
      const cx = b.x - b.nx * (TRACK_WIDTH / 2);
      const cz = b.z - b.nz * (TRACK_WIDTH / 2);
      const dx = a.x - a.nx * (TRACK_WIDTH / 2);
      const dz = a.z - a.nz * (TRACK_WIDTH / 2);

      const base = i * 4;
      positions.push(ax, 0.06, az, bx, 0.06, bz, cx, 0.06, cz, dx, 0.06, dz);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [track]);

  const edges = useMemo(() => {
    const positions: number[] = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < SAMPLES; i++) {
        const a = track[i]!;
        const b = track[(i + 1) % SAMPLES]!;
        positions.push(
          a.x + a.nx * side * (TRACK_WIDTH / 2),
          0.14,
          a.z + a.nz * side * (TRACK_WIDTH / 2),
          b.x + b.nx * side * (TRACK_WIDTH / 2),
          0.14,
          b.z + b.nz * side * (TRACK_WIDTH / 2),
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [track]);

  useEffect(
    () => () => {
      road.dispose();
      edges.dispose();
    },
    [road, edges],
  );

  return (
    <>
      <mesh geometry={road}>
        <meshStandardMaterial color="#2b2233" roughness={0.7} metalness={0.15} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffb46a" transparent opacity={0.9} />
      </lineSegments>

      {/* startovní čára */}
      <mesh
        position={[track[0]!.x, 0.1, track[0]!.z]}
        rotation={[0, Math.atan2(track[0]!.tx, track[0]!.tz), 0]}
      >
        <planeGeometry args={[TRACK_WIDTH, 1.6]} />
        <meshStandardMaterial color="#f6e7d8" roughness={0.8} />
      </mesh>

      {/* checkpointy jako brány */}
      {checkpoints.map((index, order) => {
        const point = track[index]!;
        return (
          <group
            key={index}
            position={[point.x, 0, point.z]}
            rotation={[0, Math.atan2(point.tx, point.tz), 0]}
          >
            {[1, -1].map((side) => (
              <mesh
                key={side}
                position={[side * (TRACK_WIDTH / 2 + 0.6), 2, 0]}
                rotation={[0, 0, side * 0.12]}
              >
                <boxGeometry args={[0.3, 4, 0.3]} />
                <meshBasicMaterial color={order === 0 ? '#ffd166' : '#7fe3d4'} />
              </mesh>
            ))}
            <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[1.4, 0.06, 6, 24]} />
              <meshBasicMaterial
                color={order === 0 ? '#ffd166' : '#7fe3d4'}
                transparent
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
