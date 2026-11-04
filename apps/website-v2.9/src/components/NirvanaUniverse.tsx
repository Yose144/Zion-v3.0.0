'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';

export const NIRVANA_URL = 'https://nirvana.zionterranova.com';

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function useLowPower() {
  const [low, setLow] = useState(false);
  useEffect(() => {
    const small = window.matchMedia('(max-width: 768px)').matches;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    setLow(small || weak);
  }, []);
  return low;
}

/* ─── Nirvana universe math — same numbers as the real scene ────────── */

const ORBIT_SCALE = 30;
const ORBIT_EXP = 0.55;
const orbitRadius = (au: number) => ORBIT_SCALE * Math.pow(au, ORBIT_EXP);

function hash01(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function planetPosition(id: string, index: number, orbitR: number, speed: number, t: number): [number, number, number] {
  const angle = hash01(id, 5) * Math.PI * 2 + index + t * speed;
  return [Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR];
}

const LINK_COLOR = '#f5c542';
const LINK_OPACITY = 0.32;

interface PlanetDef {
  id: string;
  name: string;
  tex: string;
  au: number;
  size: number;
  speed: number;
  spin: number;
  tint: string;
  ring?: boolean;
  tiltZ?: number;
}

const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: 'Merkur', tex: 'mercury', au: 0.387, size: 0.62, speed: 0.082, spin: 0.006, tint: '#b0a89c', tiltZ: 0.001 },
  { id: 'venus', name: 'Venuše', tex: 'venus_atmosphere', au: 0.723, size: 0.92, speed: 0.033, spin: -0.002, tint: '#e8c98a', tiltZ: 3.09 },
  { id: 'mars', name: 'Mars', tex: 'mars', au: 1.524, size: 0.74, speed: 0.011, spin: 0.024, tint: '#c1622f', tiltZ: 0.44 },
  { id: 'jupiter', name: 'Jupiter', tex: 'jupiter', au: 5.203, size: 3.6, speed: 0.0017, spin: 0.06, tint: '#d8b58c', tiltZ: 0.05 },
  { id: 'saturn', name: 'Saturn', tex: 'saturn', au: 9.537, size: 3.0, speed: 0.00067, spin: 0.055, tint: '#e3cf9f', ring: true, tiltZ: 0.47 },
  { id: 'uranus', name: 'Uran', tex: 'uranus', au: 19.19, size: 1.5, speed: 0.00024, spin: -0.04, tint: '#9fd8dc', tiltZ: 1.71 },
  { id: 'neptune', name: 'Neptun', tex: 'neptune', au: 30.07, size: 1.45, speed: 0.00012, spin: 0.04, tint: '#4d6fd1', tiltZ: 0.49 },
];

const EARTH_ORBIT_R = 30;
const EARTH_ORBIT_SPEED = 0.02;
const EARTH_SIZE = 2.1;

/* ─── shared bits ─────────────────────────────────────────────────────── */

