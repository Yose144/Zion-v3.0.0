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
  { angle: 0, color: '#10b981', label: { cs: 'Core Module', en: 'Core Module' } },
  { angle: (2 * Math.PI) / 5, color: '#06b6d4', label: { cs: 'Science Lab', en: 'Science Lab' } },
  { angle: (4 * Math.PI) / 5, color: '#f59e0b', label: { cs: 'Habitation Torus', en: 'Habitation Torus' } },
  { angle: (6 * Math.PI) / 5, color: '#ec4899', label: { cs: 'Quantum Motor Bay', en: 'Quantum Motor Bay' } },
  { angle: (8 * Math.PI) / 5, color: '#8b5cf6', label: { cs: 'Docking & Logistics', en: 'Docking & Logistics' } },
];

const SUN_POS = new THREE.Vector3(35, 12, 35);

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function createRingTexture() {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0f2a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 220; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size / 2;
    const r = 22 + Math.random() * 80;
    const hue = 80 + Math.random() * 70;
    const sat = 40 + Math.random() * 45;
    const light = 22 + Math.random() * 38;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.6)`;
    ctx.fill();
  }

  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size / 2;
    const r = 15 + Math.random() * 55;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170, 120, 60, 0.4)';
    ctx.fill();
  }

  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size / 2;
    const r = 25 + Math.random() * 70;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createEarthTexture() {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#061a33';
  ctx.fillRect(0, 0, w, h);

  const landColors = ['#1a4d2e', '#2d6a4f', '#3d5a25', '#4a7c2a', '#2f4f1f'];
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.8 + h * 0.1;
    const r = 100 + Math.random() * 160;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, landColors[Math.floor(Math.random() * landColors.length)]);
    grad.addColorStop(0.6, landColors[Math.floor(Math.random() * landColors.length)]);
    grad.addColorStop(1, 'rgba(6, 26, 51, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 50; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.7 + h * 0.15;
    const r = 6 + Math.random() * 28;
    ctx.fillStyle = 'rgba(60, 130, 60, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, 18, w * 0.32, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h - 18, w * 0.28, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
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

  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.8 + h * 0.1;
    const rx = 30 + Math.random() * 90;
    const ry = 8 + Math.random() * 30;
    const rot = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + Math.random() * 0.18})`;
    ctx.fill();
  }

  for (let i = 0; i < 20; i++) {
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
      grad.addColorStop(0, 'rgba(30, 58, 138, 0.9)');
      grad.addColorStop(0.5, 'rgba(30, 58, 138, 0.5)');
      grad.addColorStop(1, 'rgba(30, 58, 138, 0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
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

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function Hub() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[1.6, 1.85, 1.5, 48]} />
        <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <torusGeometry args={[1.95, 0.18, 16, 64]} />
        <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <torusGeometry args={[1.95, 0.18, 16, 64]} />
        <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.25, 0.05, 12, 64]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 1.4, 32]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.85} emissive="#38bdf8" emissiveIntensity={0.06} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <cylinderGeometry args={[0.7, 0.45, 0.25, 32]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} emissive="#e2e8f0" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function SolarPanelArray({ angle, texture }: { angle: number; texture: THREE.Texture | null }) {
  const radius = 7.0;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const groupRef = useRef<THREE.Group>(null);
  const cameraPos = new THREE.Vector3(0, 3, 18);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const p = new THREE.Vector3(x, 0, z);
    const r = new THREE.Vector3(x, 0, z).normalize().multiplyScalar(0.2);
    const sunDir = new THREE.Vector3().subVectors(SUN_POS, p).normalize();
    const camDir = new THREE.Vector3().subVectors(cameraPos, p).normalize();
    const n = new THREE.Vector3().addVectors(r, sunDir).add(camDir).normalize();
    const target = new THREE.Vector3().copy(p).sub(n);
    groupRef.current.lookAt(target);
  }, [x, z]);

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      <mesh position={[0, 0, 0.18]}>
        <boxGeometry args={[0.22, 0.22, 0.42]} />
        <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.52]}>
        <boxGeometry args={[3.0, 0.85, 0.04]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#1e3a8a'}
          roughness={0.2}
          metalness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <boxGeometry args={[3.05, 0.9, 0.02]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function StationModule({ angle, label, color, lang }: ModuleData & { lang: Lang }) {
  const radius = 6.6;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2 - angle, 0]}>
      <mesh>
        <boxGeometry args={[0.9, 0.7, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.35} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <boxGeometry args={[0.7, 0.6, 0.04]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
      <Html position={[0, 1.1, 0]} center distanceFactor={10}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-zion-cyan/30 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zion-cyan shadow-lg">
          {label[lang]}
        </div>
      </Html>
    </group>
  );
}

function Station({ lang }: { lang: Lang }) {
  const ringRef = useRef<THREE.Group>(null);
  const ringTexture = useMemo(() => createRingTexture(), []);
  const solarTexture = useMemo(() => createSolarTexture(), []);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.03;
    }
  });

  const spokeCenter = 3.6;
  const spokeLength = 2.8;
  const panelAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  const spokeAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  return (
    <group>
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6, 1, 56, 160]} />
          <meshStandardMaterial
            map={ringTexture ?? undefined}
            color={ringTexture ? '#ffffff' : '#22c55e'}
            roughness={0.45}
            metalness={0.35}
            emissive="#14532d"
            emissiveIntensity={0.12}
          />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6, 0.92, 32, 80]} />
          <meshBasicMaterial
            color="#06b6d4"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {MODULES.map((m, i) => (
          <StationModule key={i} {...m} lang={lang} />
        ))}
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[7.12, 0.12, 20, 160]} />
        <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.9} />
      </mesh>

      <Hub />

      {spokeAngles.map((angle, i) => {
        const sx = Math.cos(angle) * spokeCenter;
        const sz = Math.sin(angle) * spokeCenter;
        return (
          <mesh key={i} position={[sx, 0, sz]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.2, 0.2, spokeLength]} />
            <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.75} emissive="#f59e0b" emissiveIntensity={0.08} />
          </mesh>
        );
      })}

      {panelAngles.map((angle, i) => (
        <SolarPanelArray key={i} angle={angle} texture={solarTexture} />
      ))}
    </group>
  );
}

