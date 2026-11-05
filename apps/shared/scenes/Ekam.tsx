/** @jsxRuntime classic */
'use client';

import { React, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation } from './ScenePresentation';
import {
  KeyLight,
  SceneInstances,
  SceneMotes,
  SceneTerrain,
  SceneWater,
  SkyFill,
  gold,
  lamp,
  marbleMatte,
  marbleWhite,
  stoneWarm,
} from './kit';

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es';

/* ─── Ekam · The Oneness Temple — Varadaiahpalem, Andhra Pradesh ───────
 *
 * Skutečná stavba (dokončeno 2008, architekt Prabhat Poddar, Auroville;
 * Šilpa a Vastu šástra, zlatý řez). Ověřená fakta, ze kterých scéna vychází:
 *
 *  · bílý mramor, tři podlaží, výška 32,85 m
 *  · vyvýšená plošina 130 × 106 m, po obvodu vodní plochy v rozích
 *  · přízemí a střední patro: sloupové meditační sály 6 700 m² každý,
 *    prostřední patro se jmenuje Artha Kama
 *  · nejvyšší patro: bezsloupový sál Dharma Moksha 2 500 m² se zlatou koulí
 *    („Golden Orb", průměr ~91 cm)
 *  · stupy, věžičky, kopule, zdobené portály a mřížovaná okna
 *  · rovina u Východních Ghátů
 *
 * Měřítko scény: 1 jednotka ≈ 2 m. Plošina 65 × 53, budova 54 × 38,
 * výška 16,6 jednotek (~33 m).
 */

const PLATFORM = { w: 65, d: 53, h: 2.2 };
const TIER = [
  { w: 54, d: 38, h: 5.2 },
  { w: 46, d: 31, h: 5.0 },
  { w: 32, d: 21, h: 4.8 },
];
const BASE_Y = PLATFORM.h;
const TIER_Y = [BASE_Y, BASE_Y + TIER[0].h, BASE_Y + TIER[0].h + TIER[1].h];
const ROOF_Y = BASE_Y + TIER[0].h + TIER[1].h + TIER[2].h; // ≈ 16,6 jednotek = 33,2 m

/* ── mřížované arkády ─────────────────────────────────────────────── */

/** Lomený mughalský oblouk — křivka, ne špička. */
function archShape(width: number, height: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  const half = width / 2;
  const spring = height - width * 0.62;
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, spring);
  shape.bezierCurveTo(half, height * 0.78, half * 0.55, height, 0, height);
  shape.bezierCurveTo(-half * 0.55, height, -half, height * 0.78, -half, spring);
  shape.lineTo(-half, 0);
  const geometry = new THREE.ShapeGeometry(shape, 14);
  return geometry;
}

const ARCH_W = 1.5;
const ARCH_H = 2.9;
const ARCH = archShape(ARCH_W, ARCH_H);
const ARCH_FRAME = archShape(ARCH_W + 0.34, ARCH_H + 0.3);

interface Opening {
  matrix: THREE.Matrix4;
}

/** Rozmístí arkády po čtyřech stranách jednoho podlaží. */
function latticeOpening(
  width: number,
  depth: number,
  spacing: number,
  z: number,
  y: number,
): Opening[] {
  const list: Opening[] = [];
  const perLong = Math.max(2, Math.round(width / spacing));
  const perShort = Math.max(2, Math.round(depth / spacing));
  const matrix = new THREE.Matrix4();
  const place = (x: number, zz: number, ry: number) => {
    matrix.makeRotationY(ry);
    matrix.setPosition(x, y, zz);
    list.push({ matrix: matrix.clone() });
  };
  for (let i = 0; i < perLong; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / perLong;
    place(x, depth / 2 + z, 0);
    place(x, -depth / 2 - z, Math.PI);
  }
  for (let i = 0; i < perShort; i++) {
    const zz = -depth / 2 + ((i + 0.5) * depth) / perShort;
    if (Math.abs(zz) < depth / 2 - spacing * 0.6) {
      place(width / 2 + z, zz, Math.PI / 2);
      place(-width / 2 - z, zz, -Math.PI / 2);
    }
  }
  return list;
}

/** Posun instancí po vlastní ose Z (do zdi) — sklo je zapuštěné, rám vystupuje. */
function recessed(items: Opening[], dz: number): Opening[] {
  const shift = new THREE.Matrix4().makeTranslation(0, 0, dz);
  return items.map((item) => ({ matrix: item.matrix.clone().multiply(shift) }));
}