function useLazyTexture(path: string | null, onLoad?: () => void): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const cb = useRef(onLoad);
  cb.current = onLoad;
  useEffect(() => {
    if (!path) return;
    let alive = true;
    new THREE.TextureLoader().load(path, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (alive) {
        setTex(t);
        cb.current?.();
      }
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return tex;
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

/** Milky-way ESO panorama as the sky sphere — same backdrop the Nirvana universe uses. */
function SpaceBackdrop() {
  const tex = useLazyTexture('/textures/milkyway-eso-4k.jpg');
  return (
    <mesh key={tex ? 'tex' : 'flat'} scale={[-1, 1, 1]}>
      <sphereGeometry args={[880, 48, 32]} />
      <meshBasicMaterial map={tex ?? undefined} color={tex ? '#ffffff' : '#04060f'} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function Sun() {
  const corona = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);
  const tex = useLazyTexture('/textures/sun-2k.jpg');
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    if (corona.current) corona.current.opacity = 0.19 + Math.sin(t * 1.3) * 0.06;
    if (glow.current) glow.current.lookAt(camera.position);
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[6.0, 48, 48]} />
        <meshBasicMaterial key={tex ? 'tex' : 'flat'} map={tex ?? undefined} color={tex ? '#ffffff' : '#ffb84d'} />
      </mesh>
      <mesh scale={1.12}>
        <sphereGeometry args={[6.0, 24, 24]} />
        <meshBasicMaterial ref={corona} color="#ff9a3c" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
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
      <pointLight intensity={2600} distance={0} decay={2} color="#ffe2b0" />
    </group>
  );
}

function OrbitLine({ r }: { r: number }) {
  const w = Math.max(0.045, r * 0.006);
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - w, r + w, 192]} />
      <meshBasicMaterial color={LINK_COLOR} transparent opacity={LINK_OPACITY} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function PlanetLabel({ text, color, y }: { text: string; color: string; y: number }) {
  return (
    <Html center position={[0, y, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <span
        className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em]"
        style={{ color, textShadow: '0 0 10px rgba(0,0,0,0.9)' }}
      >
        {text}
      </span>
    </Html>
  );
}

function openNirvana() {
  window.open(NIRVANA_URL, '_blank', 'noopener,noreferrer');
}

/** One planet — orbit carrier + textured body + label + peek hit-sphere. */
function Planet({ def, index }: { def: PlanetDef; index: number }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const tex = useLazyTexture(`/textures/2k_${def.tex}.jpg`);
  const ringTex = useLazyTexture(def.ring ? '/textures/2k_saturn_ring_alpha.png' : null);

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
        <mesh ref={body} scale={hover ? 1.12 : 1}>
          <sphereGeometry args={[def.size, 32, 32]} />
          <meshStandardMaterial key={tex ? 'tex' : 'flat'} map={tex ?? undefined} color={tex ? '#ffffff' : def.tint} roughness={0.85} metalness={0.02} />
        </mesh>
        {def.ring && (
          <mesh rotation={[Math.PI / 2 - 0.32, 0, 0]} geometry={ringGeo ?? undefined}>
            <meshBasicMaterial key={ringTex ? 'tex' : 'flat'} map={ringTex ?? undefined} color={ringTex ? '#ffffff' : '#d9c49a'} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta < 5) openNirvana();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
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
      <PlanetLabel text={def.name} color={def.tint} y={def.size + 0.9} />
    </group>
  );
}

/** Nová Země — the first OASIS world: Earth + Moon + Issobella ring + golden label. */
function NewEarth({ onReady }: { onReady?: () => void }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const tex = useLazyTexture('/textures/earth-blue-marble.webp', onReady);
  const moonTex = useLazyTexture('/textures/2k_moon.jpg');

  useFrame(({ clock }, delta) => {
    if (!carrier.current) return;
    const t = clock.elapsedTime;
    const a = t * EARTH_ORBIT_SPEED;
    carrier.current.position.set(Math.cos(a) * EARTH_ORBIT_R, 0, Math.sin(a) * EARTH_ORBIT_R);
    if (body.current) body.current.rotation.y += delta * 0.02;
    if (moon.current) {
      const m = Math.PI * 0.35 + t * 0.05;
      moon.current.position.set(Math.cos(m) * 4.4, Math.sin(m * 0.55) * 1.2, Math.sin(m) * 4.4);
    }
  });

  return (
    <group ref={carrier}>
      {/* Issobella ring — the golden halo around the first world */}
      <mesh rotation={[Math.PI / 2 - 0.18, 0, 0]}>
        <torusGeometry args={[EARTH_SIZE * 1.65, 0.055, 8, 96]} />
        <meshBasicMaterial color="#f5c542" transparent opacity={hover ? 0.95 : 0.6} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2 - 0.18, 0, 0]}>
        <torusGeometry args={[EARTH_SIZE * 1.85, 0.03, 8, 96]} />
        <meshBasicMaterial color="#f5c542" transparent opacity={hover ? 0.7 : 0.35} toneMapped={false} />
      </mesh>
      <mesh ref={body} scale={hover ? 1.07 : 1}>
        <sphereGeometry args={[EARTH_SIZE, 48, 48]} />
        <meshStandardMaterial
          key={tex ? 'tex' : 'flat'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : '#3a6ea8'}
          roughness={0.75}
          metalness={0.05}
          emissive="#0a2f66"
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* Moon — the Matrix world */}
      <group ref={moon}>
        <mesh>
          <sphereGeometry args={[0.58, 24, 24]} />
          <meshStandardMaterial key={moonTex ? 'tex' : 'flat'} map={moonTex ?? undefined} color={moonTex ? '#ffffff' : '#9c958b'} roughness={0.9} />
        </mesh>
      </group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta < 5) openNirvana();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[EARTH_SIZE * 2.6, 24, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center position={[0, EARTH_SIZE + 1.6, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span
          className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.35em]"
          style={{ color: '#f5c542', textShadow: '0 0 14px rgba(0,0,0,0.95)' }}
        >
          Nová Země
        </span>
      </Html>
    </group>
  );
}

