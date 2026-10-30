'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

function Html({ position, children }: { position: [number, number, number]; center?: boolean; distanceFactor: number; children: ReactNode }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  // The labels contain a single text-only div; render it as a sprite so it
  // belongs to the scene's React root and has no nested root to unmount.
  const text = (children as { props: { children: string } }).props.children;
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '600 28px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width + 36);
    canvas.height = 52;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(230, 210, 170, 0.5)';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.font = '600 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3e8d0';
    ctx.fillText(text, 18, 26);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    setTexture(next);
    return () => next.dispose();
  }, [text]);
  if (!texture) return null;
  return <sprite position={position} scale={[texture.image.width / 180, 52 / 180, 1]}>
    <spriteMaterial map={texture} transparent depthWrite={false} />
  </sprite>;
}

type Lang = 'cs' | 'en';

interface PyramidData {
  position: [number, number, number];
  height: number;
  radius: number;
  accent: string;
  label: { cs: string; en: string };
}

/* Uspořádání dle masterplanu — trojúhelník kolem centrální zahrady:
 * Vědomí vzadu (sever), Paměť vlevo vpředu, Budoucnost vpravo vpředu.
 * V hero mají všechny podobnou velikost, Vědomí o něco vyšší. */
const PYRAMIDS: PyramidData[] = [
  {
    // II — VĚDOMÍ (Consciousness): největší, vzadu — meditace & komunita
    position: [0, 0, -3.4],
    height: 6.6,
    radius: 3.5,
    accent: '#7dd8a8',
    label: { cs: 'VĚDOMÍ — komunita & meditace', en: 'CONSCIOUSNESS — community & meditation' },
  },
  {
    // I — PAMĚŤ (Memory): knihovna, archiv, semínka
    position: [-4.9, 0, 2.7],
    height: 5.2,
    radius: 2.75,
    accent: '#e8c98a',
    label: { cs: 'PAMĚŤ — semínka & znalosti', en: 'MEMORY — seeds & knowledge' },
  },
  {
    // III — BUDOUCNOST (ZION Lab): technologie, node
    position: [4.9, 0, 2.7],
    height: 5.2,
    radius: 2.75,
    accent: '#a8c8e8',
    label: { cs: 'BUDOUCNOST — ZION & technologie', en: 'FUTURE — ZION & technology' },
  },
];

const CORNER = Math.PI / 4; // rohy čtvercové základny pod osami

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

/** Caminho do Jardim — pilgrim path from the west (Fátima side) */
const PATH_POINTS: [number, number][] = [
  [-24, 10],
  [-18, 7],
  [-13.5, 4.6],
  [-9, 3.0],
  [-5.5, 1.6],
  [-3.6, 0.9],
];

