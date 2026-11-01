'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, type MutableRefObject } from 'react';
import { ARENA_HALF, type Fighter } from './duel';

/**
 * MERKUR — klec v merkurím úsvitu. Stejná scéna pro sólo i multiplayer
 * (lekce z Venuše: vizuál tratě je jeden soubor, aby se nic neopravovalo dvakrát).
 */
export function DuelStage() {
  const sunGeo = useMemo(() => new THREE.CircleGeometry(7, 28), []);
  const haloGeo = useMemo(() => new THREE.RingGeometry(7.2, 9.4, 28), []);
  return (
    <>
      <color attach="background" args={['#181008']} />
      <fog attach="fog" args={['#181008', 20, 80]} />

      <ambientLight intensity={0.55} color="#d9b98c" />
      <hemisphereLight args={['#caa26a', '#1d1410', 0.7]} />
      <directionalLight position={[14, 20, 8]} intensity={1.6} color="#ffe0b3" />
      <pointLight position={[0, 5, 4]} intensity={22} color="#ffb877" distance={26} decay={2} />

      {/* strž pod klecí */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[ARENA_HALF * 2 + 6, 0.5, 9]} />
        <meshStandardMaterial color="#6f6558" roughness={0.95} />
      </mesh>
      {/* středová linka klece */}
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 8]} />
        <meshBasicMaterial color="#ffb46a" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* sloupky a břevno — "klec" */}
      {[-ARENA_HALF - 1.2, ARENA_HALF + 1.2].map((x) => (
        <mesh key={x} position={[x, 1.5, -3.4]}>
          <boxGeometry args={[0.24, 3, 0.24]} />
          <meshStandardMaterial color="#4c4438" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3, -3.4]}>
        <boxGeometry args={[ARENA_HALF * 2 + 2.8, 0.14, 0.14]} />
        <meshStandardMaterial color="#4c4438" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* merkurí hřbety v dálce */}
      {[
        [-16, 2.4, -34, 26, 5, 8],
        [10, 3.4, -44, 34, 7, 10],
        [30, 2, -30, 20, 4, 7],
      ].map(([x, y, z, w, h, d], index) => (
        <mesh key={index} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#3a2d22" roughness={1} />
        </mesh>
      ))}

      {/* slunce nízko nad obzorem (Merkur je k němu blízko — záměrně malé a jasné) */}
      <mesh geometry={sunGeo} position={[-34, 9, -70]}>
        <meshBasicMaterial color="#ffe9b0" toneMapped={false} />
      </mesh>
      <mesh geometry={haloGeo} position={[-34, 9, -70.2]}>
        <meshBasicMaterial color="#ffcf7a" transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/**
 * Kamera bokem, jako u klasického beating baru. Střed záběru sleduje
 * střed mezi bojovníky (ořezaný, aby kamera neulétla do krajů).
 */
export function DuelCamera({
  a,
  b,
}: {
  a: MutableRefObject<Fighter>;
  b: MutableRefObject<Fighter>;
}) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.2, 0), []);
  const desired = useMemo(() => new THREE.Vector3(0, 2.1, 12), []);

  useFrame((_, delta) => {
    const mid = THREE.MathUtils.clamp((a.current.x + b.current.x) / 2, -2.5, 2.5);
    const spread = Math.abs(a.current.x - b.current.x);
    desired.set(mid, 2.05, 10.5 + Math.min(4, spread * 0.35));
    const k = 1 - Math.exp(-6 * Math.min(0.05, delta));
    camera.position.lerp(desired, k);
    target.set(mid, 1.2, 0);
    camera.lookAt(target);
  });
  return null;
}
