/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime } from './ScenePresentation';
import {
  KeyLight,
  SceneWater,
  makeNoise,
  terrainGround,
  SkyFill,
  gold,
  glass,
  grassGround,
  lamp,
  leafCanopy,
  marbleDarkStone,
  marbleMatte,
  marbleWhite,
  stoneWarm,
} from './kit';

type Lang = 'cs' | 'en';

/* ─── Ekam · Oneness Temple — Andhra Pradesh, Indie ───────────────────
 * Reálná stavba (status: built). Dlouhá bílá mramorová síň ve třech
 * patrech arkád, centrální osmiúhelná věž se zlatým kalashem a
 * světelným paprskem Hiranyagarbha, řada shikhara kupolí po střeše,
 * rohové věže, velké schodiště, zrcadlový bazén a geometrické zahrady.
 * Svítání za chrámem — světlo se rodí za věží.
 *
 * Render kit: mramor s žilkami (albedo + normal), zlacení s IBL odleskem,
 * texturovaná zem, instancované stromy a lampy, voda s vlnami, obloha
 * s oparem a post-processing (bloom + AgX).
 */

const rng = (s: number) => {
  const x = Math.sin(s * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const GOLD = '#d9b45c';
const GLASS = '#2e3d4c';

/** arkádové okno — štítek ve tvaru lomeného oblouku */
function archGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0.5, 0.62);
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
            <mesh geometry={ARCH} scale={[w, h, 1]} material={glass()} />
            {/* kamenný rám */}
            <mesh geometry={ARCH} scale={[w + 0.28, h + 0.24, 1]} position={[0, -0.1, -0.02]} material={marbleMatte(1)} />
          </group>
        );
      })}
    </group>
  );
}

/** shikhara — malý pavilon s rebrovanou kupolí a hrotem */
function Shikhara({ x, y, z, s = 1 }: { x: number; y: number; z: number; s?: number }) {
  const dome = React.useMemo(
    () =>
      new THREE.LatheGeometry(
        [[0, 0], [0.58, 0.1], [0.68, 0.42], [0.5, 0.95], [0.2, 1.3], [0.06, 1.5], [0, 1.58]].map(([a, b]) => new THREE.Vector2(a, b)),
        14,
      ),
    [],
  );
  React.useEffect(() => () => dome.dispose(), [dome]);
  return (
    <group position={[x, y, z]} scale={s}>
      <mesh position={[0, 0.25, 0]} castShadow material={marbleDarkStone(1)}>
        <cylinderGeometry args={[0.62, 0.7, 0.5, 8]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow geometry={dome} material={marbleWhite(1)} />
      <mesh position={[0, 2.16, 0]} material={gold(0.3)}>
        <sphereGeometry args={[0.09, 8, 6]} />
      </mesh>
    </group>
  );
}

/** rohová osmiúhelná věž */
function CornerTower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.4, 0]} castShadow material={marbleDarkStone(2)}>
        <cylinderGeometry args={[1.5, 1.75, 6.8, 8]} />
      </mesh>
      {/* balkónové římsy */}
      {[2.2, 4.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={marbleMatte(1)}>
          <cylinderGeometry args={[1.9, 1.9, 0.18, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 7.1, 0]} castShadow material={marbleWhite(1)}>
        <sphereGeometry args={[1.35, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 7.9, 0]} material={gold(0.3)}>
        <coneGeometry args={[0.4, 1.1, 8]} />
      </mesh>
    </group>
  );
}

