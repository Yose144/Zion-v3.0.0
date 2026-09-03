'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

interface PyramidData {
  position: [number, number, number];
  height: number;
  radius: number;
  color: string;
  label: { cs: string; en: string };
}

const PYRAMIDS: PyramidData[] = [
  {
    position: [0, 0, -2.2],
    height: 3.2,
    radius: 1.55,
    color: '#34d399',
    label: { cs: 'CONSCIOUSNESS — komunita & meditace', en: 'CONSCIOUSNESS — community & meditation' },
  },
  {
    position: [-3.6, 0, 2.6],
    height: 2.3,
    radius: 1.15,
    color: '#f6ad55',
    label: { cs: 'MEMORY — semínka & znalosti', en: 'MEMORY — seeds & knowledge' },
  },
  {
    position: [3.6, 0, 2.6],
    height: 2.3,
    radius: 1.15,
    color: '#a78bfa',
    label: { cs: 'FUTURE — ZION & technologie', en: 'FUTURE — ZION & technology' },
  },
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

function CrystalPyramid({
  position,
  height,
  radius,
  color,
  label,
  lang,
}: PyramidData & { lang: Lang }) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group position={position} ref={groupRef}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <coneGeometry args={[radius, height, 4]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.05}
          roughness={0.12}
          transmission={0.28}
          thickness={0.6}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[radius * 1.015, height * 1.015, 4]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.22} />
      </mesh>
      <Html position={[0, height + 0.5, 0]} center distanceFactor={10}>
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
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.28, 2.6, 8]} />
        <meshStandardMaterial color="#6b4c2a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color="#2d7a35" roughness={0.85} />
      </mesh>
      <mesh position={[0.55, 2.85, 0.25]} castShadow>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color="#3b9a45" roughness={0.85} />
      </mesh>
      <mesh position={[-0.5, 2.75, 0.45]} castShadow>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#2d7a35" roughness={0.85} />
      </mesh>
      <mesh position={[0.2, 3.15, -0.45]} castShadow>
        <icosahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial color="#4caf50" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Merkaba() {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.2;
      ref.current.rotation.z += delta * 0.12;
    }
  });

  return (
    <group position={[0, 5.2, 0]} ref={ref}>
      <mesh>
        <tetrahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color="#f6ad55" wireframe transparent opacity={0.3} />
      </mesh>
      <mesh scale={[-1, -1, -1]}>
        <tetrahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color="#f6ad55" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function Vegetation() {
  const positions = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2 + (i % 3) * 0.3;
      const r = 6.5 + (i % 5) * 0.55 + Math.random() * 0.4;
      const s = 0.22 + (i % 4) * 0.09;
      out.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        s,
      });
    }
    // Food forest / orchard clusters
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 8.5 + Math.random() * 4;
      const s = 0.35 + Math.random() * 0.3;
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
    <instancedMesh ref={ref} args={[geometry, material, positions.length]} castShadow receiveShadow />
  );
}

function WaterAndLandscape() {
  return (
    <>
      {/* Central reflecting pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.6, 56]} />
        <meshPhysicalMaterial
          color="#06b6d4"
          roughness={0.04}
          metalness={0.75}
          transparent
          opacity={0.65}
          clearcoat={1}
        />
      </mesh>

      {/* Radial water channels to the three pyramids */}
      {PYRAMIDS.map((p, i) => {
        const dx = p.position[0];
        const dz = p.position[2];
        const angle = Math.atan2(dx, dz);
        const len = Math.sqrt(dx * dx + dz * dz) - p.radius * 0.8;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * (len / 2), 0.03, Math.cos(angle) * (len / 2)]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.28, 0.03, len]} />
            <meshPhysicalMaterial
              color="#06b6d4"
              roughness={0.05}
              metalness={0.7}
              transparent
              opacity={0.55}
            />
          </mesh>
        );
      })}

      {/* Distant ocean plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, -18]} receiveShadow>
        <planeGeometry args={[120, 60]} />
        <meshStandardMaterial color="#0e4a5e" roughness={0.15} metalness={0.35} transparent opacity={0.85} />
      </mesh>
    </>
  );
}

function GardenScene({ lang }: { lang: Lang }) {
  return (
    <>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#142612" roughness={1} metalness={0} />
      </mesh>

      {/* Outer stone ring / gathering circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.8, 3.0, 64]} />
        <meshStandardMaterial color="#8c7a5a" roughness={0.95} />
      </mesh>

      <WaterAndLandscape />

      {/* Three pyramids */}
      {PYRAMIDS.map((p, i) => (
        <CrystalPyramid key={i} {...p} lang={lang} />
      ))}

      {/* Central tree */}
      <CentralTree />

      {/* Sacred geometry above the garden */}
      <Merkaba />

      {/* Gardens and food forest */}
      <Vegetation />
    </>
  );
}

export default function GenesisGardenPreview({
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
        camera={{ position: [0, 10, 16.5], fov: 46 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0a0f0a']} />
        <fog attach="fog" args={['#0a0f0a', 12, 38]} />

        <ambientLight intensity={0.5} color="#fff8e7" />
        <directionalLight position={[14, 24, 12]} intensity={1.35} color="#ffd7a3" castShadow />
        <pointLight position={[0, 3.5, 0]} intensity={2.0} color="#ffd700" distance={16} decay={2} />

        <GardenScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={9}
          maxDistance={28}
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
