/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';
import { tScene } from './scene-i18n';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';
import { KeyLight, SceneMotes, SceneTerrain, SceneWater, SkyFill, gold as goldMaterial, stoneWarm } from './kit';

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

/* ─── Amenti · Giza — Síň záznamů · Egypt ─────────────────────────────
 * Dle hero: zlatá pyramida s otevřenou síní a světelným paprskem
 * do nebe, nad ní kosmická meditující bytost v mandale Květu života
 * držící zářící vejce Hiranyagarbha. V pozadí klasické pyramidy Gízy,
 * vlevo modrá hvězdná tvář, vpravo Země s orbitální stanicí — vše
 * spojené zlatými energetickými oblouky. V popředí oáza s vodopádem,
 * palmami a poutníky.
 */

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

/** textura hieroglyfických pásem pro pyramidu */
function glyphTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a6a42'; ctx.fillRect(0, 0, 512, 512);
  let seed = 9; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // horizontální kamenné řady
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = `rgba(60,44,26,${0.15 + rnd() * 0.2})`;
    ctx.fillRect(0, y, 512, 2);
  }
  // hieroglyfické znaky ve dvou pásmech
  for (const band of [160, 340]) {
    for (let i = 0; i < 34; i++) {
      ctx.fillStyle = `rgba(255,210,120,${0.25 + rnd() * 0.45})`;
      const x = i * 15 + 4;
      ctx.fillRect(x, band, 8, 10 + rnd() * 8);
      if (rnd() > 0.6) ctx.fillRect(x + 2, band - 6, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** hlavní pyramida — otevřená síň vpředu, zářící vrchol, paprsek do nebe */
function GrandPyramid() {
  const beam = React.useRef<THREE.Mesh>(null);
  const tex = React.useMemo(() => glyphTexture(), []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock }) => {
    const m = beam.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.10 + Math.sin(motionTime(clock) * 1.4) * 0.025;
  });
  return (
    <group position={[0, 0, -26]}>
      {/* tělo pyramidy */}
      <mesh castShadow receiveShadow material={stoneWarm(5, '#dcc094')}>
        <coneGeometry args={[24, 20, 4]} />
      </mesh>
      {/* otevřená síň — svítící zlatý portál na čelní stěně */}
      <mesh position={[0, 3.4, 15.2]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} color="#ffe9a8" emissive="#ffca50" emissiveIntensity={0.9} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* interiér — zlatá sloupučí síň naznačená uvnitř portálu */}
      <group position={[0, 3.4, 15.4]}>
        {[-2.4, -0.8, 0.8, 2.4].map((x, i) => (
          <mesh key={i} position={[x, -0.6, 0]}>
            <boxGeometry args={[0.35, 5.5, 0.1]} />
            <meshStandardMaterial color="#c08a30" emissive="#8a5a14" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {/* zářící vrchol — pyramidion */}
      <mesh position={[0, 10.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.9, 2.6, 4]} />
        <meshStandardMaterial color="#ffd870" metalness={0.7} roughness={0.25} emissive="#ffb830" emissiveIntensity={1.4} />
      </mesh>
      {/* světelný paprsek z vrcholu */}
      <mesh ref={beam} position={[0, 24, 0]}>
        <cylinderGeometry args={[0.5, 0.9, 30, 10, 1, true]} />
        <meshBasicMaterial color="#ffe9a0" transparent opacity={0.13} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 11, 2]} intensity={4} color="#ffca50" distance={30} decay={2} />
      <pointLight position={[0, 3.5, 16]} intensity={3} color="#ffb840" distance={18} decay={2} />
      {/* základna + schodiště */}
      <mesh position={[0, 0.5, 19]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#9a7a50" roughness={0.9} />
      </mesh>
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[0, 0.15 + i * 0.3, 22 - i * 1.1]} receiveShadow>
          <boxGeometry args={[8 - i * 0.6, 0.28, 1.1]} />
          <meshStandardMaterial color="#a8845a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** meditující kosmická bytost — translucidní zlatá silueta v mandale */
function CosmicBeing({ x, y, z }: { x: number; y: number; z: number }) {
  const orb = React.useRef<THREE.Mesh>(null);
  const rings = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = motionTime(clock);
    if (orb.current) {
      const m = orb.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.6 + Math.sin(t * 1.2) * 0.5;
    }
    if (rings.current) rings.current.rotation.z = t * 0.05;
  });
  const gold = { color: '#ffd88a', emissive: '#ffae2e', emissiveIntensity: 0.9, transparent: true, opacity: 0.5 };
  return (
    <group position={[x, y, z]}>
      {/* meditující silueta */}
      <group>
        {/* lotusový sed */}
        <mesh position={[0, -7.5, 0]} scale={[1.5, 0.4, 1]}>
          <sphereGeometry args={[4.4, 14, 10]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        {/* torso */}
        <mesh position={[0, -3.4, 0]}>
          <capsuleGeometry args={[2.6, 4.6, 6, 10]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        {/* hlava */}
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[1.7, 14, 10]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        {/* ushnisha + třetí oko */}
        <mesh position={[0, 2.6, 0]}>
          <coneGeometry args={[0.7, 1.1, 8]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        <mesh position={[0, 1, 1.62]}>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshStandardMaterial color="#fff2c8" emissive="#ffe98a" emissiveIntensity={2.4} />
        </mesh>
        {/* ruce v dhyāna mudře */}
        {[-1, 1].map((s, i) => (
          <mesh key={i} position={[s * 2.4, -4.6, 0.8]} rotation={[0, 0, s * 0.9]}>
            <capsuleGeometry args={[0.55, 2.6, 4, 8]} />
            <meshStandardMaterial {...gold} />
          </mesh>
        ))}
      </group>
      {/* mandala — dvojitý kruh + květ života */}
      <group ref={rings}>
        <mesh>
          <torusGeometry args={[9.5, 0.14, 8, 64]} />
          <meshStandardMaterial color="#ffca60" emissive="#ff9a20" emissiveIntensity={1} transparent opacity={0.7} />
        </mesh>
        <mesh>
          <torusGeometry args={[12, 0.09, 8, 64]} />
          <meshStandardMaterial color="#ffca60" emissive="#ff9a20" emissiveIntensity={0.7} transparent opacity={0.5} />
        </mesh>
        {/* kroužky květu života na obvodu */}
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 6.4, Math.cos(a) * 6.4, 0]}>
              <torusGeometry args={[2.6, 0.07, 6, 24]} />
              <meshStandardMaterial color="#ffca60" emissive="#ff9a20" emissiveIntensity={0.6} transparent opacity={0.45} />
            </mesh>
          );
        })}
      </group>
      {/* zářící vejce Hiranyagarbha */}
      <mesh ref={orb} position={[0, -9.6, 2.2]} scale={[0.8, 1.1, 0.8]}>
        <sphereGeometry args={[2, 16, 12]} />
        <meshStandardMaterial color="#fff0b8" emissive="#ffca40" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, -9, 3]} intensity={6} color="#ffca50" distance={40} decay={2} />
    </group>
  );
}

