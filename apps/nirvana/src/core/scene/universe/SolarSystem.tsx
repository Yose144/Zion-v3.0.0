'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SUN_POS, EARTH_ORBIT_R, planetPosition } from './positions';
import { Html } from '@react-three/drei';
import { TextLabel } from './Label';

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

/** Slunce — povrch + pulzující korona + měkká záře, která nemá tvrdý okraj. */
function Sun() {
  const sun = useRef<THREE.Mesh>(null);
  const corona = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const tex = useLazyTexture('/textures/sun-2k.jpg');

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (sun.current) sun.current.rotation.y += delta * 0.02;
    if (corona.current) corona.current.opacity = 0.19 + Math.sin(t * 1.3) * 0.06;
    // záře je plocha, ne koule — jinak má zblízka viditelný okraj
    if (glow.current) glow.current.lookAt(camera.position);
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
      {/* vnější záře — jedna aditivní plocha s radiálním přechodem */}
      <mesh ref={glow} scale={[4.6, 4.6, 4.6]}>
        <planeGeometry args={[12, 12]} />
        <shaderMaterial
          uniforms={{ uInner: { value: new THREE.Color('#ffcf7a') }, uOuter: { value: new THREE.Color('#e4661e') } }}
          vertexShader={GLOW_VERT}
          fragmentShader={GLOW_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

const GLOW_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAG = `
precision highp float;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float halo = pow(max(0.0, 1.0 - r), 3.2) * 0.55;
  float rim = exp(-r * 7.0) * 0.5;
  vec3 col = mix(uOuter, uInner, clamp(halo * 1.8, 0.0, 1.0)) * (halo + rim);
  gl_FragColor = vec4(col, col.r + col.g * 0.5);
}
`;

interface PlanetDef {
  id: string;
  name: string;
  tex: string;
  /** Vzdálenost ve astronomických jednotkách (1 AU = dráha Země). */
  au: number;
  size: number;
  speed: number; // úhlová rychlost oběhu rad/s
  spin: number; // rotace rad/s
  tint: string; // fallback + lehký nádech
  ring?: boolean;
  /** Axiální náklon v radiánech (Uranus ~98°, Venuše retrográdní). */
  tiltZ?: number;
}

/**
 * Komprese drah: lineární AU by dalo Neptun 903 jednotek daleko, kde už není
 * vidět nic než prázdno. `r = 30 · AU^0.55` drží pořadí i poměry „blíž = těsněji“,
 * ale celá soustava se vejde do ~200 jednotek — tedy do záběru, kde je vidět
 * víc planet najednou. Země vychází přesně na 30 (EARTH_ORBIT_R).
 */
export const ORBIT_SCALE = 30;
export const ORBIT_EXP = 0.55;
export function orbitRadius(au: number): number {
  return ORBIT_SCALE * Math.pow(au, ORBIT_EXP);
}

/**
 * Dráhy: reálné AU poměry lineárně — 1 AU = 30 jednotek
 * (Merkur 0.39 → 11.7, Neptun 30.1 → 903). Zemská soustava
 * na své 3. dráze = 30. Rychlosti: Kepler ∝ r^-1.5, Země = 0.02.
 * Velikosti: reálné poměry (Jupiter 11.2× Země) × 0.45.
 * tiltZ: skutečný axiální sklon v radiánech.
 */
export const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: 'Merkur', tex: 'mercury', au: 0.387, size: 0.62, speed: 0.082, spin: 0.006, tint: '#b0a89c', tiltZ: 0.001 },
  { id: 'venus', name: 'Venuše', tex: 'venus_atmosphere', au: 0.723, size: 0.92, speed: 0.033, spin: -0.002, tint: '#e8c98a', tiltZ: 3.09 },
  { id: 'mars', name: 'Mars', tex: 'mars', au: 1.524, size: 0.74, speed: 0.011, spin: 0.024, tint: '#c1622f', tiltZ: 0.44 },
  { id: 'jupiter', name: 'Jupiter', tex: 'jupiter', au: 5.203, size: 3.6, speed: 0.0017, spin: 0.06, tint: '#d8b58c', tiltZ: 0.05 },
  { id: 'saturn', name: 'Saturn', tex: 'saturn', au: 9.537, size: 3.0, speed: 0.00067, spin: 0.055, tint: '#e3cf9f', ring: true, tiltZ: 0.47 },
  { id: 'uranus', name: 'Uran', tex: 'uranus', au: 19.19, size: 1.5, speed: 0.00024, spin: -0.04, tint: '#9fd8dc', tiltZ: 1.71 },
  { id: 'neptune', name: 'Neptun', tex: 'neptune', au: 30.07, size: 1.45, speed: 0.00012, spin: 0.04, tint: '#4d6fd1', tiltZ: 0.49 },
];

