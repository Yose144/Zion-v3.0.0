/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── Bodhi Lanka — Akáša Node, Srí Lanka ─────────────────────────────
 * Dle koncept boardu: centrální Sri Maha Bodhi (živý strom osvícení) na
 * ostrově uprostřed lotosového jezírka, 5 otevřených pavilonů se
 * střechami z lotosových lupínků, klenuté můstky Rama Setu, osa
 * Anuradhapura s bílými dagobami, džungle a zlatý soumrak.
 * Parametry: areál ⌀~120 m, jezírko ⌀36 m, Bodhi ~22 m, pavilon 8–10 m.
 */

const DEG = Math.PI / 180;
const ISLAND_R = 11;
const POND_OUT = 21;
const PAV_DIST = 27;
const WATER_Y = -0.12;

function polar(azDeg: number, d: number): [number, number] {
  const a = azDeg * DEG;
  return [Math.sin(a) * d, -Math.cos(a) * d];
}

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

interface PavilionDef {
  az: number;
  name: { cs: string; en: string };
  accent: string;
  big?: boolean;
}
const PAVILIONS: PavilionDef[] = [
  { az: 0, name: { cs: 'Sál Akáši', en: 'Akasha Hall' }, accent: '#ffd98a', big: true },
  { az: 72, name: { cs: 'Síň Srdce', en: 'Heart Hall' }, accent: '#ff9a7a' },
  { az: 144, name: { cs: 'Meditační pavilon', en: 'Meditation Pavilion' }, accent: '#8ad4c8' },
  { az: 216, name: { cs: 'Meditační pavilon', en: 'Meditation Pavilion' }, accent: '#8ad4c8' },
  { az: 288, name: { cs: 'Síň Společenství', en: 'Community Hall' }, accent: '#c8a8f0' },
];

/** lotosový pavilon — pódium na vodě, sloupočelí, dvě řady lupínků */
function Pavilion({ def }: { def: PavilionDef }) {
  const [px, pz] = polar(def.az, PAV_DIST);
  const yaw = Math.atan2(-px, -pz); // +z do centra
  const s = def.big ? 1.22 : 1;
  return (
    <group position={[px, 0, pz]} rotation={[0, yaw, 0]}>
      {/* kamenný ostrov + pódium */}
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <cylinderGeometry args={[6.4 * s, 7.0 * s, 0.9, 36]} />
        <meshStandardMaterial color="#6b5c44" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.6 * s, 5.9 * s, 0.35, 36]} />
        <meshStandardMaterial color="#a08d68" roughness={0.9} />
      </mesh>
      {/* zlatá podlaha s teplou září */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.41, 0]}>
        <circleGeometry args={[5.0 * s, 36]} />
        <meshStandardMaterial color="#7a6248" emissive="#8a6230" emissiveIntensity={0.14} roughness={0.85} />
      </mesh>
      {/* sloupočelí */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh key={i} position={[Math.sin(a) * 4.3 * s, 0.4 + 1.35 * s, Math.cos(a) * 4.3 * s]} castShadow>
            <cylinderGeometry args={[0.13 * s, 0.17 * s, 2.7 * s, 7]} />
            <meshStandardMaterial color="#8a6a42" roughness={0.8} />
          </mesh>
        );
      })}
      {/* věnec pod střechou */}
      <mesh position={[0, 0.4 + 2.78 * s, 0]}>
        <cylinderGeometry args={[4.55 * s, 4.55 * s, 0.22 * s, 8]} />
        <meshStandardMaterial color="#7a5c38" roughness={0.8} />
      </mesh>
      {/* dvojitá lotosová střecha */}
      <LotusRoof y={0.4 + 2.85 * s} s={s} />
      {/* vnitřní záře */}
      <pointLight position={[0, 1.9 * s, 0]} intensity={2.2} color={def.accent} distance={11 * s} decay={2} />
    </group>
  );
}

