/** @jsxRuntime classic */
'use client';

import { React, useFrame, useThree, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime } from './ScenePresentation';
import {
  KeyLight,
  SceneInstances,
  SceneMotes,
  SkyFill,
  basaltRock,
  gold,
  marbleDarkStone,
  marbleMatte,
  marbleWhite,
  type InstanceItem,
} from './kit';
import { sriYantraGeometry } from './kit/yantra';

type Lang = 'cs' | 'en';

/** Stavy, které scéna umí. `listening`/`speaking` nemáme — žádný hlas v repu není. */
export type HiranSceneState = 'idle' | 'thinking' | 'offline' | 'error';

/** Jeden svět za branou. Data dodává aplikace (`FREE_WORLD_MISSIONS`), ne scéna. */
export interface HiranGate {
  key: string;
  name: string;
  /** Cesta do 3D prezentace světa, pokud existuje. */
  present?: string;
}

/* ─── HIRAN · Zlaté vejce na lotosu — brána do světů ────────────────────
 * Hiranyagarbha je v Rgvédu „zlatý zárodek" v kosmických vodách. Tady je to
 * místo: kruhová mramorová terasa, na ní lotos z perleťových plátků, v něm
 * zlatý orb (sklo + energie + Śrí jantra + prstence) a kolem třináct bran
 * do světů Království srdce. Klik na orb = Hiran mluví, klik na bránu = vstup
 * do světa.
 *
 * Render kit: mramor s žilkami, zlacení s IBL, instancované plátky lotosu,
 * aditivní záře bez vlastního tonemappingu, HDR composer (bloom + AgX).
 */

const ORB_Y = 6.9;
const ORB_R = 2.7;
const GATE_R = 14.5;
const GATE_Y = 4.2;

/** Rozhodí barvy bran po kruhu — každý svět má svůj odstín, orb je zlatý. */
function gateColor(index: number, total: number): string {
  const color = new THREE.Color();
  color.setHSL(((index / Math.max(1, total)) * 0.82 + 0.62) % 1, 0.62, 0.62);
  return `#${color.getHexString()}`;
}

/** Jeden okvětní lístek ležící v rovině XZ, kořen v počátku, špička k +X. */
function petalGeometry(length: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width, length * 0.28, width * 0.76, length * 0.78, 0, length);
  shape.bezierCurveTo(-width * 0.76, length * 0.78, -width, length * 0.28, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 12);
  // XY (špička +Y) → XZ (špička +X)
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

/** Kruhová terasa se stupni a zlatými vlysy. */
function Terrace() {
  return (
    <group>
      <mesh position={[0, -0.5, 0]} receiveShadow material={marbleMatte(3)}>
        <cylinderGeometry args={[19.5, 20.5, 1, 72]} />
      </mesh>
      {/* leštěná tmavá podlaha — zlato na ní svítí */}
      <mesh position={[0, 0.05, 0]} receiveShadow material={basaltRock()}>
        <cylinderGeometry args={[18.6, 18.6, 0.14, 72]} />
      </mesh>
      {[18.2, 11.4, 6.6].map((radius) => (
        <mesh key={radius} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} material={gold(0.28)}>
          <torusGeometry args={[radius, 0.05, 6, 180]} />
        </mesh>
      ))}
      {/* vnější obrubník */}
      <mesh position={[0, 0.28, 0]} material={marbleWhite(2)}>
        <cylinderGeometry args={[20.2, 20.2, 0.55, 72, 1, true]} />
      </mesh>
    </group>
  );
}

