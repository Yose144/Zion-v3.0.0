/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── LUMI · Nová Amerika — Issobella L6 Research Station ─────────────
 * Dle hero + koncept boardu: centrální výzkumná kupole se stromovým
 * jádrem, prstencový komplex s teplými okny a zelenými terasami,
 * krovová komunikační věž, radioteleskopy, geodetické skleníkové
 * biodomy, přistávací plocha se zaoceánským shuttle, startovací věž,
 * vodopád do jezírka, terasovité zahrady, sopka za mraky — a obloha,
 * která přechází ze západního soumraku do Mléčné dráhy.
 */

const DEG = Math.PI / 180;
const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
function polar(azDeg: number, d: number): [number, number] {
  const a = azDeg * DEG;
  return [Math.sin(a) * d, -Math.cos(a) * d];
}

/** geodetická kupole — icosahedron cut-off + zlatý rám z hran */
function GeoDome({ r, y = 0, glass = '#bfe0ea', frame = '#c9a55c', cut = 0.52, light = 0 }: {
  r: number; y?: number; glass?: string; frame?: string; cut?: number; light?: number;
}) {
  const { dome, edges } = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(r, 2);
    const dome = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * cut);
    const edges = new THREE.EdgesGeometry(g, 12);
    return { dome, edges };
  }, [r, cut]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={dome} castShadow>
        <meshPhysicalMaterial color={glass} roughness={0.15} metalness={0.1} transparent opacity={0.42}
          emissive="#ffd98a" emissiveIntensity={light} clearcoat={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges} position={[0, r * (1 - Math.cos(Math.PI * cut)) * 0, 0]} scale={[1, 1, 1]} rotation={[0, 0, 0]}>
        <lineBasicMaterial color={frame} transparent opacity={0.85} />
      </lineSegments>
      {/* spodní věnec */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.995, 0.08, 6, 40]} />
        <meshStandardMaterial color={frame} metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** centrální kupole s vnitřním stromem života + světelným portálem */
function ResearchCore() {
  const portalRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = portalRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.5 + Math.sin(clock.getElapsedTime() * 1.8) * 0.15;
  });
  return (
    <group>
      {/* kamenný sokl */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[8.4, 8.9, 1.0, 40]} />
        <meshStandardMaterial color="#7a6f56" roughness={0.9} />
      </mesh>
      {/* kolonáda soklu */}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 7.9, 1.6, Math.cos(a) * 7.9]} castShadow>
            <cylinderGeometry args={[0.14, 0.16, 2.2, 7]} />
            <meshStandardMaterial color="#d8cba8" roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.8, 0]}>
        <cylinderGeometry args={[8.0, 8.0, 0.28, 40]} />
        <meshStandardMaterial color="#8a7d62" roughness={0.8} />
      </mesh>
      {/* vnitřní strom viditelný skrz kupoli */}
      <group position={[0, 2.9, 0]}>
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.32, 0.55, 4.4, 8]} />
          <meshStandardMaterial color="#5d4526" roughness={0.9} />
        </mesh>
        {[...Array(9)].map((_, i) => {
          const a = rng(i + 3) * Math.PI * 2, r = Math.pow(rng(i + 8), .5) * 3.2;
          return (
            <mesh key={i} position={[Math.sin(a) * r, 4.6 + rng(i + 5) * 1.6 - r * 0.2, Math.cos(a) * r]}>
              <sphereGeometry args={[1.1 + rng(i) * 0.8, 7, 6]} />
              <meshStandardMaterial color={i % 2 ? '#4d7038' : '#5d8040'} roughness={0.95} emissive="#2a4a1a" emissiveIntensity={0.35} />
            </mesh>
          );
        })}
        {/* světelný portál jádra */}
        <mesh position={[0, 2.2, 4.6]} rotation={[0, 0, 0]}>
          <torusGeometry args={[1.5, 0.12, 8, 40]} />
          <meshStandardMaterial color="#8ad4ff" emissive="#4aa8e8" emissiveIntensity={1.4} />
        </mesh>
        <mesh ref={portalRef} position={[0, 2.2, 4.6]}>
          <circleGeometry args={[1.4, 24]} />
          <meshBasicMaterial color="#9adfff" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 4.5, 0]} intensity={3.2} color="#ffd98a" distance={15} decay={2} />
      </group>
      {/* hlavní kupole */}
      <GeoDome r={7.6} y={2.95} glass="#bfe0ea" light={0.06} cut={0.52} />
      {/* zlatý vrcholový lem */}
      <mesh position={[0, 2.95 + 7.6 + 0.1, 0]}>
        <sphereGeometry args={[0.35, 10, 8]} />
        <meshStandardMaterial color="#d9b45c" metalness={0.8} roughness={0.3} emissive="#a06a1a" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** prstencový komplex — dvoupatrová budova s teplými okny + zelené střechy */
