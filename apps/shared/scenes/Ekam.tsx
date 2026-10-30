/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── Ekam · Oneness Temple — Andhra Pradesh, Indie ───────────────────
 * Reálná stavba (status: built). Dlouhá bílá mramorová síň ve třech
 * patrech arkád, centrální osmiúhelná věž se zlatým kalashem a
 * světelným paprskem Hiranyagarbha, řada shikhara kupolí po střeše,
 * rohové věže, velké schodiště, zrcadlový bazén a geometrické zahrady.
 * Svítání za chrámem — světlo se rodí za věží.
 */

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

const MARBLE = '#ece4d4';
const MARBLE_D = '#ddd2ba';
const GOLD = '#d9b45c';
const GLASS = '#2e3d4c';

/** arkádové okno — štítek ve tvaru lomeného oblouku */
function archGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0.5, 0.62);
  s.absarc(0, 0.62, 0.5, 0, Math.PI, false);
  s.lineTo(-0.5, 0);
  return new THREE.ShapeGeometry(s, 10);
}
const ARCH = archGeometry();

function ArchRow({ n, x, y, z, w, h, gap, ry = 0 }: { n: number; x: number; y: number; z: number; w: number; h: number; gap: number; ry?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {Array.from({ length: n }, (_, i) => {
        const off = (i - (n - 1) / 2) * gap;
        return (
          <group key={i} position={[off, 0, 0]}>
            <mesh geometry={ARCH} scale={[w, h, 1]}>
              <meshStandardMaterial color={GLASS} roughness={0.3} metalness={0.4} emissive="#f4b95e" emissiveIntensity={0.18} side={THREE.DoubleSide} />
            </mesh>
            {/* kamenný rám */}
            <mesh geometry={ARCH} scale={[w + 0.28, h + 0.24, 1]} position={[0, -0.1, -0.02]}>
              <meshStandardMaterial color={MARBLE_D} roughness={0.7} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** shikhara — malý pavilon s rebrovanou kupolí a hrotem */
function Shikhara({ x, y, z, s = 1 }: { x: number; y: number; z: number; s?: number }) {
  return (
    <group position={[x, y, z]} scale={s}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.7, 0.5, 8]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.7} />
      </mesh>
      {/* rebrovaná kupole — lathe profil cibule */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <latheGeometry args={[
          [[0, 0], [0.58, 0.1], [0.68, 0.42], [0.5, 0.95], [0.2, 1.3], [0.06, 1.5], [0, 1.58]]
            .map(([a, b]) => new THREE.Vector2(a, b)), 14]} />
        <meshStandardMaterial color={MARBLE} roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.16, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} emissive="#8a5a14" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** rohová osmiúhelná věž */
function CornerTower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.4, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.75, 6.8, 8]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.65} />
      </mesh>
      {/* balkónové římsy */}
      {[2.2, 4.4].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[1.9, 1.9, 0.18, 8]} />
          <meshStandardMaterial color={MARBLE} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 7.1, 0]}>
        <sphereGeometry args={[1.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={MARBLE} roughness={0.6} />
      </mesh>
      <mesh position={[0, 7.9, 0]}>
        <coneGeometry args={[0.4, 1.1, 8]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} emissive="#8a5a14" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

/** centrální věž — osmiúhelná, stupňovitá, ribbed dome + kalash + beam */
function CentralTower() {
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = beamRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.32 + Math.sin(clock.getElapsedTime() * 1.4) * 0.07;
  });
  return (
    <group position={[0, 0, -1]}>
      {/* stupňovitý základ */}
      <mesh position={[0, 6.6, 0]} castShadow>
        <cylinderGeometry args={[3.3, 3.8, 1.2, 8]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.65} />
      </mesh>
      {/* arkádový buben věže */}
      <mesh position={[0, 8.5, 0]} castShadow>
        <cylinderGeometry args={[2.7, 3.0, 2.6, 8]} />
        <meshStandardMaterial color={MARBLE} roughness={0.6} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <group key={i} position={[Math.sin(a) * 2.72, 7.9, Math.cos(a) * 2.72]} rotation={[0, a, 0]}>
            <mesh geometry={ARCH} scale={[0.55, 1.15, 1]} position={[0, 0, 0.02]}>
              <meshStandardMaterial color={GLASS} roughness={0.35} emissive="#ffd98a" emissiveIntensity={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {/* ribbed dome */}
      <mesh position={[0, 10.15, 0]} castShadow>
        <latheGeometry args={[
          [[0, 0], [2.75, 0.15], [3.0, 0.7], [2.4, 1.9], [1.3, 3.0], [0.5, 3.7], [0.15, 4.15], [0, 4.25]]
            .map(([a, b]) => new THREE.Vector2(a, b)), 20]} />
        <meshStandardMaterial color={MARBLE} roughness={0.5} />
      </mesh>
      {/* zlatý kalash — vrcholový ornament */}
      <mesh position={[0, 14.9, 0]}>
        <cylinderGeometry args={[0.16, 0.34, 0.9, 8]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} emissive="#a06a1a" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 15.7, 0]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.2} emissive="#c9862a" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 16.4, 0]}>
        <coneGeometry args={[0.2, 0.9, 8]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} emissive="#a06a1a" emissiveIntensity={0.5} />
      </mesh>
      {/* Hiranyagarbha — světelný paprsek do nebe */}
      <mesh ref={beamRef} position={[0, 46, 0]}>
        <cylinderGeometry args={[0.32, 0.55, 58, 10, 1, true]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight position={[0, 15.8, 0]} intensity={4} color="#ffd98a" distance={26} decay={2} />
    </group>
  );
}

