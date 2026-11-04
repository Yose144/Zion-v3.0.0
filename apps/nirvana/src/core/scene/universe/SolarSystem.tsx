'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SUN_POS, EARTH_ORBIT_R, planetPosition } from './positions';
import { LINK_COLOR, LINK_OPACITY, LINK_WIDTH, orbitWidth } from './links';
import { Html } from '@react-three/drei';
import { StarGate } from './StarGate';
import type { Portal } from '@/core/portals/manifest';
import { PLANETS, orbitRadius, type PlanetDef, type PlanetId } from './planetCatalog';
import { NavHalo } from './NavHalo';
import { proceduralTexture } from './proceduralTexture';

// Zpětně kompatibilní re-export — ostatní moduly (a testy) importují odsud.
export { PLANETS, ORBIT_SCALE, ORBIT_EXP, orbitRadius, JUPITER } from './planetCatalog';
export type { PlanetDef } from './planetCatalog';

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

  useFrame(({ clock, camera }, delta) => {
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

/** Jedna planeta — oběh kolem Slunce + vlastní rotace. */
function Planet({
  def,
  index,
  lang,
  selected,
  onSelect,
  gate,
}: {
  def: PlanetDef;
  index: number;
  lang: 'cs' | 'en';
  selected: boolean;
  onSelect?: (id: PlanetId) => void;
  /** Brána je dítě planety — obíhá s ní (Jupiter ji drží pořád nablízku). */
  gate?: { portal: Portal; onOpen: (id: string) => void };
}) {
  const [hover, setHover] = useState(false);
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const interactive = Boolean(def.game && onSelect);
  const lazyTex = useLazyTexture(def.procedural ? null : `/textures/2k_${def.tex}.jpg`);
  const tex = def.procedural ? proceduralTexture(def.id, def.tint) : lazyTex;
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

  useFrame(({ clock, camera }, delta) => {
    if (!carrier.current) return;
    const [x, y, z] = planetPosition(def.id, index, orbitRadius(def.au), def.speed, clock.elapsedTime);
    carrier.current.position.set(x, y, z);
    if (body.current) body.current.rotation.y += delta * def.spin;
  });

  return (
    <group ref={carrier}>
      <group rotation={[0, 0, def.tiltZ ?? 0]}>
        {/* rotační osa — nakloněná přesně tak, jak planeta skutečně stojí.
            Stejná linka jako dráhy (links.ts): světová šířka, ne 1px vlas,
            který při oddálení mizí. */}
        <mesh>
          <boxGeometry args={[LINK_WIDTH, def.size * 3.5, LINK_WIDTH]} />
          <meshBasicMaterial
            color={LINK_COLOR}
            transparent
            opacity={LINK_OPACITY}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
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
      {/* jednotný hover indikátor — stejný kruh jako u všech ostatních odkazů.
          Žádný název pod ním; jméno ukáže až panel po kliknutí. */}
      {interactive && (
        <NavHalo
          active={hover || selected}
          color={def.tint}
          radius={def.size * 1.75}
          thickness={Math.max(0.02, def.size * 0.05)}
        />
      )}

      {/* neviditelná hit-sféra — 0,74 jednotky Marsu se na klik netrefí */}
      {interactive && (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            // Jediná cesta: klik označí planetu, `focus` prop spustí přelet
            // v `LinkEngine`. Žádné druhé flyTo s půjčenou kamerou.
            onSelect?.(def.id as PlanetId);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHover(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <sphereGeometry args={[Math.max(def.size * 2.6, 2.6), 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Neinteraktivní planety (Saturn…) nejsou odkazy — nesou jen tlumené
          jméno pro orientaci. Interaktivní světy jméno nemají: hover = kruh,
          klik = panel. */}
      {!interactive && (
        <Html center position={[0, def.size + 0.6, 0]} style={{ pointerEvents: 'none' }}>
          <span className="planet-label" style={{ color: def.tint }}>
            {def.name}
          </span>
        </Html>
      )}

      {/* brána do OASIS — připnutá k téhle planetě (Jupiter), ne k Zemi */}
      {gate && <StarGate portal={gate.portal} onOpen={gate.onOpen} />}
    </group>
  );
}


/** Vodící dráha planety — jedna barva a průhlednost s ostatními linkami (links.ts). */
function OrbitLine({ r }: { r: number }) {
  const w = orbitWidth(r) / 2;
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - w, r + w, 192]} />
      <meshBasicMaterial
        color={LINK_COLOR}
        transparent
        opacity={LINK_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Slunce + planety + vodící dráha Země — všechny dráhy v rovině ekliptiky. */
export function SolarSystem({
  onOpenPark,
  onSelectPlanet,
  focused = 'earth',
  lang = 'cs',
  gatePortal = null,
  onOpenPortal,
}: {
  onOpenPark?: () => void;
  onSelectPlanet?: (id: PlanetId) => void;
  focused?: string;
  lang?: 'cs' | 'en';
  /** Brána do OASIS — vykreslí se jako dítě Jupiteru. */
  gatePortal?: Portal | null;
  onOpenPortal?: (id: string) => void;
} = {}) {
  const gate =
    gatePortal && onOpenPortal ? { portal: gatePortal, onOpen: onOpenPortal } : undefined;
  return (
    <group position={SUN_POS}>
      <Sun />
      <OrbitLine r={EARTH_ORBIT_R} />
      {PLANETS.map((p, i) => (
        <group key={p.id}>
          <OrbitLine r={orbitRadius(p.au)} />
          <Planet
            def={p}
            index={i}
            lang={lang}
            selected={focused === p.id}
            onSelect={onSelectPlanet}
            gate={p.id === 'jupiter' ? gate : undefined}
          />
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
  const [hover, setHover] = useState(false);

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
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <NavHalo active={hover} color="#ffb46a" radius={def.size * 1.35} thickness={def.size * 0.06} />
      <mesh rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[def.size * 1.15, 0.1, 8, 64]} />
        <meshBasicMaterial color="#ffb46a" toneMapped={false} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.38, 0]} />
        <meshBasicMaterial color="#ffe9a8" toneMapped={false} />
      </mesh>
    </group>
  );
}
