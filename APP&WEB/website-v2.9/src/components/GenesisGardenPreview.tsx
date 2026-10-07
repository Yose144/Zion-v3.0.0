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

/** River Nabão — meanders along the eastern edge of the site (Agroal spring side) */
const RIVER_POINTS: [number, number][] = [
  [8.5, -24],
  [6.8, -19],
  [8.6, -14],
  [7.2, -9],
  [9.4, -4],
  [10.6, 1],
  [9.0, 6],
  [11.2, 11],
  [9.6, 16],
  [10.8, 21],
  [9.2, 26],
];

/** Caminho do Jardim — pilgrim path from the west (Fátima side) to the stone ring, then to the albergue */
const PATH_POINTS: [number, number][] = [
  [-24, 10],
  [-18, 7],
  [-13.5, 4.6],
  [-9, 3.0],
  [-5.5, 1.6],
  [-3.1, 0.4],
];

const PATH_TO_ALBERGUE: [number, number][] = [
  [2.9, -0.4],
  [4.6, -1.9],
  [6.4, -3.1],
];

const ALBERGUE_POS: [number, number, number] = [7.0, 0, -3.4];

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/** Flat ribbon geometry following a list of (x,z) points */
function makeRibbon(pts: [number, number][], width: number): THREE.BufferGeometry {
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [nx, nz] = pts[Math.min(n - 1, i + 1)];
    let dx = nx - px;
    let dz = nz - pz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const ox = -dz * (width / 2);
    const oz = dx * (width / 2);
    positions[i * 6 + 0] = x + ox;
    positions[i * 6 + 2] = z + oz;
    positions[i * 6 + 3] = x - ox;
    positions[i * 6 + 5] = z - oz;
    if (i < n - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function CrystalPyramid({
  position,
  height,
  radius,
  color,
  label,
  lang,
}: PyramidData & { lang: Lang }) {
  return (
    <group position={position}>
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

/** Albergue do Jardim — stone pilgrim hostel by the river path */
function Albergue({ lang }: { lang: Lang }) {
  return (
    <group position={ALBERGUE_POS}>
      {/* walls */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.0, 1.5]} />
        <meshStandardMaterial color="#a89070" roughness={0.9} />
      </mesh>
      {/* terracotta pyramid roof */}
      <mesh position={[0, 1.42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.45, 0.85, 4]} />
        <meshStandardMaterial color="#8a4b2f" roughness={0.85} />
      </mesh>
      {/* door */}
      <mesh position={[0.35, 0.35, 0.76]}>
        <boxGeometry args={[0.45, 0.7, 0.05]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.95} />
      </mesh>
      {/* warm window */}
      <mesh position={[-0.45, 0.55, 0.76]}>
        <boxGeometry args={[0.32, 0.32, 0.04]} />
        <meshStandardMaterial color="#ffd98a" emissive="#ffb347" emissiveIntensity={0.9} />
      </mesh>
      {/* tiny bell gable */}
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[0.22, 0.3, 0.12]} />
        <meshStandardMaterial color="#a89070" roughness={0.9} />
      </mesh>
      <Html position={[0, 2.45, 0]} center distanceFactor={12}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-amber-500/40 bg-black/70 px-2 py-1 text-[10px] font-semibold text-amber-300 shadow-lg">
          {lang === 'cs' ? 'ALBERGUE DO JARDIM — nocleh poutníka' : 'ALBERGUE DO JARDIM — pilgrim lodge'}
        </div>
      </Html>
    </group>
  );
}

/** Cypress sentinels along the Nabão bank and the pilgrim path */
const CYPRESS_POSITIONS: [number, number][] = [
  [10.4, -20.5],
  [8.4, -15.2],
  [10.0, -10.2],
  [8.8, -5.4],
  [12.4, 2.2],
  [10.4, 7.2],
  [12.8, 12.2],
  [11.0, 17.4],
  [-14.5, 6.0],
  [-10.5, 4.0],
  [-6.6, 2.4],
];

function Cypresses() {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < CYPRESS_POSITIONS.length; i++) {
      const [x, z] = CYPRESS_POSITIONS[i];
      const s = 0.9 + (i % 3) * 0.18;
      dummy.position.set(x, 0.8 * s, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CYPRESS_POSITIONS.length]} castShadow>
      <coneGeometry args={[0.34, 1.6, 7]} />
      <meshStandardMaterial color="#1c5a2e" roughness={0.9} />
    </instancedMesh>
  );
}