/** hlavní mramorová síň — 3 patra arkád + portikus + schodiště */
function MainHall() {
  return (
    <group>
      {/* spodní patro — plná hmota s arkádami */}
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[44, 3.4, 15]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.7} />
      </mesh>
      <ArchRow n={17} x={0} y={0.55} z={7.53} w={0.85} h={1.9} gap={2.3} />
      {/* římsa mezi patry */}
      <mesh position={[0, 3.5, 0]} castShadow>
        <boxGeometry args={[45, 0.35, 15.8]} />
        <meshStandardMaterial color={MARBLE} roughness={0.6} />
      </mesh>
      {/* prostřední patro — arkády + balkon */}
      <mesh position={[0, 4.9, -0.4]} castShadow>
        <boxGeometry args={[38, 2.6, 13]} />
        <meshStandardMaterial color={MARBLE} roughness={0.65} />
      </mesh>
      <ArchRow n={15} x={0} y={4.1} z={6.15} w={0.7} h={1.7} gap={2.3} />
      <mesh position={[0, 6.35, -0.4]}>
        <boxGeometry args={[39, 0.3, 13.6]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.6} />
      </mesh>
      {/* horní galerie — menší arkády */}
      <mesh position={[0, 7.6, -0.9]} castShadow>
        <boxGeometry args={[30, 2.2, 10.5]} />
        <meshStandardMaterial color={MARBLE} roughness={0.65} />
      </mesh>
      <ArchRow n={13} x={0} y={7.0} z={4.4} w={0.55} h={1.35} gap={2.1} />
      {/* shikhara řada po střeše */}
      {[-13.5, -9.5, -5.5, 5.5, 9.5, 13.5].map((x, i) => (
        <Shikhara key={i} x={x} y={8.8} z={-0.9} s={1.15} />
      ))}
      {[-16.5, 16.5].map((x, i) => (
        <Shikhara key={`e${i}`} x={x} y={6.5} z={-0.4} s={0.95} />
      ))}
      {/* boční arkády na krajích */}
      <ArchRow n={2} x={-21.6} y={0.55} z={7.53} w={0.85} h={1.9} gap={2.3} />
      <ArchRow n={2} x={21.6} y={0.55} z={7.53} w={0.85} h={1.9} gap={2.3} />

      {/* portikus — sloupový průčelní vchod */}
      <group position={[0, 0, 8.6]}>
        <mesh position={[0, 3.9, 0]} castShadow>
          <boxGeometry args={[10.5, 0.5, 3.4]} />
          <meshStandardMaterial color={MARBLE_D} roughness={0.6} />
        </mesh>
        {[-4.2, -2.1, 2.1, 4.2].map((x) => (
          <mesh key={x} position={[x, 1.9, 1.1]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 3.8, 10]} />
            <meshStandardMaterial color={MARBLE} roughness={0.6} />
          </mesh>
        ))}
        {/* fronton — mělký trojúhelník */}
        <mesh position={[0, 4.45, 0]} scale={[1, 1, 0.5]}>
          <cylinderGeometry args={[0.01, 4.3, 1.05, 3]} />
          <meshStandardMaterial color={MARBLE} roughness={0.6} />
        </mesh>
        {/* hlavní dveře */}
        <mesh geometry={ARCH} scale={[1.6, 2.9, 1]} position={[0, 0.4, -1.15]}>
          <meshStandardMaterial color={GLASS} roughness={0.3} emissive="#ffd98a" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* velké schodiště */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 3.15 - i * 0.34, 10.4 + i * 0.62]} receiveShadow>
          <boxGeometry args={[11 - i * 0.28, 0.34, 0.62]} />
          <meshStandardMaterial color={MARBLE_D} roughness={0.75} />
        </mesh>
      ))}
      {/* terasa kolem soklu */}
      <mesh position={[0, 0.08, 2]} receiveShadow>
        <boxGeometry args={[52, 0.25, 26]} />
        <meshStandardMaterial color="#c9bda2" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** zrcadlový bazén + fontána */
