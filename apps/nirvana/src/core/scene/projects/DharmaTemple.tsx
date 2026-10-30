'use client';

/**
 * Dharma Temple — La Palma · Nirvana presentation.
 * Mirror of apps/website-v2.9/src/components/DharmaTemplePreview.tsx —
 * keep the two visually in sync when iterating on the model.
 */

import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

/* ─── Rozměry dle konceptu ───────────────────────────────────────────
 * Hlavní kopule ⌀ ~42 m (výška 21 m), 6 muzeí ⌀ ~28 m v hexagonu,
 * komplex na plošině, schodiště na jižní ose, Buddha před Stromem.
 */
const CENTER_R = 3.4;
const OUTER_R = 2.0;
const RING_R = 5.55;
const PLATFORM_H = 0.85;

interface OuterDome {
  angle: number; // od osy +z (jih), rad
  label: { cs: string; en: string };
}

/* Hexagon — dvě kopule čelní k schodišti (±30°), dvě boční (±90°), dvě zadní (±150°) */
const OUTER_DOMES: OuterDome[] = [
  { angle: Math.PI / 6, label: { cs: 'Meditační prostor', en: 'Meditation space' } },
  { angle: -Math.PI / 6, label: { cs: 'Muzeum Země', en: 'Earth museum' } },
  { angle: Math.PI / 2, label: { cs: 'Muzeum Vědomí', en: 'Consciousness museum' } },
  { angle: -Math.PI / 2, label: { cs: 'Muzeum Posvátné Geometrie', en: 'Sacred Geometry museum' } },
  { angle: (5 * Math.PI) / 6, label: { cs: 'Muzeum Přírody a Rostlin', en: 'Nature & Plants museum' } },
  { angle: -(5 * Math.PI) / 6, label: { cs: 'Muzeum Budoucnosti', en: 'Future & Technology museum' } },
];

function domePos(angle: number): [number, number] {
  return [Math.sin(angle) * RING_R, Math.cos(angle) * RING_R];
}

/* Geodetický rám — hrany icosahedronu jako zlaté pruty (1 InstancedMesh) */
function GeodeticFrames({ domes }: { domes: { r: number; pos: [number, number, number] }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const segments = useMemo(() => {
    const out: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    for (const d of domes) {
      const geo = new THREE.IcosahedronGeometry(d.r, 2);
      const edges = new THREE.EdgesGeometry(geo, 1);
      const arr = edges.getAttribute('position');
      for (let i = 0; i < arr.count; i += 2) {
        out.push({
          a: new THREE.Vector3(arr.getX(i) + d.pos[0], arr.getY(i) + d.pos[1], arr.getZ(i) + d.pos[2]),
          b: new THREE.Vector3(arr.getX(i + 1) + d.pos[0], arr.getY(i + 1) + d.pos[1], arr.getZ(i + 1) + d.pos[2]),
        });
      }
      geo.dispose();
      edges.dispose();
    }
    return out;
  }, [domes]);

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
    <instancedMesh ref={mesh} args={[undefined, undefined, segments.length]} frustumCulled={false} castShadow>
      <cylinderGeometry args={[0.022, 0.022, 1, 5]} />
      <meshStandardMaterial color="#d9b25f" metalness={0.8} roughness={0.3} />
    </instancedMesh>
  );
}

/** Bílá fóliová kopule — translucidní skořepina, teplá záře zevnitř (ETFE) */
function Dome({ radius, pos, lang, label, inner }: {
  radius: number;
  pos: [number, number, number];
  lang: Lang;
  label: { cs: string; en: string };
  inner?: React.ReactNode;
}) {
  return (
    <group>
      <mesh position={[pos[0], PLATFORM_H + 0.1, pos[2]]} receiveShadow castShadow>
        <cylinderGeometry args={[radius * 1.12, radius * 1.2, 0.2, 32]} />
        <meshStandardMaterial color="#9a8a6a" roughness={0.9} />
      </mesh>
      <mesh position={[pos[0], PLATFORM_H + 0.21, pos[2]]} receiveShadow>
        <cylinderGeometry args={[radius * 0.98, radius * 0.98, 0.06, 32]} />
        <meshStandardMaterial color="#7a5c38" roughness={0.85} emissive="#3a2410" emissiveIntensity={0.4} />
      </mesh>

      {inner}

      <mesh position={pos}>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#f2ead8"
          metalness={0.02}
          roughness={0.35}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
          clearcoat={0.4}
          emissive="#ffc86e"
          emissiveIntensity={0.45}
        />
      </mesh>

      <pointLight position={[pos[0], pos[1] + radius * 0.45, pos[2]]} intensity={3.4} distance={radius * 2.6} color="#ffb85e" decay={2} />

      <Html position={[pos[0], pos[1] + radius + 0.5, pos[2]]} center distanceFactor={10}>
        <div className="gg-label">{label[lang]}</div>
      </Html>
    </group>
  );
}

