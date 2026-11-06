/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { AtlanticOcean } from './CoastalLandscape';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';
import { KeyLight, SkyFill, basaltRock } from './kit';

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

/* ─── Boa Esperança — Cape of Good Hope · Jihoafrická republika ────────
 * Dle hero: masivní mořské útesy s majákem na hřebenu, fynbos křoviny
 * na náhorní plošině, bouřlivý oceán s pěnou o skály, dramatická
 * obloha s božími paprsky — a šev, kde se setkávají dva oceány.
 */

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

/** skalní deska — protáhlá rozeklaná masa s plochým vrcholem */
function cliffGeo(seed: number, len: number, h: number, w: number) {
  const g = new THREE.SphereGeometry(1, 48, 24);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 7 + seed) * 0.12 +
      Math.sin(v.y * 11 + seed * 2) * 0.09 +
      Math.sin(v.z * 9 + seed * 3) * 0.1;
    let { x, y, z } = v;
    // plochá náhorní plošina — seříznutý vrchol
    if (y > 0.4) y = 0.4 + (y - 0.4) * 0.22;
    // strmější mořská stěna (jižní strana, -z)
    if (z < -0.15) z = -0.15 + (z + 0.15) * 0.5;
    pos.setXYZ(i, x * (1 + n * 0.5), y * (1 + n), z * (1 + n * 0.6));
  }
  g.scale(len, h, w);
  g.computeVertexNormals();
  return g;
}

/** útesový hřeben — hlavní mys + ustupující hřebeny */
function Cliffs() {
  const main = React.useMemo(() => cliffGeo(3, 34, 20, 9), []);
  const back1 = React.useMemo(() => cliffGeo(7, 24, 15, 8), []);
  const back2 = React.useMemo(() => cliffGeo(11, 19, 12, 7), []);
  React.useEffect(() => () => { main.dispose(); back1.dispose(); back2.dispose(); }, [main, back1, back2]);
  return (
    <group>
      {/* hlavní mys — čelo k moři */}
      <mesh geometry={main} position={[-16, 1, -14]} castShadow receiveShadow>
        <primitive object={basaltRock(5)} attach="material" />
      </mesh>
      {/* ustupující hřebeny za mysem — vpravo do dálky */}
      <mesh geometry={back1} position={[16, 0.5, -38]} rotation={[0, -0.28, 0]} castShadow>
        <primitive object={basaltRock(4)} attach="material" />
      </mesh>
      <mesh geometry={back2} position={[46, 0, -52]} rotation={[0, -0.42, 0]}>
        <primitive object={basaltRock(4)} attach="material" />
      </mesh>
      {/* útesy zahlazující pravý bok — nižší předhůří */}
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[-38 + i * 9, 2.5 + rng(i) * 2, -8 - rng(i + 4) * 5]} scale={[4.5, 3 + rng(i + 2) * 2, 4]} castShadow>
          <sphereGeometry args={[1.4, 8, 6]} />
          <primitive object={basaltRock(5)} attach="material" />
        </mesh>
      ))}
      {/* skaliska ve vodě u paty — placatá, tmavá */}
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[-6 + i * 7 - rng(i) * 4, -0.5 + rng(i + 1) * 0.4, 10 + rng(i + 3) * 9]} scale={[2.1, 0.55 + rng(i + 5) * 0.5, 1.6]}>
          <sphereGeometry args={[1.6, 7, 6]} />
          <meshStandardMaterial color="#3a3028" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** fynbos — nízké křoviny na náhorní plošině + protea akcenty */
