'use client';

/**
 * Issobella (L6) — prstenec kolem Nové Země se stanicemi.
 * Pozice stanic počítá doména (`ringStations`), renderer je jen vykreslí.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISSOBELLA_RING, ringStations } from '@zion/world';

const STATIONS = ringStations(ISSOBELLA_RING);

export function IssobellaRing({ idle = true }: { idle?: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!idle || !group.current) return;
    group.current.rotation.y += delta * 0.018;
  });

  return (
    <group ref={group} rotation={[0, 0, ISSOBELLA_RING.tilt]}>
      {/* pás prstence */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ISSOBELLA_RING.inner, ISSOBELLA_RING.outer, 128, 1]} />
        <meshBasicMaterial
          color="#6ff0c4"
          transparent
          opacity={0.11}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* vodicí linka na vnitřním okraji */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[ISSOBELLA_RING.inner - 0.006, ISSOBELLA_RING.inner + 0.006, 128, 1]}
        />
        <meshBasicMaterial
          color="#6ff0c4"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* stanice */}
      {STATIONS.map((station, index) => (
        <mesh key={index} position={[station.x, station.y, station.z]}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshBasicMaterial color="#9df5d9" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