/** Jedna planeta — oběh kolem Slunce + vlastní rotace. */
function Planet({ def, index }: { def: PlanetDef; index: number }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
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

  useFrame(({ clock }, delta) => {
    if (!carrier.current) return;
    const [x, y, z] = planetPosition(def.id, index, orbitRadius(def.au), def.speed, clock.elapsedTime);
    carrier.current.position.set(x, y, z);
    if (body.current) body.current.rotation.y += delta * def.spin;
  });

  return (
    <group ref={carrier}>
      <group rotation={[0, 0, def.tiltZ ?? 0]}>
        {/* rotační osa — nakloněná přesně tak, jak planeta skutečně stojí */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([0, -def.size * 1.75, 0, 0, def.size * 1.75, 0]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={def.tint} transparent opacity={0.45} />
        </line>
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
      {/* jméno planety jako DOM popisek — ve 3D spritu je při oddálení nečitelné */}
      <Html center position={[0, def.size + 0.6, 0]} style={{ pointerEvents: 'none' }}>
        <span className="planet-label" style={{ color: def.tint }}>
          {def.name}
        </span>
      </Html>
    </group>
  );
}

export const JUPITER = PLANETS[3]!;

/** Vodící dráha planety. */
function OrbitLine({ r }: { r: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - 0.015 * (r / 30), r + 0.015 * (r / 30), 192]} />
      <meshBasicMaterial color="#8892b0" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Slunce + planety + vodící dráha Země — všechny dráhy v rovině ekliptiky. */
export function SolarSystem({ onOpenPark }: { onOpenPark?: () => void } = {}) {
  return (
    <group position={SUN_POS}>
      <Sun />
      <OrbitLine r={EARTH_ORBIT_R} />
      {PLANETS.map((p, i) => (
        <group key={p.id}>
          <OrbitLine r={orbitRadius(p.au)} />
          <Planet def={p} index={i} />
          {p.id === 'jupiter' && onOpenPark ? <JupiterStation onOpen={onOpenPark} index={i} def={p} /> : null}
        </group>
      ))}
    </group>
  );
}

/**
 * Jupiter Station sedí u Jupitera jako prstenec — z dálky je vidět jen zlatý
 * kroužek a popisek, klik otevře okno pouti.
 */
function JupiterStation({ onOpen, index, def }: { onOpen: () => void; index: number; def: PlanetDef }) {
  const ring = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const [x, y, z] = planetPosition(def.id, index, orbitRadius(def.au), def.speed, clock.elapsedTime);
    ring.current.position.set(x, y + def.size + 1.6, z);
    ring.current.rotation.y = clock.elapsedTime * 0.25;
  });

  return (
    <group
      ref={ring}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[def.size * 1.15, 0.1, 8, 64]} />
        <meshBasicMaterial color="#ffb46a" toneMapped={false} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.38, 0]} />
        <meshBasicMaterial color="#ffe9a8" toneMapped={false} />
      </mesh>
      <TextLabel text="JUPITER STATION · POUŤ" position={[0, 3.6, 0]} color="#ffb46a" height={0.8} onClick={onOpen} />
    </group>
  );
}