function Earth() {
  const groupRef = useRef<THREE.Group>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const [earthMap, cloudMap] = useMemo(() => [createEarthTexture(), createCloudTexture()], []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.01;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.015;
  });

  return (
    <group ref={groupRef} position={[0, -4, -22]} rotation={[0.08, 0, 0]}>
      <mesh>
        <sphereGeometry args={[8, 64, 64]} />
        <meshStandardMaterial
          map={earthMap ?? undefined}
          color={earthMap ? '#ffffff' : '#1e40af'}
          roughness={0.7}
          metalness={0.05}
          emissive="#1e3a8a"
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh ref={cloudRef}>
        <sphereGeometry args={[8.08, 64, 64]} />
        <meshStandardMaterial
          map={cloudMap ?? undefined}
          transparent
          opacity={0.35}
          color="#ffffff"
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[8.3, 64, 64]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function SunLight() {
  return (
    <group position={SUN_POS}>
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>
      <mesh scale={2.5}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.22} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh scale={4.5}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.08} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({ lang }: { lang: Lang }) {
  return (
    <>
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 90, 220]} />

      <hemisphereLight color="#38bdf8" groundColor="#14532d" intensity={0.6} />
      <ambientLight intensity={0.5} color="#e2e8f0" />
      <directionalLight position={SUN_POS} intensity={1.3} color="#fff7ed" />
      <pointLight position={SUN_POS} intensity={1.8} color="#fbbf24" distance={150} decay={1.2} />

      <Stars radius={110} depth={70} count={1800} factor={6} saturation={0.4} fade speed={0.4} />

      <Earth />
      <SunLight />
      <Station lang={lang} />

      <OrbitControls
        autoRotate={false}
        minDistance={12}
        maxDistance={40}
        enablePan={false}
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
        camera={{ position: [0, 3, 18], fov: 52 }}
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
