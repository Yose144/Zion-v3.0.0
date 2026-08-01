'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { World } from '../domain/types/world';
import { createRandom } from '../domain/ports/random';

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

const SIZES: Record<string, number> = {
  'star-system': 2.2,
  'planet': 1.2,
  'sector': 0.85,
  'world': 1.0,
  'dimension': 0.9,
};

function AtmosphereGlow({ color, size }: { color: string; size: number }) {
  return (
    <mesh>
      <sphereGeometry args={[size * 1.45, 64, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function OrbitRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} />
    </mesh>
  );
}

function WorldParticles({ count, color, seed }: { count: number; color: string; seed: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const rng = useMemo(() => createRandom(seed), [seed]);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const r = 2.5 + rng.next() * 6;
      const y = (rng.next() - 0.5) * 4;
      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material };
  }, [count, color, rng]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.02;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function SatelliteRing({ count, color, distance }: { count: number; color: string; distance: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const rng = useMemo(() => createRandom(Math.floor(distance * 1000) + count), [count, distance]);
  const satellites = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const speed = 0.15 + rng.next() * 0.2; // visual drift only, no gameplay
      return { angle, speed, size: 0.08 + rng.next() * 0.1 };
    });
  }, [count, rng]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 2.2, 0, 0]}>
      {satellites.map((s, i) => {
        const x = Math.cos(s.angle) * distance;
        const z = Math.sin(s.angle) * distance;
        return (
          <mesh key={i} position={[x, 0, z]}>
            <sphereGeometry args={[s.size, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

interface WorldEnvironmentProps {
  world: World;
}

export default function WorldEnvironment({ world }: WorldEnvironmentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const color = CATEGORY_COLORS[world.category] || '#ffffff';
  const size = SIZES[world.category] || 1.0;
  const seed = useMemo(() => world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0), [world.id]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const centralGeometry = useMemo(() => {
    switch (world.category) {
      case 'star-system':
        return new THREE.SphereGeometry(size, 64, 64);
      case 'planet':
        return new THREE.SphereGeometry(size, 64, 64);
      case 'sector':
        return new THREE.DodecahedronGeometry(size, 0);
      case 'world':
        return new THREE.IcosahedronGeometry(size, 1);
      case 'dimension':
        return new THREE.TorusKnotGeometry(size * 0.55, size * 0.18, 128, 16);
      default:
        return new THREE.SphereGeometry(size, 64, 64);
    }
  }, [world.category, size]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* distant star backdrop */}
      <Stars radius={120} depth={80} count={6000} factor={3} saturation={0} fade speed={0.3} />

      {/* central object */}
      <mesh geometry={centralGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={world.category === 'star-system' ? 1.2 : 0.35}
          roughness={0.45}
          metalness={0.35}
          toneMapped={false}
          wireframe={world.category === 'dimension'}
        />
      </mesh>

      <AtmosphereGlow color={color} size={size} />

      {world.category === 'star-system' && (
        <>
          <SatelliteRing count={8} color="#22d3ee" distance={3.8} />
          <OrbitRing radius={3.8} color={color} />
        </>
      )}

      {world.category === 'planet' && (
        <>
          <SatelliteRing count={3} color={color} distance={2.2} />
          <OrbitRing radius={2.2} color={color} />
        </>
      )}

      {(world.category === 'world' || world.category === 'sector') && (
        <OrbitRing radius={size * 1.6} color={color} />
      )}

      {world.category === 'dimension' && (
        <mesh>
          <torusKnotGeometry args={[size * 0.85, size * 0.08, 128, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} wireframe />
        </mesh>
      )}

      <WorldParticles count={180} color={color} seed={seed} />

      {/* World title */}
      <Html center position={[0, size + 1.4, 0]} distanceFactor={8}>
        <div className="pointer-events-none select-none text-center">
          <h1 className="text-2xl font-bold text-white" style={{ textShadow: `0 0 24px ${color}` }}>
            {world.name}
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color }}>
            {world.category}
          </p>
        </div>
      </Html>
    </group>
  );
}