function ReflectingPool() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = water.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 0.3 + Math.sin(clock.getElapsedTime() * 0.9) * 0.08;
  });
  return (
    <group>
      {/* dlouhý bazén před chrámem */}
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 24]}>
        <planeGeometry args={[9, 26]} />
        <meshStandardMaterial color="#1a5a66" roughness={0.12} metalness={0.15} emissive="#1f7a8a" emissiveIntensity={0.3} />
      </mesh>
      {/* úzký odraz světla na hladině podle osy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 22]}>
        <planeGeometry args={[1.6, 17]} />
        <meshBasicMaterial color="#f4d89a" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* kamenný lem */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4.85, 0.16, 24]}>
          <boxGeometry args={[0.7, 0.35, 26.6]} />
          <meshStandardMaterial color={MARBLE_D} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 37.4]}>
        <boxGeometry args={[10.4, 0.35, 0.7]} />
        <meshStandardMaterial color={MARBLE_D} roughness={0.8} />
      </mesh>
      {/* 3 fontánové trysky */}
      {[-2.8, 0, 2.8].map((x, i) => (
        <group key={i} position={[x, 0.1, 24]}>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.09, 1.0, 6]} />
            <meshBasicMaterial color="#cfe8f0" transparent opacity={0.55} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.65, 14]} />
            <meshBasicMaterial color="#cfe8f0" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** geometrické zahrady — aleje, živé ploty, lampy */
