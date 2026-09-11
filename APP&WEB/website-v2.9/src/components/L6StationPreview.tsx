'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

interface ModuleData {
  angle: number;
  label: { cs: string; en: string };
  color: string;
}

const MODULES: ModuleData[] = [
  { angle: 0, color: '#9333ea', label: { cs: 'Core Module', en: 'Core Module' } },
  { angle: (2 * Math.PI) / 5, color: '#06b6d4', label: { cs: 'Science Lab', en: 'Science Lab' } },
  { angle: (4 * Math.PI) / 5, color: '#f59e0b', label: { cs: 'Habitation Torus', en: 'Habitation Torus' } },
  { angle: (6 * Math.PI) / 5, color: '#ec4899', label: { cs: 'Quantum Motor Bay', en: 'Quantum Motor Bay' } },
  { angle: (8 * Math.PI) / 5, color: '#10b981', label: { cs: 'Docking & Logistics', en: 'Docking & Logistics' } },
];

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function Earth() {
  return (
    <group position={[0, -28, -42]}>
      <mesh>
        <sphereGeometry args={[14, 64, 64]} />
        <meshStandardMaterial
          color="#1e3a8a"
          roughness={0.55}
          metalness={0.1}
          emissive="#0f172a"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[14, 64, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function SolarPanel({ position, rotation, size = [3.2, 0.04, 1.8] }: { position: [number, number, number]; rotation: [number, number, number]; size?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#0f172a" roughness={0.25} metalness={0.75} />
    </mesh>
  );
}

function StationModule({ angle, label, color, lang }: ModuleData & { lang: Lang }) {
  const radius = 7.4;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return (
    <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.0, 1.6]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.85]}>
        <boxGeometry args={[0.9, 0.9, 0.05]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
      <Html position={[0, 1.3, 0]} center distanceFactor={10}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-zion-cyan/30 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zion-cyan shadow-lg">
          {label[lang]}
        </div>
      </Html>
    </group>
  );
}

function Station({ lang }: { lang: Lang }) {
  const stationRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (stationRef.current) {
      stationRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <group ref={stationRef}>
      {/* Main rotating ring (torus) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[6, 1, 32, 80]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.45} />
      </mesh>

      {/* Inner glass / window band */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6, 0.92, 32, 80]} />
        <meshPhysicalMaterial
          color="#06b6d4"
          roughness={0.1}
          metalness={0.1}
          transparent
          opacity={0.12}
          transmission={0.25}
          thickness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central hub */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.4, 3.4, 24]} />
        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Spokes */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => {
        const r = 6;
        const x = Math.cos(angle) * r * 0.5;
        const z = Math.sin(angle) * r * 0.5;
        return (
          <mesh key={i} position={[x, 0, z]} rotation={[0, angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.28, 0.28, r]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.55} />
          </mesh>
        );
      })}

      {/* Modules */}
      {MODULES.map((m, i) => (
        <StationModule key={i} {...m} lang={lang} />
      ))}

      {/* Solar panel arrays */}
      <SolarPanel position={[0, 5.5, 0]} rotation={[0, 0, 0]} size={[10, 0.06, 3.2]} />
      <SolarPanel position={[0, 5.5, 0]} rotation={[0, Math.PI / 2, 0]} size={[10, 0.06, 3.2]} />
      <SolarPanel position={[0, -5.5, 0]} rotation={[0, 0, 0]} size={[8, 0.06, 2.4]} />
      <SolarPanel position={[0, -5.5, 0]} rotation={[0, Math.PI / 2, 0]} size={[8, 0.06, 2.4]} />

      {/* Docking port */}
      <mesh position={[0, 0, 8.8]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 1.4, 16]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Scene({ lang }: { lang: Lang }) {
  return (
    <>
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 18, 90]} />

      <ambientLight intensity={0.35} color="#e2e8f0" />
      <directionalLight position={[18, 22, 14]} intensity={1.4} color="#ffd7a3" castShadow />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#06b6d4" distance={24} decay={2} />

      <Stars radius={120} depth={80} count={3000} factor={6} saturation={0.4} fade speed={0.4} />

      <Earth />
      <Station lang={lang} />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.3}
        minDistance={14}
        maxDistance={45}
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
        shadows
        camera={{ position: [0, 5, 22], fov: 48 }}
        gl={{ antialias: true, alpha: true }}
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
