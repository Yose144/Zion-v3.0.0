'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

interface ModuleData {
  angle: number;
  label: { cs: string; en: string };
  color: string;
}

const MODULES: ModuleData[] = [
  { angle: Math.PI / 6, color: '#10b981', label: { cs: 'Core Module', en: 'Core Module' } },
  { angle: Math.PI / 2, color: '#06b6d4', label: { cs: 'Science Lab', en: 'Science Lab' } },
  { angle: (5 * Math.PI) / 6, color: '#f59e0b', label: { cs: 'Habitation Torus', en: 'Habitation Torus' } },
  { angle: (7 * Math.PI) / 6, color: '#ec4899', label: { cs: 'Quantum Motor Bay', en: 'Quantum Motor Bay' } },
  { angle: (3 * Math.PI) / 2, color: '#8b5cf6', label: { cs: 'Docking & Logistics', en: 'Docking & Logistics' } },
];

const SUN_POS = new THREE.Vector3(42, 10, -20);

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/* Parkland texture for the ring's upper surface — trees, meadows, ponds */
function createRingTexture() {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#123520';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * (size / 2);
    const r = 18 + Math.random() * 70;
    const hue = 75 + Math.random() * 75;
    const sat = 42 + Math.random() * 45;
    const light = 24 + Math.random() * 36;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.6)`;
    ctx.fill();
  }

  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size;
    const y = Math.random() * (size / 2);
    const r = 10 + Math.random() * 40;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190, 150, 80, 0.35)';
    ctx.fill();
  }

  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * (size / 2);
    const r = 18 + Math.random() * 55;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/* Warm window lights strip for the hull */
function createWindowTexture() {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, w, h);

  for (let row = 0; row < 3; row++) {
    const y = 10 + row * 18;
    for (let x = 4; x < w - 6; x += 8 + Math.random() * 10) {
      const lit = Math.random() > 0.28;
      ctx.fillStyle = lit
        ? `rgba(255, ${190 + Math.floor(Math.random() * 50)}, 110, ${0.75 + Math.random() * 0.25})`
        : 'rgba(30, 36, 46, 0.9)';
      ctx.fillRect(x, y, 5, 7);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(10, 1);
  return texture;
}

function createCloudTexture() {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.85 + h * 0.08;
    const rx = 30 + Math.random() * 100;
    const ry = 8 + Math.random() * 30;
    const rot = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + Math.random() * 0.18})`;
    ctx.fill();
  }

  for (let i = 0; i < 24; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 50 + Math.random() * 120;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function createSolarTexture() {
  if (typeof document === 'undefined') return null;
  const w = 320;
  const h = 80;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, w, h);

  const cellW = w / 10;
  const cellH = h / 2;
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * cellW;
      const y = row * cellH;
      const grad = ctx.createLinearGradient(x, y, x, y + cellH);
      grad.addColorStop(0, 'rgba(30, 58, 138, 0.95)');
      grad.addColorStop(0.5, 'rgba(30, 58, 138, 0.55)');
      grad.addColorStop(1, 'rgba(30, 58, 138, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += cellW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += cellH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

/* Geodesic biodome — glass shell + gold framework + warm interior glow */
function BioDome({
  position,
  radius,
  glow = '#fbbf24',
  label,
  labelColor = '#06b6d4',
  lang,
}: {
  position: [number, number, number];
  radius: number;
  glow?: string;
  label?: { cs: string; en: string };
  labelColor?: string;
  lang: Lang;
}) {
  return (
    <group position={position}>
      {/* base collar */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[radius * 1.05, radius * 1.15, 0.14, 32]} />
        <meshStandardMaterial color="#8b98a8" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* interior vegetation floor */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[radius * 0.92, radius * 0.95, 0.05, 24]} />
        <meshStandardMaterial color="#14532d" roughness={0.8} metalness={0.05} emissive="#14532d" emissiveIntensity={0.15} />
      </mesh>
      {/* warm interior light */}
      <mesh position={[0, radius * 0.3, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[radius * 0.8, 20, 14]} />
        <meshBasicMaterial color={glow} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* glass shell */}
      <mesh>
        <sphereGeometry args={[radius, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#dbeafe"
          transparent
          opacity={0.22}
          roughness={0.08}
          metalness={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* geodesic frame */}
      <mesh>
        <sphereGeometry args={[radius * 1.002, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.4} />
      </mesh>
      {label && (
        <Html position={[0, radius + 0.55, 0]} center distanceFactor={10}>
          <div
            className="pointer-events-none whitespace-nowrap rounded border bg-black/70 px-2 py-1 text-[10px] font-semibold shadow-lg"
            style={{ borderColor: `${labelColor}55`, color: labelColor }}
          >
            {label[lang]}
          </div>
        </Html>
      )}
    </group>
  );
}

/* Central hub — tiered decks, big dome, spire, docking keel below */
function Hub() {
  return (
    <group>
      {/* main disc */}
      <mesh>
        <cylinderGeometry args={[2.7, 3.1, 0.85, 64]} />
        <meshStandardMaterial color="#9aa7b6" roughness={0.28} metalness={0.85} />
      </mesh>
      {/* balcony rails */}
      <mesh position={[0, 0.46, 0]}>
        <torusGeometry args={[2.75, 0.09, 12, 72]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.46, 0]}>
        <torusGeometry args={[2.95, 0.09, 12, 72]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* upper tier */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[1.9, 2.45, 0.7, 48]} />
        <meshStandardMaterial color="#aab6c4" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* central dome */}
      <group position={[0, 1.15, 0]}>
        <mesh>
          <sphereGeometry args={[1.35, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#dbeafe" transparent opacity={0.25} roughness={0.06} metalness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.355, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, 0.3, 0]} scale={[1, 0.6, 1]}>
          <sphereGeometry args={[1.05, 20, 14]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* spire */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.34, 0.85, 1.6, 24]} />
        <meshStandardMaterial color="#b6c2d0" roughness={0.25} metalness={0.85} emissive="#fbbf24" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <cylinderGeometry args={[0.05, 0.16, 1.5, 12]} />
        <meshStandardMaterial color="#d7dee8" roughness={0.2} metalness={0.9} emissive="#e2e8f0" emissiveIntensity={0.2} />
      </mesh>
      {/* beacon */}
      <mesh position={[0, 4.7, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#67e8f9" toneMapped={false} />
      </mesh>
      {/* keel + docked ship */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.55, 0.3, 1.5, 20]} />
        <meshStandardMaterial color="#8b98a8" roughness={0.3} metalness={0.85} />
      </mesh>
      <group position={[0, -2.15, 0]}>
        <mesh>
          <cylinderGeometry args={[0.22, 0.28, 0.9, 14]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.16, 0.35, 12]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} />
        </mesh>
      </group>
      {/* hub glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.04, 10, 72]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* Large solar wing — truss arm + wide panel field, like the hero image */
function SolarWing({ angle, texture }: { angle: number; texture: THREE.Texture | null }) {
  const inner = 7.1;
  const outer = 12.8;
  const mid = (inner + outer) / 2;
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (groupRef.current) {
      // tilt panels slightly toward the sun
      groupRef.current.rotation.x = 0.12;
    }
  }, []);

  return (
    <group position={[Math.cos(angle) * mid, 0, Math.sin(angle) * mid]} rotation={[0, -angle + Math.PI / 2, 0]}>
      <group ref={groupRef}>
        {/* truss */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, outer - inner, 10]} />
          <meshStandardMaterial color="#7d8a9a" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* panel field */}
        <group position={[(outer - inner) / 2 + 2.1, 0, 0]}>
          <mesh>
            <boxGeometry args={[5.4, 0.05, 2.9]} />
            <meshStandardMaterial
              map={texture ?? undefined}
              color={texture ? '#ffffff' : '#1e3a8a'}
              roughness={0.2}
              metalness={0.5}
              emissive="#1e40af"
              emissiveIntensity={0.18}
            />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[5.55, 0.04, 3.05]} />
            <meshStandardMaterial color="#8b98a8" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* edge frame */}
          <mesh>
            <boxGeometry args={[5.55, 0.03, 3.05]} />
            <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.15} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Station({ lang }: { lang: Lang }) {
  const ringRef = useRef<THREE.Group>(null);
  const ringTexture = useMemo(() => createRingTexture(), []);
  const windowTexture = useMemo(() => createWindowTexture(), []);
  const solarTexture = useMemo(() => createSolarTexture(), []);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.02;
    }
  });

  const spokeAngles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6, (7 * Math.PI) / 6, (3 * Math.PI) / 2, (11 * Math.PI) / 6];
  const wingAngles = [0.22, Math.PI - 0.35, Math.PI + 0.35, -0.22];
  const domeAngles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6, (7 * Math.PI) / 6, (3 * Math.PI) / 2, (11 * Math.PI) / 6];

  return (
    <group>
      {/* ── rotating habitat section ── */}
      <group ref={ringRef}>
        {/* hull */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6, 1.0, 48, 160]} />
          <meshStandardMaterial color="#b8c2cf" roughness={0.32} metalness={0.8} />
        </mesh>
        {/* parkland band on top */}
        <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6, 0.72, 40, 160]} />
          <meshStandardMaterial
            map={ringTexture ?? undefined}
            color={ringTexture ? '#ffffff' : '#22c55e'}
            roughness={0.6}
            metalness={0.15}
            emissive="#14532d"
            emissiveIntensity={0.1}
          />
        </mesh>
        {/* window light band on outer hull */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[6.99, 6.99, 0.36, 128, 1, true]} />
          <meshStandardMaterial
            map={windowTexture ?? undefined}
            emissiveMap={windowTexture ?? undefined}
            emissive="#ffca66"
            emissiveIntensity={1.15}
            color="#1a2029"
            roughness={0.4}
            metalness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* inner deck ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <torusGeometry args={[3.4, 0.3, 24, 96]} />
          <meshStandardMaterial color="#a8b4c2" roughness={0.3} metalness={0.82} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
          <torusGeometry args={[3.4, 0.2, 20, 96]} />
          <meshStandardMaterial map={ringTexture ?? undefined} color="#ffffff" roughness={0.6} metalness={0.1} emissive="#14532d" emissiveIntensity={0.08} />
        </mesh>
        {/* biodomes on the ring */}
        {domeAngles.map((angle, i) => {
          const mod = MODULES[i % MODULES.length];
          const hasLabel = i < MODULES.length;
          return (
            <BioDome
              key={i}
              position={[Math.cos(angle) * 6, 1.0, Math.sin(angle) * 6]}
              radius={0.85}
              glow={mod.color}
              label={hasLabel ? mod.label : undefined}
              labelColor={mod.color}
              lang={lang}
            />
          );
        })}
        {/* two small domes on inner ring */}
        {[Math.PI / 4, (5 * Math.PI) / 4].map((angle, i) => (
          <BioDome
            key={`inner-${i}`}
            position={[Math.cos(angle) * 3.4, 0.4, Math.sin(angle) * 3.4]}
            radius={0.42}
            glow="#67e8f9"
            lang={lang}
          />
        ))}
      </group>

      {/* ── static frame ── */}
      {/* spokes (do not rotate with ring visual, attached to hub) */}
      {spokeAngles.map((angle, i) => {
        const sx = Math.cos(angle) * 3.9;
        const sz = Math.sin(angle) * 3.9;
        return (
          <group key={`spoke-${i}`} position={[sx, 0, sz]} rotation={[0, Math.PI / 2 - angle, 0]}>
            <mesh>
              <boxGeometry args={[0.55, 0.24, 4.6]} />
              <meshStandardMaterial color="#aeb9c6" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[0.3, 0.05, 4.6]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} roughness={0.4} metalness={0.4} />
            </mesh>
          </group>
        );
      })}

      <Hub />

      {wingAngles.map((angle, i) => (
        <SolarWing key={`wing-${i}`} angle={angle} texture={solarTexture} />
      ))}
    </group>
  );
}