function Gardens() {
  const trees = useMemo(() => {
    const arr: { p: [number, number]; s: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const a = rng(i + 5) * Math.PI * 2;
      const r = 30 + rng(i + 17) * 42;
      arr.push({ p: [Math.sin(a) * r * 1.25, Math.cos(a) * r], s: 0.7 + rng(i + 9) * 1.1 });
    }
    return arr;
  }, []);
  const lamps = [-6.4, 6.4].flatMap((x) => Array.from({ length: 6 }, (_, i) => [x, 14 + i * 5.5]));
  return (
    <group>
      {/* země */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 10]} receiveShadow>
        <circleGeometry args={[160, 72]} />
        <meshStandardMaterial color="#3d4f2c" roughness={0.98} />
      </mesh>
      {/* travnaté kvadranty */}
      {[[-15, 22], [15, 22], [-15, 33], [15, 33]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} receiveShadow>
          <planeGeometry args={[16, 11]} />
          <meshStandardMaterial color="#4d6a33" roughness={0.95} />
        </mesh>
      ))}
      {/* živé ploty */}
      {[[-15, 16.2], [15, 16.2], [-15, 27.8], [15, 27.8], [-15, 39], [15, 39]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]} castShadow>
          <boxGeometry args={[15.4, 0.9, 0.55]} />
          <meshStandardMaterial color="#3f5a2c" roughness={0.95} />
        </mesh>
      ))}
      {/* alejové stromy podél bazénu */}
      {[-8, 8].flatMap((x) => [15, 20.5, 26, 31.5, 37].map((z) => ({ x, z }))).map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.2, 2.2, 6]} />
            <meshStandardMaterial color="#5a4228" roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.6, 0]} castShadow>
            <sphereGeometry args={[1.05, 8, 6]} />
            <meshStandardMaterial color={i % 2 ? '#55753a' : '#4a6a34'} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* lampy podél cest */}
      {lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 2.8, 6]} />
            <meshStandardMaterial color="#3a3428" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <sphereGeometry args={[0.24, 8, 6]} />
            <meshStandardMaterial color="#ffe9b0" emissive="#f4b95e" emissiveIntensity={1.6} />
          </mesh>
        </group>
      ))}
      {/* vzdálený les */}
      {trees.map((t, i) => (
        <group key={i} position={[t.p[0], -0.05, t.p[1]]}>
          <mesh position={[0, t.s, 0]}>
            <cylinderGeometry args={[0.12 * t.s, 0.2 * t.s, 2 * t.s, 5]} />
            <meshStandardMaterial color="#4a3826" roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.4 * t.s, 0]}>
            <sphereGeometry args={[1.15 * t.s, 6, 5]} />
            <meshStandardMaterial color={['#3f5a2e', '#4a6a34', '#557538'][i % 3]} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** vzdálené kopce za chrámem */
function Hills() {
  return (
    <group>
      {[
        { p: [-70, 0, -95], s: [80, 10, 20] },
        { p: [50, 0, -105], s: [90, 8, 18] },
        { p: [-15, 0, -115], s: [75, 6, 15] },
      ].map((h, i) => (
        <mesh key={i} position={h.p as [number, number, number]} scale={h.s as [number, number, number]}>
          <sphereGeometry args={[1, 18, 9]} />
          <meshStandardMaterial color="#4a5a44" roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}

/** obloha — svítání za chrámem, zlaté paprsky */
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
            vec3 c = d.y > 0.14 ? mix(mid, top, smoothstep(0.14, 0.6, d.y))
                              : mix(low, mid, smoothstep(-0.05, 0.14, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.95, 0.72) * pow(s, 900.0) * 3.0
               + vec3(1.0, 0.78, 0.45) * pow(s, 60.0) * 0.5
               + vec3(0.96, 0.55, 0.28) * pow(s, 8.0) * 0.2;
            c = mix(c, vec3(0.9, 0.64, 0.4), smoothstep(0.16, -0.02, d.y) * 0.3);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#33436e') },
          mid: { value: new THREE.Color('#d9934e') },
          low: { value: new THREE.Color('#f2bc72') },
          sunDir: { value: new THREE.Vector3(-0.03, 0.1, -0.99).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[320, 24, 16]} />
    </mesh>
  );
}

export function EkamScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <SkySun />
      <fog attach="fog" args={['#c98a4a', 110, 290]} />

      <MainHall />
      <CentralTower />
      <CornerTower x={-23.5} z={-5.5} />
      <CornerTower x={23.5} z={-5.5} />
      <CornerTower x={-23.5} z={5.5} />
      <CornerTower x={23.5} z={5.5} />
      <ReflectingPool />
      <Gardens />
      <Hills />

      {/* labely */}
      <SceneLabel position={[0, 19.5, -1]} text="Ekam · Oneness Temple" scale={2.2} />
      <SceneLabel position={[0, 12.2, 0]} text={cs ? 'Hiranyagarbha — zlatý zárodek' : 'Hiranyagarbha — golden womb'} scale={1.8} />
      <SceneLabel position={[0, 2.6, 24]} text={cs ? 'Zrcadlový bazén' : 'Reflecting pool'} scale={1.7} />
      <SceneLabel position={[-23.5, 9.6, -5.5]} text={cs ? 'Rohové věže' : 'Corner towers'} scale={1.6} />
      <SceneLabel position={[0, 3.4, -50]} text={cs ? 'Mystikovo pole' : "Mystic's Field"} scale={1.9} />
    </>
  );
}

export const EKAM_CAMERA = { position: [0, 17, 70] as [number, number, number], fov: 44, far: 900 };
export const EKAM_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 18, maxDistance: 140, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 7, -2] as [number, number, number], enablePan: false };
export function EkamLighting() {
  return <>
    <ambientLight intensity={0.62} color="#ffe4b8" />
    <hemisphereLight args={['#ffdcaa', '#3d5233', 0.7]} />
    <directionalLight position={[-20, 26, -70]} intensity={2.2} color="#ffc887" castShadow />
    <directionalLight position={[40, 28, 46]} intensity={0.5} color="#d8ecff" />
  </>;
}