/** klasické pyramidy Gízy v pozadí */
function GizaPyramids() {
  return (
    <group>
      {[
        { p: [-52, 0, -78], s: 14, h: 10 },
        { p: [-38, 0, -66], s: 10, h: 8 },
        { p: [-66, 0, -60], s: 6, h: 5 },
      ].map((pyr, i) => (
        <mesh key={i} position={pyr.p as [number, number, number]} castShadow>
          <coneGeometry args={[pyr.s, pyr.h, 4]} />
          <meshStandardMaterial color={['#9a7a52', '#a8845a', '#8a6a48'][i]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** modrá hvězdná tvář — translucidní drátěná hlava z uzlů */
function StarFace({ x, y, z }: { x: number; y: number; z: number }) {
  const nodes = React.useMemo(() => {
    const pts: [number, number, number][] = [];
    // profil tváře z uzlů — ovál + obličejové linie
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      pts.push([Math.sin(a) * 4.4, Math.cos(a) * 5.4, Math.sin(a * 3) * 0.8]);
    }
    // vnitřní síť — nos, oko, brada
    pts.push([0.9, 0.5, 2.6], [1.4, -0.6, 2.4], [0.6, -1.8, 2.2], [-0.8, 0.9, 2.3], [0.2, 2.4, 1.8], [-0.4, -3.2, 1.6]);
    return pts;
  }, []);
  const edges = React.useMemo(() => {
    const lines: [number, number][] = [];
    for (let i = 0; i < 26; i++) lines.push([i, (i + 1) % 26]);
    // paprskové spojnice do vnitřní sítě
    for (let i = 0; i < 26; i += 4) lines.push([i, 26 + (i % 6)]);
    return lines;
  }, []);
  const geo = React.useMemo(() => {
    const verts: number[] = [];
    for (const [a, b] of edges) verts.push(...nodes[a], ...nodes[b]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [nodes, edges]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={[x, y, z]} rotation={[0, 0.5, 0]}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color="#6ab8e8" transparent opacity={0.5} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.14, 6, 5]} />
          <meshStandardMaterial color="#bfe4ff" emissive="#5aa8e8" emissiveIntensity={1.4} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[5.8, 18, 14]} />
        <meshStandardMaterial color="#2a6ab8" transparent opacity={0.12} roughness={0.3} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/** Země + orbitální stanice */
function EarthStation({ x, y, z }: { x: number; y: number; z: number }) {
  const st = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (st.current) st.current.rotation.y = motionTime(clock) * 0.1;
  });
  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[6, 20, 14]} />
        <meshStandardMaterial color="#2a6ab8" roughness={0.4} emissive="#1a4a88" emissiveIntensity={0.4} />
      </mesh>
      {/* kontinenty naznačené jasnými skvrnami */}
      {[...Array(8)].map((_, i) => {
        const a = rng(i + 3) * Math.PI * 2;
        const b = rng(i + 9) * Math.PI - Math.PI / 2;
        return (
          <mesh key={i} position={[Math.cos(a) * Math.cos(b) * 6.1, Math.sin(b) * 6.1, Math.sin(a) * Math.cos(b) * 6.1]} scale={[1.4, 0.8, 1.4]}>
            <sphereGeometry args={[0.9 + rng(i) * 0.8, 7, 5]} />
            <meshStandardMaterial color="#3a8a5c" roughness={0.7} emissive="#1a5a3a" emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      {/* orbitální stanice — kroužitý prsten modulů */}
      <group ref={st} rotation={[0.4, 0, 0.2]}>
        <mesh>
          <torusGeometry args={[8.4, 0.12, 6, 48]} />
          <meshStandardMaterial color="#c8ccd4" metalness={0.8} roughness={0.3} emissive="#7a8a9a" emissiveIntensity={0.3} />
        </mesh>
        {[...Array(10)].map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 8.4, Math.sin(a) * 8.4, 0]} rotation={[0, 0, a]}>
              <boxGeometry args={[1, 0.5, 0.6]} />
              <meshStandardMaterial color="#d8dce4" metalness={0.7} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** zlatý energetický oblouk mezi dvěma body */
function GoldArc({ from, to, lift = 6 }: { from: [number, number, number]; to: [number, number, number]; lift?: number }) {
  const geo = React.useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    return new THREE.TubeGeometry(curve, 40, 0.09, 5);
  }, [from[0], from[1], from[2], to[0], to[1], to[2], lift]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color="#ffca5e" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** oáza — jezírko, vodopád, palmy, květiny */
function Oasis() {
  return (
    <group>
      {/* jezírko */}
      <SceneWater width={24} depth={17} position={[14, 0.06, 12]} tint="#0b4a52" repeat={3} speed={0.7} sun={[-0.52, 0.07, -0.85]} sky="#e08a4a" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[14, 0.02, 12]} scale={[1.55, 1.12, 1]}>
        <ringGeometry args={[8.5, 8.6, 28]} />
        <meshStandardMaterial color="#c8b888" roughness={0.9} />
      </mesh>
      {/* vodopád do jezírka */}
      {[...Array(3)].map((_, i) => (
        <mesh key={i} position={[20.5 + i * 1.2, 1.5, 9 - i * 0.5]} rotation={[0, -0.45, 0]}>
          <planeGeometry args={[1.3, 3.6]} />
          <meshStandardMaterial color="#bfe8e0" transparent opacity={0.6} emissive="#7ac8c0" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* skalisko vodopádu — vrypě do země na kraji jezírka */}
      <mesh position={[23, 0.6, 7.5]} scale={[2.6, 1.1, 2]}>
        <sphereGeometry args={[1.8, 8, 6]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.95} />
      </mesh>
      {/* pěna u paty vodopádu */}
      {[...Array(4)].map((_, i) => (
        <mesh key={100 + i} rotation={[-Math.PI / 2, 0, 0]} position={[19.5 + i * 1.1, 0.09, 10.4 + (i % 2) * 0.8]}>
          <circleGeometry args={[0.6 + rng(i) * 0.5, 8]} />
          <meshStandardMaterial color="#e8f4ee" transparent opacity={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* palmy kolem oázy */}
      {[[4, 16, 1.5], [24, 16, 1.35], [8, 4, 1.2], [26, 12, 1.55], [-6, 14, 1.35], [-14, 8, 1.15]].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={[s, s, s]}>
          <mesh position={[0, 3, 0]} rotation={[0, 0, 0.08 * (i % 2 ? 1 : -1)]} castShadow>
            <cylinderGeometry args={[0.18, 0.3, 6, 6]} />
            <meshStandardMaterial color="#6a4a2e" roughness={0.9} />
          </mesh>
          {[...Array(9)].map((_, j) => {
            const a = (j / 9) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.sin(a) * 0.9, 6.2, Math.cos(a) * 0.9]} rotation={[0.55, a, 0]} scale={[0.55, 1.1, 0.18]}>
                <octahedronGeometry args={[1.7]} />
                <meshStandardMaterial color={j % 2 ? '#3a7a3c' : '#4a8a44'} roughness={0.85} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* květiny */}
      {[...Array(16)].map((_, i) => {
        const a = rng(i + 20) * Math.PI * 2;
        const r = 10 + rng(i + 4) * 10;
        return (
          <mesh key={i} position={[14 + Math.sin(a) * r * 1.2, 0.25, 12 + Math.cos(a) * r * 0.8]}>
            <sphereGeometry args={[0.2, 6, 5]} />
            <meshStandardMaterial color={['#d04a6a', '#e07a3a', '#c84a8a', '#e8b83e'][i % 4]} emissive={['#a02848', '#a04a1a', '#90285a', '#a07818'][i % 4]} emissiveIntensity={0.5} />
          </mesh>
        );
      })}
      {/* lotusy na hladině */}
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[10 + i * 2.2, 0.12, 13 + (i % 2) * 1.6]} scale={[1, 0.3, 1]}>
          <sphereGeometry args={[0.45, 8, 6]} />
          <meshStandardMaterial color="#e8a8c8" emissive="#c06a98" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** moře vpravo + plachetnice */
function SeaAndSails() {
  return (
    <group>
      <SceneWater width={120} depth={130} position={[112, -3.1, -30]} tint="#0a3542" repeat={8} speed={1.4} sun={[-0.52, 0.07, -0.85]} sky="#d98a52" />
      {[...Array(4)].map((_, i) => (
        <group key={i} position={[60 + i * 9 - rng(i) * 4, 0, -52 - rng(i + 2) * 18]} rotation={[0, rng(i + 4) * 0.8 - 0.4, 0]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[2.6, 0.5, 0.9]} />
            <meshStandardMaterial color="#7a5a38" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.9, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 3.4, 4]} />
            <meshStandardMaterial color="#4a3826" />
          </mesh>
          <mesh position={[0.5, 1.9, 0]} rotation={[0, 0, -0.06]}>
            <planeGeometry args={[1.5, 2.6]} />
            <meshStandardMaterial color="#f0ead8" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** poušť + zelený pás Nilu + poutníci */
function Desert() {
  return (
    <group>
      <SceneTerrain
        kind="sand"
        size={760}
        segments={170}
        repeat={240}
        seed={29}
        level={-0.15}
        height={(x, z, noise) => {
          const distance = Math.hypot(x, z - 6);
          const dunes = Math.max(0, Math.min(1, (distance - 64) / 90)) * ((noise.ridged(x * 0.012, z * 0.012, 3) - 0.5) * 9);
          // The sea shelf drops away east of the oasis.
          const shelf = THREE.MathUtils.smoothstep(x, 48, 76) * -6;
          return dunes + shelf;
        }}
        color={(x, _y, z, noise) => {
          const distance = Math.hypot(x, z - 6);
          const dry = noise.fbm(x * 0.02 + 4, z * 0.02 + 1, 3);
          const sand: [number, number, number] = [0.6 + dry * 0.1, 0.49 + dry * 0.08, 0.34 + dry * 0.06];
          if (x > 58) return [0.22 + dry * 0.04, 0.23 + dry * 0.03, 0.21];
          // The green band of the valley, faded at both edges instead of a hard ring.
          const band = THREE.MathUtils.smoothstep(distance, 22, 34) * (1 - THREE.MathUtils.smoothstep(distance, 46, 58));
          if (band <= 0.02) return sand;
          const green: [number, number, number] = [0.2 + dry * 0.06, 0.31 + dry * 0.08, 0.15 + dry * 0.04];
          return [sand[0] + (green[0] - sand[0]) * band, sand[1] + (green[1] - sand[1]) * band, sand[2] + (green[2] - sand[2]) * band];
        }}
      />
      {/* skaliska popředí */}
      {[...Array(10)].map((_, i) => {
        const a = -0.7 + i * 0.17;
        return (
          <mesh key={i} position={[Math.sin(a) * 40, 0.4 + rng(i) * 0.7, 34 + rng(i + 2) * 6]} scale={[1.9, 0.6 + rng(i + 4) * 0.5, 1.4]} castShadow>
            <sphereGeometry args={[1.7, 8, 6]} />
            <meshStandardMaterial color={i % 2 ? '#8a6a46' : '#7a5c3c'} roughness={0.95} />
          </mesh>
        );
      })}
      {/* poutníci na cestě */}
      {[...Array(6)].map((_, i) => (
        <group key={i} position={[-10 + i * 3.2, 0, 30 - i * 3.4]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <capsuleGeometry args={[0.24, 0.72, 4, 6]} />
            <meshStandardMaterial color={['#e8dcc0', '#4a8a4a', '#d8b830', '#c8b89a', '#8a5a3a', '#e0d0b0'][i]} roughness={0.9} />
          </mesh>
          <mesh position={[0.32, 1, 0]} rotation={[0, 0, -0.14]}>
            <cylinderGeometry args={[0.03, 0.035, 1.7, 4]} />
            <meshStandardMaterial color="#5a4630" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* cesta */}
      <mesh rotation={[-Math.PI / 2, 0, -0.6]} position={[-4, 0.02, 18]}>
        <planeGeometry args={[2.6, 40]} />
        <meshStandardMaterial color="#b89468" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function AmentiScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation
        camera={AMENTI_CAMERA}
        target={AMENTI_CONTROLS.target}
        atmosphere={{
          sun: [-0.52, 0.07, -0.85],
          zenith: '#0b1230',
          horizon: '#e08a4a',
          ground: '#2a2018',
          sunColor: '#ffb066',
          sunSharpness: 420,
          clouds: 0,
          stars: 0.95,
          fog: '#3a2c20',
          fogDensity: 0.0013,
          envIntensity: 0.8,
        }}
        post={{ bloom: 0.34, threshold: 0.86, exposure: 1.04, vignette: 0.55 }}
        intro={{ duration: 4.2, rise: 0.3 }}
      />

      <Desert />
      <GrandPyramid />
      <GizaPyramids />
      <CosmicBeing x={0} y={42} z={-26} />
      <StarFace x={-38} y={38} z={-52} />
      <EarthStation x={42} y={40} z={-56} />
      {/* zlaté energetické oblouky — síť mezi body */}
      <GoldArc from={[0, 12.4, -26]} to={[0, 31, -24]} lift={3} />
      <GoldArc from={[0, 45, -26]} to={[-36, 40, -50]} lift={8} />
      <GoldArc from={[0, 45, -26]} to={[40, 42, -54]} lift={8} />
      <GoldArc from={[-36, 36, -50]} to={[40, 38, -54]} lift={14} />
      <Oasis />
      <SceneMotes count={260} area={[120, 120]} height={26} speed={0.5} size={2.8} color="#f0c9a0" opacity={0.35} sway={2.4} seed={9} />
      <SeaAndSails />

      {/* labely */}
      <SceneLabel position={[0, 15.5, -10]} text={cs ? 'Síň Amenti — záznam civilizace' : tScene('Hall of Amenti — record of civilisation', lang)} scale={2.6} />
      <SceneLabel position={[0, 53, -26]} text={cs ? 'Hiranyagarbha — zlaté vejce' : tScene('Hiranyagarbha — golden egg', lang)} scale={2.4} />
      <SceneLabel position={[-38, 46, -52]} text={cs ? 'Hvězdná tvář' : tScene('Star face', lang)} scale={2} />
      <SceneLabel position={[42, 48.5, -56]} text={cs ? 'Země + orbitální stanice' : tScene('Earth + orbital station', lang)} scale={2} />
      <SceneLabel position={[-48, 12, -68]} text={cs ? 'Pyramidy Gízy' : tScene('Giza pyramids', lang)} scale={2.2} />
      <SceneLabel position={[14, 3.5, 12]} text={cs ? 'Oáza' : tScene('Oasis', lang)} scale={1.8} />
      <SceneLabel position={[66, 5, -58]} text={cs ? 'Plachetnice na moři' : tScene('Sailboats at sea', lang)} scale={1.9} />
    </>
  );
}

export const AMENTI_CAMERA = { position: [2, 24, 82] as [number, number, number], fov: 48, far: 1400 };
export const AMENTI_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.14, minDistance: 18, maxDistance: 240, maxPolarAngle: Math.PI / 2 - 0.05, target: [0, 22, -20] as [number, number, number], enablePan: false };
export function AmentiLighting() {
  return (
    <>
      <ambientLight intensity={0.16} color="#ffd8b0" />
      <SkyFill sky="#7f96c8" ground="#2a2018" intensity={0.42} />
      <KeyLight sun={[-0.52, 0.07, -0.85]} intensity={2.1} extent={110} distance={180} color="#ffb671" />
    </>
  );
}