function RingComplex() {
  const ring = (rIn: number, rOut: number, y: number, h: number, color: string) => (
    <mesh position={[0, y + h / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[rOut, rOut, h, 48, 1, true]} />
      <meshStandardMaterial color={color} roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
  const winRing = (r: number, y: number, n: number, off = 0) => (
    Array.from({ length: n }, (_, i) => {
      const a = off + (i / n) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.sin(a) * r, y, Math.cos(a) * r]} rotation={[0, a, 0]}>
          <planeGeometry args={[0.8, 1.0]} />
          <meshStandardMaterial color="#2e3d4c" roughness={0.3} emissive="#ffca70" emissiveIntensity={0.9} side={THREE.DoubleSide} />
        </mesh>
      );
    })
  );
  return (
    <group>
      {/* prstence zdí — 2 patra */}
      {ring(10.6, 13.4, 0, 2.4, '#cdbf9e')}
      {ring(11.8, 13.9, 2.4, 2.2, '#d6c9ad')}
      {/* zelené střešní terasy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.45, 0]}>
        <ringGeometry args={[9.8, 13.9, 48]} />
        <meshStandardMaterial color="#4f7038" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.65, 0]}>
        <ringGeometry args={[10.9, 14.2, 48]} />
        <meshStandardMaterial color="#557a3c" roughness={0.95} />
      </mesh>
      {/* okna — dvě řady */}
      {winRing(13.45, 1.35, 24)}
      {winRing(13.95, 3.5, 24, Math.PI / 24)}
      {/* keříky na střechách */}
      {[...Array(14)].map((_, i) => {
        const a = rng(i + 41) * Math.PI * 2, r = 10.4 + rng(i + 7) * 3;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 4.85, Math.cos(a) * r]}>
            <sphereGeometry args={[0.4 + rng(i) * 0.35, 6, 5]} />
            <meshStandardMaterial color="#4a6a34" roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

/** krovová komunikační věž s anténami a blikajícím majákem */
function CommsTower({ x, z }: { x: number; z: number }) {
  const beacon = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = beacon.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 4) * 1.1;
  });
  const legs = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    const w = 1.1, h = 17;
    // 3 nohy + horizontální výztuhy
    for (let l = 0; l < 3; l++) {
      const a = (l / 3) * Math.PI * 2 + Math.PI / 6;
      const bx = Math.cos(a) * w, bz = Math.sin(a) * w;
      pts.push(bx, 0, bz, bx * 0.25, h, bz * 0.25);
      const nxt = ((l + 1) / 3) * Math.PI * 2 + Math.PI / 6;
      const nx = Math.cos(nxt) * w, nz = Math.sin(nxt) * w;
      for (let s = 1; s <= 5; s++) {
        const t = s / 5, y = h * t;
        pts.push(bx + (nx - bx) * 0, y * 0 + 0, bz + (nz - bz) * 0); // placeholder replaced below
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group position={[x, 0, z]}>
      {/* jednoduchá krovová věž — 3 sešikmené nohy + platformy + tyč */}
      {[0, 1, 2].map((l) => {
        const a = (l / 3) * Math.PI * 2 + Math.PI / 6;
        return (
          <mesh key={l} position={[Math.cos(a) * 0.7, 8.5, Math.sin(a) * 0.7]} rotation={[Math.sin(a) * 0.09, 0, -Math.cos(a) * 0.09]} castShadow>
            <cylinderGeometry args={[0.07, 0.12, 17.4, 5]} />
            <meshStandardMaterial color="#b8b0a0" metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
      {[3.5, 7, 10.5, 14].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, i * 0.4, 0]}>
          <cylinderGeometry args={[0.9 - i * 0.16, 0.9 - i * 0.16, 0.12, 6]} />
          <meshStandardMaterial color="#a89e8c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* anténní talíře */}
      {[[1.0, 11, 0.4], [-0.9, 8.2, -0.3], [0.3, 14.4, 0.8]].map(([px, py, pz], i) => (
        <group key={i} position={[px, py, pz]} rotation={[0.5, i * 1.7, 0]}>
          <mesh>
            <sphereGeometry args={[0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshStandardMaterial color="#e8e2d2" roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 18, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 2.4, 5]} />
        <meshStandardMaterial color="#989080" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={beacon} position={[0, 19.3, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color="#ff6040" emissive="#ff3020" emissiveIntensity={1.6} />
      </mesh>
      <lineSegments geometry={legs} visible={false}><lineBasicMaterial /></lineSegments>
    </group>
  );
}

/** radioteleskop — talíř na podstavci, nakloněný k obloze */
function Dish({ x, z, yaw = 0, s = 1 }: { x: number; z: number; yaw?: number; s?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} scale={s}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.8, 1.1, 1.4, 10]} />
        <meshStandardMaterial color="#d8d2c2" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 2.2, 8]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.6} />
      </mesh>
      {/* talíř */}
      <group position={[0, 3.2, 0]} rotation={[-0.7, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[2.4, 20, 8, 0, Math.PI * 2, 0, Math.PI / 3.2]} />
          <meshStandardMaterial color="#e8e2d4" roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* přijímač na rameni */}
        <mesh position={[0, 0, 1.6]}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshStandardMaterial color="#989080" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.6, 0.8]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.1, 5]} />
          <meshStandardMaterial color="#989080" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/** skleníkový biodom — menší geodome nad vegetací */
function Biodome({ x, z, r = 4.4 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[r + 0.5, r + 0.8, 0.8, 28]} />
        <meshStandardMaterial color="#8a7d62" roughness={0.9} />
      </mesh>
      {/* vnitřní vegetace */}
      {[...Array(8)].map((_, i) => {
        const a = rng(i + x) * Math.PI * 2, rr = rng(i + 3) * r * 0.7;
        return (
          <mesh key={i} position={[Math.sin(a) * rr, 0.9 + rng(i) * 0.5, Math.cos(a) * rr]}>
            <sphereGeometry args={[0.7 + rng(i + 5) * 0.7, 6, 5]} />
            <meshStandardMaterial color={i % 2 ? '#4d7038' : '#5d8040'} emissive="#2a4a1a" emissiveIntensity={0.4} roughness={0.9} />
          </mesh>
        );
      })}
      <GeoDome r={r} y={0.8} glass="#cfe8d4" light={0.1} cut={0.55} />
    </group>
  );
}

/** přistávací plocha se zaoceánským shuttle */
function LandingPad({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[7.5, 7.9, 0.3, 8]} />
        <meshStandardMaterial color="#5a5648" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
        <ringGeometry args={[6.2, 6.7, 40]} />
        <meshStandardMaterial color="#d9b45c" emissive="#a06a1a" emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.33, 0]}>
        <circleGeometry args={[1.1, 20]} />
        <meshStandardMaterial color="#8a8268" roughness={0.8} />
      </mesh>
      {/* shuttle — trup + křídla + kormidlo */}
      <group position={[0, 1.1, 0]} rotation={[0, 0.6, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.7, 4.2, 6, 10]} />
          <meshStandardMaterial color="#e8e4d8" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, -2.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.72, 1.4, 10]} />
          <meshStandardMaterial color="#e8e4d8" roughness={0.35} metalness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.35, -0.15, -1.2]} rotation={[0, s * -0.5, s * 0.08]} castShadow>
            <boxGeometry args={[1.9, 0.12, 1.5]} />
            <meshStandardMaterial color="#c8c4b8" roughness={0.45} metalness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 0.75, -1.9]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 1.3, 1.1]} />
          <meshStandardMaterial color="#c8c4b8" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* kokpit */}
        <mesh position={[0, 0.45, 1.3]}>
          <sphereGeometry args={[0.42, 10, 8]} />
          <meshStandardMaterial color="#2e3d4c" roughness={0.2} metalness={0.5} emissive="#4aa8e8" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** startovací věž — bílá raketová jehla s obslužnou konstrukcí */