/* ─── scene + shell ───────────────────────────────────────────────────── */

function Scene({ onReady, reducedMotion }: { onReady?: () => void; reducedMotion: boolean }) {
  const ready = useRef(false);
  const fireReady = useCallback(() => {
    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }
  }, [onReady]);

  return (
    <>
      <ambientLight intensity={0.32} />
      <SpaceBackdrop />
      <Sun />
      <OrbitLine r={EARTH_ORBIT_R} />
      {PLANETS.map((p, i) => (
        <group key={p.id}>
          <OrbitLine r={orbitRadius(p.au)} />
          <Planet def={p} index={i} />
        </group>
      ))}
      <NewEarth onReady={fireReady} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.5}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI * 0.82}
      />
    </>
  );
}

export type NirvanaUniverseProps = {
  className?: string;
  active?: boolean;
  onReady?: () => void;
  onUnavailable?: () => void;
};

function NirvanaUniverse({ className, active = true, onReady, onUnavailable }: NirvanaUniverseProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const low = useLowPower();
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (webglOk === false) onUnavailableRef.current?.();
  }, [webglOk]);

  return (
    <div
      className={clsx(
        'relative h-[380px] w-full overflow-hidden rounded-[22px] sm:h-[440px] lg:h-[520px]',
        'border border-rasta-gold/30 bg-[#02030a]',
        'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(252,209,22,0.06)_inset,0_0_64px_rgba(6,105,40,0.12)]',
        'ring-1 ring-rasta-gold/10',
        className,
      )}
    >
      {webglOk ? (
        <Canvas
          className="h-full w-full !block"
          dpr={low ? 1 : [1, 1.5]}
          frameloop={active ? (reducedMotion ? 'demand' : 'always') : 'never'}
          gl={{ alpha: false, antialias: !low, powerPreference: low ? 'default' : 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x02030a, 1);
            gl.domElement.addEventListener('webglcontextlost', () => onUnavailableRef.current?.(), { once: true });
          }}
          camera={{ position: [0, 24, 62], fov: 42, far: 2400 }}
        >
          <Scene onReady={onReady} reducedMotion={reducedMotion} />
        </Canvas>
      ) : webglOk === false ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-[10px] text-rasta-gold/40 uppercase tracking-widest">WebGL unavailable</p>
        </div>
      ) : null}

      {/* caption overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.42em] text-rasta-gold/70 sm:text-[11px]">
          {cs ? 'Nirvana · první svět OASIS · živá scéna' : 'Nirvana · first OASIS world · live scene'}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-white/70 sm:text-xs">
              {cs ? 'Táhni pro rozhlédnutí · klik na svět = nahlédnout' : 'Drag to look around · click a world to peek inside'}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40">
              <span aria-hidden>🔒</span>
              {cs ? 'vstup na ZAP kód — svět se otevře na nirvana.zionterranova.com' : 'entry requires a ZAP code — opens nirvana.zionterranova.com'}
            </p>
          </div>
          <a
            href={NIRVANA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rasta-gold/40 bg-rasta-gold/15 px-4 py-2 text-[11px] font-semibold text-rasta-gold transition-colors hover:bg-rasta-gold/25 sm:text-xs"
          >
            {cs ? 'Nahlédnout do Nirvany' : 'Peek into Nirvana'} →
          </a>
        </div>
      </div>
    </div>
  );
}

export default memo(NirvanaUniverse);
