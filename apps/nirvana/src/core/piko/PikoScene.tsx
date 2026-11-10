'use client';

/**
 * TE PĪKO ORA — scéna laguny pro dvě vodní hry.
 *
 * Jeden `<Canvas>` pro obě hry: kánoe i surf sdílejí vodu, břeh, vesnici
 * a horizont, takže se nemůže stát, že by druhá hra vypadala jako jiný svět.
 * Simulace je v `canoe.ts` / `surf.ts` — scéna jen čte stav a kreslí ho.
 *
 * Pravidla, která tu platí:
 *  - voda je **jeden shader** (ne stovky vln), hýbe se z `uTime`,
 *  - opakované objekty (palmy, chýše, bóje, molo) jsou instancované,
 *  - kamera se ve VR nevynucuje (patří headsetu), origin nese hráče,
 *  - statistiky jdou do HUD 10×/s, ne každý snímek.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { XROrigin } from '@react-three/xr';
import { VrInputs } from '@/core/xr/inputs';
import { VR_DEADZONE, useVrKeys } from '@/core/xr';
import { dampFactor } from '@/core/design/motion';
import { play } from '@/core/audio/engine';
import { isGamePaused } from '@/core/games/pause';
import { PIKO_COLORS, PIKO_GATES, START, waveHeightAt, waveProgressZ, type PikoMode } from './world';
import { CANOE, createCanoe, stepCanoe, type CanoeState } from './canoe';
import { SURF, createSurf, pocketTargetFor, stepSurf, type SurfState } from './surf';

export interface PikoStats {
  mode: PikoMode;
  phase: 'idle' | 'riding' | 'between' | 'done';
  score: number;
  elapsed: number;
  /** km/h */
  speed: number;
  gates: number;
  totalGates: number;
  wave: number;
  totalWaves: number;
  balance: number;
  /** 0..1 — blízkost kapse vlny. */
  pocket: number;
  /** Poloha hráče a kapsy (m) — HUD z toho dělá šipku kapse. */
  x: number;
  pocketX: number;
  distance: number;
  waveTimer: number;
  started: boolean;
  finished: boolean;
  /** Poslední událost (pro hlášku v HUD) + její pořadí. */
  event: string | null;
  eventId: number;
}

export interface PikoResult {
  mode: PikoMode;
  score: number;
  elapsed: number;
  gates: number;
  waves: number;
  distance: number;
  wipes: number;
}

/* ── voda a obloha ─────────────────────────────────────────────────── */

const SEA_VERTEX = `
uniform float uTime;
varying vec2 vXZ;
varying float vWave;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.11 + uTime * 1.15) * 0.22
          + sin(p.y * 0.17 - uTime * 0.90) * 0.14
          + sin((p.x + p.y) * 0.06 + uTime * 0.55) * 0.09;
  p.z += w;
  vWave = w;
  vXZ = p.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const SEA_FRAGMENT = `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uHorizon;