function Fynbos() {
  const plants = React.useMemo(() => {
    const arr: { p: [number, number, number]; s: number; flower: boolean }[] = [];
    for (let i = 0; i < 90; i++) {
      const t = rng(i + 9);
      const x = -46 + t * 55 + rng(i + 1) * 6;
      const z = -20 + rng(i + 2) * 9;
      const y = 13.2 - Math.max(0, (x + 46) * 0.02) + rng(i + 5) * 0.4;
      arr.push({ p: [x, y, z], s: 0.35 + rng(i + 3) * 0.8, flower: rng(i + 7) > 0.88 });
    }
    return arr;
  }, []);
  return (
    <group>
      {plants.map((p, i) => (
        <group key={i} position={p.p}>
          <mesh scale={[1.5, p.s, 1.5]} castShadow>
            <sphereGeometry args={[0.7, 6, 5]} />
            <meshStandardMaterial color={['#4a5228', '#5a5e30', '#6a6a38', '#556030'][i % 4]} roughness={0.95} />
          </mesh>
          {p.flower && (
            <mesh position={[0, p.s * 0.75, 0]}>
              <sphereGeometry args={[0.22, 6, 5]} />
              <meshStandardMaterial color="#c86a8a" emissive="#a04a6a" emissiveIntensity={0.4} roughness={0.7} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** maják Cape Point — bílá věž s lucernou + rotující svazek */
function Lighthouse() {
  const beam = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (beam.current) beam.current.rotation.y = motionTime(clock) * 0.5;
  });
  return (
    <group position={[-10, 13.6, -16]}>
      {/* plošina + domek strážce */}
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[4.4, 5, 0.7, 12]} />
        <meshStandardMaterial color="#6b5a42" roughness={0.9} />
      </mesh>
      <mesh position={[3.2, 1.3, 0.8]} castShadow>
        <boxGeometry args={[2.6, 1.6, 2]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.8} />
      </mesh>
      <mesh position={[3.2, 2.25, 0.8]} rotation={[0, 0, 0]}>
        <coneGeometry args={[1.9, 0.9, 4]} />
        <meshStandardMaterial color="#8a4a30" roughness={0.8} />
      </mesh>
      {/* bílá věž */}
      <mesh position={[0, 4.2, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.25, 8, 14]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.6} />
      </mesh>
      {/* galerie + lucerna */}
      <mesh position={[0, 8.35, 0]}>
        <cylinderGeometry args={[1.35, 1.1, 0.35, 14]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 8.95, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.9, 12]} />
        <meshStandardMaterial color="#ffe9b0" emissive="#ffd060" emissiveIntensity={1.6} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 9.65, 0]}>
        <coneGeometry args={[0.95, 0.8, 12]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
      </mesh>
      {/* rotující svazek */}
      <group ref={beam} position={[0, 8.95, 0]}>
        <mesh position={[7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[1.5, 14, 14, 1, true]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-5.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[1.1, 11, 12, 1, true]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight position={[0, 9, 0]} intensity={3} color="#ffca5e" distance={26} decay={2} />
    </group>
  );
}

/** kamenný kruh — místo setkání na plošině (Khoisan) */
function StoneCircle({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 13.55, z]}>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[3.4, 3.7, 0.3, 16]} />
        <meshStandardMaterial color="#7a6a52" roughness={0.9} />
      </mesh>
      {[...Array(9)].map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 2.7, 0.75, Math.cos(a) * 2.7]} rotation={[0, a, 0.05]} castShadow>
            <boxGeometry args={[0.45, 1.3 + (i % 3) * 0.25, 0.3]} />
            <meshStandardMaterial color="#8a7a5e" roughness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 0.5, 10]} />
        <meshStandardMaterial color="#5a4a38" roughness={0.95} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={1.6} color="#ff9a3e" distance={9} decay={2} />
    </group>
  );
}

