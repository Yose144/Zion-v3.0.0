/** @jsxRuntime classic */
'use client';

import { React, useFrame, useThree, THREE } from '@genesis/runtime';
import { tScene } from './scene-i18n';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime } from './ScenePresentation';
import {
  KeyLight,
  SceneInstances,
  SceneMotes,
  SkyFill,
  gold,
  marbleMatte,
  type InstanceItem,
} from './kit';
import { sriYantraGeometry } from './kit/yantra';

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

/* ─── OASIS · Zlaté vejce ve spirální galaxii ────────────────────────────
 * L4 je herní vrstva: spirálová galaxie světů, v jejímž srdci visí Zlaté
 * vejce — Hiranyagarbha, cena za 108 stop. Vejce sedí na lotosu, nese
 * přesnou Śrí jantra pečeť (kit/yantra — konkurenční konstrukce), dva
 * prstence a vějíř světelných paprsků; pod ním pomalu obíhá tříramenná
 * galaxie zlata → cyan → purple (paleta OASIS).
 *
 * Render kit: aditivní záře bez tonemappingu, HDR composer (bloom + AgX),
 * instancované plátky lotosu, jeden Points draw call na galaxii.
 */

const EGG_Y = 6.8;
const EGG_R = 2.55;
const LOTUS_Y = 1.15;
const GALAXY_Y = -2.4;