uniform vec3 uSun;
varying vec2 vXZ;
varying float vWave;
void main() {
  // hloubka roste k moři (lokální +y = světové −z), mělčina je u břehu
  float depth = clamp(0.20 + max(0.0, vXZ.y) * 0.004 + vWave * 0.45, 0.0, 1.0);
  vec3 color = mix(uShallow, uDeep, depth);

  // jemné vlnky — ne široké pruhy (ty vypadaly jako bílé dálnice)
  float ripple = sin(vXZ.x * 0.22 + vXZ.y * 0.33 + uTime * 1.5) * 0.5 + 0.5;
  float fine = smoothstep(0.86, 1.0, ripple);
  color = mix(color, uFoam, fine * 0.10);

  // pěna na břehu: úzký pás kolem hranice příboje
  float shore = (vXZ.y + 58.0) / 5.5;
  float shoreBand = exp(-shore * shore);
  color = mix(color, uFoam, shoreBand * 0.45);

  // zamlžení k obzoru + slunce na hladině
  float horizon = smoothstep(95.0, 168.0, vXZ.y);
  color = mix(color, uHorizon, horizon * 0.60);
  float glint = pow(max(0.0, 1.0 - abs(vXZ.x + 78.0) * 0.010), 12.0);
  color += uSun * glint * 0.22;

  gl_FragColor = vec4(color, 1.0);
}`;

const SKY_VERTEX = `
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
varying vec3 vP;
uniform vec3 top;
uniform vec3 mid;
uniform vec3 low;
uniform vec3 sunDir;
void main() {
  vec3 d = normalize(vP);
  vec3 c = d.y > 0.16 ? mix(mid, top, smoothstep(0.16, 0.72, d.y))
                      : mix(low, mid, smoothstep(-0.06, 0.16, d.y));
  float s = max(dot(d, sunDir), 0.0);
  c += vec3(1.0, 0.93, 0.70) * pow(s, 1400.0) * 1.4
     + vec3(1.0, 0.76, 0.44) * pow(s, 40.0) * 0.16
     + vec3(0.98, 0.62, 0.32) * pow(s, 5.0) * 0.18;
  gl_FragColor = vec4(c, 1.0);
}`;

function Sea() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(PIKO_COLORS.deep) },
          uShallow: { value: new THREE.Color(PIKO_COLORS.shallow) },
          uFoam: { value: new THREE.Color(PIKO_COLORS.foam) },
          uHorizon: { value: new THREE.Color('#f1c49b') },
          uSun: { value: new THREE.Color(PIKO_COLORS.sun) },
        },
        vertexShader: SEA_VERTEX,
        fragmentShader: SEA_FRAGMENT,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const uniform = material.uniforms.uTime;
    if (uniform) uniform.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -30]} material={material} renderOrder={-1}>
      <planeGeometry args={[340, 340, 96, 96]} />
    </mesh>
  );
}

function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#3f6f9a') },
          mid: { value: new THREE.Color('#e7b08a') },
          low: { value: new THREE.Color('#f6d8a8') },
          sunDir: { value: new THREE.Vector3(-300, 46, -560).normalize() },
        },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1500, 24, 16]} />
    </mesh>
  );
}

/**
 * Měkká záře kolem slunce.
 *
 * Dřív to byla druhá, větší koule s `opacity` — jenže koule má ostrý okraj,
 * takže na obloze visel druhý bledý kotouč (vypadalo to jako měsíc).
 * Billboard s radiálním přechodem nemá okraj žádný.
 */
function SunGlow() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color('#ffb56b') } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uColor;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float a = pow(max(0.0, 1.0 - r), 3.0);
            gl_FragColor = vec4(uColor, a * 0.55);
          }
        `,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    mesh.current?.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} position={[-300, 46, -560]} material={material}>
      <planeGeometry args={[360, 360]} />
    </mesh>
  );
}

/* ── břeh, vesnice, palmy, hory ────────────────────────────────────── */

/**
 * Měkká pěna — jediná textura ve scéně.
 *
 * Kruh/elipsa s ostrým okrajem vypadá jako papírový výstřižek položený na
 * vodu (přesně tak to na prvním snímku bylo). Radiální gradient v canvasu
 * udělá okraj, který se rozpije do hladiny, a stojí jeden canvas.
 */
function useFoamTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function FoamPatch({
  texture,
  position,
  size,
  opacity,
}: {
  texture: THREE.Texture | null;
  position: [number, number, number];
  size: [number, number];
  opacity: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[size[0], size[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        key={texture ? 'foam' : 'flat'}
        map={texture ?? undefined}
        color={PIKO_COLORS.foam}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

const PALM_TRUNK = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
const PALM_LEAF = (() => {
  const geometry = new THREE.PlaneGeometry(1, 1, 10, 1);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const along = position.getX(i) + 0.5; // 0..1 od kmene
    const across = position.getY(i);
    const width = 0.42 * (1 - 0.5 * along);
    position.setXYZ(i, along, -0.55 * along * along, across * width);
  }
  geometry.computeVertexNormals();
  return geometry;
})();

interface Palm {
  x: number;
  z: number;
  h: number;
  lean: number;
  yaw: number;
}

const PALMS: Palm[] = [
  { x: -58, z: 34, h: 7.4, lean: -0.16, yaw: 0.4 },
  { x: -44, z: 45, h: 8.6, lean: 0.1, yaw: 1.2 },
  { x: -30, z: 31, h: 6.8, lean: 0.22, yaw: 2.1 },
  { x: -18, z: 47, h: 9.2, lean: -0.08, yaw: 0.9 },
  { x: -6, z: 33, h: 7.1, lean: 0.18, yaw: 2.8 },
  { x: 8, z: 46, h: 8.1, lean: -0.14, yaw: 1.7 },
  { x: 22, z: 32, h: 7.6, lean: 0.2, yaw: 0.2 },
  { x: 34, z: 48, h: 9.4, lean: -0.1, yaw: 2.4 },
  { x: 47, z: 36, h: 7.2, lean: 0.24, yaw: 1.1 },
  { x: 60, z: 50, h: 8.8, lean: -0.18, yaw: 3.0 },
  { x: -66, z: 54, h: 9.8, lean: 0.12, yaw: 0.7 },
  { x: 66, z: 28, h: 6.6, lean: -0.22, yaw: 1.9 },
];

/** Chýše (fare) — jen střecha a základ, instancované do dvou draw callů. */
const FARES = [
  { x: -46, z: 58, w: 8, len: 11, yaw: 0.2 },
  { x: -26, z: 62, w: 7, len: 10, yaw: -0.1 },
  { x: -4, z: 57, w: 8.5, len: 12, yaw: 0.05 },
  { x: 18, z: 61, w: 7, len: 10, yaw: -0.16 },
  { x: 38, z: 57, w: 8, len: 11, yaw: 0.12 },
  { x: 56, z: 63, w: 6.5, len: 9, yaw: -0.05 },
];

function Village() {
  const bases = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!bases.current || !roofs.current) return;
    const dummy = new THREE.Object3D();
    let roofIndex = 0;
    FARES.forEach((fare, index) => {
      dummy.position.set(fare.x, 1.0, fare.z);
      dummy.rotation.set(0, fare.yaw, 0);
      dummy.scale.set(fare.w, 2.0, fare.len);
      dummy.updateMatrix();
      bases.current!.setMatrixAt(index, dummy.matrix);

      const roofH = fare.w * 0.52;
      const slope = Math.hypot(fare.w / 2, roofH) * 1.08;
      const pitch = Math.atan2(roofH, fare.w / 2);
      for (const side of [-1, 1]) {
        const offset = side * (fare.w * 0.26);
        dummy.position.set(
          fare.x + Math.cos(fare.yaw) * offset,
          2.0 + roofH * 0.5,
          fare.z - Math.sin(fare.yaw) * offset,
        );
        dummy.rotation.set(0, fare.yaw, -side * pitch);
        dummy.scale.set(slope, 0.16, fare.len * 1.06);
        dummy.updateMatrix();
        roofs.current!.setMatrixAt(roofIndex, dummy.matrix);
        roofIndex += 1;
      }
    });
    bases.current.instanceMatrix.needsUpdate = true;
    roofs.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={bases} args={[undefined, undefined, FARES.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6b4f2e" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, FARES.length * 2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={PIKO_COLORS.thatch} roughness={1} />
      </instancedMesh>
    </>
  );
}

function Palms() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!trunks.current || !crowns.current) return;
    const dummy = new THREE.Object3D();
    let leafIndex = 0;
    PALMS.forEach((palm, index) => {
      dummy.position.set(palm.x, palm.h / 2, palm.z);
      dummy.rotation.set(0, palm.yaw, palm.lean);
      dummy.scale.set(1.1, palm.h, 1.1);
      dummy.updateMatrix();
      trunks.current!.setMatrixAt(index, dummy.matrix);

      const topX = palm.x - Math.sin(palm.lean) * (palm.h / 2);
      const topY = (palm.h / 2) * (1 + Math.cos(palm.lean));
      const topZ = palm.z;
      for (let i = 0; i < 9; i++) {
        const yaw = (i / 9) * Math.PI * 2 + palm.yaw * 0.6;
        dummy.position.set(topX, topY, topZ);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(4.2, 1, 1);
        dummy.updateMatrix();
        crowns.current!.setMatrixAt(leafIndex, dummy.matrix);
        leafIndex += 1;
      }
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, PALMS.length]} geometry={PALM_TRUNK}>
        <meshStandardMaterial color={PIKO_COLORS.wood} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, PALMS.length * 9]} geometry={PALM_LEAF}>
        <meshStandardMaterial color={PIKO_COLORS.palm} roughness={0.9} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

