'use client';

import { useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Html, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import InteractiveObject from './InteractiveObject';
import GlassPanel from './GlassPanel';
import type { ZoneConfig } from '@/lib/zones';

interface ZoneProps {
  zone: ZoneConfig;
  active: boolean;
  position: [number, number, number];
  panel?: ReactNode;
}

export default function Zone({ zone, active, position, panel }: ZoneProps) {
  const router = useRouter();
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      const speed = zone.id === 'avatars' ? 0.18 : 0.08;
      groupRef.current.rotation.y = state.clock.elapsedTime * speed;
    }
  });

  const handleClick = () => {
    if (!active) router.push(zone.route);
  };

  return (
    <group ref={groupRef} position={position}>
      <InteractiveObject
        onClick={handleClick}
        label={active ? zone.name : `Go to ${zone.name}`}
        hoverScale={active ? 1.05 : 1.12}
      >
        {(hovered) => <ZoneArtifact zone={zone} active={active} hovered={hovered} />}
      </InteractiveObject>

      {active && panel && (
        <Html
          transform
          center
          distanceFactor={6}
          position={[0, 2.6, 0.5]}
          className="pointer-events-auto"
          style={{ width: 'min(90vw, 820px)' }}
        >
          {panel}
        </Html>
      )}
    </group>
  );
}

function ZoneArtifact({
  zone,
  active,
  hovered,
}: {
  zone: ZoneConfig;
  active: boolean;
  hovered: boolean;
}) {
  const intensity = active ? 0.5 : hovered ? 0.35 : 0.18;
  const color = zone.color;

  switch (zone.id) {
    case 'dashboard':
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.2, 1.2, 0.08, 48]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity * 0.6}
              transparent
              opacity={0.85}
              roughness={0.2}
              metalness={0.5}
            />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <octahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity}
              roughness={0.1}
              metalness={0.6}
            />
          </mesh>
        </group>
      );
    case 'avatars':
      return (
        <group>
          {[...Array(6)].map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85]}>
                <sphereGeometry args={[0.16, 24, 24]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={intensity * 0.8}
                  roughness={0.3}
                  metalness={0.4}
                />
              </mesh>
            );
          })}
          <mesh>
            <torusGeometry args={[0.85, 0.035, 16, 64]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity * 0.4}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      );
    case 'quests':
      return (
        <group rotation={[0, 0, Math.PI / 4]}>
          <RoundedBox args={[0.7, 0.35, 0.12]} radius={0.05} smoothness={4}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity}
              roughness={0.4}
              metalness={0.3}
            />
          </RoundedBox>
          <mesh position={[0, 0.3, 0.08]}>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 16]} />
            <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={intensity} />
          </mesh>
        </group>
      );
    case 'leaderboard':
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.7, 2, 0.7]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity * 0.7}
              transparent
              opacity={0.85}
              roughness={0.15}
              metalness={0.5}
            />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={intensity} />
          </mesh>
        </group>
      );
    case 'onboarding':
      return (
        <group>
          {[...Array(5)].map((_, i) => (
            <mesh key={i} position={[(i - 2) * 0.35, 0.1, 0]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={intensity * (1 + i * 0.1)}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2, 0.25]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity * 0.3}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}