/** Lotos — dva věnce perleťových plátků, kořeny na terase, špičky vzhůru. */
function LotusDais() {
  const outer = React.useMemo(() => petalGeometry(3.9, 1.35), []);
  const inner = React.useMemo(() => petalGeometry(2.7, 0.98), []);
  React.useEffect(() => () => outer.dispose(), [outer]);
  React.useEffect(() => () => inner.dispose(), [inner]);

  const outerItems = React.useMemo<InstanceItem[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return {
          position: [Math.cos(angle) * 2.3, 1.05, Math.sin(angle) * 2.3] as [number, number, number],
          rotation: [0, -angle, 0.78] as [number, number, number],
          scale: 1,
        };
      }),
    [],
  );
  const innerItems = React.useMemo<InstanceItem[]>(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return {
          position: [Math.cos(angle) * 1.55, 1.2, Math.sin(angle) * 1.55] as [number, number, number],
          rotation: [0, -angle, 0.5] as [number, number, number],
          scale: 1,
        };
      }),
    [],
  );

  return (
    <group>
      {/* stupňovitý základ květu */}
      <mesh position={[0, 0.5, 0]} receiveShadow castShadow material={marbleMatte(3)}>
        <cylinderGeometry args={[4.4, 4.9, 0.7, 40]} />
      </mesh>
      <mesh position={[0, 0.92, 0]} material={gold(0.26)}>
        <cylinderGeometry args={[4.3, 4.5, 0.12, 40]} />
      </mesh>

      <SceneInstances geometry={outer} material={marbleMatte(3)} items={outerItems} castShadow receiveShadow />
      <SceneInstances geometry={inner} material={marbleMatte(3)} items={innerItems} castShadow receiveShadow />

      {/* lůžko orbů — zlatý kalich uprostřed květu */}
      <mesh position={[0, 1.9, 0]} castShadow material={gold(0.22)}>
        <cylinderGeometry args={[1.55, 1.0, 1.5, 28, 1, true]} />
      </mesh>
      <mesh position={[0, 2.05, 0]} material={gold(0.3)}>
        <cylinderGeometry args={[1.38, 1.38, 0.14, 28]} />
      </mesh>
      <mesh position={[0, 2.62, 0]} rotation={[-Math.PI / 2, 0, 0]} material={gold(0.28)}>
        <torusGeometry args={[1.55, 0.06, 6, 60]} />
      </mesh>
    </group>
  );
}