function Shore() {
  const planks = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!planks.current || !poles.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 10; i++) {
      dummy.position.set(-18, 0.62, 23 - i * 1.4);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1.8, 0.08, 1.2);
      dummy.updateMatrix();
      planks.current.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        dummy.position.set(-18 + side * 0.75, 0.3, 22.4 - i * 2.4);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.12, 1.4, 0.12);
        dummy.updateMatrix();
        poles.current.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
      }
    }
    planks.current.instanceMatrix.needsUpdate = true;
    poles.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      {/* písek a mokrý pruh u vody */}
      <mesh position={[0, 0.1, 62]} receiveShadow>
        <boxGeometry args={[340, 0.6, 76]} />
        <meshStandardMaterial color={PIKO_COLORS.sand} roughness={1} />
      </mesh>
      <mesh position={[0, 0.16, 26]}>
        <boxGeometry args={[340, 0.5, 8]} />
        <meshStandardMaterial color={PIKO_COLORS.wetSand} roughness={0.75} />
      </mesh>

      {/* molo — stranou od startu, aby nezakrývalo kánoi */}
      <instancedMesh ref={planks} args={[undefined, undefined, 10]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a6b3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, undefined, 12]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </instancedMesh>

      <Village />
      <Palms />

      {/* sopečné hory sesterského ostrova za útesem — daleko a v oparu,
          aby nebyly černé pyramidy přes celý obzor */}
      {[
        { x: -210, h: 52, z: -330, r: 92 },
        { x: -70, h: 66, z: -352, r: 108 },
        { x: 90, h: 46, z: -336, r: 82 },
        { x: 230, h: 40, z: -320, r: 72 },
      ].map((mountain, index) => (
        <mesh
          key={index}
          position={[mountain.x, mountain.h / 2 - 6, mountain.z]}
          rotation={[0, index * 0.9, 0]}
        >
          <coneGeometry args={[mountain.r, mountain.h, 8]} />
          <meshStandardMaterial color="#4d7665" roughness={1} />
        </mesh>
      ))}
      {/* nízký břeh ostrova pod horami — pás zeleně, ne černá deska */}
      {[
        { x: -150, z: -312, r: 120, h: 16 },
        { x: 30, z: -326, r: 140, h: 20 },
        { x: 190, z: -308, r: 100, h: 14 },
      ].map((hill, index) => (
        <mesh key={`hill-${index}`} position={[hill.x, hill.h / 2 - 5, hill.z]}>
          <coneGeometry args={[hill.r, hill.h, 7]} />
          <meshStandardMaterial color="#33584a" roughness={1} />
        </mesh>
      ))}

      {/* slunce nad obzorem — jádro a měkká záře (žádná druhá planeta) */}
      <mesh position={[-300, 46, -560]}>
        <sphereGeometry args={[30, 20, 14]} />
        <meshBasicMaterial color="#ffe4b4" toneMapped={false} />
      </mesh>
      <SunGlow />
    </>
  );
}

/* ── bóje kurzu ────────────────────────────────────────────────────── */