/** centrální věž — osmiúhelná, stupňovitá, ribbed dome + kalash + beam */
function CentralTower() {
  const beamRef = React.useRef<THREE.Mesh>(null);
  const dome = React.useMemo(
    () =>
      new THREE.LatheGeometry(
        [[0, 0], [2.75, 0.15], [3.0, 0.7], [2.4, 1.9], [1.3, 3.0], [0.5, 3.7], [0.15, 4.15], [0, 4.25]].map(([a, b]) => new THREE.Vector2(a, b)),
        24,
      ),
    [],
  );
  React.useEffect(() => () => dome.dispose(), [dome]);
  useFrame(({ clock }) => {
    const m = beamRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.16 + Math.sin(motionTime(clock) * 1.4) * 0.05;
  });
  return (
    <group position={[0, 0, -1]}>
      {/* stupňovitý základ */}
      <mesh position={[0, 6.6, 0]} castShadow material={marbleDarkStone(2)}>
        <cylinderGeometry args={[3.3, 3.8, 1.2, 8]} />
      </mesh>
      {/* arkádový buben věže */}
      <mesh position={[0, 8.5, 0]} castShadow material={marbleWhite(2)}>
        <cylinderGeometry args={[2.7, 3.0, 2.6, 8]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <group key={i} position={[Math.sin(a) * 2.72, 7.9, Math.cos(a) * 2.72]} rotation={[0, a, 0]}>
            <mesh geometry={ARCH} scale={[0.55, 1.15, 1]} position={[0, 0, 0.02]} material={glass()} />
          </group>
        );
      })}
      {/* ribbed dome */}
      <mesh position={[0, 10.15, 0]} castShadow geometry={dome} material={marbleWhite(2)} />
      {/* zlatý kalash — vrcholový ornament */}
      <mesh position={[0, 14.9, 0]} material={gold(0.24)}>
        <cylinderGeometry args={[0.16, 0.34, 0.9, 8]} />
      </mesh>
      <mesh position={[0, 15.7, 0]} material={gold(0.2)}>
        <sphereGeometry args={[0.42, 14, 10]} />
      </mesh>
      <mesh position={[0, 16.4, 0]} material={gold(0.24)}>
        <coneGeometry args={[0.2, 0.9, 8]} />
      </mesh>
      {/* Hiranyagarbha — světelný paprsek do nebe */}
      <mesh ref={beamRef} position={[0, 46, 0]}>
        <cylinderGeometry args={[0.32, 0.55, 58, 10, 1, true]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight position={[0, 15.8, 0]} intensity={6} color="#ffd98a" distance={26} decay={2} />
    </group>
  );
}

/** hlavní mramorová síň — 3 patra arkád + portikus + schodiště */
function MainHall() {
  return (
    <group>
      {/* spodní patro — plná hmota s arkádami */}
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow material={marbleMatte(4)}>
        <boxGeometry args={[44, 3.4, 15]} />
      </mesh>
      <ArchRow n={17} x={0} y={0.55} z={7.53} w={0.85} h={1.9} gap={2.3} />
      {/* římsa mezi patry */}
      <mesh position={[0, 3.5, 0]} castShadow material={marbleMatte(6)}>
        <boxGeometry args={[45, 0.35, 15.8]} />
      </mesh>
      {/* prostřední patro — arkády + balkon */}
      <mesh position={[0, 4.9, -0.4]} castShadow material={marbleWhite(6)}>
        <boxGeometry args={[38, 2.6, 13]} />
      </mesh>
      <ArchRow n={15} x={0} y={4.1} z={6.15} w={0.7} h={1.7} gap={2.3} />
      <mesh position={[0, 6.35, -0.4]} material={marbleMatte(6)}>
        <boxGeometry args={[39, 0.3, 13.6]} />
      </mesh>
      {/* horní galerie — menší arkády */}
      <mesh position={[0, 7.6, -0.9]} castShadow material={marbleWhite(6)}>
        <boxGeometry args={[30, 2.2, 10.5]} />
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
        <mesh position={[0, 3.9, 0]} castShadow material={marbleMatte(2)}>
          <boxGeometry args={[10.5, 0.5, 3.4]} />
        </mesh>
        {[-4.2, -2.1, 2.1, 4.2].map((x) => (
          <mesh key={x} position={[x, 1.9, 1.1]} castShadow material={marbleWhite(2)}>
            <cylinderGeometry args={[0.22, 0.26, 3.8, 12]} />
          </mesh>
        ))}
        {/* fronton — mělký trojúhelník */}
        <mesh position={[0, 4.45, 0]} scale={[1, 1, 0.5]} material={marbleMatte(1)}>
          <cylinderGeometry args={[0.01, 4.3, 1.05, 3]} />
        </mesh>
        {/* hlavní dveře */}
        <mesh geometry={ARCH} scale={[1.6, 2.9, 1]} position={[0, 0.4, -1.15]} material={glass()} />
      </group>

      {/* velké schodiště */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 3.15 - i * 0.34, 10.4 + i * 0.62]} receiveShadow castShadow material={marbleMatte(2)}>
          <boxGeometry args={[11 - i * 0.28, 0.34, 0.62]} />
        </mesh>
      ))}
      {/* terasa kolem soklu */}
      <mesh position={[0, 0.08, 2]} receiveShadow material={marbleMatte(6)}>
        <boxGeometry args={[52, 0.25, 26]} />
      </mesh>
    </group>
  );
}