/** Strom života (Bodhi Gaia) — osa chrámu, koruna vyčnívá nad kopulí */
function BodhiTree() {
  const canopy = useMemo(
    () =>
      [
        { p: [0, 4.9, 0], s: 1.95, c: '#3d7a3a' },
        { p: [1.3, 5.15, 0.4], s: 1.35, c: '#4a9440' },
        { p: [-1.3, 5.1, 0.5], s: 1.25, c: '#3d7a3a' },
        { p: [0.6, 5.55, -0.6], s: 1.15, c: '#55a04a' },
        { p: [-0.65, 5.45, -0.55], s: 1.05, c: '#4a9440' },
        { p: [1.9, 4.85, -0.4], s: 0.9, c: '#5aa854' },
        { p: [-1.85, 4.8, -0.25], s: 0.92, c: '#3d7a3a' },
        { p: [0.05, 5.85, 0.05], s: 0.85, c: '#6ab45f' },
        { p: [0.72, 5.45, 0.65], s: 0.65, c: '#c9a83f' },
        { p: [-0.65, 5.5, 0.2], s: 0.58, c: '#c9a83f' },
        { p: [0.1, 6.25, -0.15], s: 0.5, c: '#6ab45f' },
      ] as { p: [number, number, number]; s: number; c: string }[],
    [],
  );

  return (
    <group>
      <mesh position={[0, PLATFORM_H + 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.55, 4.4, 9]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[0.55, PLATFORM_H + 3.4, 0.1]} rotation={[0, 0, -0.32]} castShadow>
        <cylinderGeometry args={[0.15, 0.28, 2.1, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[-0.5, PLATFORM_H + 3.35, -0.05]} rotation={[0, 0, 0.34]} castShadow>
        <cylinderGeometry args={[0.13, 0.26, 2.0, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      <mesh position={[0.05, PLATFORM_H + 3.5, -0.4]} rotation={[0.3, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, 1.9, 7]} />
        <meshStandardMaterial color="#4e3720" roughness={0.95} />
      </mesh>
      {canopy.map((b, i) => (
        <mesh key={i} position={[b.p[0], PLATFORM_H + b.p[1], b.p[2]]} scale={[b.s, b.s * 0.72, b.s]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={b.c} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, PLATFORM_H + 0.3, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, 0.32, 12]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Buddha na jižní ose — meditující před stromem */
function Buddha() {
  return (
    <group position={[0, PLATFORM_H, 4.05]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.62, 0.32, 12]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshStandardMaterial color="#c9a458" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <sphereGeometry args={[0.28, 14, 10]} />
        <meshStandardMaterial color="#c9a458" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial color="#d4b26a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.36, 0]} castShadow>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial color="#d4b26a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.05, -0.18]}>
        <torusGeometry args={[0.42, 0.035, 8, 32]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** Merkaba — rotující posvátná geometrie nad komplexem */
function Merkaba() {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.25;
      ref.current.rotation.z += delta * 0.15;
    }
  });

  return (
    <group position={[0, 8.4, 0]} ref={ref}>
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

/** Schodiště na jižní ose — cesta světla k chrámu */
function GrandStairs() {
  const steps = 14;
  const width = 1.7;
  const rise = PLATFORM_H / steps;
  const run = 0.42;

  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <mesh
          key={i}
          position={[0, PLATFORM_H - rise * (i + 0.5), 8.2 + run * (i + 0.5)]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[width, rise, run]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#a8956f' : '#9a8a64'} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 0.12), PLATFORM_H / 2 - 0.02, 8.2 + (run * steps) / 2]} receiveShadow>
          <boxGeometry args={[0.12, PLATFORM_H, run * steps]} />
          <meshStandardMaterial color="#b0985e" roughness={0.75} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 8.2 + run * steps + 1.3]} receiveShadow>
        <boxGeometry args={[width + 1.4, 0.12, 2.2]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
      </mesh>
      {/* Květ života — zlatý reliéf na nástupní plošině */}
      <mesh position={[0, 0.13, 8.2 + run * steps + 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.58, 6, 48]} />
        <meshBasicMaterial color="#e8c25a" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.5, 0.132, 8.2 + run * steps + 1.3 + Math.sin(a) * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.5, 24]} />
            <meshBasicMaterial color="#e8c25a" transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Jezírka — vodní zahrady podél schodiště a mezi kopulemi */
function WaterGardens() {
  const ponds = useMemo(() => {
    const list: { pos: [number, number, number]; r: number }[] = [];
    for (const a of [Math.PI / 3, -Math.PI / 3, (2 * Math.PI) / 3, -(2 * Math.PI) / 3]) {
      const x = Math.sin(a) * (RING_R + 0.15);
      const z = Math.cos(a) * (RING_R + 0.15);
      list.push({ pos: [x, PLATFORM_H + 0.02, z], r: 0.95 });
    }
    list.push({ pos: [-2.1, 0.03, 10.6], r: 1.1 });
    list.push({ pos: [2.1, 0.03, 10.6], r: 1.1 });
    return list;
  }, []);

  return (
    <>
      {ponds.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={p.pos}>
          <circleGeometry args={[p.r, 40]} />
          <meshPhysicalMaterial
            color="#0e7a9c"
            roughness={0.04}
            metalness={0.7}
            transparent
            opacity={0.85}
            clearcoat={1}
            emissive="#0a4a5e"
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      {ponds.map((p, i) => (
        <mesh key={`rim${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[p.pos[0], p.pos[1] + 0.004, p.pos[2]]}>
          <ringGeometry args={[p.r, p.r + 0.14, 40]} />
          <meshStandardMaterial color="#a8946f" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

/** La Palma les — hustá vegetace kolem komplexu */
function Forest() {
  const { positions, trees } = useMemo(() => {
    const out: { x: number; z: number; s: number; c: string }[] = [];
    const treeOut: { x: number; z: number; s: number; c: string }[] = [];
    let seed = 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const insideSite = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      if (d < 9.6) return true;
      if (Math.abs(x) < 2.6 && z > 7.5 && z < 16) return true;
      return false;
    };
    for (let i = 0; i < 160; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 9.8 + rnd() * 8.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (insideSite(x, z)) continue;
      const s = 0.28 + rnd() * 0.4;
      out.push({
        x, z, s,
        c: i % 4 === 0 ? '#3f8a3f' : i % 4 === 1 ? '#2f7a35' : i % 4 === 2 ? '#1f5e2a' : '#4a7a2e',
      });
    }
    for (let i = 0; i < 55; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 10.5 + rnd() * 9.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (insideSite(x, z)) continue;
      const s = 0.6 + rnd() * 0.55;
      treeOut.push({
        x, z, s,
        c: i % 3 === 0 ? '#3a8a3f' : i % 3 === 1 ? '#2a7030' : '#26682c',
      });
    }
    for (let i = 0; i < 5; i++) {
      treeOut.push({ x: -2.9, z: 15.5 + i * 1.7, s: 0.75, c: '#2f7d35' });
      treeOut.push({ x: 2.9, z: 15.5 + i * 1.7, s: 0.75, c: '#2f7d35' });
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
        dummy.position.set(x, 0.5 * s + s * 1.0, z);
        dummy.scale.set(s, s * 0.85, s);
        dummy.updateMatrix();
        treeRef.current.setMatrixAt(i, dummy.matrix);
        treeRef.current.setColorAt(i, color.set(c));
        dummy.position.set(x, 0.5 * s, z);
        dummy.scale.set(s * 0.2, s * 1.0, s * 0.2);
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

/** Západ slunce nad oceánem — gradient oblohy + slunce (La Palma) */
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
                              : mix(low, mid, smoothstep(-0.06, 0.25, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.88, 0.62) * pow(s, 380.0) * 2.2
               + vec3(1.0, 0.72, 0.4) * pow(s, 26.0) * 0.4
               + vec3(0.95, 0.6, 0.3) * pow(s, 5.0) * 0.2;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#161c26') },
          mid: { value: new THREE.Color('#5c4530') },
          low: { value: new THREE.Color('#c07a3a') },
          sunDir: { value: new THREE.Vector3(-0.75, 0.08, -0.66).normalize() },
        },
      }),
    [],
  );

  return (
    <>
      <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[120, 24, 16]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40, 0.01, -40]}>
        <circleGeometry args={[55, 48]} />
        <meshStandardMaterial color="#173a52" roughness={0.25} metalness={0.5} />
      </mesh>
    </>
  );
}

export function DharmaTempleScene({ lang }: { lang: Lang }) {
  const domes = useMemo(() => {
    const list = [{ r: CENTER_R, pos: [0, PLATFORM_H, 0] as [number, number, number] }];
    for (const d of OUTER_DOMES) {
      const [x, z] = domePos(d.angle);
      list.push({ r: OUTER_R, pos: [x, PLATFORM_H, z] });
    }
    return list;
  }, []);

  return (
    <>
      <SkyAndSun />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[34, 72]} />
        <meshStandardMaterial color="#2a4520" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, PLATFORM_H / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8.6, 9.0, PLATFORM_H, 48]} />
        <meshStandardMaterial color="#7d6f52" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PLATFORM_H + 0.005, 0]} receiveShadow>
        <circleGeometry args={[8.6, 64]} />
        <meshStandardMaterial color="#94855f" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PLATFORM_H + 0.008, 0]}>
        <ringGeometry args={[7.6, 8.3, 64]} />
        <meshStandardMaterial color="#3f6128" roughness={1} />
      </mesh>

      <WaterGardens />
      <GrandStairs />

      <Dome
        radius={CENTER_R}
        pos={[0, PLATFORM_H, 0]}
        lang={lang}
        label={{ cs: 'HLAVNÍ CHRÁM — sál osvícení', en: 'MAIN TEMPLE — hall of enlightenment' }}
        inner={<BodhiTree />}
      />

      {OUTER_DOMES.map((d, i) => {
        const [x, z] = domePos(d.angle);
        return <Dome key={i} radius={OUTER_R} pos={[x, PLATFORM_H, z]} lang={lang} label={d.label} />;
      })}
      <GeodeticFrames domes={domes} />

      <Buddha />
      <Merkaba />
      <Forest />
    </>
  );
}