function GateRings({ state }: { state: React.MutableRefObject<CanoeState> }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const buoys = useRef<THREE.InstancedMesh>(null);
  const lastNext = useRef(-1);

  // bóje jsou jen dekorace, takže stačí jedna instance; prstence musí měnit
  // barvu podle pořadí, a to je přes `instanceColor` nespolehlivé — šest
  // samostatných meshů je čitelnější a stojí šest draw callů.
  useEffect(() => {
    if (!buoys.current) return;
    const dummy = new THREE.Object3D();
    PIKO_GATES.forEach((gate, index) => {
      for (let side = 0; side < 2; side++) {
        dummy.position.set(gate.x + (side === 0 ? -3.1 : 3.1), 0.32, gate.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        buoys.current!.setMatrixAt(index * 2 + side, dummy.matrix);
      }
    });
    buoys.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const next = state.current.nextGate;
    if (next === lastNext.current) return;
    lastNext.current = next;
    rings.current.forEach((mesh, index) => {
      if (!mesh) return;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(index < next ? '#2b6f6a' : index === next ? '#ffd166' : '#9fe8de');
      material.opacity = index === next ? 0.95 : 0.55;
    });
  });

  return (
    <>
      {PIKO_GATES.map((gate, index) => (
        <mesh
          key={index}
          ref={(node) => {
            rings.current[index] = node;
          }}
          position={[gate.x, 0.5, gate.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[3.2, 0.16, 8, 28]} />
          <meshBasicMaterial
            color={index === 0 ? '#ffd166' : '#9fe8de'}
            toneMapped={false}
            transparent
            opacity={index === 0 ? 0.95 : 0.55}
          />
        </mesh>
      ))}
      <instancedMesh ref={buoys} args={[undefined, undefined, PIKO_GATES.length * 2]}>
        <sphereGeometry args={[0.36, 10, 8]} />
        <meshStandardMaterial color="#f6f0dc" roughness={0.6} />
      </instancedMesh>
    </>
  );
}

/* ── modely hráče ──────────────────────────────────────────────────── */

function CanoeModel({
  groupRef,
  paddleRef,
  wakeRef,
  foam,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  paddleRef: React.RefObject<THREE.Group | null>;
  wakeRef: React.RefObject<THREE.Mesh | null>;
  foam: THREE.Texture | null;
}) {
  return (
    <group ref={groupRef} position={[START.x, 0, START.z]} rotation={[0, Math.PI, 0]}>
      {/* trup a vnitřek */}
      <mesh position={[0, 0.16, 0]} scale={[0.46, 0.3, 2.5]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#6b4a29" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.32, 0]} scale={[0.3, 0.08, 1.9]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#20150a" roughness={1} />
      </mesh>
      {/* balancírka a boomy */}
      <mesh position={[1.05, 0.1, 0]} scale={[0.16, 0.14, 1.6]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#6e5233" roughness={0.9} />
      </mesh>
      {[-0.9, 0.9].map((z) => (
        <mesh key={z} position={[0.55, 0.34, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 1.15, 6]} />
          <meshStandardMaterial color="#8a6b3a" roughness={0.9} />
        </mesh>
      ))}
      {/* veslař — látka a kůže musí být vidět proti trupu */}
      <group position={[0, 0.34, 0.1]}>
        <mesh position={[0, 0.34, 0]}>
          <capsuleGeometry args={[0.17, 0.42, 4, 8]} />
          <meshStandardMaterial color="#c2553c" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.76, 0]}>
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshStandardMaterial color="#b6764a" roughness={0.9} />
        </mesh>
        <group ref={paddleRef} position={[0.12, 0.58, 0.05]}>
          <mesh rotation={[0.25, 0, 0.5]} position={[-0.2, -0.25, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 1.5, 5]} />
            <meshStandardMaterial color="#c9a458" roughness={0.8} />
          </mesh>
          <mesh position={[-0.56, -0.86, 0.32]} rotation={[0.25, 0, 0.5]}>
            <boxGeometry args={[0.17, 0.5, 0.03]} />
            <meshStandardMaterial color="#d9b46a" roughness={0.7} />
          </mesh>
        </group>
      </group>
      {/* pěna u přídě — měkká textura, jinak to byl bílý kruh */}
      <mesh ref={wakeRef} position={[0, 0.08, -2.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 6]} />
        <meshBasicMaterial
          key={foam ? 'foam' : 'flat'}
          map={foam ?? undefined}
          color={PIKO_COLORS.foam}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SurferModel({
  groupRef,
  sprayRef,
  foam,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  sprayRef: React.RefObject<THREE.Mesh | null>;
  foam: THREE.Texture | null;
}) {
  return (
    <group ref={groupRef} position={[0, 0.2, -42]}>
      {/* prkno */}
      <mesh position={[0, 0.06, 0]} scale={[0.44, 0.07, 1.35]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#2fb8ad" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.12, 0]} scale={[0.09, 0.025, 1.2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffd166" roughness={0.6} />
      </mesh>
      {/* surfař */}
      <group position={[0, 0.2, -0.14]} rotation={[0.3, 0, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <capsuleGeometry args={[0.16, 0.36, 4, 8]} />
          <meshStandardMaterial color="#c2553c" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshStandardMaterial color="#3a2a1c" roughness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.22, 0.5, 0.04]} rotation={[0, 0, side * 0.7]}>
            <cylinderGeometry args={[0.05, 0.05, 0.4, 5]} />
            <meshStandardMaterial color="#b6764a" roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* spray za prknem */}
      <mesh ref={sprayRef} position={[0, 0.05, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 4.2]} />
        <meshBasicMaterial
          key={foam ? 'foam' : 'flat'}
          map={foam ?? undefined}
          color={PIKO_COLORS.foam}
          transparent
          opacity={0.24}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Vlna pod surfařem.
 *
 * První verze byla vysoká stěna (175 × 13 j.) a z kamery vypadala jako
 * nakloněná deska přes obzor. Druhá byla dlouhý bílý pruh, který zůstal
 * **mezi kamerou a surfařem** — a proto přerostl celý záběr. Teď jsou to
 * pěnové elipsy (kruh se scale) před prknem a za ním: čtou se jako hřeben
 * a stopa, ale nic nezakrývají.
 */
function WaveRig({
  groupRef,
  foam,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  foam: THREE.Texture | null;
}) {
  return (
    <group ref={groupRef} visible={false}>
      {/* hřeben před surfařem — měkká pěna, ne obdélník */}
      <FoamPatch texture={foam} position={[0, 0.12, 2.6]} size={[18, 6]} opacity={0.55} />
      {/* stopa za prknem */}
      <FoamPatch texture={foam} position={[0, 0.1, -2.4]} size={[9, 5]} opacity={0.32} />
      {/* druhý, vzdálenější hřeben pro hloubku */}
      <FoamPatch texture={foam} position={[0, 0.08, -8]} size={[26, 4]} opacity={0.2} />
    </group>
  );
}

/* ── VR ────────────────────────────────────────────────────────────── */

function PikoXr({
  pose,
  active,
}: {
  pose: React.MutableRefObject<{ x: number; y: number; z: number; heading: number }>;
  active: boolean;
}) {
  const origin = useRef<THREE.Group>(null);
  const keys = useVrKeys();

  useFrame(() => {
    if (!origin.current) return;
    origin.current.position.set(pose.current.x, pose.current.y, pose.current.z);
    origin.current.rotation.y = pose.current.heading;
  });

  return (
    <>
      <XROrigin ref={origin} />
      <VrInputs
        onInput={(input) => {
          const stick = input.left.stick;
          keys.set('KeyW', active && stick.y > VR_DEADZONE);
          keys.set('KeyS', active && stick.y < -VR_DEADZONE);
          keys.set('KeyA', active && stick.x < -VR_DEADZONE);
          keys.set('KeyD', active && stick.x > VR_DEADZONE);
        }}
      />
    </>
  );
}

/* ── hlavní scéna ──────────────────────────────────────────────────── */

export function PikoScene({
  mode,
  running,
  xr = false,
  onStats,
  onFinish,
}: {
  mode: PikoMode;
  running: boolean;
  xr?: boolean;
  onStats: (stats: PikoStats) => void;
  onFinish: (result: PikoResult) => void;
}) {
  const { camera, gl } = useThree();
  const canoe = useRef<CanoeState>(createCanoe());
  const surf = useRef<SurfState>(createSurf());
  const keys = useRef(new Set<string>());
  const clock = useRef(0);
  const statsClock = useRef(0);
  const lastStats = useRef('');
  const finished = useRef(false);
  const eventSeq = useRef(0);
  const eventRef = useRef<string | null>(null);
  const pose = useRef({ x: START.x, y: 0.8, z: START.z, heading: Math.PI });

  const canoeGroup = useRef<THREE.Group>(null);
  const paddle = useRef<THREE.Group>(null);
  const wake = useRef<THREE.Mesh>(null);
  const surferGroup = useRef<THREE.Group>(null);
  const spray = useRef<THREE.Mesh>(null);
  const waveGroup = useRef<THREE.Group>(null);
  const pocketMarker = useRef<THREE.Mesh>(null);

  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const foam = useFoamTexture();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);

  // nový běh = čistá simulace (jinak by „Znovu" pokračovalo v dojetém kurzu)
  useEffect(() => {
    if (!running) return;
    canoe.current = createCanoe();
    surf.current = createSurf();
    clock.current = 0;
    statsClock.current = 0;
    lastStats.current = '';
    finished.current = false;
    eventRef.current = null;
    eventSeq.current = 0;
    pose.current = { x: START.x, y: 0.8, z: START.z, heading: Math.PI };
  }, [running, mode]);

  // ladicí háček pro headless testy
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('pikoDebug') !== '1') return;
    const bag = window as unknown as Record<string, unknown>;
    bag.__pikoDebug = () => {
      if (mode === 'canoe') {
        const state = canoe.current;
        return {
          mode,
          x: Math.round(state.x * 10) / 10,
          z: Math.round(state.z * 10) / 10,
          heading: Math.round(state.heading * 100) / 100,
          speed: Math.round(state.speed * 10) / 10,
          gates: state.gates,
          nextGate: state.nextGate,
          elapsed: Math.round(state.elapsed * 10) / 10,
          score: state.score,
          finished: state.finished,
          gatesAt: PIKO_GATES,
        };
      }
      const state = surf.current;
      return {
        mode,
        wave: state.wave,
        phase: state.phase,
        x: Math.round(state.x * 10) / 10,
        speed: Math.round(state.speed * 10) / 10,
        balance: Math.round(state.balance),
        pocket: Math.round(state.pocket * 100) / 100,
        distance: Math.round(state.distance),
        score: state.score,
        wipes: state.wipes,
        finished: state.finished,
      };
    };
    bag.__pikoTeleport = (x: number, z: number) => {
      canoe.current.x = x;
      canoe.current.z = z;
    };
    bag.__pikoSurf = (patch: { distance?: number; balance?: number; speed?: number }) => {
      if (typeof patch.distance === 'number') surf.current.distance = patch.distance;
      if (typeof patch.balance === 'number') surf.current.balance = patch.balance;
      if (typeof patch.speed === 'number') surf.current.speed = patch.speed;
    };
    bag.__pikoRenderer = () => ({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
    });
    return () => {
      delete bag.__pikoDebug;
      delete bag.__pikoTeleport;
      delete bag.__pikoSurf;
      delete bag.__pikoRenderer;
    };
  }, [mode]);

  useFrame((_, delta) => {
    if (!running) return;
    // Společné hamburger menu pauzuje celou hru (`core/games/pause`).
    // Klávesy se při pauze pouští, jinak by po zavření menu zůstalo pádlo
    // „držet" a kánoe by sama vyplula.
    if (isGamePaused()) {
      keys.current.clear();
      return;
    }
    const dt = Math.min(0.05, delta);
    clock.current += dt;
    const now = clock.current;
    const pressed = (code: string) => keys.current.has(code);
    const steer =
      (pressed('KeyA') || pressed('ArrowLeft') ? 1 : 0) -
      (pressed('KeyD') || pressed('ArrowRight') ? 1 : 0);

    let stats: PikoStats;

    if (mode === 'canoe') {
      const state = canoe.current;
      if (waveGroup.current) waveGroup.current.visible = false;
      if (pocketMarker.current) pocketMarker.current.visible = false;
      const step = stepCanoe(
        state,
        {
          paddle: pressed('KeyW') || pressed('ArrowUp') || pressed('Space'),
          steer,
          brace: pressed('KeyS') || pressed('ArrowDown'),
        },
        dt,
      );
      if (step.stroke) play('stroke');
      if (step.gate !== null) {
        play('gate');
        eventRef.current = 'gate';
        eventSeq.current += 1;
      }
      if (step.hitReef) play('wall');

      const height = waveHeightAt(state.x, state.z, now);
      if (canoeGroup.current) {
        canoeGroup.current.position.set(state.x, height, state.z);
        canoeGroup.current.rotation.y = state.heading;
        canoeGroup.current.rotation.z = -steer * 0.07;
        canoeGroup.current.rotation.x = Math.sin(now * 2.1) * 0.02;
      }
      if (paddle.current) {
        paddle.current.rotation.x = Math.sin(state.strokePhase * Math.PI * 2) * 1.05;
        paddle.current.rotation.z = Math.cos(state.strokePhase * Math.PI * 2) * 0.2;
      }
      if (wake.current) {
        const material = wake.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.12 + Math.min(1, state.speed / CANOE.maxSpeed) * 0.4;
      }

      pose.current = { x: state.x, y: height + 0.55, z: state.z, heading: state.heading };

      if (!xr) {
        const forwardX = Math.sin(state.heading);
        const forwardZ = Math.cos(state.heading);
        const speedRatio = state.speed / CANOE.maxSpeed;
        camPos.set(
          state.x - forwardX * (6.6 + speedRatio * 2.2),
          2.9 + speedRatio * 0.4,
          state.z - forwardZ * (6.6 + speedRatio * 2.2),
        );
        camera.position.lerp(camPos, dampFactor(dt));
        camTarget.set(state.x + forwardX * 5, 0.9, state.z + forwardZ * 5);
        camera.lookAt(camTarget);
      }

      stats = {
        mode,
        phase: state.finished ? 'done' : state.started ? 'riding' : 'idle',
        score: state.score,
        elapsed: state.elapsed,
        speed: Math.round(state.speed * 3.6),
        gates: state.gates,
        totalGates: PIKO_GATES.length,
        wave: 0,
        totalWaves: SURF.waves,
        balance: 100,
        pocket: 0,
        x: Math.round(state.x * 10) / 10,
        pocketX: 0,
        distance: 0,
        waveTimer: 0,
        started: state.started,
        finished: state.finished,
        event: eventRef.current,
        eventId: eventSeq.current,
      };

      if (step.finished && !finished.current) {
        finished.current = true;
        onFinish({
          mode,
          score: state.score,
          elapsed: state.elapsed,
          gates: state.gates,
          waves: 0,
          distance: 0,
          wipes: 0,
        });
      }
    } else {
      const state = surf.current;
      const step = stepSurf(
        state,
        { steer, pump: pressed('KeyW') || pressed('ArrowUp') || pressed('Space') },
        dt,
      );
      if (step.event === 'takeoff') play('swell');
      if (step.event === 'wipeout') play('wipeout');
      if (step.event === 'wave') play('finish');
      if (step.event) {
        eventRef.current = step.event;
        eventSeq.current += 1;
      }

      const riding = state.phase === 'riding';
      const progress = state.distance / SURF.length;
      const z = riding ? waveProgressZ(progress) : waveProgressZ(0.1);
      const x = state.x;
      const height = waveHeightAt(x, z, now);

      if (surferGroup.current) {
        surferGroup.current.position.set(x, height + 0.12, z);
        surferGroup.current.rotation.y = steer * 0.5;
        surferGroup.current.rotation.z = -steer * 0.28;
        surferGroup.current.rotation.x = riding ? -0.05 : 0.02;
      }
      if (spray.current) {
        const material = spray.current.material as THREE.MeshBasicMaterial;
        material.opacity = riding ? 0.1 + Math.min(1, state.speed / SURF.maxSpeed) * 0.3 : 0.05;
      }
      if (waveGroup.current) {
        waveGroup.current.visible = riding;
        waveGroup.current.position.set(x, 0, z);
      }
      if (pocketMarker.current) {
        pocketMarker.current.visible = riding;
        if (riding) {
          pocketMarker.current.position.set(pocketTargetFor(state), 0.3, z);
          pocketMarker.current.scale.setScalar(1 + Math.sin(now * 4.2) * 0.08);
        }
      }

      const heading = Math.atan2(-x, 40);
      pose.current = { x, y: height + 0.9, z, heading };

      if (!xr) {
        camPos.set(x * 0.5, 4.2 + Math.min(1, state.speed / SURF.maxSpeed) * 0.8, z - 7.5);
        camera.position.lerp(camPos, dampFactor(dt));
        camTarget.set(x * 0.85, 1.0, z + 3.5);
        camera.lookAt(camTarget);
      }

      stats = {
        mode,
        phase: state.phase === 'ready' ? 'idle' : state.phase,
        score: state.score,
        elapsed: state.elapsed,
        speed: Math.round(state.speed * 3.6),
        gates: 0,
        totalGates: PIKO_GATES.length,
        wave: state.wave,
        totalWaves: SURF.waves,
        balance: Math.round(state.balance),
        pocket: state.pocket,
        x: Math.round(state.x * 10) / 10,
        pocketX: Math.round(pocketTargetFor(state) * 10) / 10,
        distance: Math.round(state.totalDistance),
        waveTimer: Math.max(0, state.waveTimer),
        started: state.phase !== 'ready',
        finished: state.finished,
        event: eventRef.current,
        eventId: eventSeq.current,
      };

      if (step.finished && !finished.current) {
        finished.current = true;
        onFinish({
          mode,
          score: state.score,
          elapsed: state.elapsed,
          gates: 0,
          waves: state.wave,
          distance: Math.round(state.totalDistance),
          wipes: state.wipes,
        });
      }
    }

    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const key = JSON.stringify(stats);
      if (key !== lastStats.current) {
        lastStats.current = key;
        onStats(stats);
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#f0b98a']} />
      <fog attach="fog" args={['#f3c9a4', 120, 900]} />
      <ambientLight intensity={0.3} color="#bcd8e0" />
      <hemisphereLight args={['#ffd9a0', '#1b4d4a', 0.85]} />
      <directionalLight position={[-80, 46, -120]} intensity={2.3} color="#ffd9a0" />
      {/* doplňkové světlo z břehu: bez něj byly hory i loď z pohledu hráče
          černé (slunce svítí zpoza nich) */}
      <directionalLight position={[30, 30, 120]} intensity={0.55} color="#8fb8c8" />

      <Sky />
      <Sea />
      <Shore />
      <group visible={mode === 'canoe'}>
        <GateRings state={canoe} />
      </group>
      <WaveRig groupRef={waveGroup} foam={foam} />
      {/* kapsa vlny — jediná vizuální nápověda, kde je nejsilnější místo */}
      <mesh ref={pocketMarker} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.7, 2.15, 36]} />
        <meshBasicMaterial
          color="#ffd166"
          transparent
          opacity={0.9}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group visible={mode === 'canoe'}>
        <CanoeModel groupRef={canoeGroup} paddleRef={paddle} wakeRef={wake} foam={foam} />
      </group>
      <group visible={mode === 'surf'}>
        <SurferModel groupRef={surferGroup} sprayRef={spray} foam={foam} />
      </group>

      {xr && <PikoXr pose={pose} active={running} />}
    </>
  );
}