/** zrcadlový bazén + fontána */
function ReflectingPool() {
  return (
    <group>
      {/* tmavé dno bazénu — hloubka pod hladinou */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 24]}>
        <planeGeometry args={[9, 26]} />
        <meshStandardMaterial color="#0a2126" roughness={0.9} />
      </mesh>
      {/* dlouhý bazén před chrámem */}
      <SceneWater width={9} depth={26} position={[0, 0.06, 24]} tint="#0a2f38" repeat={2} speed={0.8} sun={[-0.36, 0.32, -0.87]} sky="#e8c9a0" />
      {/* kamenný lem */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4.85, 0.16, 24]} material={marbleMatte(4)}>
          <boxGeometry args={[0.7, 0.35, 26.6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 37.4]} material={marbleMatte(2)}>
        <boxGeometry args={[10.4, 0.35, 0.7]} />
      </mesh>
      {/* 3 fontánové trysky */}
      {[-2.8, 0, 2.8].map((x, i) => (
        <group key={i} position={[x, 0.1, 24]}>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.09, 1.0, 6]} />
            <meshBasicMaterial color="#cfe8f0" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.65, 14]} />
            <meshBasicMaterial color="#cfe8f0" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Jedna instancovaná vrstva korun stromů — 60 stromů = 1 draw call. */
function CanopyLayer({ items, y, scale, tone }: { items: { x: number; z: number; s: number; y: number }[]; y: number; scale: number; tone: number }) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  const geometry = React.useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    const color = new THREE.Color();
    items.forEach((item, i) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.s * 7.3 + i);
      position.set(item.x, item.y + y * item.s, item.z);
      size.set(scale * item.s * (0.9 + (i % 3) * 0.12), scale * item.s * 0.62, scale * item.s * (0.95 + (i % 4) * 0.07));
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(i, matrix);
      color.setHSL(0.245 + tone * 0.012 + (i % 5) * 0.005, 0.3, 0.3 + (i % 4) * 0.04);
      node.setColorAt(i, color);
    });
    node.instanceMatrix.needsUpdate = true;
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [items, y, scale, tone]);
  return <instancedMesh ref={mesh} args={[geometry, leafCanopy('leaf'), items.length]} frustumCulled={false} castShadow receiveShadow />;
}

/** Stromy: kmeny + tři vrstvy korun, vše instancované. */
function Trees({ items }: { items: { x: number; z: number; s: number; y: number }[] }) {
  const trunks = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const node = trunks.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    items.forEach((item, i) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.s * 5 + i);
      position.set(item.x, item.y + item.s, item.z);
      size.set(item.s * 0.9, item.s, item.s * 0.9);
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(i, matrix);
    });
    node.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, items.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 2, 6]} />
        <meshStandardMaterial color="#6a5238" roughness={0.92} />
      </instancedMesh>
      <CanopyLayer items={items} y={1.95} scale={1.5} tone={0} />
      <CanopyLayer items={items} y={2.7} scale={1.05} tone={1} />
      <CanopyLayer items={items} y={2.3} scale={1.2} tone={2} />
    </group>
  );
}


/** Height of the surrounding meadow; flat under the temple, rolling further out. */
const ekamNoise = makeNoise(17);
function ekamGround(x: number, z: number): number {
  const distance = Math.hypot(x, z - 6);
  const outside = THREE.MathUtils.smoothstep(distance, 62, 190);
  if (outside <= 0) return 0;
  const rolling = (ekamNoise.fbm(x * 0.006, z * 0.006, 4) - 0.5) * 34 + (ekamNoise.fbm(x * 0.02, z * 0.02, 3) - 0.5) * 6;
  return outside * rolling;
}

/** Large displaced meadow with per-vertex colour so the grass texture never tiles visibly. */
function Terrain() {
  const geometry = React.useMemo(() => {
    const geometry = new THREE.PlaneGeometry(900, 900, 168, 168);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position');
    const colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i) + 6;
      const y = ekamGround(x, z - 6);
      position.setY(i, y);
      const dry = ekamNoise.fbm(x * 0.03 + 5, z * 0.03 + 2, 3);
      color.setHSL(0.235 + dry * 0.035, 0.24 + dry * 0.12, THREE.MathUtils.clamp(0.3 + dry * 0.12 + y * 0.002, 0.2, 0.5));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[0, -0.06, 6]} receiveShadow material={terrainGround(220)} />;
}