function Vegetation() {
  const positions = useMemo(() => {
    const out: { x: number; z: number; s: number; c: string }[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2 + (i % 3) * 0.3;
      const r = 6.5 + (i % 5) * 0.55 + Math.random() * 0.4;
      const s = 0.22 + (i % 4) * 0.09;
      out.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        s,
        c: i % 3 === 0 ? '#2f7a35' : i % 3 === 1 ? '#1f5e2a' : '#4a7a2e',
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
        c: i % 2 === 0 ? '#3a8a3f' : '#26682c',
      });
    }
    return out;
  }, []);

  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < positions.length; i++) {
      const { x, z, s, c } = positions[i];
      dummy.position.set(x, s * 0.5, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, color.set(c));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} />
    </instancedMesh>
  );
}

/** Gentle wooded hills of the Nabão valley enclosing the site */
function ValleyHills() {
  const hills: { p: [number, number, number]; r: number }[] = [
    { p: [-15, -0.4, -17], r: 7 },
    { p: [15, -0.6, -19], r: 8.5 },
    { p: [-21, -0.5, 5], r: 6.5 },
    { p: [20, -0.5, -7], r: 7.5 },
    { p: [-2, -0.8, -24], r: 9 },
    { p: [-16, -0.7, 15], r: 7 },
    { p: [19, -0.7, 17], r: 6 },
  ];
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.p} scale={[1, 0.32, 1]}>
          <sphereGeometry args={[h.r, 20, 14]} />
          <meshStandardMaterial color="#16301a" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function WaterPathAndRiver({ lang }: { lang: Lang }) {
  const riverGeo = useMemo(() => makeRibbon(RIVER_POINTS, 1.7), []);
  const riverGlowGeo = useMemo(() => makeRibbon(RIVER_POINTS, 0.7), []);
  const pathGeo = useMemo(() => makeRibbon(PATH_POINTS, 0.55), []);
  const path2Geo = useMemo(() => makeRibbon(PATH_TO_ALBERGUE, 0.45), []);

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

      {/* River Nabão — meander along the eastern edge */}
      <mesh geometry={riverGeo} position={[0, 0.018, 0]}>
        <meshPhysicalMaterial
          color="#0d5a74"
          roughness={0.08}
          metalness={0.5}
          transparent
          opacity={0.9}
          clearcoat={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* river glow highlight */}
      <mesh geometry={riverGlowGeo} position={[0, 0.021, 0]}>
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Caminho do Jardim — pilgrim path */}
      <mesh geometry={pathGeo} position={[0, 0.022, 0]}>
        <meshStandardMaterial color="#b39d72" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={path2Geo} position={[0, 0.022, 0]}>
        <meshStandardMaterial color="#b39d72" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Nabão label */}
      <Html position={[10.4, 0.9, 12]} center distanceFactor={14}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-sky-400/30 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300/90">
          {lang === 'cs' ? 'řeka Nabão · pramen Agroal' : 'Nabão river · Agroal spring'}
        </div>
      </Html>
    </>
  );
}

function GardenScene({ lang }: { lang: Lang }) {
  return (
    <>
      {/* Ground plane — valley floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 72]} />
        <meshStandardMaterial color="#142612" roughness={1} metalness={0} />
      </mesh>

      {/* Outer stone ring / gathering circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.8, 3.0, 64]} />
        <meshStandardMaterial color="#8c7a5a" roughness={0.95} />
      </mesh>

      <WaterPathAndRiver lang={lang} />
      <ValleyHills />

      {/* Three pyramids */}
      {PYRAMIDS.map((p, i) => (
        <CrystalPyramid key={i} {...p} lang={lang} />
      ))}

      {/* Central tree */}
      <CentralTree />

      {/* Pilgrim hostel */}
      <Albergue lang={lang} />

      {/* Sacred geometry above the garden */}
      <Merkaba />

      {/* Gardens and food forest */}
      <Vegetation />
      <Cypresses />
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
        camera={{ position: [0, 11.5, 18.5], fov: 46 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0a0f0a']} />
        <fog attach="fog" args={['#0a0f0a', 16, 46]} />

        <ambientLight intensity={0.45} color="#fff8e7" />
        <hemisphereLight args={['#ffe9c4', '#0c120c', 0.4]} />
        <directionalLight position={[14, 24, 12]} intensity={1.35} color="#ffd7a3" castShadow />
        <pointLight position={[0, 3.5, 0]} intensity={2.0} color="#ffd700" distance={16} decay={2} />

        <GardenScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={9}
          maxDistance={32}
          maxPolarAngle={Math.PI / 2 - 0.04}
          enablePan={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 rounded border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60">
        {lang === 'cs' ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </div>
  );
}
