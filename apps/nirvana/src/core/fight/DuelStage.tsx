'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { ARENA_HALF, type Fighter } from './duel';

/**
 * MERKUR — klec v merkurím úsvitu. Stejná scéna pro sólo i multiplayer
 * (lekce z Venuše: vizuál tratě je jeden soubor, aby se nic neopravovalo dvakrát).
 */
export function DuelStage() {
  const sunGeo = useMemo(() => new THREE.CircleGeometry(11, 40), []);
  const haloGeo = useMemo(() => new THREE.RingGeometry(11.3, 15.2, 40), []);
  return (
    <>
      <color attach="background" args={['#2b1a1a']} />
      <fog attach="fog" args={['#2b1a1a', 24, 100]} />

      <ambientLight intensity={0.78} color="#e4c49b" />
      <hemisphereLight args={['#edb87d', '#30201b', 1.05]} />
      <directionalLight position={[14, 20, 8]} intensity={2.1} color="#ffe0b3" />
      <pointLight position={[0, 5, 4]} intensity={34} color="#ffb877" distance={34} decay={2} />

      {/* strž pod klecí */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[ARENA_HALF * 2 + 6, 0.5, 9]} />
          <meshStandardMaterial color="#89765f" roughness={0.92} />
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
          <meshStandardMaterial color="#573b2d" roughness={1} />
        </mesh>
      ))}

      {/* slunce nízko nad obzorem (Merkur je k němu blízko — záměrně malé a jasné) */}
      <mesh geometry={sunGeo} position={[-30, 10, -67]}>
        <meshBasicMaterial color="#ffe9b0" toneMapped={false} />
      </mesh>
      <mesh geometry={haloGeo} position={[-30, 10, -67.2]}>
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
  const previousHp = useRef({ a: a.current.hp, b: b.current.hp });
  const hitShake = useRef(0);

  useFrame((_, delta) => {
    const mid = THREE.MathUtils.clamp((a.current.x + b.current.x) / 2, -2.5, 2.5);
    const spread = Math.abs(a.current.x - b.current.x);
    const k = 1 - Math.exp(-6 * Math.min(0.05, delta));
    desired.set(mid, 2.05, 8.4 + Math.min(3.8, spread * 0.25));
    camera.position.lerp(desired, k);
    if (camera instanceof THREE.PerspectiveCamera) {
      const desiredFov = 42 + Math.min(17, Math.max(0, spread - 5) * 1.3);
      camera.fov += (desiredFov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    if (a.current.hp < previousHp.current.a || b.current.hp < previousHp.current.b) hitShake.current = 0.14;
    previousHp.current.a = a.current.hp;
    previousHp.current.b = b.current.hp;
    hitShake.current = Math.max(0, hitShake.current - delta);
    if (hitShake.current > 0) {
      const strength = hitShake.current / 0.14;
      camera.position.x += Math.sin(_.clock.elapsedTime * 82) * 0.055 * strength;
      camera.position.y += Math.cos(_.clock.elapsedTime * 67) * 0.035 * strength;
    }
    target.set(mid, 1.2, 0);
    camera.lookAt(target);
  });
  return null;
}