function LaunchSpire({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[4.6, 5.2, 0.8, 8]} />
        <meshStandardMaterial color="#6b6250" roughness={0.9} />
      </mesh>
      {/* raketa */}
      <mesh position={[0, 9.5, 0]} castShadow>
        <cylinderGeometry args={[0.85, 1.05, 17, 12]} />
        <meshStandardMaterial color="#eee8da" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, 19.6, 0]} castShadow>
        <coneGeometry args={[0.85, 4.2, 12]} />
        <meshStandardMaterial color="#e8e2d2" roughness={0.35} metalness={0.3} />
      </mesh>
      {/* zlatý pruh + lomené kormidla */}
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[1.07, 1.07, 1.4, 12]} />
        <meshStandardMaterial color="#d9b45c" metalness={0.7} roughness={0.3} emissive="#a06a1a" emissiveIntensity={0.4} />
      </mesh>
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.0, 1.6, Math.cos(a) * 1.0]} rotation={[Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]} castShadow>
            <boxGeometry args={[0.12, 2.6, 1.1]} />
            <meshStandardMaterial color="#d8d2c2" roughness={0.45} />
          </mesh>
        );
      })}
      {/* obslužné rameno */}
      <mesh position={[1.9, 13.5, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[3.2, 0.3, 0.5]} />
        <meshStandardMaterial color="#a89e8c" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[3.4, 6.8, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 13.6, 6]} />
        <meshStandardMaterial color="#a89e8c" metalness={0.5} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 20, 0]} intensity={1.6} color="#ffe9b0" distance={16} decay={2} />
    </group>
  );
}