/** geometrické zahrady — aleje, živé ploty, lampy */
function Gardens() {
  const distant = React.useMemo(() => {
    const arr: { x: number; z: number; s: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const a = rng(i + 5) * Math.PI * 2;
      const r = 46 + rng(i + 17) * 90;
      const x = Math.sin(a) * r * 1.25;
      const z = Math.cos(a) * r;
      arr.push({ x, z, y: ekamGround(x, z - 6), s: 1 + rng(i + 9) * 1.4 });
    }
    return arr;
  }, []);
  const avenue = React.useMemo(
    () => [-8, 8].flatMap((x) => [15, 20.5, 26, 31.5, 37].map((z) => ({ x, z, y: 0, s: 0.62 }))),
    [],
  );
  const hedges = React.useMemo(() => [[-15, 16.2], [15, 16.2], [-15, 27.8], [15, 27.8], [-15, 39], [15, 39]], []);
  const lamps = React.useMemo(() => [-6.4, 6.4].flatMap((x) => Array.from({ length: 6 }, (_, i) => ({ x, z: 14 + i * 5.5 }))), []);
  const hedgeRef = React.useRef<THREE.InstancedMesh>(null);
  const postRef = React.useRef<THREE.InstancedMesh>(null);
  const globeRef = React.useRef<THREE.InstancedMesh>(null);

  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    const identity = new THREE.Quaternion();
    if (hedgeRef.current) {
      hedges.forEach(([x, z], i) => {
        position.set(x, 0.45, z);
        size.set(15.4, 0.9, 0.55);
        matrix.compose(position, identity, size);
        hedgeRef.current!.setMatrixAt(i, matrix);
      });
      hedgeRef.current.instanceMatrix.needsUpdate = true;
    }
    if (postRef.current && globeRef.current) {
      lamps.forEach((item, i) => {
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
        position.set(item.x, 1.4, item.z);
        size.set(1, 1, 1);
        matrix.compose(position, quaternion, size);
        postRef.current!.setMatrixAt(i, matrix);
        position.set(item.x, 2.9, item.z);
        matrix.compose(position, quaternion, size);
        globeRef.current!.setMatrixAt(i, matrix);
      });
      postRef.current.instanceMatrix.needsUpdate = true;
      globeRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [hedges, lamps]);

  return (
    <group>
      <Terrain />
      {/* živé ploty */}
      <instancedMesh ref={hedgeRef} args={[undefined, undefined, hedges.length]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#415c2f" roughness={0.92} />
      </instancedMesh>
      {/* alejové a vzdálené stromy */}
      <Trees items={avenue} />
      <Trees items={distant} />
      {/* lampy podél cest */}
      <instancedMesh ref={postRef} args={[undefined, undefined, lamps.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.09, 2.8, 6]} />
        <meshStandardMaterial color="#332e24" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={globeRef} args={[undefined, undefined, lamps.length]} frustumCulled={false} material={lamp('#ffca7a', 3.2)}>
        <sphereGeometry args={[0.24, 10, 8]} />
      </instancedMesh>
    </group>
  );
}

export function EkamScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation
        camera={EKAM_CAMERA}
        target={EKAM_CONTROLS.target}
        atmosphere={{
          sun: [-0.36, 0.32, -0.87],
          zenith: '#2c4670',
          horizon: '#f5c78d',
          ground: '#4a4032',
          sunColor: '#ffd9a4',
          sunSharpness: 300,
          clouds: 0.55,
          stars: 0,
          fog: '#d8ac82',
          fogDensity: 0.0015,
          envIntensity: 0.95,
        }}
        post={{ bloom: 0.34, threshold: 0.9, exposure: 1.02, vignette: 0.5 }}
        intro={{ duration: 3.6 }}
      />
      <EkamLighting />

      <MainHall />
      <CentralTower />
      <CornerTower x={-23.5} z={-5.5} />
      <CornerTower x={23.5} z={-5.5} />
      <CornerTower x={-23.5} z={5.5} />
      <CornerTower x={23.5} z={5.5} />
      <ReflectingPool />
      <Gardens />

      {/* labely */}
      <SceneLabel position={[0, 19.5, -1]} text="Ekam · Oneness Temple" scale={2.2} />
      <SceneLabel position={[0, 12.2, 0]} text={cs ? 'Hiranyagarbha — zlatý zárodek' : 'Hiranyagarbha — golden womb'} scale={1.8} />
      <SceneLabel position={[0, 2.6, 24]} text={cs ? 'Zrcadlový bazén' : 'Reflecting pool'} scale={1.7} />
      <SceneLabel position={[-23.5, 9.6, -5.5]} text={cs ? 'Rohové věže' : 'Corner towers'} scale={1.6} />
      <SceneLabel position={[0, 3.4, -50]} text={cs ? 'Mystikovo pole' : "Mystic's Field"} scale={1.9} />
    </>
  );
}

export const EKAM_CAMERA = { position: [0, 13.5, 54] as [number, number, number], fov: 40, far: 1200 };
export const EKAM_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 18, maxDistance: 140, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 7, -2] as [number, number, number], enablePan: false };

export function EkamLighting() {
  return (
    <>
      <ambientLight intensity={0.12} color="#ffe4b8" />
      <SkyFill sky="#b8cdea" ground="#6b5a44" intensity={0.5} />
      <KeyLight sun={[-0.36, 0.32, -0.87]} intensity={3.2} extent={80} distance={130} color="#ffd2a1" />
    </>
  );
}
