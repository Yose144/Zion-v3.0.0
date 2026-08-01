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
  'star-system': 2.4,
  'planet': 1.3,
  'sector': 1.0,
  'world': 1.1,
  'dimension': 1.0,
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function createGlowTexture(color: string): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(255, 255, 255, 1)`);
  g.addColorStop(0.2, `rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`);
  g.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, 0.15)`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createPlanetTexture(baseColor: string, secondaryColor: string, seed: number): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = createRandom(seed);

  // Base ocean / void
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Continents / landmasses
  ctx.fillStyle = secondaryColor;
  const blobs = 10 + rng.int(0, 8);
  for (let i = 0; i < blobs; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = 20 + rng.next() * 60;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Atmosphere / shadow gradient
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.72);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createCoronaTexture(color: string): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(255, 250, 240, 0.95)`);
  g.addColorStop(0.15, `rgba(${c.r}, ${c.g}, ${c.b}, 0.65)`);
  g.addColorStop(0.45, `rgba(${c.r}, ${c.g}, ${c.b}, 0.15)`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createRingTexture(color: string): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, 0.35)`);
  g.addColorStop(0.45, `rgba(${c.r}, ${c.g}, ${c.b}, 0.12)`);
  g.addColorStop(0.55, `rgba(${c.r}, ${c.g}, ${c.b}, 0.35)`);
  g.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, 0.08)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function AtmosphereSphere({ color, size }: { color: string; size: number }) {
  return (
    <mesh>
      <sphereGeometry args={[size * 1.18, 64, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

function OrbitRing({ radius, color, texture }: { radius: number; color: string; texture?: THREE.Texture }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.05, radius + 0.05, 256]} />
      <meshBasicMaterial
        color={color}
        map={texture}
        transparent
        opacity={texture ? 0.9 : 0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function WorldParticles({ count, color, seed, radius = 6 }: { count: number; color: string; seed: number; radius?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const rng = useMemo(() => createRandom(seed), [seed]);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const r = rng.next() * radius + 2;
      const y = (rng.next() - 0.5) * radius * 0.6;
      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * r;

      const shade = c.clone().offsetHSL(0, 0, (rng.next() - 0.5) * 0.2);
      colors[i3] = shade.r;
      colors[i3 + 1] = shade.g;
      colors[i3 + 2] = shade.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material };
  }, [count, color, rng, radius]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.015;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function SatelliteRing({ count, color, distance, sizeBase = 0.1 }: { count: number; color: string; distance: number; sizeBase?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const rng = useMemo(() => createRandom(Math.floor(distance * 1000) + count), [count, distance]);
  const satellites = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + rng.next() * 0.2;
      return { angle, size: sizeBase + rng.next() * 0.12 };
    });
  }, [count, rng, sizeBase]);

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
            <sphereGeometry args={[s.size, 20, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function StarCorona({ color, size }: { color: string; size: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const texture = useMemo(() => createCoronaTexture(color), [color]);

  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
    }
  });

  return (
    <>
      <sprite position={[0, 0, 0]} scale={[size * 4, size * 4, 1]}>
        <spriteMaterial map={texture} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite position={[0, 0, 0]} scale={[size * 8, size * 8, 1]}>
        <spriteMaterial map={texture} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight ref={lightRef} color={color} intensity={2.5} distance={50} decay={1.2} position={[0, 0, 0]} />
    </>
  );
}

function planetSecondaryColor(color: string): string {
  const c = new THREE.Color(color);
  const hsl = {} as { h: number; s: number; l: number };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.max(0.3, hsl.s * 0.75), Math.min(0.75, hsl.l * 1.35));
  return `#${c.getHexString()}`;
}

export default function WorldEnvironment({ world }: { world: World }) {
  const groupRef = useRef<THREE.Group>(null);
  const color = CATEGORY_COLORS[world.category] || '#ffffff';
  const size = SIZES[world.category] || 1.0;
  const seed = useMemo(() => world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0), [world.id]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  const centralGeometry = useMemo(() => {
    switch (world.category) {
      case 'star-system':
        return new THREE.SphereGeometry(size, 64, 64);
      case 'planet':
      case 'world':
        return new THREE.SphereGeometry(size, 64, 64);
      case 'sector':
        return new THREE.DodecahedronGeometry(size, 0);
      case 'dimension':
        return new THREE.TorusKnotGeometry(size * 0.55, size * 0.18, 160, 24);
      default:
        return new THREE.SphereGeometry(size, 64, 64);
    }
  }, [world.category, size]);

  const planetTexture = useMemo(() => {
    if (world.category === 'planet' || world.category === 'world') {
      const base = world.category === 'world' ? '#1f4e45' : color;
      const secondary = world.category === 'world' ? '#4ade80' : planetSecondaryColor(color);
      return createPlanetTexture(base, secondary, seed);
    }
    return null;
  }, [world.category, color, seed]);

  const ringTexture = useMemo(() => createRingTexture(color), [color]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* distant star backdrop */}
      <Stars radius={140} depth={90} count={5000} factor={3} saturation={0} fade speed={0.3} />

      {world.category === 'star-system' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color="#fff7d6" toneMapped={false} />
          </mesh>
          <StarCorona color={color} size={size} />
          <SatelliteRing count={8} color="#22d3ee" distance={4.2} sizeBase={0.1} />
          <OrbitRing radius={4.2} color={color} />
          <WorldParticles count={260} color={color} seed={seed} radius={9} />
        </>
      )}

      {(world.category === 'planet' || world.category === 'world') && (
        <>
          <mesh geometry={centralGeometry}>
            <meshStandardMaterial
              map={planetTexture}
              color="#ffffff"
              emissive={color}
              emissiveIntensity={0.08}
              roughness={0.65}
              metalness={0.15}
              toneMapped={false}
            />
          </mesh>
          <AtmosphereSphere color={color} size={size} />
          <OrbitRing radius={size * 2.2} color={color} texture={ringTexture} />
          {world.category === 'planet' && <SatelliteRing count={3} color="#cbd5e1" distance={size * 2.4} sizeBase={0.06} />}
          <WorldParticles count={200} color={color} seed={seed} radius={6} />
        </>
      )}

      {world.category === 'sector' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.25}
              roughness={0.4}
              metalness={0.6}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color={color} wireframe transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <OrbitRing radius={size * 1.8} color={color} texture={ringTexture} />
          <WorldParticles count={160} color={color} seed={seed} radius={5} />
        </>
      )}

      {world.category === 'dimension' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh geometry={new THREE.TorusKnotGeometry(size * 0.85, size * 0.08, 160, 24)}>
            <meshBasicMaterial color={color} wireframe transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <sprite position={[0, 0, 0]} scale={[size * 3.5, size * 3.5, 1]}>
            <spriteMaterial map={createGlowTexture(color)} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <WorldParticles count={220} color={color} seed={seed} radius={6} />
        </>
      )}

      {/* World title */}
      <Html center position={[0, size * 1.6 + 0.8, 0]} distanceFactor={8}>
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
