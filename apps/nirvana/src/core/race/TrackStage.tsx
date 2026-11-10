'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SAMPLES, TRACK_WIDTH, type TrackPoint } from './track';

/**
 * Vizuál tratě Venuše — pás, okraje, startovní čára a brány.
 *
 * Sdílí to sólo závod i multiplayer, aby obě scény vypadaly stejně
 * a nemusely se opravovat dvakrát.
 *
 * Světla podél okrajů jsou **jeden instancedMesh** (80 sloupků) — viz
 * poznámku o instancování v AGENTS.md: matice se skládají v
 * `useLayoutEffect`, `frustumCulled={false}`, barvy přes `setColorAt`.
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

  // ── světla podél okrajů: 2 strany × každý 8. vzorek ──
  const lightCount = Math.floor(SAMPLES / 8) * 2;
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const lightData = useMemo(() => {
    const items: { x: number; z: number; yaw: number; gold: boolean }[] = [];
    for (let i = 0; i < SAMPLES; i += 8) {
      const p = track[i]!;
      const yaw = Math.atan2(p.tx, p.tz);
      const gold = (i / 8) % 2 === 0;
      for (const side of [1, -1]) {
        items.push({
          x: p.x + p.nx * side * (TRACK_WIDTH / 2 + 0.55),
          z: p.z + p.nz * side * (TRACK_WIDTH / 2 + 0.55),
          yaw,
          gold,
        });
      }
    }
    return items;
  }, [track]);

  useLayoutEffect(() => {
    const mesh = lightsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    lightData.forEach((item, i) => {
      q.setFromAxisAngle(up, item.yaw);
      pos.set(item.x, 0.55, item.z);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      col.set(item.gold ? '#ffd166' : '#57c8ff');
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [lightData]);

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

      {/* startovní gantry — dva sloupky + příčka se světelným pásem */}
      {(() => {
        const p = track[0]!;
        const yaw = Math.atan2(p.tx, p.tz);
        const half = TRACK_WIDTH / 2 + 1.5;
        return (
          <group position={[p.x, 0, p.z]} rotation={[0, yaw, 0]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * half, 2.6, 0]}>
                <cylinderGeometry args={[0.14, 0.2, 5.2, 8]} />
                <meshStandardMaterial color="#3a2f4a" metalness={0.5} roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, 5.1, 0]}>
              <boxGeometry args={[half * 2 + 0.4, 0.55, 0.55]} />
              <meshStandardMaterial color="#241c33" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* světelné mezery nad startem — jako na pravém okruhu */}
            {[-6, -3, 0, 3, 6].map((x, i) => (
              <mesh key={x} position={[x, 4.72, 0]}>
                <sphereGeometry args={[0.16, 8, 8]} />
                <meshBasicMaterial color={i < 3 ? '#ff3b30' : '#39ff88'} toneMapped={false} />
              </mesh>
            ))}
          </group>
        );
      })()}

      {/* světla podél okrajů — jeden instancedMesh, 80 sloupků */}
      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightCount]} frustumCulled={false}>
        <boxGeometry args={[0.16, 1.1, 0.16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

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
