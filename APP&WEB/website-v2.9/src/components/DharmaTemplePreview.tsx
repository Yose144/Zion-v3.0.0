'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

interface DomeData {
  angle: number;
  radius: number;
  color: string;
  label: { cs: string; en: string };
}

const CENTER_DOME: DomeData = {
  angle: 0,
  radius: 1.9,
  color: '#f5ecd0',
  label: { cs: 'Hlavní chrám – sál osvícení', en: 'Main temple – hall of enlightenment' },
};

const OUTER_DOMES: DomeData[] = [
  { angle: 0, radius: 0.82, color: '#a78bfa', label: { cs: 'Meditační prostor', en: 'Meditation space' } },
  { angle: Math.PI / 3, radius: 0.82, color: '#34d399', label: { cs: 'Muzeum Země', en: 'Earth museum' } },
  { angle: (2 * Math.PI) / 3, radius: 0.82, color: '#f6e05e', label: { cs: 'Muzeum Vědění', en: 'Knowledge museum' } },
  { angle: Math.PI, radius: 0.82, color: '#63b3ed', label: { cs: 'Muzeum Poznání / Geometrie', en: 'Geometry / insight museum' } },
  { angle: (4 * Math.PI) / 3, radius: 0.82, color: '#68d391', label: { cs: 'Muzeum Přírody a řemesel', en: 'Nature & crafts museum' } },
  { angle: (5 * Math.PI) / 3, radius: 0.82, color: '#4fd1c5', label: { cs: 'Muzeum Budoucnosti a Technologií', en: 'Future & technology museum' } },
];

const BUSH_POSITIONS = [
  [4.0, 4.5, 5.0, 5.5, 6.0, 6.2],
  [3.8, 4.6, 5.2, 5.8, 6.4, 6.6],
  [4.2, 4.7, 5.4, 5.9, 6.1, 6.5],
  [3.9, 4.4, 5.1, 5.7, 6.3, 6.7],
] as const;

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function GeodesicDome({
  radius,
  position,
  color,
  label,
  lang,
}: {
  radius: number;
  position: [number, number, number];
  color: string;
  label: { cs: string; en: string };
  lang: Lang;
}) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group position={position} ref={groupRef}>
      <mesh castShadow={false} receiveShadow={false}>
        <icosahedronGeometry args={[radius, 2]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.05}
          roughness={0.1}
          transmission={0.25}
          thickness={0.5}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[radius * 1.008, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.22} />
      </mesh>
      <Html position={[0, radius + 0.45, 0]} center distanceFactor={8}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-zion-gold/30 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zion-gold shadow-lg">
          {label[lang]}
        </div>
      </Html>
    </group>
  );
}

function CentralTree() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 2.2, 8]} />
        <meshStandardMaterial color="#6b4c2a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#2d7a35" roughness={0.85} />
      </mesh>
      <mesh position={[0.4, 2.4, 0.2]} castShadow>
        <icosahedronGeometry args={[0.45, 1]} />
        <meshStandardMaterial color="#3b9a45" roughness={0.85} />
      </mesh>
      <mesh position={[-0.35, 2.35, 0.35]} castShadow>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial color="#2d7a35" roughness={0.85} />
      </mesh>
      <mesh position={[0.15, 2.7, -0.35]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color="#4caf50" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Merkaba() {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.25;
      ref.current.rotation.z += delta * 0.15;
    }
  });

  return (
    <group position={[0, 4.9, 0]} ref={ref}>
      <mesh>
        <tetrahedronGeometry args={[0.95, 0]} />
        <meshBasicMaterial color="#f6ad55" wireframe transparent opacity={0.35} />
      </mesh>
      <mesh scale={[-1, -1, -1]}>
        <tetrahedronGeometry args={[0.95, 0]} />
        <meshBasicMaterial color="#f6ad55" wireframe transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function Vegetation() {
  const positions = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2 + (i % 3) * 0.25;
      const r = 6.2 + (i % 5) * 0.45;
      const s = 0.2 + (i % 4) * 0.08;
      out.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        s,
      });
    }
    return out;
  }, []);

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f5e2a', roughness: 0.9 }), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      const { x, z, s } = positions[i];
      dummy.position.set(x, s * 0.5, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={ref} args={[geometry, material, 64]} castShadow receiveShadow />
  );
}

function TempleScene({ lang }: { lang: Lang }) {
  const outerDomeDistance = 5.5;

  return (
    <>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#0f1f12" roughness={1} metalness={0} />
      </mesh>

      {/* Reflecting pool under the central tree */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[1.35, 48]} />
        <meshPhysicalMaterial
          color="#06b6d4"
          roughness={0.04}
          metalness={0.75}
          transparent
          opacity={0.65}
          clearcoat={1}
        />
      </mesh>

      {/* Ring walkway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <torusGeometry args={[3.5, 0.12, 8, 96]} />
        <meshStandardMaterial color="#c4b896" roughness={0.9} />
      </mesh>

      {/* Radial walkways */}
      {OUTER_DOMES.map((d, i) => {
        const a = d.angle;
        const len = 4.4;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * (len / 2), 0.03, Math.sin(a) * (len / 2)]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <boxGeometry args={[0.55, 0.04, len]} />
            <meshStandardMaterial color="#c4b896" roughness={0.95} />
          </mesh>
        );
      })}

      {/* Central dome + tree */}
      <GeodesicDome
        radius={CENTER_DOME.radius}
        position={[0, CENTER_DOME.radius, 0]}
        color={CENTER_DOME.color}
        label={CENTER_DOME.label}
        lang={lang}
      />
      <CentralTree />

      {/* Outer domes */}
      {OUTER_DOMES.map((d, i) => {
        const x = Math.cos(d.angle) * outerDomeDistance;
        const z = Math.sin(d.angle) * outerDomeDistance;
        return (
          <GeodesicDome
            key={i}
            radius={d.radius}
            position={[x, d.radius, z]}
            color={d.color}
            label={d.label}
            lang={lang}
          />
        );
      })}

      {/* Sacred geometry above the temple */}
      <Merkaba />

      {/* Outer garden belt */}
      <Vegetation />
    </>
  );
}

export default function DharmaTemplePreview({
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
        camera={{ position: [0, 9, 14.5], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0a0f0a']} />
        <fog attach="fog" args={['#0a0f0a', 10, 30]} />

        <ambientLight intensity={0.45} color="#fff8e7" />
        <directionalLight position={[12, 22, 10]} intensity={1.3} color="#ffd7a3" castShadow />
        <pointLight position={[0, 3, 0]} intensity={2.2} color="#ffd700" distance={14} decay={2} />

        <TempleScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.45}
          minDistance={8}
          maxDistance={24}
          maxPolarAngle={Math.PI / 2 - 0.04}
          enablePan={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 rounded border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60">
        Drag / drag to rotate · scroll to zoom
      </div>
    </div>
  );
}