const PATH_TO_ALBERGUE: [number, number][] = [
  [3.6, 0.2],
  [5.2, -1.4],
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

/* ─── Ocelový rám ────────────────────────────────────────────────────
 * Z řezů v konceptu: ocelová prostorová konstrukce — hrany + vodorovné
 * vazníky v úrovních pater. Všechny pruty → jeden InstancedMesh.
 */
function useFrameSegments(pyramids: PyramidData[], levels = 5) {
  return useMemo(() => {
    const segments: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const T = new THREE.Vector3();

    for (const p of pyramids) {
      const corners: THREE.Vector3[] = [];
      for (let c = 0; c < 4; c++) {
        const th = (c * Math.PI) / 2 + CORNER;
        corners.push(
          new THREE.Vector3(
            p.position[0] + Math.cos(th) * p.radius,
            0,
            p.position[2] + Math.sin(th) * p.radius,
          ),
        );
      }
      T.set(p.position[0], p.height, p.position[2]);

      // hlavní hrany: rohy → vrchol
      for (const c of corners) segments.push({ a: c.clone(), b: T.clone() });

      // vodorovné okruhy v úrovních pater (řezy v hero)
      for (let i = 1; i <= levels; i++) {
        const k = 1 - i / (levels + 1);
        for (let f = 0; f < 4; f++) {
          A.copy(T).addScaledVector(corners[f].clone().sub(T), k);
          B.copy(T).addScaledVector(corners[(f + 1) % 4].clone().sub(T), k);
          segments.push({ a: A.clone(), b: B.clone() });
        }
      }

      // diagrid mřížka na stěnách — řidší (každý 2. segment)
      for (let f = 0; f < 4; f++) {
        A.copy(corners[f]);
        B.copy(corners[(f + 1) % 4]);
        const levelPts = (i: number): THREE.Vector3[] => {
          const k = 1 - i / levels;
          const ai = T.clone().addScaledVector(A.clone().sub(T), k);
          const bi = T.clone().addScaledVector(B.clone().sub(T), k);
          const cnt = (levels - i) * 2;
          const pts: THREE.Vector3[] = [];
          for (let j = 0; j <= cnt; j++) pts.push(ai.clone().lerp(bi, cnt ? j / cnt : 0));
          return pts;
        };
        const rows: THREE.Vector3[][] = [];
        for (let i = 0; i <= levels; i++) rows.push(levelPts(i));
        for (let i = 0; i < levels; i++) {
          const bot = rows[i];
          const top = rows[i + 1];
          for (let j = 0; j < bot.length - 1; j += 2) {
            segments.push({ a: bot[j], b: bot[Math.min(j + 2, bot.length - 1)] });
          }
          for (let j = 0; j < top.length; j += 2) {
            segments.push({ a: top[j], b: bot[j] });
            segments.push({ a: top[j], b: bot[Math.min(j + 1, bot.length - 1)] });
          }
        }
      }
    }
    return segments;
  }, [pyramids, levels]);
}

function PyramidFrame({ pyramids }: { pyramids: PyramidData[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const segments = useFrameSegments(pyramids, 5);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    segments.forEach((s, i) => {
      dir.subVectors(s.b, s.a);
      const len = dir.length();
      dir.normalize();
      q.setFromUnitVectors(up, dir);
      mid.addVectors(s.a, s.b).multiplyScalar(0.5);
      dummy.position.copy(mid);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [segments]);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, segments.length]}
      frustumCulled={false}
      castShadow
    >
      <cylinderGeometry args={[0.035, 0.035, 1, 6]} />
      <meshStandardMaterial color="#e0bc6a" metalness={0.85} roughness={0.22} />
    </instancedMesh>
  );
}

/** Vegetace uvnitř pyramid — zelené trsy na terasách (skleník z hero) */
function TerraceGreens({ position, height, radius, terraces }: {
  position: [number, number, number];
  height: number;
  radius: number;
  terraces: { y: number; r: number }[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const clumps = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = [];
    let seed = Math.abs(Math.floor(position[0] * 31 + position[2] * 17 + 99)) + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const t of terraces) {
      const n = Math.floor(t.r * 5);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = t.r * (0.35 + rnd() * 0.55);
        out.push({
          p: [position[0] + Math.cos(a) * rr, t.y + 0.12 + rnd() * 0.1, position[2] + Math.sin(a) * rr],
          s: 0.14 + rnd() * 0.16,
        });
      }
    }
    // zemní patro — keře po obvodu
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
      const rr = radius * (0.5 + rnd() * 0.4);
      out.push({
        p: [position[0] + Math.cos(a) * rr, 0.25 + rnd() * 0.15, position[2] + Math.sin(a) * rr],
        s: 0.2 + rnd() * 0.18,
      });
    }
    return out;
  }, [position, radius, terraces]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    clumps.forEach((c, i) => {
      dummy.position.set(c.p[0], c.p[1], c.p[2]);
      dummy.scale.set(c.s, c.s * 0.7, c.s);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [clumps]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, clumps.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#3f7a34" roughness={0.9} emissive="#1d3a16" emissiveIntensity={0.35} />
    </instancedMesh>
  );
}