/** dvojitá lotosová střecha — kopule + 10 velkých + 10 malých lupínků + pupen */
function LotusRoof({ y, s }: { y: number; s: number }) {
  const low = useMemo(() => {
    const g = new THREE.OctahedronGeometry(1, 1);
    g.scale(1.7 * s, 0.3 * s, 4.4 * s);
    g.translate(0, 0, 2.3 * s);
    return g;
  }, [s]);
  const high = useMemo(() => {
    const g = new THREE.OctahedronGeometry(1, 1);
    g.scale(1.15 * s, 0.28 * s, 3.0 * s);
    g.translate(0, 0, 1.7 * s);
    return g;
  }, [s]);
  return (
    <group position={[0, y, 0]}>
      {/* pevné tělo střechy — zploštělá kopule pod lupínky */}
      <mesh position={[0, 0.15 * s, 0]} scale={[1, 0.62 * s, 1]} castShadow>
        <sphereGeometry args={[3.4 * s, 24, 14]} />
        <meshStandardMaterial color="#e6d9ba" roughness={0.55} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh geometry={low} rotation={[-0.42, 0, 0]} position={[0, 0.15 * s, 0]} castShadow>
              <meshStandardMaterial color="#efe4c8" roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
        return (
          <group key={i} rotation={[0, a, 0]} position={[0, 0.7 * s, 0]}>
            <mesh geometry={high} rotation={[-0.85, 0, 0]} castShadow>
              <meshStandardMaterial color="#e0cfa6" roughness={0.55} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {/* pupen na vrcholu */}
      <mesh position={[0, 1.5 * s, 0]} castShadow>
        <octahedronGeometry args={[0.6 * s, 1]} />
        <meshStandardMaterial color="#caa55e" metalness={0.6} roughness={0.3} emissive="#8a5a1a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** Sri Maha Bodhi — mohutný rozložitý strom s opěrnými kořeny */
function BodhiTree() {
  const branches = useMemo(() => {
    const arr: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const an = (i / 9) * Math.PI * 2 + 0.3;
      const reach = 7.5 + (i % 3) * 1.6;
      arr.push({
        a: new THREE.Vector3(0, 6.8, 0),
        b: new THREE.Vector3(Math.sin(an) * reach, 10.5 + Math.sin(i * 1.7) * 2.2, Math.cos(an) * reach),
        r: 0.55 - (i % 3) * 0.1,
      });
    }
    arr.push({ a: new THREE.Vector3(0, 6.8, 0), b: new THREE.Vector3(0.6, 14.5, 0.4), r: 0.6 });
    return arr;
  }, []);
  const canopy = useMemo(() => {
    const arr: { p: [number, number, number]; s: number; c: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const a = rng(i + 2) * Math.PI * 2;
      const rr = Math.pow(rng(i + 9), 0.55) * 10.5;
      arr.push({
        p: [Math.sin(a) * rr, 11.8 + rng(i + 5) * 4.2 - rr * 0.24, Math.cos(a) * rr],
        s: 1.7 + rng(i + 13) * 2.1,
        c: ['#4d7038', '#5d8040', '#6d9048', '#557a3a'][i % 4],
      });
    }
    return arr;
  }, []);
  const roots = useMemo(() => {
    const arr: { p: [number, number, number]; yaw: number; tilt: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      arr.push({ p: [Math.sin(a) * 4.4, 4.6, Math.cos(a) * 4.4], yaw: a, tilt: 0.5 + rng(i) * 0.4 });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* kmen — masivní, mírně zvlněný (3 segmenty) */}
      <mesh position={[0, 2.2, 0]} rotation={[0.03, 0, -0.04]} castShadow>
        <cylinderGeometry args={[1.5, 2.3, 4.6, 10]} />
        <meshStandardMaterial color="#6a4e2c" roughness={0.95} />
      </mesh>
      <mesh position={[0.3, 5.8, 0.1]} rotation={[-0.04, 0, 0.06]} castShadow>
        <cylinderGeometry args={[1.1, 1.5, 3.2, 9]} />
        <meshStandardMaterial color="#654a2a" roughness={0.95} />
      </mesh>
      {/* opěrné kořeny — deskovité patky */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.15;
        return (
          <mesh key={i} position={[Math.sin(a) * 2.2, 1.1, Math.cos(a) * 2.2]} rotation={[0.35, a, 0]} castShadow>
            <coneGeometry args={[0.75, 2.6, 4]} />
            <meshStandardMaterial color="#5f4526" roughness={0.95} />
          </mesh>
        );
      })}
      {/* větve */}
      {branches.map((b, i) => {
        const mid = b.a.clone().lerp(b.b, 0.5);
        const dir = b.b.clone().sub(b.a);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return (
          <mesh key={i} position={mid} quaternion={q} castShadow>
            <cylinderGeometry args={[b.r * 0.45, b.r, len, 6]} />
            <meshStandardMaterial color="#5f4526" roughness={0.95} />
          </mesh>
        );
      })}
      {/* visuté vzdušné kořeny */}
      {roots.map((r, i) => (
        <mesh key={i} position={r.p} rotation={[r.tilt * 0.2, r.yaw, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 7.4, 5]} />
          <meshStandardMaterial color="#7a5c36" roughness={0.95} />
        </mesh>
      ))}
      {/* koruna */}
      {canopy.map((c, i) => (
        <mesh key={i} position={c.p} castShadow>
          <sphereGeometry args={[c.s, 7, 6]} />
          <meshStandardMaterial color={c.c} roughness={0.95} />
        </mesh>
      ))}
      {/* světlo posvátna pod korunou */}
      <pointLight position={[0, 6.5, 0]} intensity={3} color="#ffd98a" distance={17} decay={2} />
      {/* zlatý Buddha pod stromem */}
      <group position={[0, 0.95, 3.1]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <sphereGeometry args={[0.42, 10, 8]} />
          <meshStandardMaterial color="#d9a742" metalness={0.55} roughness={0.35} emissive="#8a5a14" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.55, 4, 8]} />
          <meshStandardMaterial color="#d9a742" metalness={0.55} roughness={0.35} emissive="#8a5a14" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial color="#d9a742" metalness={0.55} roughness={0.35} emissive="#8a5a14" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 1.66, -0.14]} rotation={[Math.PI / 2.3, 0, 0]}>
          <circleGeometry args={[0.4, 20]} />
          <meshStandardMaterial color="#f0c45e" metalness={0.7} roughness={0.25} emissive="#a06a1a" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** centrální ostrov — kamenná platforma s posvátným kruhem */