const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float halo = pow(max(0.0, 1.0 - r), 3.0);
  float rim = exp(-r * 5.5) * 0.55;
  float pulse = 0.92 + 0.08 * sin(uTime * 0.9);
  gl_FragColor = vec4(uColor * (halo + rim) * pulse * uIntensity, 1.0);
}
`;

const ENERGY_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const ENERGY_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uIntensity;
varying vec3 vPos;
varying vec3 vNormalW;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPos);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 2.2);
  float a = sin(vPos.x * 1.7 + uTime * 0.6) * sin(vPos.y * 1.4 - uTime * 0.45) * sin(vPos.z * 1.6 + uTime * 0.35);
  float filaments = smoothstep(0.4, 1.0, abs(sin(vPos.y * 3.4 + uTime * 0.8 + a * 1.7)));
  vec3 gold = vec3(1.0, 0.86, 0.52);
  vec3 col = gold * (0.35 + filaments * 1.3) * (0.55 + 0.45 * sin(uTime * 0.7));
  float alpha = (rim * 0.8 + filaments * 0.35) * uIntensity;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

/** Zlaté vejce: sklo, energie, Śrí jantra, prstence a záře. Klik = Hiran. */
function GoldenOrb({
  state,
  onOrbClick,
}: {
  state: HiranSceneState;
  onOrbClick?: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const group = React.useRef<THREE.Group>(null);
  const halo = React.useRef<THREE.Mesh>(null);
  const ringA = React.useRef<THREE.Mesh>(null);
  const ringB = React.useRef<THREE.Mesh>(null);
  const yantra = React.useRef<THREE.Group>(null);
  const hover = React.useRef(0);
  const hoverTarget = React.useRef(0);
  const intensity = React.useRef(1);

  const yantraGeometry = React.useMemo(() => sriYantraGeometry({ radius: 2.4 }), []);
  React.useEffect(() => () => yantraGeometry.dispose(), [yantraGeometry]);

  const haloUniforms = React.useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffd98a') },
      uIntensity: { value: 1 },
      uTime: { value: 0 },
    }),
    [],
  );
  const energyUniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    }),
    [],
  );

  const target = state === 'thinking' ? 1.45 : state === 'offline' ? 0.45 : state === 'error' ? 0.35 : 1;

  useFrame(({ clock }, delta) => {
    const t = motionTime(clock);
    intensity.current += (target - intensity.current) * Math.min(1, delta * 2.4);
    haloUniforms.uTime.value = t;
    energyUniforms.uTime.value = t;
    haloUniforms.uIntensity.value = intensity.current;
    energyUniforms.uIntensity.value = intensity.current;

    hover.current += (hoverTarget.current - hover.current) * Math.min(1, delta * 6);
    if (group.current) group.current.scale.setScalar(1 + hover.current * 0.02 + intensity.current * 0.004);
    if (halo.current) halo.current.lookAt(camera.position);
    if (yantra.current) yantra.current.rotation.z = t * 0.12;
    if (ringA.current) {
      ringA.current.rotation.z = t * 0.16;
      ringA.current.rotation.x = 1.12 + Math.sin(t * 0.24) * 0.06;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.11;
      ringB.current.rotation.x = -1.34 + Math.cos(t * 0.2) * 0.05;
    }
  });

  return (
    <group ref={group} position={[0, ORB_Y, 0]}>
      {/* záře — plocha, ne koule (koule má zblízka viditelný okraj) */}
      <mesh ref={halo} scale={[16, 16, 16]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={HALO_VERT}
          fragmentShader={HALO_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* jádro */}
      <mesh>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#ffc65c" />
      </mesh>

      {/* energie pod sklem */}
      <mesh>
        <sphereGeometry args={[ORB_R * 0.9, 40, 40]} />
        <shaderMaterial
          uniforms={energyUniforms}
          vertexShader={ENERGY_VERT}
          fragmentShader={ENERGY_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Śrí jantra — uvnitř skla, jak ji masterplan chce */}
      <group ref={yantra}>
        <lineSegments geometry={yantraGeometry}>
          <lineBasicMaterial
            color="#ffe6a8"
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>

      {/* skleněný plášť — jen blanka, ať jádro zůstane zlaté */}
      <mesh>
        <sphereGeometry args={[ORB_R, 48, 48]} />
        <meshStandardMaterial
          color="#ffe6b0"
          transparent
          opacity={0.13}
          roughness={0.08}
          metalness={0}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* prstence */}
      <mesh ref={ringA} rotation={[1.12, 0, 0]} material={gold(0.24)}>
        <torusGeometry args={[3.25, 0.06, 8, 120]} />
      </mesh>
      <mesh ref={ringB} rotation={[-1.34, 0.3, 0]} material={gold(0.3)}>
        <torusGeometry args={[3.75, 0.045, 8, 120]} />
      </mesh>

      {/* chyták na klik — orb je vstup do rozhovoru */}
      <mesh
        onClick={
          onOrbClick
            ? (event) => {
                event.stopPropagation();
                onOrbClick();
              }
            : undefined
        }
        onPointerOver={
          onOrbClick
            ? (event) => {
                event.stopPropagation();
                hoverTarget.current = 1;
                document.body.style.cursor = 'pointer';
              }
            : undefined
        }
        onPointerOut={
          onOrbClick
            ? () => {
                hoverTarget.current = 0;
                document.body.style.cursor = 'auto';
              }
            : undefined
        }
      >
        <sphereGeometry args={[3.2, 20, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Brána do jednoho světa — pylon, prstenec, clona a popisek. */
function Gate({
  gate,
  index,
  total,
  onSelect,
  showLabel = true,
}: {
  gate: HiranGate;
  index: number;
  total: number;
  onSelect?: (gate: HiranGate) => void;
  /** Na úzkém displeji se popisky 13 bran překrývají — kreslí se jen na širokém. */
  showLabel?: boolean;
}) {
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const color = gateColor(index, total);
  const ringMaterial = React.useMemo(
    () => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    [color],
  );
  const veilMaterial = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );
  React.useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);
  React.useEffect(() => () => veilMaterial.dispose(), [veilMaterial]);

  const interactive = Boolean(onSelect && gate.present);

  return (
    <group
      position={[Math.cos(angle) * GATE_R, 0, Math.sin(angle) * GATE_R]}
      rotation={[0, -angle, 0]}
      onClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              onSelect!(gate);
            }
          : undefined
      }
      onPointerOver={
        interactive
          ? (event) => {
              event.stopPropagation();
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        interactive
          ? () => {
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      {/* pylon */}
      <mesh position={[0, GATE_Y / 2 + 0.5, 0]} castShadow material={marbleWhite(2)}>
        <cylinderGeometry args={[0.17, 0.3, GATE_Y, 10]} />
      </mesh>
      <mesh position={[0, 0.35, 0]} receiveShadow material={marbleMatte(3)}>
        <cylinderGeometry args={[0.7, 0.9, 0.7, 12]} />
      </mesh>
      <mesh position={[0, GATE_Y + 0.5, 0]} material={marbleWhite(2)}>
        <cylinderGeometry args={[0.34, 0.26, 0.28, 10]} />
      </mesh>
      {/* prstenec + clona */}
      <mesh position={[0, GATE_Y + 1.5, 0]} material={ringMaterial}>
        <torusGeometry args={[1.15, 0.085, 8, 72]} />
      </mesh>
      <mesh position={[0, GATE_Y + 1.5, 0]} material={veilMaterial}>
        <circleGeometry args={[1.09, 40]} />
      </mesh>
      {/* zlatý klenot na vrcholu */}
      <mesh position={[0, GATE_Y + 3.05, 0]} material={gold(0.22)}>
        <octahedronGeometry args={[0.26, 0]} />
      </mesh>
      {showLabel ? (
        <SceneLabel position={[0, GATE_Y + 4.0, 0]} text={gate.name} scale={0.95} />
      ) : null}
    </group>
  );
}

export function HiranScene({
  lang,
  gates = [],
  state = 'idle',
  onSelectGate,
  onOrbClick,
  gateLabels = true,
}: {
  lang: Lang;
  gates?: HiranGate[];
  state?: HiranSceneState;
  onSelectGate?: (gate: HiranGate) => void;
  onOrbClick?: () => void;
  /** `false` na úzkém displeji: 13 popisků se v malém záběru překrývá. */
  gateLabels?: boolean;
}) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation
        camera={HIRAN_CAMERA}
        target={HIRAN_CONTROLS.target}
        atmosphere={{
          sun: [-0.42, 0.46, -0.78],
          zenith: '#0d0a24',
          horizon: '#3b2140',
          ground: '#170f22',
          sunColor: '#ffd9a4',
          sunSharpness: 220,
          clouds: 0.18,
          stars: 0.72,
          fog: '#241536',
          fogDensity: 0.0028,
          envIntensity: 0.9,
        }}
        post={{ bloom: 0.55, threshold: 0.8, exposure: 0.98, vignette: 0.55 }}
        intro={{ duration: 3.4 }}
      />
      <HiranLighting />

      <Terrace />
      <LotusDais />
      <GoldenOrb state={state} onOrbClick={onOrbClick} />

      {gates.map((gate, index) => (
        <Gate
          key={gate.key}
          gate={gate}
          index={index}
          total={gates.length}
          onSelect={onSelectGate}
          showLabel={gateLabels}
        />
      ))}

      <SceneMotes
        count={180}
        area={[46, 46]}
        height={26}
        speed={0.22}
        size={1.15}
        color="#ffe2a8"
        opacity={0.4}
        sway={1.4}
        seed={11}
      />

      <SceneLabel position={[0, ORB_Y + 5.4, 0]} text="HIRAN" scale={2.4} />
    </>
  );
}

export const HIRAN_CAMERA = { position: [0, 11.5, 33] as [number, number, number], fov: 42, far: 900 };
export const HIRAN_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.1,
  minDistance: 13,
  maxDistance: 70,
  maxPolarAngle: Math.PI / 2 - 0.08,
  target: [0, 6.5, 0] as [number, number, number],
  enablePan: false,
};

export function HiranLighting() {
  return (
    <>
      <ambientLight intensity={0.1} color="#ffe4b8" />
      <SkyFill sky="#8fa6d8" ground="#3a2a44" intensity={0.32} />
      <KeyLight sun={[-0.42, 0.46, -0.78]} intensity={1.7} extent={70} distance={120} color="#ffd2a1" />
      {/* teplé světlo z vejce na lotos a terasu */}
      <pointLight position={[0, ORB_Y, 0]} intensity={9} color="#ffcf7a" distance={30} decay={2} />
      <pointLight position={[0, 2.4, 0]} intensity={4} color="#ffb85c" distance={16} decay={2} />
    </>
  );
}