/** Prosklená pyramida — sklo, terasy, zeleň, vnitřní záře (dle hero/řezů) */
function CrystalPyramid({ position, height, radius, accent, label, lang }: PyramidData & { lang: Lang }) {
  const terraces = useMemo(() => {
    // patra z průřezu — široké kamenné/skvělé podlahy s vegetací
    const fr = [0.22, 0.4, 0.58, 0.74];
    return fr.map((f) => ({ y: height * f, r: radius * (1 - f) * 0.94 }));
  }, [height, radius]);

  return (
    <group>
      {/* sokl — kamenná pata */}
      <mesh position={[position[0], 0.11, position[2]]} rotation={[0, CORNER, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[radius * 1.06, radius * 1.13, 0.22, 4]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
      </mesh>

      {/* vnitřní terasy — patra plná zeleně, čitelné přes sklo */}
      {terraces.map((t, i) => (
        <mesh key={i} position={[position[0], t.y, position[2]]} rotation={[0, CORNER, 0]}>
          <cylinderGeometry args={[t.r, t.r * 1.02, 0.09, 4]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#4d6b35' : '#425c2d'}
            roughness={0.85}
            emissive="#2a421c"
            emissiveIntensity={0.45}
          />
        </mesh>
      ))}
      <TerraceGreens position={position} height={height} radius={radius} terraces={terraces} />

      {/* vnitřní jádro — sloup světla/strom uprostřed (Vědomí) */}
      {height > 6 && (
        <>
          <mesh position={[position[0], height * 0.42, position[2]]} castShadow>
            <cylinderGeometry args={[0.16, 0.3, height * 0.8, 8]} />
            <meshStandardMaterial color="#5e4226" roughness={0.9} />
          </mesh>
          <mesh position={[position[0], height * 0.66, position[2]]} scale={[1.15, 0.75, 1.15]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#4a9440" roughness={0.85} emissive="#2f5a22" emissiveIntensity={0.4} />
          </mesh>
        </>
      )}

      {/* sklo — průsvitná skořepina s jemným leskem */}
      <mesh position={[position[0], height / 2, position[2]]} rotation={[0, CORNER, 0]}>
        <coneGeometry args={[radius, height, 4, 1, true]} />
        <meshPhysicalMaterial
          color="#cfe8f2"
          metalness={0.5}
          roughness={0.12}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
          clearcoat={1}
          emissive="#8fb8c8"
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* accent nádech — barva mise ve skle */}
      <mesh position={[position[0], height / 2, position[2]]} rotation={[0, CORNER, 0]}>
        <coneGeometry args={[radius * 0.996, height * 0.996, 4, 1, true]} />
        <meshBasicMaterial color={accent} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* teplá záře uvnitř — skleník svítí zevnitř jako na hero */}
      <pointLight position={[position[0], height * 0.3, position[2]]} intensity={1.4} distance={radius * 2.2} color="#ffce8a" decay={2} />

      <Html position={[position[0], height + 0.55, position[2]]} center distanceFactor={11}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white/85 shadow-lg">
          {label[lang]}
        </div>
      </Html>
    </group>
  );
}

/** Strom života — mohutný rozložitý strom uprostřed kruhového náměstí */
function CentralTree() {
  const canopy = useMemo(() => {
    const blobs: { p: [number, number, number]; s: number; c: string }[] = [
      { p: [0, 3.5, 0], s: 1.9, c: '#3d7a3a' },
      { p: [1.4, 3.7, 0.4], s: 1.35, c: '#4a9440' },
      { p: [-1.4, 3.65, 0.5], s: 1.25, c: '#3d7a3a' },
      { p: [0.6, 4.15, -0.8], s: 1.15, c: '#55a04a' },
      { p: [-0.8, 4.05, -0.7], s: 1.0, c: '#4a9440' },
      { p: [1.9, 3.3, -0.5], s: 0.9, c: '#5aa854' },
      { p: [-1.85, 3.2, -0.3], s: 0.9, c: '#3d7a3a' },
      { p: [0.1, 4.6, 0.1], s: 0.85, c: '#6ab45f' },
      { p: [2.2, 3.0, 0.5], s: 0.7, c: '#4a8a3e' },
      { p: [-2.15, 2.95, 0.6], s: 0.72, c: '#3f7d38' },
      { p: [0.9, 4.3, 0.7], s: 0.6, c: '#c9a83f' },
      { p: [-0.9, 4.35, 0.2], s: 0.55, c: '#c9a83f' },
      { p: [0.3, 3.2, 1.3], s: 0.85, c: '#478a3c' },
      { p: [-0.4, 3.15, 1.25], s: 0.8, c: '#3d7a3a' },
    ];
    return blobs;
  }, []);

  return (
    <group position={[0, 0, 0.9]}>
      {/* kmen — silný, rozvětený */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.52, 2.9, 8]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[0.4, 2.5, 0.1]} rotation={[0, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.13, 0.24, 1.7, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[-0.38, 2.45, -0.05]} rotation={[0, 0, 0.32]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, 1.6, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[0.05, 2.6, -0.3]} rotation={[0.28, 0, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.18, 1.5, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <group scale={[0.85, 0.82, 0.85]}>
        {canopy.map((b, i) => (
          <mesh key={i} position={b.p} scale={[b.s, b.s * 0.72, b.s]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={b.c} roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* kořenová násobka — kamenná ohrádka */}
      <mesh position={[0, 0.14, 0]} rotation={[0, CORNER, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.28, 8]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
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
    <group position={[0, 8.6, -0.4]} ref={ref}>
      <mesh>
        <tetrahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color="#e8c25a" wireframe transparent opacity={0.3} />
      </mesh>
      <mesh scale={[-1, -1, -1]}>
        <tetrahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color="#e8c25a" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/** Albergue do Jardim — stone pilgrim hostel by the river path */
function Albergue({ lang }: { lang: Lang }) {
  return (
    <group position={ALBERGUE_POS}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.0, 1.5]} />
        <meshStandardMaterial color="#a89070" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.45, 0.85, 4]} />
        <meshStandardMaterial color="#8a4b2f" roughness={0.85} />
      </mesh>
      <mesh position={[0.35, 0.35, 0.76]}>
        <boxGeometry args={[0.45, 0.7, 0.05]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.95} />
      </mesh>
      <mesh position={[-0.45, 0.55, 0.76]}>
        <boxGeometry args={[0.32, 0.32, 0.04]} />
        <meshStandardMaterial color="#ffd98a" emissive="#ffb347" emissiveIntensity={0.9} />
      </mesh>
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
  // alej podél hlavní cesty od řeky
  [5.6, -1.2],
  [4.4, 0.8],
  [-4.2, 1.9],
  [-5.8, 2.9],
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

/** Hustá vegetace — keře, stromy, živé ploty kolem areálu (dle hero: bujná zeleň) */
function Vegetation() {
  const { positions, trees } = useMemo(() => {
    const out: { x: number; z: number; s: number; c: string }[] = [];
    const treeOut: { x: number; z: number; s: number; c: string }[] = [];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const insidePyramid = (x: number, z: number) =>
      PYRAMIDS.some(
        (p) => Math.abs(x - p.position[0]) + Math.abs(z - p.position[2]) < p.radius * 1.3,
      );
    // prstenec keřů kolem centrální zahrady
    for (let i = 0; i < 140; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 7.2 + rnd() * 5.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (insidePyramid(x, z) || (x < -9 && z < -8) || (x < -8 && z > 8)) continue;
      const s = 0.25 + rnd() * 0.35;
      out.push({
        x, z, s,
        c: i % 4 === 0 ? '#3f8a3f' : i % 4 === 1 ? '#2f7a35' : i % 4 === 2 ? '#1f5e2a' : '#4a7a2e',
      });
    }
    // listnaté stromy — širší koruny, vymezení prostoru
    for (let i = 0; i < 40; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 9.5 + rnd() * 6.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (insidePyramid(x, z) || (x < -9 && z < -8) || (x < -8 && z > 8)) continue;
      const s = 0.55 + rnd() * 0.5;
      treeOut.push({
        x, z, s,
        c: i % 3 === 0 ? '#3a8a3f' : i % 3 === 1 ? '#2a7030' : '#26682c',
      });
    }
    // ovocné sady — pravidelné řady v západní části
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const x = -16 + col * 1.5;
        const z = -6 + row * 1.6;
        if (insidePyramid(x, z) || (x < -9 && z < -8) || (x < -8 && z > 8)) continue;
        out.push({ x, z, s: 0.3 + rnd() * 0.12, c: '#4a8a3e' });
      }
    }
    // farmářské terasy na jihovýchodě
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 12 + col * 1.4;
        const z = -8 + row * 1.7;
        out.push({ x, z, s: 0.28 + rnd() * 0.12, c: row % 2 === 0 ? '#5a8a3e' : '#3f7a34' });
      }
    }
    return { positions: out, trees: treeOut };
  }, []);

  const ref = useRef<THREE.InstancedMesh>(null);
  const treeRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    if (ref.current) {
      for (let i = 0; i < positions.length; i++) {
        const { x, z, s, c } = positions[i];
        dummy.position.set(x, s * 0.5, z);
        dummy.scale.set(s, s * 0.85, s);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
        ref.current.setColorAt(i, color.set(c));
      }
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
    if (treeRef.current && trunkRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const { x, z, s, c } = trees[i];
        dummy.position.set(x, 0.5 * s + s * 0.9, z);
        dummy.scale.set(s, s * 0.8, s);
        dummy.updateMatrix();
        treeRef.current.setMatrixAt(i, dummy.matrix);
        treeRef.current.setColorAt(i, color.set(c));
        dummy.position.set(x, 0.45 * s, z);
        dummy.scale.set(s * 0.22, s * 0.9, s * 0.22);
        dummy.updateMatrix();
        trunkRef.current.setMatrixAt(i, dummy.matrix);
      }
      treeRef.current.instanceMatrix.needsUpdate = true;
      if (treeRef.current.instanceColor) treeRef.current.instanceColor.needsUpdate = true;
      trunkRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [positions, trees]);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.5, 0.65, 1, 5]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={treeRef} args={[undefined, undefined, trees.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

/** Radiální záhony — farmářské klíny mezi pyramidami (dle masterplanu) */
function GardenBeds() {
  const beds = useMemo(() => {
    // klínové sektory mezi směry k pyramidám
    const out: { a0: number; a1: number; r0: number; r1: number; c: string }[] = [];
    const spokes = [-2.5, -1.2, 0.3, 1.6, 2.9]; // úhly kvolněni pyramidám (rad)
    const palette = ['#3f6e2c', '#496f2f', '#38652a', '#54763a'];
    let k = 0;
    for (let i = 0; i < spokes.length - 1; i++) {
      const a0 = spokes[i] + 0.16;
      const a1 = spokes[i + 1] - 0.16;
      const n = 4;
      for (let j = 0; j < n; j++) {
        const t0 = 3.1 + j * 1.35;
        out.push({ a0, a1, r0: t0, r1: t0 + 1.1, c: palette[(k++) % palette.length] });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {beds.map((b, i) => {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, b.r1, b.a0, b.a1, false);
        shape.absarc(0, 0, b.r0, b.a1, b.a0, true);
        return (
          <mesh key={i} position={[0, 0.045, 0.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <shapeGeometry args={[shape, 24]} />
            <meshStandardMaterial color={b.c} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Gentle wooded hills of the Nabão valley enclosing the site */
/** A shaded gathering terrace and planted rows, inspired by the site concept. */
function GardenTerrace() {
  return (
    <group position={[12.8, 0, 7.5]} rotation={[0, -0.22, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[5.4, 0.24, 3.4]} />
        <meshStandardMaterial color="#aa9876" roughness={1} />
      </mesh>
      {[-2.25, 0, 2.25].flatMap((x) => [-1.25, 1.25].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 1.25, z]} castShadow>
          <boxGeometry args={[0.16, 2.3, 0.16]} />
          <meshStandardMaterial color="#76573a" roughness={0.9} />
        </mesh>
      )))}
      {[-1.25, 1.25].map((z) => (
        <mesh key={z} position={[0, 2.42, z]} castShadow>
          <boxGeometry args={[5.1, 0.16, 0.18]} />
          <meshStandardMaterial color="#76573a" roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-2.2 + i * 0.55, 2.49, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, 2.8]} />
          <meshStandardMaterial color="#76573a" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.58, 0]}>
        <boxGeometry args={[4.8, 0.12, 2.55]} />
        <meshStandardMaterial color="#54733d" roughness={1} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[2.1, 0.12, 0.85]} />
        <meshStandardMaterial color="#8f704a" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Temporary accommodation and a conceptual boatbuilding yard. */
function TipiCamp() {
  const tents: [number, number, number][] = [[-12, -11, 0.2], [-16, -10, -0.3], [-13.5, -15, 0.5], [-18, -14, -0.1]];
  return <group>{tents.map(([x, z, angle], i) => (
    <group key={i} position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[1.28, 1.3, 0.16, 12]} /><meshStandardMaterial color="#9b7956" roughness={1} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <coneGeometry args={[1.05, 2.2, 16, 1, true]} />
        <meshStandardMaterial color={i % 2 ? '#e1d2ae' : '#eee0c0'} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.55, 0.83]} rotation={[-0.44, 0, Math.PI]}>
        <circleGeometry args={[0.34, 3]} />
        <meshBasicMaterial color="#4a3021" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.17, 1.38]} receiveShadow>
        <boxGeometry args={[0.75, 0.12, 0.55]} /><meshStandardMaterial color="#9b7956" roughness={1} />
      </mesh>
      {[-1, 0, 1].map((j) => <mesh key={j} position={[j * 0.12, 2.27, 0]} rotation={[0, 0, j * 0.18]}>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 5]} /><meshStandardMaterial color="#71513a" />
      </mesh>)}
    </group>
  ))}</group>;
}

/** Open wooden ribs, keel and building stands distinguish construction from sailing. */
function BoatYard() {
  const hull = (z: number, key: number) => <group key={key} position={[0, 0, z]}>
    <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.09, 0.09, 6.6, 6]} /><meshStandardMaterial color="#805333" />
    </mesh>
    {Array.from({ length: 11 }, (_, i) => {
      const x = (i - 5) * 0.55;
      const width = Math.max(0.14, Math.sqrt(Math.max(0, 1 - (x / 3.35) ** 2)));
      return <mesh key={i} position={[x, 1.3, 0]} rotation={[0, Math.PI / 2, Math.PI]} scale={[width, 0.65, 1]}>
        <torusGeometry args={[1, 0.045, 6, 20, Math.PI]} /><meshStandardMaterial color="#b7814c" roughness={0.9} />
      </mesh>;
    })}
    {/* Lower planking and the rising stem make the unfinished hull legible. */}
    {[-1, 1].map((side) => <mesh key={side} position={[0, 0.76, side * 0.52]} rotation={[side * 0.35, 0, 0]}>
      <boxGeometry args={[4.9, 0.32, 0.07]} /><meshStandardMaterial color="#98673f" roughness={0.86} />
    </mesh>)}
    {[[-3.2, -0.55], [3.2, 0.55]].map(([x, tilt]) => <mesh key={x} position={[x, 0.98, 0]} rotation={[0, 0, tilt]}>
      <boxGeometry args={[0.12, 1.05, 0.12]} /><meshStandardMaterial color="#805333" />
    </mesh>)}
    {[-0.8, 0.8].map((side) => <mesh key={side} position={[0, 1.3, side]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.055, 0.055, 5.6, 5]} /><meshStandardMaterial color="#98663e" />
    </mesh>)}
    {[-2, 2].map((x) => <mesh key={x} position={[x, 0.24, 0]}>
      <boxGeometry args={[0.16, 0.48, 2.1]} /><meshStandardMaterial color="#70513a" />
    </mesh>)}
  </group>;
  return <group position={[-12.5, 0, 12.5]} rotation={[0, 0.25, 0]}>
    <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[9, 7]} /><meshStandardMaterial color="#9a8567" roughness={1} />
    </mesh>
    {hull(-1.9, 0)}
    {/* Temporary work platforms and stacked timber beside the hulls. */}
    <mesh position={[-3.9, 0.36, 0]}><boxGeometry args={[0.65, 0.72, 5.6]} /><meshStandardMaterial color="#836440" roughness={1} /></mesh>
    {[0, 1, 2].map((i) => <mesh key={i} position={[3.7, 0.12 + i * 0.12, -2.5]}>
      <boxGeometry args={[0.16, 0.1, 2.4]} /><meshStandardMaterial color="#ad8254" roughness={1} />
    </mesh>)}
    <group position={[0, 0, 1.8]}>{hull(-0.85, 1)}{hull(0.85, 2)}
      <mesh position={[0, 1.3, 0]}><boxGeometry args={[3.8, 0.12, 2.1]} /><meshStandardMaterial color="#af8053" /></mesh>
    </group>
  </group>;
}

function ValleyHills() {
  const hills: { p: [number, number, number]; r: number }[] = [
    { p: [-22, -0.4, -20], r: 5 },
    { p: [15, -0.6, -19], r: 8.5 },
    { p: [-21, -0.5, 5], r: 6.5 },
    { p: [20, -0.5, -7], r: 7.5 },
    { p: [-2, -0.8, -24], r: 9 },
    { p: [-23, -0.7, 20], r: 4 },
    { p: [19, -0.7, 17], r: 6 },
  ];
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.p} scale={[1, 0.32, 1]}>
          <sphereGeometry args={[h.r, 20, 14]} />
          <meshStandardMaterial color="#2f4a26" roughness={1} />
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
      {/* Vodní prstenec kolem Stromu života — z hero: kruhová fontána/zrcadlo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0.9]}>
        <ringGeometry args={[2.15, 2.55, 64]} />
        <meshPhysicalMaterial
          color="#2fa8c8"
          roughness={0.03}
          metalness={0.8}
          transparent
          opacity={0.85}
          clearcoat={1}
          emissive="#0a4a5e"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* kamenné lemy prstence */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0.9]}>
        <ringGeometry args={[2.5, 2.66, 64]} />
        <meshStandardMaterial color="#a8946f" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0.9]}>
        <ringGeometry args={[1.98, 2.15, 64]} />
        <meshStandardMaterial color="#a8946f" roughness={0.9} />
      </mesh>

      {/* Radiální kamenné cesty ze středu ke třem pyramidám */}
      {PYRAMIDS.map((p, i) => {
        const dx = p.position[0];
        const dz = p.position[2] - 0.9;
        const angle = Math.atan2(dx, dz);
        const len = Math.max(0.15, Math.sqrt(dx * dx + dz * dz) - p.radius * 1.05 - 2.6);
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * (2.66 + len / 2), 0.055, 0.9 + Math.cos(angle) * (2.66 + len / 2)]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.5, 0.04, len]} />
            <meshStandardMaterial color="#9d8a66" roughness={0.95} />
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
      <mesh geometry={riverGlowGeo} position={[0, 0.021, 0]}>
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Caminho do Jardim — pilgrim path */}
      <mesh geometry={pathGeo} position={[0, 0.045, 0]}>
        <meshStandardMaterial color="#b39d72" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={path2Geo} position={[0, 0.045, 0]}>
        <meshStandardMaterial color="#b39d72" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Nabão label */}
      <Html position={[10.4, 0.9, 12]} center distanceFactor={14}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-sky-400/30 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300/90">
          {lang === 'cs' ? 'údolí Nabão · směr Agroal' : 'Nabão valley · toward Agroal'}
        </div>
      </Html>
    </>
  );
}