/** oceán — dvě vody se švem + pěna o skály + vlny */
function TwoOceans() {
  const foam = React.useRef<THREE.Group>(null);
  const swell = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = motionTime(clock);
    if (foam.current) {
      foam.current.children.forEach((c, i) => {
        const s = 0.8 + Math.sin(t * 1.1 + i * 1.7) * 0.25;
        c.scale.set(s, 1, s * 0.8);
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.opacity = 0.3 + Math.sin(t * 1.4 + i * 2.3) * 0.18;
      });
    }
    if (swell.current) {
      swell.current.position.z = 16 + Math.sin(t * 0.35) * 2.5;
      const m = swell.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.35 + Math.sin(t * 0.5) * 0.12;
    }
  });
  return (
    <group>
      <AtlanticOcean level={-.7} coastal={false} roughSea />
      {/* pěna u skalisek */}
      <group ref={foam}>
        {[...Array(10)].map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, rng(i) * 3]} position={[-8 + i * 5.5 - rng(i + 2) * 3, -0.5, 7 + rng(i + 4) * 9]}>
            <circleGeometry args={[0.9 + rng(i + 6) * 1.4, 12]} />
            <meshStandardMaterial color="#eef8f2" transparent opacity={0.5} roughness={0.6} />
          </mesh>
        ))}
        {/* pěna pod útesovou stěnou */}
        {[...Array(8)].map((_, i) => (
          <mesh key={100 + i} rotation={[-Math.PI / 2, 0, 0]} position={[-34 + i * 7, -0.5, -5 + rng(i + 8) * 3]}>
            <circleGeometry args={[1.4 + rng(i + 10) * 1.4, 12]} />
            <meshStandardMaterial color="#e6f4ec" transparent opacity={0.45} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** mořští ptáci kroužící u mysu */
function Seabirds() {
  const flock = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (flock.current) flock.current.rotation.y = motionTime(clock) * 0.12;
  });
  return (
    <group ref={flock} position={[-14, 22, -8]}>
      {[...Array(6)].map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * (7 + i), Math.sin(i * 2.2) * 2, Math.cos(a) * (7 + i)]} rotation={[0, -a, 0]}>
            <mesh rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.7, 0.05, 0.18]} />
              <meshStandardMaterial color="#e8e4da" />
            </mesh>
            <mesh rotation={[0, 0, -0.5]}>
              <boxGeometry args={[0.7, 0.05, 0.18]} />
              <meshStandardMaterial color="#e8e4da" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function BoaEsperancaScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation
        camera={BOA_CAMERA}
        target={BOA_CONTROLS.target}
        atmosphere={{
          sun: [-0.6, 0.18, -0.78],
          zenith: '#2a3444',
          horizon: '#8f958f',
          ground: '#2a3238',
          sunColor: '#ffd6a8',
          sunSharpness: 200,
          clouds: 0.85,
          stars: 0,
          fog: '#7b8184',
          fogDensity: 0.0028,
          envIntensity: 0.9,
        }}
        post={{ bloom: 0.3, threshold: 0.9, exposure: 0.98, vignette: 0.55 }}
        intro={{ duration: 4 }}
      />

      <Cliffs />
      <Fynbos />
      <Lighthouse />
      <StoneCircle x={-24} z={-14} />
      <TwoOceans />
      <Seabirds />

      {/* labely */}
      <SceneLabel position={[-10, 26.5, -16]} text={cs ? 'Maják Cape Point' : 'Cape Point lighthouse'} scale={2.6} />
      <SceneLabel position={[-24, 16.5, -14]} text={cs ? 'Kruh kamenů — Khoisan' : 'Stone circle — Khoisan'} scale={1.9} />
      <SceneLabel position={[30, 14, -46]} text={cs ? 'Útesy mysu' : 'Cliffs of the cape'} scale={2.4} />
      <SceneLabel position={[2, 2.5, 26]} text={cs ? 'Šev dvou oceánů' : 'Seam of two oceans'} scale={2} />
      <SceneLabel position={[-38, 15.5, -13]} text={cs ? 'Fynbos' : 'Fynbos'} scale={1.7} />
    </>
  );
}

export const BOA_CAMERA = { position: [16, 9, 58] as [number, number, number], fov: 48, far: 1000 };
export const BOA_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 16, maxDistance: 140, maxPolarAngle: Math.PI / 2 - 0.05, target: [-8, 10, -10] as [number, number, number], enablePan: false };
export function BoaEsperancaLighting() {
  return (
    <>
      <ambientLight intensity={0.18} color="#c8d0d8" />
      <SkyFill sky="#a9b8c8" ground="#24303a" intensity={0.5} />
      <KeyLight sun={[-0.6, 0.18, -0.78]} intensity={2.2} extent={120} distance={180} color="#ffd6a8" />
    </>
  );
}