function Earth() {
  const groupRef = useRef<THREE.Group>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const cloudMap = useMemo(() => createCloudTexture(), []);
  const [maps, setMaps] = useState<{ color?: THREE.Texture; bump?: THREE.Texture; night?: THREE.Texture }>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/textures/earth-blue-marble.webp', (color) => {
      color.colorSpace = THREE.SRGBColorSpace;
      loader.load('/textures/earth-topology.png', (bump) => {
        loader.load('/textures/earth-dark.jpg', (night) => {
          night.colorSpace = THREE.SRGBColorSpace;
          setMaps({ color, bump, night });
        });
      });
    });
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.008;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.013;
  });

  const R = 30;

  return (
    <group position={[0, -34.5, -4]} rotation={[-0.9, 0, 0.12]}>
      <group ref={groupRef} rotation={[0, 4.5, 0]}>
        {maps.color ? (
          <mesh>
            <sphereGeometry args={[R, 96, 96]} />
            <meshLambertMaterial
              map={maps.color}
              bumpMap={maps.bump ?? undefined}
              bumpScale={0.4}
              emissiveMap={maps.night ?? undefined}
              emissive={maps.night ? '#ffcf7a' : '#000000'}
              emissiveIntensity={maps.night ? 0.3 : 0}
              color="#ffffff"
            />
          </mesh>
        ) : (
          <mesh>
            <sphereGeometry args={[R, 64, 64]} />
            <meshStandardMaterial color="#123a5e" roughness={0.7} metalness={0.02} />
          </mesh>
        )}
        <mesh ref={cloudRef}>
          <sphereGeometry args={[R * 1.006, 64, 64]} />
          <meshStandardMaterial
            map={cloudMap ?? undefined}
            transparent
            opacity={0.28}
            color="#ffffff"
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* atmosphere rim */}
      <mesh scale={1.015}>
        <sphereGeometry args={[R, 64, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.12} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={1.07}>
        <sphereGeometry args={[R, 48, 48]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.045} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SunLight() {
  return (
    <group position={SUN_POS}>
      <mesh>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </mesh>
      <mesh scale={3}>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh scale={6}>
        <sphereGeometry args={[1.1, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({ lang }: { lang: Lang }) {
  return (
    <>
      <color attach="background" args={['#04060a']} />
      <fog attach="fog" args={['#04060a', 70, 200]} />

      <hemisphereLight color="#7dd3fc" groundColor="#14532d" intensity={0.4} />
      <ambientLight intensity={0.35} color="#e2e8f0" />
      <directionalLight position={SUN_POS} intensity={1.15} color="#fff3d6" />
      <pointLight position={SUN_POS} intensity={1.2} color="#fbbf24" distance={160} decay={1.2} />
      {/* earthshine fill from below */}
      <pointLight position={[0, -20, 0]} intensity={0.35} color="#3b82f6" distance={60} decay={1.4} />

      <Stars radius={140} depth={80} count={2200} factor={6} saturation={0.35} fade speed={0.4} />

      <Earth />
      <SunLight />
      <Station lang={lang} />

      <OrbitControls
        autoRotate={false}
        minDistance={13}
        maxDistance={45}
        enablePan={false}
        maxPolarAngle={Math.PI * 0.72}
      />
    </>
  );
}

export default function L6StationPreview({
  lang = 'cs',
  className = '',
}: {
  lang?: Lang;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    setAvailable(isWebGLAvailable());
  }, []);

  if (!available) {
    return (
      <div
        className={`relative flex h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}
      >
        <p className="text-sm text-white/60">3D preview není dostupný v tomto prohlížeči. / 3D preview is not available in this browser.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}>
      <Canvas
        camera={{ position: [0, 9.5, 19], fov: 48 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene lang={lang} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 rounded border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60">
        {lang === 'cs' ? 'Otočit / přibližovat myší' : 'Drag / scroll to explore'}
      </div>
    </div>
  );
}