/** Západ slunce — gradientní obloha + zářící slunce za Vědomí (dle hero) */
function SkyAndSun() {
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
          varying vec3 vP;
          void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
        `,
        fragmentShader: `
          varying vec3 vP;
          uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir;
          void main(){
            vec3 d = normalize(vP);
            vec3 c = d.y > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, d.y))
                              : mix(low, mid, smoothstep(-0.05, 0.25, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.88, 0.62) * pow(s, 380.0) * 2.2
               + vec3(1.0, 0.72, 0.4) * pow(s, 26.0) * 0.35
               + vec3(0.95, 0.6, 0.3) * pow(s, 5.0) * 0.18;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#24466a') },
          mid: { value: new THREE.Color('#a47a59') },
          low: { value: new THREE.Color('#e3ad69') },
          sunDir: { value: new THREE.Vector3(0.18, 0.1, -1).normalize() },
        },
      }),
    [],
  );

  return (
    <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 24, 16]} />
    </mesh>
  );
}

function GardenScene({ lang }: { lang: Lang }) {
  return (
    <>
      <SkyAndSun />
      {/* Země — živá zelená údolí (dle hero, ne písek) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 72]} />
        <meshStandardMaterial color="#35501f" roughness={1} metalness={0} />
      </mesh>
      {/* centrální travnatý kruh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.9]}>
        <circleGeometry args={[8.2, 64]} />
        <meshStandardMaterial color="#3f6128" roughness={1} />
      </mesh>
      {/* kamenné náměstí uprostřed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.048, 0.9]}>
        <circleGeometry args={[2.98, 48]} />
        <meshStandardMaterial color="#94855f" roughness={0.95} />
      </mesh>

      <GardenBeds />
      <WaterPathAndRiver lang={lang} />
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(angle) * 3.15, 0.12, 0.9 + Math.sin(angle) * 3.15]} scale={[0.23, 0.12, 0.18]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#a99a7a" roughness={1} />
        </mesh>;
      })}
      <ValleyHills />
      <GardenTerrace />
      <mesh position={[-13, 0.035, -7.5]} rotation={[-Math.PI / 2, 0, -0.55]} receiveShadow>
        <planeGeometry args={[0.65, 9]} /><meshStandardMaterial color="#b39d72" roughness={1} />
      </mesh>
      <TipiCamp />
      <BoatYard />

      {/* Tři prosklené pyramidy — sklo + ocelový rám + terasy se zelení */}
      {PYRAMIDS.map((p, i) => (
        <CrystalPyramid key={i} {...p} lang={lang} />
      ))}
      <PyramidFrame pyramids={PYRAMIDS} />

      {/* Strom života */}
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
        camera={{ position: [0, 8.5, 19.5], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* golden-hour atmosféra dle hero — teplá obloha, měkká mlha */}
        <color attach="background" args={['#33301f']} />
        <fog attach="fog" args={['#33301f', 24, 58]} />

        <ambientLight intensity={0.72} color="#fff3dd" />
        <hemisphereLight args={['#ffe9c4', '#24351a', 0.62]} />
        {/* nízké zadní slunce — backlight přes pyramidy jako na hero */}
        <directionalLight position={[10, 9, -14]} intensity={2.2} color="#ffb76a" castShadow />
        <directionalLight position={[-12, 16, 14]} intensity={0.85} color="#ffd9a8" />
        <pointLight position={[0, 3.5, 0.9]} intensity={2.4} color="#ffd700" distance={18} decay={2} />

        <GardenScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={9}
          maxDistance={36}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 3, 0]}
          enablePan={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 rounded border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60">
        {lang === 'cs' ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </div>
  );
}
