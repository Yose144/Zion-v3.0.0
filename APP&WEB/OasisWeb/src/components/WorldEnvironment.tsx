'use client';

import { useMemo, useRef } from 'react';
import { useFrame, extend, type ThreeElement } from '@react-three/fiber';
import { Html, Stars, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { World } from '../domain/types/world';
import { createRandom } from '../domain/ports/random';
import { useGameStore } from '../store/gameStore';
import { CATEGORY_COLORS } from '../lib/categoryColors';
import {
  createPlanetTexture,
  createGlowTexture,
  createRingTexture,
  createCoronaTexture,
  planetSecondaryColor,
} from '../lib/planetTexture';

/**
 * Fresnel-based atmosphere glow — the rim brightens with viewing angle like
 * real planetary limb glow, instead of a flat back-side sphere. This alone
 * makes planets read as atmospheric bodies rather than painted balls.
 */
const AtmosphereMaterial = shaderMaterial(
  { uColor: new THREE.Color('#06b6d4'), uIntensity: 1.0, uPower: 2.2 },
  /* vertex */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* fragment */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uPower;
    void main() {
      float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
      float fresnel = pow(rim, uPower);
      gl_FragColor = vec4(uColor, fresnel * uIntensity);
    }
  `
);

extend({ AtmosphereMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    atmosphereMaterial: ThreeElement<typeof AtmosphereMaterial>;
  }
}

const SIZES: Record<string, number> = {
  'star-system': 2.4,
  planet: 1.3,
  sector: 1.0,
  world: 1.1,
  dimension: 1.0,
};







function AtmosphereSphere({ color, size }: { color: string; size: number }) {
  const colorObj = useMemo(() => new THREE.Color(color), [color]);
  return (
    <mesh scale={1.12}>
      <sphereGeometry args={[size, 48, 48]} />
      <atmosphereMaterial
        uColor={colorObj}
        uIntensity={1.1}
        uPower={2.4}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.FrontSide}
        toneMapped={false}
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

function AvatarHologram({ world, color, size }: { world: World; color: string; size: number }) {
  const { realQuests, avatars } = useGameStore();
  const spriteRef = useRef<THREE.Sprite>(null);
  const quest = realQuests.find((q) => {
    const loc = (q.location ?? '').toLowerCase();
    const name = (q.avatar_name ?? '').toLowerCase();
    const wn = world.name.toLowerCase();
    return loc.includes(wn) || wn.includes(loc) || name.includes(wn) || wn.includes(name);
  });
  const avatar = quest?.avatar_name
    ? avatars.find((a) => a.name?.toLowerCase() === quest.avatar_name.toLowerCase())
    : null;

  useFrame((state) => {
    if (spriteRef.current) {
      spriteRef.current.position.y = size * 1.3 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
    }
  });

  if (!quest || !avatar) return null;

  return (
    <group position={[0, 0, 0]}>
      <sprite ref={spriteRef} position={[0, size * 1.3, 0]} scale={[size * 1.6, size * 1.6, 1]}>
        <spriteMaterial
          map={createGlowTexture(color)}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <Html position={[0, size * 1.7, 0]} center distanceFactor={8}>
        <div className="pointer-events-none select-none text-center">
          <p className="text-[10px] font-bold text-white" style={{ textShadow: `0 0 8px ${color}` }}>
            {avatar.name}
          </p>
          <p className="text-[9px] text-oasis-cyan">{avatar.subtitle}</p>
        </div>
      </Html>
    </group>
  );
}


export default function WorldEnvironment({ world, isMobile = false }: { world: World; isMobile?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const color = CATEGORY_COLORS[world.category] || '#ffffff';
  const size = SIZES[world.category] || 1.0;
  const seed = useMemo(() => world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0), [world.id]);
  const mobileFactor = isMobile ? 0.5 : 1;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  const centralGeometry = useMemo(() => {
    const seg = isMobile ? 32 : 64;
    const torusSeg = isMobile ? 80 : 160;
    switch (world.category) {
      case 'star-system':
        return new THREE.SphereGeometry(size, seg, seg);
      case 'planet':
      case 'world':
        return new THREE.SphereGeometry(size, seg, seg);
      case 'sector':
        return new THREE.DodecahedronGeometry(size, 0);
      case 'dimension':
        return new THREE.TorusKnotGeometry(size * 0.55, size * 0.18, torusSeg, 24);
      default:
        return new THREE.SphereGeometry(size, seg, seg);
    }
  }, [world.category, size, isMobile]);

  const planetTexture = useMemo(() => {
    if (world.category === 'planet' || world.category === 'world') {
      const base = color;
      const secondary = planetSecondaryColor(color);
      return createPlanetTexture(base, secondary, seed, isMobile);
    }
    return null;
  }, [world.category, color, seed, isMobile]);

  const ringTexture = useMemo(() => createRingTexture(color), [color]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* distant star backdrop */}
      <Stars radius={140} depth={90} count={isMobile ? 800 : 2000} factor={3} saturation={0.65} fade speed={0.3} />

      {world.category === 'star-system' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <StarCorona color={color} size={size} />
          <SatelliteRing count={Math.floor(8 * mobileFactor)} color={color} distance={4.2} sizeBase={0.1} />
          <OrbitRing radius={4.2} color={color} />
          <WorldParticles count={Math.floor(260 * mobileFactor)} color={color} seed={seed} radius={9} />
          <AvatarHologram world={world} color={color} size={size} />
        </>
      )}

      {(world.category === 'planet' || world.category === 'world') && (
        <>
          <mesh geometry={centralGeometry}>
            <meshPhysicalMaterial
              map={planetTexture}
              color="#ffffff"
              emissive={color}
              emissiveIntensity={0.16}
              roughness={0.45}
              metalness={0.1}
              clearcoat={0.25}
              clearcoatRoughness={0.4}
              toneMapped={false}
            />
          </mesh>
          <AtmosphereSphere color={color} size={size} />
          <OrbitRing radius={size * 2.2} color={color} texture={ringTexture} />
          {world.category === 'planet' && <SatelliteRing count={Math.max(1, Math.floor(3 * mobileFactor))} color="#d4d4d4" distance={size * 2.4} sizeBase={0.06} />}
          <WorldParticles count={Math.floor(200 * mobileFactor)} color={color} seed={seed} radius={6} />
          <AvatarHologram world={world} color={color} size={size} />
        </>
      )}

      {world.category === 'sector' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshPhysicalMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.35}
              roughness={0.25}
              metalness={0.55}
              clearcoat={0.7}
              clearcoatRoughness={0.15}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color={color} wireframe transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <OrbitRing radius={size * 1.8} color={color} texture={ringTexture} />
          <WorldParticles count={Math.floor(160 * mobileFactor)} color={color} seed={seed} radius={5} />
          <AvatarHologram world={world} color={color} size={size} />
        </>
      )}

      {world.category === 'dimension' && (
        <>
          <mesh geometry={centralGeometry}>
            <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh geometry={new THREE.TorusKnotGeometry(size * 0.85, size * 0.08, isMobile ? 80 : 160, 24)}>
            <meshBasicMaterial color={color} wireframe transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <sprite position={[0, 0, 0]} scale={[size * 3.5, size * 3.5, 1]}>
            <spriteMaterial map={createGlowTexture(color)} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <WorldParticles count={Math.floor(220 * mobileFactor)} color={color} seed={seed} radius={6} />
          <AvatarHologram world={world} color={color} size={size} />
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
