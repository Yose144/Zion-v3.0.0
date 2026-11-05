'use client';

/**
 * TANKY 3D — stejná pravidla (`tanks.ts`) jako oldschool 2D, jiný renderer.
 *
 * Terén je **jedna heightmapa** (`PlaneGeometry`), kterou zásahy přepisují:
 * sim jen sníží výšky, scéna podle `terrain.version` přepíše vrcholy.
 * Kdyby si scéna krátery počítala sama, rozešla by se se simulací.
 *
 * Kamera sleduje střelu — to je celý trik „nové" verze: vidíš dráhu,
 * ne jen výsledek.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { XRStore } from '@react-three/xr';
import { XR } from '@react-three/xr';
import * as THREE from 'three';
import { TanksXr } from './TanksXr';
import {
  BLAST_R,
  TANK_H,
  TANK_W,
  TERRAIN_COLS,
  WORLD_W,
  tankCenter,
  terrainAt,
  type TanksState,
} from './tanks';
import { canvasDpr } from '@/core/design/dpr';

/**
 * Hřiště je 2D (1000 × 0), takže se profil vytáhne do strany. Deska je
 * **větší než hřiště** — okraje by jinak byly vidět jako hrana prkna.
 */
const DEPTH = 1500;
const PLATE_W = WORLD_W * 1.7;

function Terrain({ state }: { state: React.MutableRefObject<TanksState> }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PLATE_W, DEPTH, 190, 24);
    geo.rotateX(-Math.PI / 2);
    // barva ve vrcholech: níž = tmavší písek, výš = světlejší hřeben.
    // Bez toho je velká plocha jednolitá a hloubka se nedá číst.
    const colors = new Float32Array(geo.getAttribute('position').count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // PlaneGeometry je centrovaná na počátek, ale svět tanků je 0..WORLD_W —
    // bez posunu stál terén půl mapy vlevo a tanky pluly ve prázdnu.
    geo.translate(WORLD_W / 2, 0, 0);
    return geo;
  }, []);
  const version = useRef(-1);

  useFrame(() => {
    const terrain = state.current.terrain;
    if (terrain.version === version.current) return;
    version.current = terrain.version;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = geometry.getAttribute('color') as THREE.BufferAttribute;
    const low = new THREE.Color('#6b3f1d');
    const high = new THREE.Color('#e0a356');
    const mix = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      // vrcholy už jsou posunuté do světa, takže výšku bereme přímo z `x`
      const height = terrainAt(terrain, position.getX(i));
      position.setY(i, height);
      const t = Math.min(1, Math.max(0, (height - 60) / 320));
      mix.copy(low).lerp(high, t);
      color.setXYZ(i, mix.r, mix.g, mix.b);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.05} />
    </mesh>
  );
}

function TankModel({
  state,
  side,
}: {
  state: React.MutableRefObject<TanksState>;
  side: 'player' | 'bot';
}) {
  const group = useRef<THREE.Group>(null);
  const barrel = useRef<THREE.Group>(null);
  const body = side === 'player' ? '#4fd6c4' : '#e0603d';
  const dark = side === 'player' ? '#1f5f58' : '#7a2b18';

  useFrame(() => {
    const tank = side === 'player' ? state.current.player : state.current.bot;
    const node = group.current;
    if (!node) return;
    node.visible = tank.alive;
    const h = terrainAt(state.current.terrain, tank.x);
    node.position.set(tank.x, h, 0);
    node.rotation.y = side === 'player' ? 0 : Math.PI;
    if (barrel.current) {
      barrel.current.rotation.z = (tank.angle * Math.PI) / 180;
    }
  });

  return (
    <group ref={group}>
      {/* pásy */}
      <mesh position={[0, 5, TANK_W / 2 - 4]} castShadow>
        <boxGeometry args={[TANK_W, 10, 8]} />
        <meshStandardMaterial color={dark} roughness={0.9} />
      </mesh>
      <mesh position={[0, 5, -TANK_W / 2 + 4]} castShadow>
        <boxGeometry args={[TANK_W, 10, 8]} />
        <meshStandardMaterial color={dark} roughness={0.9} />
      </mesh>
      {/* korba */}
      <mesh position={[0, TANK_H / 2 + 2, 0]} castShadow>
        <boxGeometry args={[TANK_W * 0.86, TANK_H * 0.8, TANK_W * 0.9]} />
        <meshStandardMaterial color={body} roughness={0.55} metalness={0.25} />
      </mesh>
      {/* věž + hlaveň (hlaveň je dítě věže, takže se s ní natáčí) */}
      <group ref={barrel} position={[0, TANK_H / 2 + 8, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[9, 11, 10, 16]} />
          <meshStandardMaterial color={body} roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[18, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[3.2, 3.2, 30, 12]} />
          <meshStandardMaterial color={dark} roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Shot({ state }: { state: React.MutableRefObject<TanksState> }) {
  const ball = useRef<THREE.Mesh>(null);
  /**
   * Stopa je `THREE.Line`, ne JSX `<line>` — to koliduje s SVG elementem
   * a v R3F se typově rozbije (`Ref<SVGLineElement>`).
   */
  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
    const material = new THREE.LineBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.5 });
    return new THREE.Line(geometry, material);
  }, []);

  useFrame(() => {
    const shot = state.current.shot;
    if (ball.current) {
      ball.current.visible = Boolean(shot);
      if (shot) ball.current.position.set(shot.x, shot.y, 0);
    }
    trail.visible = Boolean(shot);
    if (!shot) return;
    const attribute = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const points = shot.trail;
    const total = points.length / 2;
    const count = Math.min(160, total);
    for (let i = 0; i < count; i += 1) {
      const at = (total - count + i) * 2;
      attribute.setXYZ(i, points[at]!, points[at + 1]!, 0);
    }
    attribute.needsUpdate = true;
    trail.geometry.setDrawRange(0, count);
  });

  return (
    <>
      <mesh ref={ball}>
        <sphereGeometry args={[5, 12, 12]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
      <primitive object={trail} />
    </>
  );
}