function CentralIsland() {
  return (
    <group>
      <mesh position={[0, -0.35, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_R + 0.9, ISLAND_R + 1.6, 1.1, 48]} />
        <meshStandardMaterial color="#63563f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R + 0.6, 0.6, 48]} />
        <meshStandardMaterial color="#8a7a58" roughness={0.92} />
      </mesh>
      {/* zelený ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.62, 0]}>
        <ringGeometry args={[3.6, ISLAND_R - 0.4, 48]} />
        <meshStandardMaterial color="#5d7a3f" roughness={0.95} />
      </mesh>
      {/* posvátný kruh pod stromem */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.65, 0]} receiveShadow>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color="#9a8a64" roughness={0.85} />
      </mesh>
      {([1.4, 2.4] as number[]).map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.68, 0]}>
          <ringGeometry args={[r - 0.05, r + 0.05, 48]} />
          <meshStandardMaterial color="#e0b95e" emissive="#a07a24" emissiveIntensity={0.6} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* meditující kruh */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.5;
        return (
          <mesh key={i} position={[Math.sin(a) * 2.9, 0.82, Math.cos(a) * 2.9]} castShadow>
            <capsuleGeometry args={[0.16, 0.3, 4, 6]} />
            <meshStandardMaterial color="#3a3430" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/** klenutý dřevěný můstek Rama Setu mezi dvěma body */
function Bridge({ from, to, w = 1.6 }: { from: [number, number]; to: [number, number]; w?: number }) {
  const { deck, rails, posts, side } = useMemo(() => {
    const a = new THREE.Vector3(from[0], 0.62, from[1]);
    const b = new THREE.Vector3(to[0], 0.62, to[1]);
    const mid = a.clone().lerp(b, 0.5); mid.y = 1.9;
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const deck = new THREE.TubeGeometry(curve, 20, w * 0.5, 4);
    deck.scale(1, 0.16, 1);
    deck.translate(0, -0.12, 0);
    const rails: THREE.TubeGeometry[] = [];
    const posts: THREE.Vector3[] = [];
    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const s of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const p = curve.getPoint(i / 12).add(side.clone().multiplyScalar(s * w * 0.55));
        p.y += 0.55;
        pts.push(p);
      }
      rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.045, 5));
    }
    for (let i = 1; i < 6; i++) posts.push(curve.getPoint(i / 6));
    return { deck, rails, posts, side };
  }, [from, to, w]);
  return (
    <group>
      <mesh geometry={deck} castShadow receiveShadow>
        <meshStandardMaterial color="#8a6a42" roughness={0.85} />
      </mesh>
      {rails.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#caa55e" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {posts.map((p, i) => (
        <group key={i} position={p}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[side.x * s * w * 0.55, 0.25, side.z * s * w * 0.55]}>
              <cylinderGeometry args={[0.045, 0.05, 0.7, 5]} />
              <meshStandardMaterial color="#7a5c38" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** lotosová jezírka — voda, lilie, lotosy */
function LotusPond() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = water.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 0.14 + Math.sin(clock.getElapsedTime() * 0.7) * 0.05;
  });
  const lilies = useMemo(() => {
    const arr: { p: [number, number]; s: number; f: boolean }[] = [];
    let i = 0;
    while (arr.length < 42 && i < 300) {
      i++;
      const a = rng(i * 3.7) * Math.PI * 2;
      const r = ISLAND_R + 2 + rng(i * 1.3) * (POND_OUT - ISLAND_R - 3.5);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      arr.push({ p: [x, z], s: 0.5 + rng(i + 9) * 0.7, f: rng(i + 4) > 0.62 });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* vodní plocha jezírka + mělčina */}
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]}>
        <circleGeometry args={[46, 72]} />
        <meshStandardMaterial color="#22687a" roughness={0.1} metalness={0.4} transparent opacity={0.96} emissive="#e8a04a" emissiveIntensity={0.28} />
      </mesh>
      {/* mělká teplá voda u břehu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y + 0.02, 0]}>
        <ringGeometry args={[POND_OUT + 1, 46, 72]} />
        <meshStandardMaterial color="#4f8a8a" roughness={0.18} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* zlatý odraz západu na hladině */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2.4]} position={[-14, WATER_Y + 0.03, 6]}>
        <planeGeometry args={[10, 36]} />
        <meshBasicMaterial color="#f4b95e" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* lilie + lotosy */}
      {lilies.map((l, i) => (
        <group key={i} position={[l.p[0], WATER_Y + 0.05, l.p[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[l.s, l.s * 0.9, 1]}>
            <circleGeometry args={[0.55, 10]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#4d7038' : '#3f6030'} roughness={0.9} />
          </mesh>
          {l.f && (
            <group position={[0, 0.1, 0]}>
              {Array.from({ length: 6 }, (_, k) => {
                const a = (k / 6) * Math.PI * 2;
                return (
                  <mesh key={k} position={[Math.sin(a) * 0.16, 0.09, Math.cos(a) * 0.16]} rotation={[0.55, a, 0]}>
                    <coneGeometry args={[0.09, 0.34, 5]} />
                    <meshStandardMaterial color="#e88aa8" roughness={0.6} emissive="#a03a5a" emissiveIntensity={0.25} />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.12, 0]}>
                <sphereGeometry args={[0.09, 8, 6]} />
                <meshStandardMaterial color="#f4c95e" emissive="#a06a1a" emissiveIntensity={0.4} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/** zahradní okraj — země, cesta, tropická džungle */
function GardenRing() {
  const palms = useMemo(() => {
    const arr: { p: [number, number]; h: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = rng(i + 21) * Math.PI * 2;
      const r = 49 + rng(i + 31) * 22;
      const z = Math.cos(a) * r;
      // vstupní koridor na jih
      if (z > 42 && Math.abs(Math.sin(a) * r) < 9) continue;
      arr.push({ p: [Math.sin(a) * r, z], h: 5 + rng(i + 3) * 5 });
    }
    return arr;
  }, []);
  const shrubs = useMemo(() => {
    const arr: { p: [number, number]; s: number; c: string }[] = [];
    for (let i = 0; i < 60; i++) {
      const a = rng(i + 77) * Math.PI * 2;
      const r = 46.5 + rng(i + 7) * 12;
      const z = Math.cos(a) * r;
      if (z > 42 && Math.abs(Math.sin(a) * r) < 9) continue;
      arr.push({ p: [Math.sin(a) * r, z], s: 0.5 + rng(i + 17) * 1.1, c: ['#4a6a34', '#5d8040', '#3f5e2e'][i % 3] });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* země areálu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y - 0.25, 0]} receiveShadow>
        <ringGeometry args={[45.5, 140, 80]} />
        <meshStandardMaterial color="#33401f" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <circleGeometry args={[150, 64]} />
        <meshStandardMaterial color="#2b3a20" roughness={0.98} />
      </mesh>
      {/* vstupní cesta z jihu — kamenná promenáda */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 33.5]}>
        <planeGeometry args={[1.8, 26]} />
        <meshStandardMaterial color="#a08d68" roughness={0.9} />
      </mesh>
      {/* palmy */}
      {palms.map((p, i) => (
        <Palm key={i} pos={[p.p[0], -0.2, p.p[1]]} h={p.h} />
      ))}
      {shrubs.map((s, i) => (
        <mesh key={i} position={[s.p[0], s.s * 0.4 - 0.2, s.p[1]]} scale={[1.3, s.s, 1.3]} castShadow>
          <sphereGeometry args={[0.8, 7, 6]} />
          <meshStandardMaterial color={s.c} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Palm({ pos, h }: { pos: [number, number, number]; h: number }) {
  const fronds = 7;
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} rotation={[0.05, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.13, 0.24, h, 6]} />
        <meshStandardMaterial color="#6a5138" roughness={0.95} />
      </mesh>
      {Array.from({ length: fronds }, (_, i) => {
        const a = (i / fronds) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.9, h + 0.35, Math.cos(a) * 0.9]} rotation={[0.55 + (i % 2) * 0.2, a, 0]} scale={[0.55, 0.18, 2.6]} castShadow>
            <octahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color={i % 2 ? '#4f7a34' : '#5d8a3c'} roughness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, h + 0.15, 0]}>
        <sphereGeometry args={[0.32, 6, 5]} />
        <meshStandardMaterial color="#7a5a34" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Anuradhapura — bílé dagoby na severní ose v mlze */
function Stupas() {
  return (
    <group>
      {[
        { p: [-16, 0, -86], s: 1.5 },
        { p: [6, 0, -98], s: 1.1 },
        { p: [-38, 0, -95], s: 0.8 },
      ].map((d, i) => (
        <group key={i} position={d.p as [number, number, number]} scale={d.s}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[5.2, 5.6, 2, 20]} />
            <meshStandardMaterial color="#d8cdb4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 5.4, 0]} castShadow>
            <sphereGeometry args={[4.6, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#e4dcc8" roughness={0.8} />
          </mesh>
          <mesh position={[0, 10.4, 0]}>
            <cylinderGeometry args={[0.55, 1.3, 2.6, 10]} />
            <meshStandardMaterial color="#d8cdb4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 12.4, 0]}>
            <coneGeometry args={[1.1, 2.4, 10]} />
            <meshStandardMaterial color="#caa55e" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* nízké hory za stupami */}
      {[
        { p: [-30, 0, -115], s: [55, 9, 18] },
        { p: [30, 0, -120], s: [65, 7, 16] },
      ].map((h, i) => (
        <mesh key={i} position={h.p as [number, number, number]} scale={h.s as [number, number, number]}>
          <sphereGeometry args={[1, 18, 9]} />
          <meshStandardMaterial color="#4a5a3c" roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}

/** obloha — zlatý soumrak nad Indickým oceánem, slunce na západě */
function SkySun() {
  const mat = React.useMemo(
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
            vec3 c = d.y > 0.15 ? mix(mid, top, smoothstep(0.15, 0.65, d.y))
                              : mix(low, mid, smoothstep(-0.05, 0.15, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.9, 0.62) * pow(s, 300.0) * 3.4
               + vec3(1.0, 0.68, 0.38) * pow(s, 28.0) * 0.55
               + vec3(0.95, 0.5, 0.24) * pow(s, 6.5) * 0.24;
            // jemná zlatá mlha nad obzorem
            c = mix(c, vec3(0.88, 0.62, 0.38), smoothstep(0.18, -0.02, d.y) * 0.35);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#2e3c62') },
          mid: { value: new THREE.Color('#c98444') },
          low: { value: new THREE.Color('#f0b868') },
          sunDir: { value: new THREE.Vector3(-0.82, 0.1, -0.3).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[300, 24, 16]} />
    </mesh>
  );
}

export function BodhiLankaScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <SkySun />
      <fog attach="fog" args={['#c98a4a', 90, 260]} />

      <LotusPond />
      <CentralIsland />
      <BodhiTree />
      {PAVILIONS.map((p) => (
        <Pavilion key={p.az} def={p} />
      ))}
      {/* Rama Setu — mosty z centra ke každému pavilonu */}
      {PAVILIONS.map((p) => {
        const r1 = ISLAND_R - 0.5, r2 = PAV_DIST - 6.2 * (p.big ? 1.22 : 1);
        const [x1, z1] = polar(p.az, r1);
        const [x2, z2] = polar(p.az, r2);
        return <Bridge key={p.az} from={[x1, z1]} to={[x2, z2]} />;
      })}
      {/* vstupní můstek z jihu na hlavní osu */}
      <Bridge from={[0, 44]} to={[0, POND_OUT + 1.5]} w={1.9} />
      <GardenRing />
      <Stupas />

      {/* labely — větší měřítko scény = větší sprity */}
      <SceneLabel position={[0, 17.6, 0]} text="Sri Maha Bodhi" scale={2.4} />
      <SceneLabel position={[0, 5.6, 3.4]} text={cs ? 'Buddha · meditace' : 'Buddha · meditation'} scale={1.8} />
      {PAVILIONS.filter((p) => p.az === 0 || p.az === 72 || p.az === 288).map((p) => {
        const [x, z] = polar(p.az, PAV_DIST);
        return <SceneLabel key={p.az} position={[x, 7.6 * (p.big ? 1.22 : 1), z]} text={cs ? p.name.cs : p.name.en} scale={1.8} />;
      })}
      <SceneLabel position={[polar(150, 17)[0], 2.4, polar(150, 17)[1]]} text={cs ? 'Lotosové jezírko' : 'Lotus Pond'} scale={1.8} />
      <SceneLabel position={[polar(36, 19)[0], 3.0, polar(36, 19)[1]]} text={cs ? 'Rama Setu · most srdcí' : 'Rama Setu · bridge of hearts'} scale={1.8} />
      <SceneLabel position={[-16, 19, -86]} text={cs ? 'Anuradhapura — posvátná osa' : 'Anuradhapura — sacred axis'} scale={2.6} />
    </>
  );
}

export const LANKA_CAMERA = { position: [0, 26, 74] as [number, number, number], fov: 45, far: 900 };
export const LANKA_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.18, minDistance: 20, maxDistance: 150, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 5, -2] as [number, number, number], enablePan: false };
export function LankaLighting() {
  return <>
    <ambientLight intensity={0.62} color="#ffe4b8" />
    <hemisphereLight args={['#ffdcaa', '#3d5233', 0.7]} />
    <directionalLight position={[-60, 24, -22]} intensity={2.1} color="#ffc887" castShadow />
    <directionalLight position={[42, 30, 42]} intensity={0.55} color="#d8ecff" />
  </>;
}
