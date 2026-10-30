'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SUN_POS, EARTH_ORBIT_R, hash01 } from './positions';

/**
 * Sluneční soustava — reálné textury Solar System Scope
 * (CC BY 4.0, NASA data). Měřítko stylizované — planety obíhají
 * Slunce v jeho kvadrantu scény, Nová Země zůstává centrum.
 */

function useLazyTexture(path: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    new THREE.TextureLoader().load(path, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return tex;
}

/** Slunce — povrch + pulzující korona + pomalá rotace. */
function Sun() {
  const sun = useRef<THREE.Mesh>(null);
  const corona = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useLazyTexture('/textures/sun-2k.jpg');

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (sun.current) sun.current.rotation.y += delta * 0.02;
    if (corona.current) corona.current.opacity = 0.19 + Math.sin(t * 1.3) * 0.06;
  });

  return (
    <group>
      <mesh ref={sun}>
        <sphereGeometry args={[6.0, 48, 48]} />
        {/* key → USE_MAP recompile až po načtení textury */}
        <meshBasicMaterial key={tex ? 'tex' : 'flat'} map={tex ?? undefined} color={tex ? '#ffffff' : '#ffb84d'} />
      </mesh>
      {/* vnitřní korona */}
      <mesh scale={1.12}>
        <sphereGeometry args={[6.0, 24, 24]} />
        <meshBasicMaterial ref={corona} color="#ff9a3c" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      {/* vnější žár */}
      <mesh scale={1.4}>
        <sphereGeometry args={[6.0, 16, 16]} />
        <meshBasicMaterial color="#e4661e" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={1.85}>
        <sphereGeometry args={[6.0, 12, 12]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.045} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

interface PlanetDef {
  id: string;
  tex: string;
  orbitR: number;
  size: number;
  speed: number; // úhlová rychlost oběhu rad/s
  spin: number; // rotace rad/s
  tint: string; // fallback + lehký nádech
  ring?: boolean;
  tiltZ?: number; // axiální náklon (Uranus ~98°)
}

/**
 * Dráhy: reálné AU poměry lineárně — 1 AU = 30 jednotek
 * (Merkur 0.39 → 11.7, Neptun 30.1 → 903). Zemská soustava
 * na své 3. dráze = 30. Rychlosti: Kepler ∝ r^-1.5, Země = 0.02.
 * Velikosti: reálné poměry (Jupiter 11.2× Země) × 0.45.
 * tiltZ: skutečný axiální sklon v radiánech.
 */
const PLANETS: PlanetDef[] = [
  { id: 'mercury', tex: 'mercury', orbitR: 11.7, size: 0.15, speed: 0.082, spin: 0.006, tint: '#b0a89c', tiltZ: 0.001 },
  { id: 'venus', tex: 'venus_atmosphere', orbitR: 21.6, size: 0.35, speed: 0.033, spin: -0.002, tint: '#e8c98a', tiltZ: 3.09 },
  { id: 'mars', tex: 'mars', orbitR: 45.6, size: 0.24, speed: 0.011, spin: 0.024, tint: '#c1622f', tiltZ: 0.44 },
  { id: 'jupiter', tex: 'jupiter', orbitR: 156, size: 5.0, speed: 0.0017, spin: 0.06, tint: '#d8b58c', tiltZ: 0.05 },
  { id: 'saturn', tex: 'saturn', orbitR: 288, size: 4.2, speed: 0.00067, spin: 0.055, tint: '#e3cf9f', ring: true, tiltZ: 0.47 },
  { id: 'uranus', tex: 'uranus', orbitR: 576, size: 1.8, speed: 0.00024, spin: -0.04, tint: '#9fd8dc', tiltZ: 1.71 },
  { id: 'neptune', tex: 'neptune', orbitR: 903, size: 1.75, speed: 0.00012, spin: 0.04, tint: '#4d6fd1', tiltZ: 0.49 },
];

/** Jedna planeta — oběh kolem Slunce + vlastní rotace. */
function Planet({ def, index }: { def: PlanetDef; index: number }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const angle = useRef(hash01(def.id, 5) * Math.PI * 2 + index);
  const tex = useLazyTexture(`/textures/2k_${def.tex}.jpg`);
  const ringTex = useLazyTexture(def.ring ? '/textures/2k_saturn_ring_alpha.png' : null);
  // Saturn ring: strip textura → u = radiální vzdálenost
  const ringGeo = useMemo(() => {
    if (!def.ring) return null;
    const inner = def.size * 1.35;
    const outer = def.size * 2.25;
    const g = new THREE.RingGeometry(inner, outer, 64);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    return g;
  }, [def.ring, def.size]);

  useFrame((_, delta) => {
    if (!carrier.current) return;
    angle.current += delta * def.speed;
    carrier.current.position.set(Math.cos(angle.current) * def.orbitR, 0, Math.sin(angle.current) * def.orbitR);
    if (body.current) body.current.rotation.y += delta * def.spin;
  });

  return (
    <group ref={carrier}>
      <group rotation={[0, 0, def.tiltZ ?? 0]}>
        <mesh ref={body}>
          <sphereGeometry args={[def.size, 32, 32]} />
          <meshStandardMaterial key={tex ? 'tex' : 'flat'} map={tex ?? undefined} color={tex ? '#ffffff' : def.tint} roughness={0.85} metalness={0.02} />
        </mesh>
        {def.ring && (
          <mesh rotation={[Math.PI / 2 - 0.32, 0, 0]} geometry={ringGeo ?? undefined}>
            <meshBasicMaterial key={ringTex ? 'tex' : 'flat'} map={ringTex ?? undefined} color={ringTex ? '#ffffff' : '#d9c49a'} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Vodící dráha planety. */
function OrbitLine({ r }: { r: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - 0.015 * (r / 30), r + 0.015 * (r / 30), 192]} />
      <meshBasicMaterial color="#8892b0" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Slunce + planety + vodící dráha Země — všechny dráhy v rovině ekliptiky. */
export function SolarSystem() {
  return (
    <group position={SUN_POS}>
      <Sun />
      <OrbitLine r={EARTH_ORBIT_R} />
      {PLANETS.map((p, i) => (
        <group key={p.id}>
          <OrbitLine r={p.orbitR} />
          <Planet def={p} index={i} />
        </group>
      ))}
    </group>
  );
}