/* ── shadery ────────────────────────────────────────────────────────── */

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
  float pulse = 0.94 + 0.06 * sin(uTime * 0.9);
  gl_FragColor = vec4(uColor * (halo + rim) * pulse * uIntensity, 1.0);
}
`;

/* jádro vejce — vertikální jantar gradient (pow() jen nad clampnutou bází,
 * jinak reálné GPU produkuje NaN → bloom flicker) */
const CORE_VERT = /* glsl */ `
varying float vY;
varying vec3 vN;
void main() {
  vY = normalize(position).y;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBot;
uniform float uTime;
varying float vY;
varying vec3 vN;

void main() {
  vec3 c = vY > 0.0
    ? mix(uMid, uTop, pow(max(vY, 0.0), 0.8))
    : mix(uMid, uBot, pow(max(-vY, 0.0), 0.7));
  float light = 0.85 + 0.15 * vN.z;
  float breath = 0.97 + 0.03 * sin(uTime * 1.26);
  gl_FragColor = vec4(c * light * breath, 1.0);
}
`;

const SHELL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const SHELL_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;

void main() {
  float f = pow(max(0.0, 1.0 - abs(dot(vN, vV))), 2.6);
  gl_FragColor = vec4(uColor, f * 0.9);
}
`;

/* spirálová galaxie — per-hvězda barva, velikost i jemný třpyt.
 * gl_PointSize se CLAMPUJE na dist>0.5: body za kamerou dostávají zápornou
 * velikost → undefined behavior → na reálném GPU flickrující quady. */
const GALAXY_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
varying vec3 vColor;
varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.82 + 0.18 * sin(uTime * (0.4 + fract(aPhase) * 0.8) + aPhase * 7.0);
  vTw = tw;
  vColor = aColor;
  float dist = -mv.z;
  // Cap: částice u kamery nesmí růst v obří bokeh (jinak překryjí oblohu).
  gl_PointSize = dist > 0.5 ? min(aSize * (0.9 + 0.1 * tw) * 300.0 / dist, 22.0) : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;

const GALAXY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vTw;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float a = smoothstep(1.0, 0.3, d) * vTw * 0.85;
  gl_FragColor = vec4(vColor, a);
}
`;

/* ── pomocné ────────────────────────────────────────────────────────── */

/** Jemná gaussovská odchylka (Box–Muller, clampnutá). */
function scatter(rand: () => number, sigma: number): number {
  const u = Math.max(rand(), 1e-6);
  const v = rand();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(v * Math.PI * 2);
}

/** Měkký gradient paprsku — alfa slábne ke špičce i do stran. */
function rayTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,220,130,0.55)');
  g.addColorStop(0.45, 'rgba(255,210,110,0.22)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const gx = ctx.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)');
  gx.addColorStop(0.5, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Okvětní lístek v rovině XZ, kořen v počátku, špička k +X. */
function petalGeometry(length: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width, length * 0.28, width * 0.76, length * 0.78, 0, length);
  shape.bezierCurveTo(-width * 0.76, length * 0.78, -width, length * 0.28, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

/* ── spirálová galaxie ──────────────────────────────────────────────── */

function SpiralGalaxy() {
  const group = React.useRef<THREE.Group>(null);
  const uniforms = React.useMemo(() => ({ uTime: { value: 0 } }), []);

  const geometry = React.useMemo(() => {
    const N = 4200;
    const ARMS = 3;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const goldC = new THREE.Color('#ffd98a');
    const cyan = new THREE.Color('#3ec6e8');
    const purple = new THREE.Color('#8f4ee0');
    const c = new THREE.Color();
    let s = 1234567;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < N; i++) {
      const arm = i % ARMS;
      const r = 2.5 + Math.pow(rand(), 0.62) * 25;
      const baseA = (arm / ARMS) * Math.PI * 2;
      const angle = baseA + r * 0.34 + scatter(rand, 0.09 + r * 0.006);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = GALAXY_Y + scatter(rand, 0.45 * (1.15 - r / 30));
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      size[i] = 0.35 + rand() * (r < 7 ? 1.5 : 1.0);
      phase[i] = rand() * Math.PI * 2;
      const t = Math.min(1, Math.max(0, (r - 3) / 23));
      if (t < 0.5) c.copy(goldC).lerp(cyan, t * 2);
      else c.copy(cyan).lerp(purple, (t - 0.5) * 2);
      if (rand() < 0.12) c.lerp(goldC, 0.55); // roztroušená zlatá zrnka
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const t = motionTime(clock);
    uniforms.uTime.value = t;
    if (group.current) group.current.rotation.y = t * 0.018;
  });

  return (
    <group ref={group}>
      <points geometry={geometry}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={GALAXY_VERT}
          fragmentShader={GALAXY_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* ── lotos ──────────────────────────────────────────────────────────── */

function LotusDais() {
  const outer = React.useMemo(() => petalGeometry(3.4, 1.3), []);
  const mid = React.useMemo(() => petalGeometry(2.4, 0.95), []);
  const inner = React.useMemo(() => petalGeometry(1.55, 0.62), []);
  React.useEffect(() => () => outer.dispose(), [outer]);
  React.useEffect(() => () => mid.dispose(), [mid]);
  React.useEffect(() => () => inner.dispose(), [inner]);

  const ring = (count: number, radius: number, tilt: number, y: number, offset: number): InstanceItem[] =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + offset;
      return {
        position: [Math.cos(a) * radius, y, Math.sin(a) * radius] as [number, number, number],
        rotation: [0, -a, tilt] as [number, number, number],
        scale: 1,
      };
    });
  const outerItems = React.useMemo(() => ring(12, 2.0, 0.86, 0.5, 0), []);
  const midItems = React.useMemo(() => ring(10, 1.45, 0.55, 0.72, Math.PI / 10), []);
  const innerItems = React.useMemo(() => ring(8, 0.95, 0.3, 0.95, Math.PI / 8), []);

  return (
    <group position={[0, LOTUS_Y - 1.15, 0]}>
      <SceneInstances geometry={outer} material={marbleMatte(3)} items={outerItems} castShadow receiveShadow />
      <SceneInstances geometry={mid} material={marbleMatte(3)} items={midItems} castShadow receiveShadow />
      <SceneInstances geometry={inner} material={gold(0.3)} items={innerItems} castShadow receiveShadow />
      {/* kalich pod vejcem */}
      <mesh position={[0, 1.55, 0]} material={gold(0.26)}>
        <cylinderGeometry args={[1.3, 0.85, 1.1, 28, 1, true]} />
      </mesh>
      <mesh position={[0, 2.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={gold(0.28)}>
        <torusGeometry args={[1.3, 0.05, 6, 60]} />
      </mesh>
    </group>
  );
}

/* ── Zlaté vejce ────────────────────────────────────────────────────── */

function GoldenEgg() {
  const camera = useThree((s) => s.camera);
  const group = React.useRef<THREE.Group>(null);
  const halo = React.useRef<THREE.Mesh>(null);
  const yantra = React.useRef<THREE.Group>(null);
  const ringA = React.useRef<THREE.Mesh>(null);
  const ringB = React.useRef<THREE.Mesh>(null);
  const rays = React.useRef<THREE.Group>(null);

  const yantraGeometry = React.useMemo(() => sriYantraGeometry({ radius: 1.95 }), []);
  React.useEffect(() => () => yantraGeometry.dispose(), [yantraGeometry]);

  const rayTex = React.useMemo(() => rayTexture(), []);
  React.useEffect(() => () => rayTex.dispose(), [rayTex]);

  const coreUniforms = React.useMemo(
    () => ({
      uTop: { value: new THREE.Color('#ffedb0') },
      uMid: { value: new THREE.Color('#f0991a') },
      uBot: { value: new THREE.Color('#6e2f02') },
      uTime: { value: 0 },
    }),
    [],
  );
  const shellUniforms = React.useMemo(() => ({ uColor: { value: new THREE.Color('#ffc95e') } }), []);
  const haloUniforms = React.useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffd98a') },
      uIntensity: { value: 0.85 },
      uTime: { value: 0 },
    }),
    [],
  );

  const rayItems = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        width: 0.34 + (i % 3) * 0.16,
        angle: (i / 14) * Math.PI * 2 + 0.11,
      })),
    [],
  );

  useFrame(({ clock }) => {
    const t = motionTime(clock);
    coreUniforms.uTime.value = t;
    haloUniforms.uTime.value = t;
    const breath = 1 + Math.sin(t * (Math.PI * 2) / 5) * 0.014;
    if (group.current) {
      group.current.scale.setScalar(breath);
      group.current.position.y = EGG_Y + Math.sin(t * 0.55) * 0.16;
    }
    if (halo.current) halo.current.lookAt(camera.position);
    if (yantra.current) yantra.current.rotation.z = t * 0.1;
    if (ringA.current) {
      ringA.current.rotation.z = t * 0.16;
      ringA.current.rotation.x = 1.12 + Math.sin(t * 0.24) * 0.06;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.11;
      ringB.current.rotation.x = -1.34 + Math.cos(t * 0.2) * 0.05;
    }
    if (rays.current) rays.current.rotation.z = -t * 0.03;
  });

  return (
    <group ref={group} position={[0, EGG_Y, 0]}>
      {/* záře — billboard plocha, ne koule (žádný tvrdý okraj) */}
      <mesh ref={halo} scale={[15, 15, 15]}>
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

      {/* vějíř paprsků za vejcem */}
      <group ref={rays} rotation={[-0.55, 0, 0]} position={[0, 0, -0.4]}>
        {rayItems.map((r, i) => (
          <group key={i} rotation={[0, 0, r.angle]}>
            <mesh position={[0, EGG_R + 1.6, 0]}>
              <planeGeometry args={[r.width, 4.6]} />
              <meshBasicMaterial
                map={rayTex}
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* jádro — jantar gradient */}
      <mesh>
        <sphereGeometry args={[EGG_R * 0.86, 48, 32]} />
        <shaderMaterial uniforms={coreUniforms} vertexShader={CORE_VERT} fragmentShader={CORE_FRAG} />
      </mesh>

      {/* přesná Śrí jantra pečeť uvnitř skla */}
      <group ref={yantra}>
        <lineSegments geometry={yantraGeometry}>
          <lineBasicMaterial color="#ffe6a8" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      </group>

      {/* fresnel sklo */}
      <mesh>
        <sphereGeometry args={[EGG_R, 48, 32]} />
        <shaderMaterial
          uniforms={shellUniforms}
          vertexShader={SHELL_VERT}
          fragmentShader={SHELL_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* prstence */}
      <mesh ref={ringA} rotation={[1.12, 0, 0]}>
        <torusGeometry args={[EGG_R * 1.28, 0.045, 8, 140]} />
        <meshBasicMaterial color="#ffc94d" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation={[-1.34, 0.3, 0]}>
        <torusGeometry args={[EGG_R * 1.5, 0.035, 8, 140]} />
        <meshBasicMaterial color="#ffd97a" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── scéna ──────────────────────────────────────────────────────────── */

export function OasisScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation
        camera={OASIS_CAMERA}
        target={OASIS_CONTROLS.target}
        atmosphere={{
          sun: [-0.42, 0.4, -0.8],
          zenith: '#070512',
          horizon: '#241544',
          ground: '#0b0718',
          sunColor: '#ffd9a4',
          sunSharpness: 160,
          clouds: 0.12,
          stars: 0.9,
          fog: '#0e0a20',
          fogDensity: 0.0022,
          envIntensity: 0.8,
        }}
        post={{ bloom: 0.6, threshold: 0.72, exposure: 1.05, vignette: 0.5 }}
        intro={{ duration: 3.2 }}
      />
      <OasisLighting />

      <SpiralGalaxy />
      <LotusDais />
      <GoldenEgg />

      <SceneMotes
        count={140}
        area={[34, 34]}
        height={20}
        speed={0.18}
        size={0.7}
        color="#ffe2a8"
        opacity={0.4}
        sway={1.2}
        level={-4}
        seed={7}
      />

      <SceneLabel position={[0, EGG_Y + 4.6, 0]} text={cs ? 'ZLATÉ VEJCE' : tScene('GOLDEN EGG', lang)} scale={2.2} />
      <SceneLabel position={[0, LOTUS_Y - 1.7, 0]} text={cs ? 'srdce spirální galaxie OASIS' : tScene('heart of the OASIS spiral galaxy', lang)} scale={0.95} />
    </>
  );
}

export const OASIS_CAMERA = { position: [0, 10.5, 30] as [number, number, number], fov: 42, far: 900 };
export const OASIS_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.12,
  minDistance: 12,
  maxDistance: 64,
  maxPolarAngle: Math.PI / 2 - 0.04,
  target: [0, 5, 0] as [number, number, number],
  enablePan: false,
};

export function OasisLighting() {
  return (
    <>
      <ambientLight intensity={0.12} color="#cfe0ff" />
      <SkyFill sky="#8fa6d8" ground="#2a1e44" intensity={0.3} />
      <KeyLight sun={[-0.42, 0.4, -0.8]} intensity={1.4} extent={60} distance={110} color="#ffd2a1" />
      {/* teplé světlo z vejce na lotos a galaxii */}
      <pointLight position={[0, EGG_Y, 0]} intensity={10} color="#ffcf7a" distance={34} decay={2} />
      <pointLight position={[0, LOTUS_Y + 0.6, 0]} intensity={4} color="#ffb85c" distance={14} decay={2} />
      {/* studený nádech galaxie zespodu */}
      <pointLight position={[0, GALAXY_Y + 1, 8]} intensity={2.2} color="#4ec8e8" distance={30} decay={2} />
    </>
  );
}
