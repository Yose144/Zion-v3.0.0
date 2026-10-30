/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';

type Lang = 'cs' | 'en';

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
  const main = useMemo(() => cliffGeo(3, 34, 20, 9), []);
  const back1 = useMemo(() => cliffGeo(7, 24, 15, 8), []);
  const back2 = useMemo(() => cliffGeo(11, 19, 12, 7), []);
  return (
    <group>
      {/* hlavní mys — čelo k moři */}
      <mesh geometry={main} position={[-16, 1, -14]} castShadow receiveShadow>
        <meshStandardMaterial color="#5a4634" roughness={0.95} />
      </mesh>
      {/* ustupující hřebeny za mysem — vpravo do dálky */}
      <mesh geometry={back1} position={[16, 0.5, -38]} rotation={[0, -0.28, 0]} castShadow>
        <meshStandardMaterial color="#52402e" roughness={0.95} />
      </mesh>
      <mesh geometry={back2} position={[46, 0, -52]} rotation={[0, -0.42, 0]}>
        <meshStandardMaterial color="#4a3a2c" roughness={0.95} />
      </mesh>
      {/* útesy zahlazující pravý bok — nižší předhůří */}
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[-38 + i * 9, 2.5 + rng(i) * 2, -8 - rng(i + 4) * 5]} scale={[4.5, 3 + rng(i + 2) * 2, 4]} castShadow>
          <sphereGeometry args={[1.4, 8, 6]} />
          <meshStandardMaterial color="#5a4634" roughness={0.95} />
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
  const plants = useMemo(() => {
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
  const beam = useRef<THREE.Group>(null);
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
        <mesh position={[9, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[18, 0.5, 0.12]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh position={[-7, 0, 0]}>
          <boxGeometry args={[14, 0.35, 0.1]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
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
  const foam = useRef<THREE.Group>(null);
  const swell = useRef<THREE.Mesh>(null);
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
      {/* Atlantik — tmavší tyrkys */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-60, -0.7, 40]}>
        <planeGeometry args={[160, 170]} />
        <meshStandardMaterial color="#1a4a54" roughness={0.15} metalness={0.45} />
      </mesh>
      {/* Indický oceán — teplejší zelenomodrá */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[60, -0.68, 40]}>
        <planeGeometry args={[160, 170]} />
        <meshStandardMaterial color="#205a60" roughness={0.15} metalness={0.45} />
      </mesh>
      {/* šev dvou oceánů — jemná světlá linie */}
      <mesh rotation={[-Math.PI / 2, 0, 0.1]} position={[0, -0.62, 40]}>
        <planeGeometry args={[1.1, 160]} />
        <meshStandardMaterial color="#bfe8dc" transparent opacity={0.22} roughness={0.4} emissive="#9ad0c2" emissiveIntensity={0.3} />
      </mesh>
      {/* příbojová vlna sunoucí se ke břehu */}
      <mesh ref={swell} rotation={[-Math.PI / 2, 0, 0.04]} position={[8, -0.55, 16]}>
        <planeGeometry args={[70, 2.6]} />
        <meshStandardMaterial color="#cfe8e2" transparent opacity={0.4} roughness={0.5} />
      </mesh>
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
  const flock = useRef<THREE.Group>(null);
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

/** bouřlivá obloha — temné mraky vlevo, zlaté paprsky ze slunce vpravo */
function StormSky() {
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
          float noise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
            float c = hash(vec3(i + vec2(0.0, 1.0), 1.0)), d = hash(vec3(i + vec2(1.0, 1.0), 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }
          void main(){
            vec3 d = normalize(vP);
            // základní gradient — temná bouře nahoře, zlato u obzoru vpravo
            float east = clamp(dot(normalize(d.xz), normalize(vec2(0.57, -0.83))) * 0.5 + 0.5, 0.0, 1.0);
            vec3 storm = mix(vec3(0.10, 0.11, 0.15), vec3(0.05, 0.055, 0.08), smoothstep(0.0, 0.55, d.y));
            vec3 gold = mix(vec3(0.95, 0.68, 0.34), vec3(0.42, 0.3, 0.26), smoothstep(-0.02, 0.4, d.y));
            vec3 c = mix(storm, gold, clamp(east * (1.0 - smoothstep(0.05, 0.5, d.y)) * 1.4, 0.0, 1.0));
            // mraky — vrstvený šum
            float cl = noise(d.xz / max(d.y, 0.08) * 2.2) * 0.6 + noise(d.xz / max(d.y, 0.08) * 5.5) * 0.4;
            float cloud = smoothstep(0.42, 0.75, cl) * smoothstep(-0.02, 0.18, d.y);
            c = mix(c, vec3(0.07, 0.075, 0.1), cloud * (1.0 - east * 0.55));
            // slunce + boží paprsky
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.88, 0.55) * pow(s, 500.0) * 3.4
               + vec3(1.0, 0.7, 0.35) * pow(s, 30.0) * 0.55;
            // radiální paprsky ze slunce
            vec3 sp = normalize(cross(sunDir, vec3(0.0, 1.0, 0.0)));
            float ang = atan(dot(d, sp), dot(d, normalize(cross(sp, sunDir))));
            float rays = pow(0.5 + 0.5 * sin(ang * 14.0 + cl * 6.0), 3.0);
            c += vec3(1.0, 0.82, 0.45) * rays * pow(s, 5.0) * 0.7;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          sunDir: { value: new THREE.Vector3(0.55, 0.11, -0.8).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[380, 32, 20]} />
    </mesh>
  );
}

export function BoaEsperancaScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation camera={BOA_CAMERA} target={BOA_CONTROLS.target} />
      <StormSky />
      <fog attach="fog" args={['#5a5a58', 90, 300]} />

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
  return <>
    <ambientLight intensity={0.5} color="#c8d0d8" />
    <hemisphereLight args={['#d8c8a8', '#24303a', 0.6]} />
    <directionalLight position={[80, 30, -30]} intensity={1.8} color="#ffd090" castShadow />
    <directionalLight position={[-40, 20, 50]} intensity={0.4} color="#90a8c0" />
  </>;
}
