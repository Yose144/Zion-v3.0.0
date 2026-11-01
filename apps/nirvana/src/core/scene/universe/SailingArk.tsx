'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_R } from './positions';
import { TextLabel } from './Label';

/**
 * Archa Království srdce obíhající Novou Zemi — třináctý uzel nemá pin na
 * pevnině, pluje. Kreslí se jako malý model lodi na velrybím koridoru, aby
 * bylo z vesmíru vidět, že uzel existuje, i když není na mapě.
 * Klik = okno archy; scéna sama nikam nenaviguje.
 */
export function SailingArk({ onOpen }: { onOpen: () => void }) {
  const orbit = useRef<THREE.Group>(null);
  const ship = useRef<THREE.Group>(null);
  const angle = useRef(2.35);

  useFrame((_, delta) => {
    angle.current += delta * 0.045;
    const a = angle.current;
    const r = PLANET_R + 0.42;
    if (ship.current) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      ship.current.position.set(x, 0, z);
      // bow (local +x) follows the tangent of the circle
      ship.current.rotation.set(0, -a - Math.PI / 2, Math.sin(a * 3) * 0.06);
    }
    if (orbit.current) orbit.current.rotation.y = 0;
  });

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <group ref={orbit} rotation={[0.44, 0.2, 0.08]}>
      <group ref={ship}>
        {/* hit area — a ship this small is hard to click otherwise */}
        <mesh
          visible={false}
          onClick={(e) => {
            stop(e);
            onOpen();
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <sphereGeometry args={[0.34, 8, 6]} />
        </mesh>

        <mesh
          castShadow
          onClick={(e) => {
            stop(e);
            onOpen();
          }}
        >
          <boxGeometry args={[0.52, 0.075, 0.15]} />
          <meshStandardMaterial color="#17324a" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* bow */}
        <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.075, 0.18, 8]} />
          <meshStandardMaterial color="#17324a" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* deckhouse + glasshouse */}
        <mesh position={[-0.02, 0.065, 0]}>
          <boxGeometry args={[0.24, 0.055, 0.095]} />
          <meshStandardMaterial color="#efe6d2" roughness={0.7} />
        </mesh>
        {/* warm windows — the ship reads alive from orbit */}
        <mesh position={[-0.02, 0.05, 0.049]}>
          <boxGeometry args={[0.2, 0.016, 0.004]} />
          <meshStandardMaterial color="#ffcf8a" emissive="#ff9f43" emissiveIntensity={2} />
        </mesh>
        {/* masts + sails */}
        {[-0.14, 0.04, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.19, 0]}>
            <cylinderGeometry args={[0.004, 0.006, 0.26, 5]} />
            <meshStandardMaterial color="#8d6a42" roughness={0.6} />
          </mesh>
        ))}
        {[-0.14, 0.04, 0.2].map((x) => (
          <mesh key={`sail-${x}`} position={[x - 0.05, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.09, 0.16]} />
            <meshStandardMaterial color="#fff6e4" side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
        ))}
        {/* wake glow */}
        <mesh position={[-0.34, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.42, 0.16]} />
          <meshBasicMaterial color="#7fd4f5" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        <TextLabel text="Archa · Království srdce" position={[0, 0.42, 0]} color="#9fe4ff" height={0.12} onClick={onOpen} />
      </group>
    </group>
  );
}
