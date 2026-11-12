'use client';

/*
 * The Nirvana universe preview — the only part of the landing page that needs
 * three.js (~950 KB of JS before compression). It lives in its own module so
 * the parent can `dynamic()` it: phones and data-saver connections get the
 * static poster and load this on tap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const NIRVANA_URL = 'https://nirvana.zionterranova.com';

type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

function useIntroLang(): Lang {
  const [lang, setLang] = useState<Lang>('cs');
  useEffect(() => {
    const read = () => {
      const code = document.documentElement.lang;
      setLang(code === 'en' || code === 'es' || code === 'pt' || code === 'fr' ? code : 'cs');
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => mo.disconnect();
  }, []);
  return lang;
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/* ─── same universe math as the Nirvana scene ─────────────────────── */

const orbitRadius = (au: number) => 30 * Math.pow(au, 0.55);

function hash01(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

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
  { id: 'mercury', name: 'Merkur', tex: 'mercury-768', au: 0.387, size: 0.62, speed: 0.082, spin: 0.006, tint: '#b0a89c', tiltZ: 0.001 },
  { id: 'venus', name: 'Venuše', tex: 'venus-768', au: 0.723, size: 0.92, speed: 0.033, spin: -0.002, tint: '#e8c98a', tiltZ: 3.09 },
  { id: 'mars', name: 'Mars', tex: 'mars-768', au: 1.524, size: 0.74, speed: 0.011, spin: 0.024, tint: '#c1622f', tiltZ: 0.44 },
  { id: 'jupiter', name: 'Jupiter', tex: 'jupiter-768', au: 5.203, size: 3.6, speed: 0.0017, spin: 0.06, tint: '#d8b58c', tiltZ: 0.05 },
  { id: 'saturn', name: 'Saturn', tex: 'saturn-768', au: 9.537, size: 3.0, speed: 0.00067, spin: 0.055, tint: '#e3cf9f', ring: true, tiltZ: 0.47 },
  { id: 'uranus', name: 'Uran', tex: 'uranus-768', au: 19.19, size: 1.5, speed: 0.00024, spin: -0.04, tint: '#9fd8dc', tiltZ: 1.71 },
  { id: 'neptune', name: 'Neptun', tex: 'neptune-768', au: 30.07, size: 1.45, speed: 0.00012, spin: 0.04, tint: '#4d6fd1', tiltZ: 0.49 },
];

const EARTH_ORBIT_R = 30;
const EARTH_ORBIT_SPEED = 0.02;
const EARTH_SIZE = 2.1;
const LINK_COLOR = '#f5c542';
const LINK_OPACITY = 0.32;

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

function SpaceBackdrop() {
  const tex = useLazyTexture('/textures/milkyway-1k.webp');
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
  const tex = useLazyTexture('/textures/sun-1k.webp');
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

/** 3D text label as a sprite — canvas → CanvasTexture → sprite. */
function TextLabel({ text, position, color = '#cfe3ff', height = 1.6 }: { text: string; position: [number, number, number]; color?: string; height?: number }) {
  const { tex, aspect } = useMemo(() => {
    const font = '600 44px "Segoe UI", system-ui, sans-serif';
    const m = document.createElement('canvas').getContext('2d')!;
    m.font = font;
    const tw = Math.ceil(m.measureText(text).width) + 40;
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, 20, 42);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, aspect: tw / 80 };
  }, [text, color]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

function openNirvana() {
  window.open(NIRVANA_URL, '_blank', 'noopener,noreferrer');
}

function Planet({ def, index }: { def: PlanetDef; index: number }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const tex = useLazyTexture(`/textures/${def.tex}.webp`);
  const ringTex = useLazyTexture(def.ring ? '/textures/saturn-ring-512.webp' : null);

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
    const angle = hash01(def.id, 5) * Math.PI * 2 + index + clock.elapsedTime * def.speed;
    const orbitR = orbitRadius(def.au);
    carrier.current.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
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
      <TextLabel text={def.name} position={[0, def.size + 1.6, 0]} color={def.tint} height={1.5} />
    </group>
  );
}

function NewEarth({ onReady }: { onReady?: () => void }) {
  const carrier = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const tex = useLazyTexture('/textures/earth-512.webp', onReady);
  const moonTex = useLazyTexture('/textures/moon-512.webp');

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
      <TextLabel text="Nová Země" position={[0, EARTH_SIZE + 2.2, 0]} color="#f5c542" height={2.1} />
    </group>
  );
}

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

export interface UniverseCanvasProps {
  active?: boolean;
  onReady?: () => void;
  onUnavailable?: () => void;
}

export default function UniverseCanvas({ active = true, onReady, onUnavailable }: UniverseCanvasProps) {
  const lang = useIntroLang();
  const cs = lang === 'cs';
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
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
    <div className="nirvana-embed-frame">
      {webglOk ? (
        <Canvas
          className="nirvana-canvas"
          dpr={[1, 1.5]}
          frameloop={active ? (reducedMotion ? 'demand' : 'always') : 'never'}
          gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x02030a, 1);
            gl.domElement.addEventListener(
              'webglcontextlost',
              () => onUnavailableRef.current?.(),
              { once: true }
            );
          }}
          camera={{ position: [0, 30, 82], fov: 42, far: 2400 }}
        >
          <Scene onReady={onReady} reducedMotion={reducedMotion} />
        </Canvas>
      ) : webglOk === false ? (
        <div className="nirvana-embed-fallback">
          <p>{cs ? 'WebGL není dostupné' : 'WebGL unavailable'}</p>
        </div>
      ) : null}

      <div className="nirvana-embed-top">
        <p>{cs ? 'Nirvana · první svět OASIS · živá scéna' : 'Nirvana · first OASIS world · live scene'}</p>
      </div>

      <div className="nirvana-embed-bottom">
        <div>
          <p>{cs ? 'Táhni pro rozhlédnutí · klik na svět = nahlédnout' : 'Drag to look around · click a world to peek inside'}</p>
          <p className="nirvana-embed-lock">
            🔒 {cs ? 'vstup na ZAP kód' : 'entry requires a ZAP code'}
          </p>
        </div>
        <a href={NIRVANA_URL} target="_blank" rel="noopener noreferrer" className="nirvana-embed-cta">
          {cs ? 'Nahlédnout do Nirvany' : 'Peek into Nirvana'} →
        </a>
      </div>
    </div>
  );
}