/** vodopád z terasy do jezírka + tečoucí kaskáda */
function FallsPool() {
  const fall = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = fall.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.opacity = 0.55 + Math.sin(clock.getElapsedTime() * 3) * 0.12;
  });
  return (
    <group position={[0, 0, 22]}>
      {/* terasa nad jezírkem */}
      <mesh position={[0, 1.2, -2.2]} receiveShadow>
        <boxGeometry args={[16, 2.4, 4.4]} />
        <meshStandardMaterial color="#6b5f46" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.42, -2.2]} receiveShadow>
        <planeGeometry args={[16, 4.4]} />
        <meshStandardMaterial color="#4f7038" roughness={0.95} />
      </mesh>
      {/* vodopády */}
      {[-4, 0.5, 4.5].map((x, i) => (
        <mesh key={i} ref={i === 1 ? fall : undefined} position={[x, 1.05, 0.15]} rotation={[0.12, 0, 0]}>
          <planeGeometry args={[1.5, 2.2]} />
          <meshStandardMaterial color="#a8d4e4" transparent opacity={0.62} roughness={0.25} emissive="#6fb8d4" emissiveIntensity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* jezírko */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 4.5]} scale={[1.4, 1, 1]}>
        <circleGeometry args={[6.5, 36]} />
        <meshStandardMaterial color="#1a5a66" roughness={0.12} metalness={0.12} emissive="#1f7a8a" emissiveIntensity={0.24} transparent opacity={0.95} />
      </mesh>
      {/* lilie */}
      {[...Array(8)].map((_, i) => {
        const a = rng(i + 60) * Math.PI * 2, r = 1.5 + rng(i) * 4.4;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Math.sin(a) * r * 1.4, 0.09, 4.5 + Math.cos(a) * r]}>
            <circleGeometry args={[0.4, 9]} />
            <meshStandardMaterial color="#4d7038" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/** sopka v pozadí za mračnem mraků */
function Volcano() {
  return (
    <group position={[52, 0, -95]}>
      <mesh position={[0, 13, 0]}>
        <coneGeometry args={[24, 30, 40, 1, true]} />
        <meshStandardMaterial color="#4a5648" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 13, 0]}>
        <coneGeometry args={[24, 30, 40]} />
        <meshStandardMaterial color="#4a5648" roughness={0.95} transparent opacity={0.92} />
      </mesh>
      {/* zasněžený/zvětralý vrchol */}
      <mesh position={[0, 25.5, 0]}>
        <coneGeometry args={[6.2, 7, 30]} />
        <meshStandardMaterial color="#8a9688" roughness={0.9} />
      </mesh>
      {/* oblaka u paty */}
      {[...Array(7)].map((_, i) => {
        const a = rng(i + 90) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 26, 2.5 + rng(i) * 3, Math.cos(a) * 20]} scale={[2.8, 0.7, 1.6]}>
            <sphereGeometry args={[2.6, 8, 6]} />
            <meshStandardMaterial color="#e8d8c8" transparent opacity={0.35} depthWrite={false} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

/** tropická džungle + terasovité zahrady + cesty */
function Jungle() {
  const trees = useMemo(() => {
    const arr: { p: [number, number]; h: number; t: number }[] = [];
    for (let i = 0; i < 110; i++) {
      const a = rng(i + 15) * Math.PI * 2;
      const r = 34 + rng(i + 25) * 55;
      const z = Math.cos(a) * r;
      if (z > 30 && Math.abs(Math.sin(a) * r) < 10) continue;
      arr.push({ p: [Math.sin(a) * r, z], h: 3 + rng(i + 3) * 6, t: rng(i + 8) });
    }
    return arr;
  }, []);
  const terraces = useMemo(() => {
    const arr: { pos: [number, number, number]; r: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const a = rng(i + 50) * Math.PI * 2;
      const r = 17 + rng(i + 3) * 16;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      // volná zóna kaskády & jezírka vpředu
      if (Math.abs(x) < 12 && z > 16) continue;
      arr.push({ pos: [x, 0, z], r: 2 + rng(i) * 2.4, y: 0.3 + rng(i + 6) * 0.5 });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* země */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
        <circleGeometry args={[170, 80]} />
        <meshStandardMaterial color="#33451f" roughness={0.98} />
      </mesh>
      {/* terasovitá zahrada areálu */}
      {terraces.map((t, i) => (
        <group key={i} position={t.pos}>
          <mesh position={[0, t.y - 0.15, 0]}>
            <cylinderGeometry args={[t.r, t.r + 0.4, t.y * 2 + 0.3, 18]} />
            <meshStandardMaterial color="#5d5238" roughness={0.95} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, t.y + 0.16, 0]}>
            <circleGeometry args={[t.r, 18]} />
            <meshStandardMaterial color={i % 2 ? '#4f7038' : '#5d8040'} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* kmenové cesty mezi budovy */}
      {[[0, 14.5, 0, 12.5], [14, 12, 0.5, 18], [-14.5, 10, -0.5, 16]].map(([x, z, ry, len], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, ry]} position={[x, 0.12, z + len / 2 - 8]}>
          <planeGeometry args={[1.6, len]} />
          <meshStandardMaterial color="#a08d68" roughness={0.9} />
        </mesh>
      ))}
      {/* stromy — směs palem a listnatých */}
      {trees.map((t, i) => (
        <group key={i} position={[t.p[0], 0, t.p[1]]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1 + t.t * 0.06, 0.2 + t.t * 0.08, t.h, 5]} />
            <meshStandardMaterial color="#4f3a24" roughness={0.95} />
          </mesh>
          {t.t > 0.55 ? (
            [...Array(6)].map((_, k) => {
              const a = (k / 6) * Math.PI * 2;
              return (
                <mesh key={k} position={[Math.sin(a) * 0.7, t.h + 0.25, Math.cos(a) * 0.7]} rotation={[0.55, a, 0]} scale={[0.5, 0.16, 2.1]} castShadow>
                  <octahedronGeometry args={[0.8, 0]} />
                  <meshStandardMaterial color={k % 2 ? '#4f7a34' : '#5d8a3c'} roughness={0.9} />
                </mesh>
              );
            })
          ) : (
            <mesh position={[0, t.h + 0.6, 0]} castShadow>
              <sphereGeometry args={[0.8 + t.t * 1.1 + t.h * 0.06, 7, 6]} />
              <meshStandardMaterial color={['#3f5e2e', '#4a6a34', '#55753a'][i % 3]} roughness={0.95} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** obloha — soumrak na západě, Mléčná dráha + hvězdy na východě/zenitu */
function DuskSky() {
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
          uniform vec3 sunDir;
          float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          void main(){
            vec3 d = normalize(vP);
            // soumrak: západ teplý, východ/zenit noční
            float west = clamp(dot(normalize(d.xz), normalize(vec2(-1.0, -0.35))) * 0.5 + 0.5, 0.0, 1.0);
            float daySide = smoothstep(0.1, -0.15, d.y) * west;
            vec3 night = mix(vec3(0.03, 0.05, 0.12), vec3(0.05, 0.08, 0.18), d.y * 0.5 + 0.5);
            vec3 dusk  = mix(vec3(0.95, 0.55, 0.28), vec3(0.35, 0.28, 0.42), smoothstep(-0.05, 0.5, d.y));
            vec3 c = mix(night, dusk, clamp(west * (1.0 - smoothstep(0.05, 0.55, d.y)) * 1.25, 0.0, 1.0));
            // slunce nízko na západě
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.9, 0.6) * pow(s, 700.0) * 3.0
               + vec3(1.0, 0.7, 0.4) * pow(s, 30.0) * 0.5;
            // Mléčná dráha — pás přes oblohu
            vec3 mwN = normalize(vec3(0.5, 0.75, -0.35));
            float band = exp(-abs(dot(d, mwN)) * 9.0);
            c += vec3(0.35, 0.4, 0.55) * band * 0.4 * smoothstep(-0.05, 0.25, d.y);
            // hvězdy — jen na noční straně
            vec3 cell = floor(d * 200.0);
            float star = step(0.995, hash(cell));
            float tw = 0.6 + 0.4 * hash(cell + 1.0);
            c += vec3(1.0, 0.98, 0.9) * star * tw * 1.2 * smoothstep(0.6, 0.02, west) * smoothstep(-0.02, 0.25, d.y);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          sunDir: { value: new THREE.Vector3(-0.92, 0.12, -0.32).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[340, 28, 18]} />
    </mesh>
  );
}

export function LumiStationScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <DuskSky />
      <fog attach="fog" args={['#3a3a4a', 110, 300]} />

      <ResearchCore />
      <RingComplex />
      <CommsTower x={polar(58, 22)[0]} z={polar(58, 22)[1]} />
      <Dish x={polar(265, 26)[0]} z={polar(265, 26)[1]} yaw={0.9} />
      <Dish x={polar(288, 32)[0]} z={polar(288, 32)[1]} yaw={0.6} s={0.8} />
      <Biodome x={polar(140, 24)[0]} z={polar(140, 24)[1]} r={4.6} />
      <Biodome x={polar(105, 30)[0]} z={polar(105, 30)[1]} r={3.6} />
      <LandingPad x={polar(215, 30)[0]} z={polar(215, 30)[1]} />
      <LaunchSpire x={polar(315, 34)[0]} z={polar(315, 34)[1]} />
      <FallsPool />
      <Volcano />
      <Jungle />

      {/* labely */}
      <SceneLabel position={[0, 12.4, 0]} text={cs ? 'Issobella L6 — výzkumné jádro' : 'Issobella L6 — research core'} scale={2.4} />
      <SceneLabel position={[polar(58, 22)[0], 20.6, polar(58, 22)[1]]} text={cs ? 'Komunikační věž' : 'Comms tower'} scale={1.9} />
      <SceneLabel position={[polar(270, 29)[0], 6.4, polar(270, 29)[1]]} text={cs ? 'Radioteleskopy' : 'Radio telescopes'} scale={1.9} />
      <SceneLabel position={[polar(140, 24)[0], 6.6, polar(140, 24)[1]]} text={cs ? 'Biodomy · genetická laboratoř' : 'Biodomes · genetics lab'} scale={1.8} />
      <SceneLabel position={[polar(215, 30)[0], 4.6, polar(215, 30)[1]]} text={cs ? 'Přistávací plocha' : 'Landing pad'} scale={1.9} />
      <SceneLabel position={[polar(315, 34)[0], 22.6, polar(315, 34)[1]]} text={cs ? 'Startovací věž' : 'Launch spire'} scale={1.9} />
      <SceneLabel position={[0, 4.4, 26]} text={cs ? 'Kaskáda & jezírko' : 'Cascade & pond'} scale={1.8} />
    </>
  );
}

export const LUMI_CAMERA = { position: [0, 26, 78] as [number, number, number], fov: 45, far: 1000 };
export const LUMI_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 18, maxDistance: 160, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 6, 0] as [number, number, number], enablePan: false };
export function LumiLighting() {
  return <>
    <ambientLight intensity={0.55} color="#c8d4f0" />
    <hemisphereLight args={['#ffdcaa', '#2d3d2a', 0.65]} />
    <directionalLight position={[-70, 22, -26]} intensity={1.9} color="#ffc887" castShadow />
    <directionalLight position={[40, 30, 40]} intensity={0.4} color="#a8c8ff" />
  </>;
}