function InstancedArch({ items, geometry, material }: { items: Opening[]; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    items.forEach((item, index) => node.setMatrixAt(index, item.matrix));
    node.instanceMatrix.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false} />;
}

/** Jedno podlaží: hmota, římsa a dvě vrstvy arkád (rám + prosvícená mříž). */
function Tier({ index }: { index: number }) {
  const spec = TIER[index];
  const y = TIER_Y[index];
  const openings = React.useMemo(
    () => latticeOpening(spec.w, spec.d, index === 2 ? 1.9 : 2.2, 0.05, y + (index === 2 ? 0.55 : 0.3)),
    [index, spec.w, spec.d, y],
  );
  return (
    <group>
      <mesh position={[0, y + spec.h / 2, 0]} castShadow receiveShadow material={index === 0 ? stoneWarm(6, '#f6efe1') : marbleWhite(index === 2 ? 1 : 2)}>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
      </mesh>
      {/* římsa mezi podlažími */}
      <mesh position={[0, y + spec.h, 0]} material={marbleWhite(2)} castShadow>
        <boxGeometry args={[spec.w + 0.5, 0.26, spec.d + 0.5]} />
      </mesh>
      <mesh position={[0, y + spec.h - 0.2, 0]} material={CORNICE_SHADOW}>
        <boxGeometry args={[spec.w + 0.48, 0.12, spec.d + 0.48]} />
      </mesh>
      <InstancedArch items={recessed(openings, 0.02)} geometry={ARCH_FRAME} material={MULLION_STONE} />
      <InstancedArch items={recessed(openings, 0.08)} geometry={ARCH} material={MULLION_GLASS} />
    </group>
  );
}

const MULLION_GLASS = new THREE.MeshStandardMaterial({
  color: '#171310',
  emissive: '#ff9d4a',
  emissiveIntensity: 0.18,
  roughness: 0.65,
  side: THREE.DoubleSide,
});
const CORNICE_SHADOW = new THREE.MeshStandardMaterial({ color: '#b9ae99', roughness: 0.9 });
const MULLION_STONE = new THREE.MeshStandardMaterial({
  color: '#d6cdba',
  roughness: 0.78,
  side: THREE.DoubleSide,
});

/* ── stupy a věžičky ──────────────────────────────────────────────── */

/** Stupa: baňatá kopule, štíhlá věž a zlatý hrot — hlavní motiv střechy. */
function Spire({ x, z, baseY, scale: s = 1, tower = 3.2 }: { x: number; z: number; baseY: number; scale?: number; tower?: number }) {
  const dome = React.useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [1.55, 0.05],
          [1.7, 0.34],
          [1.56, 0.72],
          [1.14, 1.12],
          [0.62, 1.44],
          [0.28, 1.66],
          [0, 1.74],
        ].map(([a, b]) => new THREE.Vector2(a * s, b * s)),
        22,
      ),
    [s],
  );
  const towerGeo = React.useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0.95, 0],
          [0.92, 0.28],
          [0.78, 0.62],
          [0.8, 0.9],
          [0.66, 1.25],
          [0.68, 1.55],
          [0.52, 2.0],
          [0.54, 2.35],
          [0.36, 2.9],
          [0.22, 3.5],
          [0.1, 4.0],
          [0.02, 4.4],
          [0, 4.5],
        ].map(([a, b]) => new THREE.Vector2(a * s, b * s * (tower / 3.2))),
        18,
      ),
    [s, tower],
  );
  return (
    <group position={[x, baseY, z]}>
      <mesh position={[0, 0.18, 0]} material={marbleMatte(2)} castShadow>
        <cylinderGeometry args={[1.5 * s, 1.72 * s, 0.45, 18]} />
      </mesh>
      <mesh geometry={dome} material={marbleWhite(2)} castShadow />
      <mesh position={[0, 1.5 * s, 0]} geometry={towerGeo} material={marbleWhite(1)} castShadow />
      <mesh position={[0, 1.5 * s + 4.5 * s * (tower / 3.2) - 0.1, 0]} material={gold(0.24)}>
        <sphereGeometry args={[0.22 * s, 12, 10]} />
      </mesh>
      <mesh position={[0, 1.5 * s + 4.5 * s * (tower / 3.2) + 0.42, 0]} material={gold(0.2)}>
        <coneGeometry args={[0.1 * s, 0.8, 8]} />
      </mesh>
    </group>
  );
}