function Blasts({ state }: { state: React.MutableRefObject<TanksState> }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const blasts = state.current.explosions;
    node.children.forEach((child, index) => {
      const blast = blasts[index];
      if (!blast) {
        child.visible = false;
        return;
      }
      child.visible = true;
      const p = Math.min(1, blast.age / 0.9);
      child.position.set(blast.x, blast.y, 0);
      const scale = 0.4 + p * 1.5;
      child.scale.setScalar(scale);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.8 - p * 0.8);
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: 4 }, (_, index) => (
        // ohnivá koule, ne prstenec na zemi — ten vypadal jako talíř
        <mesh key={index} visible={false}>
          <sphereGeometry args={[BLAST_R * 0.55, 16, 12]} />
          <meshBasicMaterial
            color="#ffb861"
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Kamera: při letu sleduje střelu, jinak drží oba tanky v záběru. */
function CameraRig({ state }: { state: React.MutableRefObject<TanksState> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(WORLD_W / 2, 140, 0));

  useFrame((_, delta) => {
    const current = state.current;
    const focus = current.shot
      ? new THREE.Vector3(current.shot.x, current.shot.y, 0)
      : new THREE.Vector3(
          (tankCenter(current.terrain, current.player).x + tankCenter(current.terrain, current.bot).x) / 2,
          140,
          0,
        );
    const damp = 1 - Math.exp(-3.2 * Math.min(delta, 0.05));
    target.current.lerp(focus, damp);
    // overview musí pojmout celé hřiště (1000 jednotek na šířku),
    // při letu se kamera přiblíží, aby byla střela vidět
    const close = Boolean(current.shot);
    const desired = new THREE.Vector3(
      target.current.x,
      target.current.y + (close ? 230 : 640),
      target.current.z + (close ? 480 : 980),
    );
    camera.position.lerp(desired, damp);
    camera.lookAt(target.current);
  });

  return null;
}

function SaturnSky() {
  return (
    <>
      <color attach="background" args={['#0a0713']} />
      {/* mlha schová okraj heightmapy — za ním už je jen vesmír */}
      <fog attach="fog" args={['#1b1224', 1000, 2100]} />
    </>
  );
}

export function TanksScene({
  state,
  xrStore,
  xr = false,
}: {
  state: React.MutableRefObject<TanksState>;
  /** XR store z `TanksGame` — `<XR>` musí být uvnitř plátna, ale store patří ven. */
  xrStore?: XRStore;
  xr?: boolean;
}) {
  return (
    <Canvas
      className="tanks-3d"
      camera={{ position: [WORLD_W / 2, 780, 980], fov: 46, far: 6000 }}
      dpr={canvasDpr(1.75)}
      shadows
    >
      {xrStore ? (
        <XR store={xrStore}>
          <TanksWorld state={state} xr={xr} />
        </XR>
      ) : (
        <TanksWorld state={state} />
      )}
    </Canvas>
  );
}

/** Všechno, co je ve scéně — oddělené, aby se dalo obalit `<XR>` bez kopie. */
function TanksWorld({ state, xr = false }: { state: React.MutableRefObject<TanksState>; xr?: boolean }) {
  return (
    <>
      <SaturnSky />
      <ambientLight intensity={0.55} />
      {/* stínová kamera musí pojmout celé hřiště, jinak se do scény propíše
          obdélník frustum (půlka mapy byla tmavá) */}
      <directionalLight
        position={[420, 900, 520]}
        intensity={1.5}
        color="#ffd9a4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-700}
        shadow-camera-right={700}
        shadow-camera-top={700}
        shadow-camera-bottom={-700}
        shadow-camera-near={1}
        shadow-camera-far={2600}
      />
      <directionalLight position={[-400, 260, -240]} intensity={0.35} color="#7f9fff" />
      <Terrain state={state} />
      <TankModel state={state} side="player" />
      <TankModel state={state} side="bot" />
      <Shot state={state} />
      <Blasts state={state} />
      {/* ve VR kameru drží headset — cinematic let za střelou by „letěl hlavou" */}
      {xr ? <TanksXr state={state} active /> : <CameraRig state={state} />}
    </>
  );
}