/** Malá kopulová věžička (čhatrí) na římse nebo na plošině. */
function Chhatri({ positions, scale = 1 }: { positions: [number, number][]; scale?: number }) {
  const items = React.useMemo(
    () => positions.map(([x, z]) => ({ position: [x, 0, z] as [number, number, number], scale })),
    [positions, scale],
  );
  return (
    <group>
      <SceneInstances geometry={CHHATRI_BASE} material={marbleMatte(1)} items={items} receiveShadow={false} />
      <SceneInstances
        geometry={CHHATRI_DOME}
        material={marbleWhite(1)}
        items={items.map((item) => ({ ...item, position: [item.position[0], item.position[1] + 0.9 * scale, item.position[2]] as [number, number, number] }))}
        receiveShadow={false}
      />
    </group>
  );
}

const CHHATRI_BASE = new THREE.CylinderGeometry(0.62, 0.72, 0.9, 12);
const CHHATRI_DOME = new THREE.SphereGeometry(0.66, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);

/* ── plošina, voda, schodiště ─────────────────────────────────────── */

function Platform() {
  return (
    <group>
      <mesh position={[0, PLATFORM.h / 2, 0]} receiveShadow castShadow material={marbleMatte(8)}>
        <boxGeometry args={[PLATFORM.w, PLATFORM.h, PLATFORM.d]} />
      </mesh>
      {/* širší kamennýstup stupně pod plošinou */}
      <mesh position={[0, 0.22, 0]} receiveShadow material={stoneWarm(14, '#ded3bd')}>
        <boxGeometry args={[PLATFORM.w + 5, 0.44, PLATFORM.d + 5]} />
      </mesh>
      {/* obvodová parapetní zídka */}
      {[
        { p: [0, PLATFORM.h + 0.35, PLATFORM.d / 2] as [number, number, number], s: [PLATFORM.w, 0.7, 0.5] as [number, number, number] },
        { p: [0, PLATFORM.h + 0.35, -PLATFORM.d / 2] as [number, number, number], s: [PLATFORM.w, 0.7, 0.5] as [number, number, number] },
        { p: [PLATFORM.w / 2, PLATFORM.h + 0.35, 0] as [number, number, number], s: [0.5, 0.7, PLATFORM.d] as [number, number, number] },
        { p: [-PLATFORM.w / 2, PLATFORM.h + 0.35, 0] as [number, number, number], s: [0.5, 0.7, PLATFORM.d] as [number, number, number] },
      ].map((p, i) => (
        <mesh key={i} position={p.p} material={marbleMatte(6)} receiveShadow>
          <boxGeometry args={p.s} />
        </mesh>
      ))}
      {/* plinth pod schodištěm, aby stupně nestály ve vzduchu */}
      <mesh position={[0, 0.12, PLATFORM.d / 2 + 4.6]} receiveShadow material={stoneWarm(8, '#ddd2bc')}>
        <boxGeometry args={[17, 0.24, 9.6]} />
      </mesh>
      {/* hlavní schodiště ze západu */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, PLATFORM.h - (i + 0.5) * (PLATFORM.h / 7), PLATFORM.d / 2 + 1.0 + i * 0.9]} receiveShadow material={marbleMatte(3)}>
          <boxGeometry args={[16 - i * 0.4, PLATFORM.h / 7, 0.92]} />
        </mesh>
      ))}
    </group>
  );
}

/** Čtyři vodní plochy v rozích plošiny — v reálu je obklopuje voda. */
function CornerWaters() {
  const spots: [number, number][] = [
    [PLATFORM.w / 2 - 7, PLATFORM.d / 2 - 6],
    [-PLATFORM.w / 2 + 7, PLATFORM.d / 2 - 6],
    [PLATFORM.w / 2 - 7, -PLATFORM.d / 2 + 6],
    [-PLATFORM.w / 2 + 7, -PLATFORM.d / 2 + 6],
  ];
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, PLATFORM.h + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} material={stoneWarm(3, '#cdbfa6')}>
            <planeGeometry args={[9, 7.5]} />
          </mesh>
          <mesh position={[x, PLATFORM.h + 0.05, z]} rotation={[-Math.PI / 2, 0, 0]} material={marbleMatte(3)}>
            <ringGeometry args={[4.2, 4.6, 4]} />
          </mesh>
          <group position={[x, 0, z]}>
            <SceneWater width={8.2} depth={6.7} position={[0, PLATFORM.h + 0.08, 0]} tint="#0d3b45" repeat={3} speed={0.6} sun={[-0.58, 0.26, 0.77]} sky="#f0c8a0" />
          </group>
        </group>
      ))}
    </group>
  );
}

/* ── okolí ───────────────────────────────────────────────────────── */

/** Východní Gháty — nízký, mlhou ztracený hřeben na obzoru. */
function Ghats() {
  return (
    <group position={[0, -1.5, -430]}>
      {[
        { x: -170, w: 260, h: 12 },
        { x: 60, w: 320, h: 16 },
        { x: 280, w: 280, h: 11 },
      ].map((ridge, index) => (
        <mesh key={index} position={[ridge.x, 0, index * 26]} scale={[1, ridge.h / (ridge.w / 2), 1]} material={stoneWarm(4, '#a9b4bb')}>
          <sphereGeometry args={[ridge.w / 2, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
    </group>
  );
}

function Approach() {
  const lamps = React.useMemo(
    () => [-7, 7].flatMap((x) => [-26, -34, -42, -50].map((z) => ({ x, z }))),
    [],
  );
  return (
    <group>
      {/* příjezdová osa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -40]} receiveShadow material={sandGroundApproach}>
        <planeGeometry args={[13, 52]} />
      </mesh>
      <SceneInstances
        geometry={LAMP_POST}
        material={stoneWarm(1, '#3d3a33')}
        items={lamps.map((p) => ({ position: [p.x, 1.1, p.z] as [number, number, number] }))}
      />
      <SceneInstances
        geometry={LAMP_GLOBE}
        material={lamp('#ffca7a', 3.2)}
        items={lamps.map((p) => ({ position: [p.x, 2.4, p.z] as [number, number, number] }))}
        castShadow={false}
      />
    </group>
  );
}

const sandGroundApproach = stoneWarm(6, '#e8dcc0');
const LAMP_POST = new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8);
const LAMP_GLOBE = new THREE.SphereGeometry(0.2, 10, 8);

/* ── scéna ───────────────────────────────────────────────────────── */

export function EkamScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';

  // Stupy po hřebeni: prostřední nejvyšší, symetrické dvojice po stranách.
  // Stupy po hřebeni: prostřední nejvyšší, symetrické dvojice po stranách — jako na fotografii.
  const spires = React.useMemo(
    () => [
      { x: 0, z: 0, baseY: ROOF_Y, s: 1.35, tower: 4.6 },
      { x: -12.5, z: 0, baseY: TIER_Y[2], s: 1.0, tower: 3.6 },
      { x: 12.5, z: 0, baseY: TIER_Y[2], s: 1.0, tower: 3.6 },
      { x: -21, z: 0, baseY: TIER_Y[1], s: 0.86, tower: 3.2 },
      { x: 21, z: 0, baseY: TIER_Y[1], s: 0.86, tower: 3.2 },
      { x: 0, z: -9, baseY: TIER_Y[2], s: 0.78, tower: 3 },
      { x: 0, z: 9, baseY: TIER_Y[2], s: 0.78, tower: 3 },
      { x: -8, z: -8, baseY: TIER_Y[1], s: 0.62, tower: 2.6 },
      { x: 8, z: -8, baseY: TIER_Y[1], s: 0.62, tower: 2.6 },
      { x: -8, z: 8, baseY: TIER_Y[1], s: 0.62, tower: 2.6 },
      { x: 8, z: 8, baseY: TIER_Y[1], s: 0.62, tower: 2.6 },
    ],
    [],
  );

  const chhatris = React.useMemo(() => {
    const list: [number, number][] = [];
    // na terase prvního patra
    const w1 = TIER[0].w / 2 - 1.6;
    const d1 = TIER[0].d / 2 - 1.6;
    for (let i = -3; i <= 3; i++) {
      list.push([(i * w1) / 3.2, d1]);
      list.push([(i * w1) / 3.2, -d1]);
    }
    for (let i = -1; i <= 1; i++) {
      list.push([w1, (i * d1) / 1.7]);
      list.push([-w1, (i * d1) / 1.7]);
    }
    // na římse druhého patra
    const w2 = TIER[1].w / 2 - 1.5;
    const d2 = TIER[1].d / 2 - 1.5;
    for (let i = -2; i <= 2; i++) {
      list.push([(i * w2) / 2.3, d2]);
      list.push([(i * w2) / 2.3, -d2]);
    }
    return list;
  }, []);

  return (
    <>
      <ScenePresentation
        camera={EKAM_CAMERA}
        target={EKAM_CONTROLS.target}
        atmosphere={{
          sun: [-0.58, 0.26, 0.77],
          zenith: '#3a4a72',
          horizon: '#f6c996',
          ground: '#3d3a2c',
          sunColor: '#ffd2a1',
          sunSharpness: 260,
          clouds: 0.34,
          stars: 0,
          fog: '#dbc3a6',
          fogDensity: 0.0021,
          envIntensity: 0.95,
        }}
        post={{ bloom: 0.28, threshold: 0.94, exposure: 0.82, vignette: 0.52 }}
        intro={{ duration: 3.8 }}
        portraitScale={1.28}
      />
      <EkamLighting />

      <SceneTerrain
        kind="grass"
        size={900}
        segments={170}
        repeat={220}
        seed={17}
        level={-0.4}
        height={(x, z, noise) => {
          const distance = Math.hypot(x, z);
          const rise = Math.max(0, Math.min(1, (distance - 150) / 220));
          return rise * (noise.fbm(x * 0.008, z * 0.008, 4) - 0.42) * 26;
        }}
        color={(x, _y, z, noise) => {
          const dry = noise.fbm(x * 0.02 + 4, z * 0.02 + 1, 3);
          return [0.2 + dry * 0.1, 0.28 + dry * 0.1, 0.12 + dry * 0.05];
        }}
      />
      <Ghats />

      <Platform />
      <CornerWaters />
      <Approach />

      {TIER.map((_, index) => (
        <Tier key={index} index={index} />
      ))}

      {/* zlatá koule — Dharma Moksha, prosvítá mříží nejvyššího patra */}
      <mesh position={[0, TIER_Y[2] + TIER[2].h * 0.55, 0]}>
        <sphereGeometry args={[0.46, 20, 16]} />
        <meshStandardMaterial color="#f7cf7a" metalness={0.9} roughness={0.22} emissive="#ffb347" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, TIER_Y[2] + TIER[2].h * 0.55, 0]} intensity={9} color="#ffc46a" distance={26} decay={2} />

      {spires.map((spire, index) => (
        <Spire key={index} x={spire.x} z={spire.z} baseY={spire.baseY} scale={spire.s} tower={spire.tower} />
      ))}

      <Chhatri positions={chhatris} scale={1.9} />
      {/* věžičky na nárožích plošiny */}
      <Chhatri
        positions={[
          [PLATFORM.w / 2 - 2.2, PLATFORM.d / 2 - 2.2],
          [-PLATFORM.w / 2 + 2.2, PLATFORM.d / 2 - 2.2],
          [PLATFORM.w / 2 - 2.2, -PLATFORM.d / 2 + 2.2],
          [-PLATFORM.w / 2 + 2.2, -PLATFORM.d / 2 + 2.2],
        ]}
        scale={2.4}
      />

      <SceneMotes count={170} area={[90, 90]} height={18} speed={0.2} size={2.2} color="#ffe8c0" opacity={0.35} sway={1.6} seed={3} />

      <SceneLabel position={[0, ROOF_Y + 7.5, 0]} text="Ekam · The Oneness Temple" scale={2.4} />
      <SceneLabel position={[0, ROOF_Y + 2.6, 0]} text={cs ? 'Dharma Moksha — zlatá koule' : 'Dharma Moksha — the golden orb'} scale={1.8} />
      <SceneLabel position={[0, TIER_Y[0] + TIER[0].h * 0.5, TIER[0].d / 2 + 1.2]} text={cs ? 'Artha Kama — sál přání' : 'Artha Kama — hall of desires'} scale={1.7} />
      <SceneLabel position={[-PLATFORM.w / 2 + 7, PLATFORM.h + 2.2, PLATFORM.d / 2 - 6]} text={cs ? 'Vodní plochy v rozích' : 'Corner water bodies'} scale={1.5} />
    </>
  );
}

export const EKAM_CAMERA = { position: [0, 18, 96] as [number, number, number], fov: 38, far: 1600 };
export const EKAM_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.14,
  minDistance: 26,
  maxDistance: 200,
  maxPolarAngle: Math.PI / 2 - 0.05,
  target: [0, 8, 0] as [number, number, number],
  enablePan: false,
};

export function EkamLighting() {
  return (
    <>
      <ambientLight intensity={0.08} color="#ffe4b8" />
      <SkyFill sky="#b8cdea" ground="#6b5a44" intensity={0.38} />
      <KeyLight sun={[-0.58, 0.26, 0.77]} intensity={2.1} extent={110} distance={170} color="#ffd6a8" />
    </>
  );
}
