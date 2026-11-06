/** @jsxRuntime classic */
'use client';

import { React, useEffect, useFrame, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime } from './ScenePresentation';
import { KeyLight, SkyFill } from './kit';
import { AtlanticOcean } from './CoastalLandscape';

/**
 * Království srdce · Nirvana — the Ark (thirteenth L5 node).
 *
 * Concept board B3: an ~85 m steel sailing colony inspired by the humpback,
 * built for a hundred people afloat — four deck levels (technical holds,
 * accommodation, common life, bridge + glasshouse + solar roof), three gaff
 * masts, and the whales it follows. Nothing here is a production plan: the
 * scene renders the study, not a ship that exists.
 *
 * Only `three` + the app runtime can be imported from this directory — the
 * scene is compiled into both the website and Nirvana.
 */

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';
type Point = [number, number, number];

const HULL_LENGTH = 21;
const HULL_BEAM = 3.6;
const DECK_Y = 1.42;

/** Cream sailcloth with a faint panel seam — the solar skin reads as fabric, not as glass. */
function useSailcloth() {
  const [texture] = React.useState(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2e9d4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d9cbab';
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= 256; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8fa3b0';
    ctx.globalAlpha = 0.28;
    for (let i = 0; i <= 256; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function hullWidthAt(t: number) {
  // Fine entry at the bow, full midship body, a transom that still carries the
  // shelter deck — the 6:1 proportion the stability studies keep asking for.
  return HULL_BEAM * (0.12 + 0.88 * Math.pow(Math.sin(Math.PI * t), 0.6)) * (1 - 0.08 * t);
}

function hullSheer(t: number) {
  return DECK_Y + 0.34 * Math.pow(Math.abs(t - 0.5) * 2, 3);
}

/** Steel hull with the double bottom implied by the belt line. */
function Hull() {
  const { shell, deck, belt } = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const deckVertices: number[] = [];
    const deckIndices: number[] = [];
    const sections = 44;
    const arcs = 18;
    for (let j = 0; j <= sections; j++) {
      const t = j / sections;
      const z = -HULL_LENGTH / 2 + t * HULL_LENGTH;
      const w = hullWidthAt(t);
      const depth = 0.95 + Math.sin(t * Math.PI) * 0.55;
      for (let i = 0; i <= arcs; i++) {
        const a = (i / arcs) * Math.PI;
        vertices.push(Math.cos(a) * w, hullSheer(t) - Math.sin(a) * depth, z);
        if (j < sections && i < arcs) {
          const k = j * (arcs + 1) + i;
          indices.push(k, k + 1, k + arcs + 1, k + 1, k + arcs + 2, k + arcs + 1);
        }
      }
      deckVertices.push(-w, hullSheer(t) + 0.01, z, w, hullSheer(t) + 0.01, z);
      if (j < sections) {
        const k = j * 2;
        deckIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const shellGeometry = new THREE.BufferGeometry();
    shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shellGeometry.setIndex(indices);
    shellGeometry.computeVertexNormals();
    const deckGeometry = new THREE.BufferGeometry();
    deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(deckVertices, 3));
    deckGeometry.setIndex(deckIndices);
    deckGeometry.computeVertexNormals();
    const beltPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      beltPoints.push(new THREE.Vector3(hullWidthAt(t) * 0.985, DECK_Y - 0.16, -HULL_LENGTH / 2 + t * HULL_LENGTH));
    }
    return { shell: shellGeometry, deck: deckGeometry, belt: beltPoints };
  }, []);

  useEffect(
    () => () => {
      shell.dispose();
      deck.dispose();
    },
    [shell, deck],
  );

  const beltCurves = useMemo(
    () => [1, -1].map((side) => new THREE.CatmullRomCurve3(belt.map((p) => new THREE.Vector3(p.x * side, p.y, p.z)), false)),
    [belt],
  );

  return (
    <>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial color="#16324a" roughness={0.42} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={deck} receiveShadow>
        <meshStandardMaterial color="#7c6142" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {beltCurves.map((curve, i) => (
        <mesh key={i}>
          <tubeGeometry args={[curve, 80, 0.022, 4, false]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </>
  );
}

/** Warm cabin windows — one instanced draw call for the whole ship. */
function Windows({ rows }: { rows: { y: number; z: number; width: number; half: number; count: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count * 2, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const z = row.z - row.width / 2 + ((i + 0.5) / row.count) * row.width;
        for (const side of [-1, 1]) {
          dummy.position.set(side * row.half, row.y, z);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.current.setMatrixAt(index++, dummy.matrix);
        }
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [rows]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, total]} frustumCulled={false}>
      <boxGeometry args={[0.03, 0.16, 0.22]} />
      <meshStandardMaterial color="#ffd08a" emissive="#ff9f43" emissiveIntensity={1.05} roughness={0.4} />
    </instancedMesh>
  );
}

function DeckBlock({
  y,
  width,
  depth,
  height,
  color,
  inset = 0,
}: {
  y: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  inset?: number;
}) {
  return (
    <mesh position={[0, y, inset]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

/** Solar skin on the shelter deck — the ship's roof is its power plant. */
function SolarRoof({ y, width, depth }: { y: number; width: number; depth: number }) {
  const panels = 6;
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: panels }).map((_, i) => {
        const z = -depth / 2 + ((i + 0.5) / panels) * depth;
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width * 0.92, (depth / panels) * 0.78]} />
            <meshStandardMaterial color="#16324f" metalness={0.6} roughness={0.28} emissive="#0d2237" emissiveIntensity={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function Spar({ a, b, radius = 0.05, color = '#8d6a42' }: { a: Point; b: Point; radius?: number; color?: string }) {
  const { center, rotation, length } = useMemo(() => {
    const from = new THREE.Vector3(...a);
    const to = new THREE.Vector3(...b);
    const dir = to.clone().sub(from);
    return {
      center: from.clone().add(to).multiplyScalar(0.5),
      rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [a[0], a[1], a[2], b[0], b[1], b[2]]);
  return (
    <mesh position={center} quaternion={rotation} castShadow>
      <cylinderGeometry args={[radius * 0.7, radius, length, 6]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

/** Gaff sail: bellying cloth between the mast and the boom. */
function Sail({ z, height, width, tex, y = 0, jib = false }: { z: number; height: number; width: number; tex: THREE.Texture | null; y?: number; jib?: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 12, 14);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const taper = jib ? 1 - v * 0.9 : 1 - 0.22 * v;
      // Geometry is local to the mast: the group below carries the z position,
      // so trimming the sail can never slide it away from its spar.
      pos.setXYZ(
        i,
        0.04 + 0.3 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
        y + v * height,
        (jib ? 1 : -1) * u * width * taper,
      );
    }
    g.computeVertexNormals();
    return g;
  }, [height, width, y, jib]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[0, 0, z]} rotation={[0, jib ? -0.55 : 0.82, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial map={tex} color="#f0e3c6" side={THREE.DoubleSide} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Hull, decks, rig — the whole vessel, ~21 units long (≈85 m at 1 unit ≈ 4 m). */
function Ark({ tex, reduced }: { tex: THREE.Texture | null; reduced: React.RefObject<boolean> }) {
  const body = useRef<THREE.Group>(null);
  const rows = useMemo(
    () => [
      { y: DECK_Y + 0.42, z: -0.2, width: 11.4, half: 1.31, count: 8 },
      { y: DECK_Y + 1.16, z: -0.5, width: 8.6, half: 1.11, count: 7 },
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (!body.current) return;
    const t = reduced.current ? 0 : motionTime(clock);
    body.current.position.y = reduced.current ? 0 : Math.sin(t * 0.42) * 0.07;
    body.current.rotation.z = reduced.current ? 0 : Math.sin(t * 0.31) * 0.012;
    body.current.rotation.x = reduced.current ? 0 : Math.sin(t * 0.27 + 1.1) * 0.006;
  });

  return (
    <group ref={body}>
      <Hull />

      {/* deck 1 — accommodation (family cabins, doubles, laundry) */}
      <DeckBlock y={DECK_Y + 0.4} width={2.62} depth={14.2} height={0.74} color="#dccdb0" />
      {/* deck 2 — common life (dining, kitchen, library, infirmary, workshops) */}
      <DeckBlock y={DECK_Y + 1.14} width={2.22} depth={11.4} height={0.72} color="#e7dcc4" />
      {/* deck 3 — bridge, terrace, glasshouse */}
      <DeckBlock y={DECK_Y + 1.86} width={1.72} depth={8.0} height={0.68} color="#f0e7d7" />

      {/* bridge with the wrap-around windows */}
      <group position={[0, DECK_Y + 2.49, 2.6]}>
        <mesh castShadow>
          <boxGeometry args={[1.46, 0.52, 1.24]} />
          <meshStandardMaterial color="#f7f0dd" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0.63]}>
          <boxGeometry args={[1.36, 0.32, 0.02]} />
          <meshStandardMaterial color="#1d4a63" metalness={0.4} roughness={0.18} />
        </mesh>
      </group>

      {/* glasshouse — the farm deck everyone sees from the water */}
      <group position={[0, DECK_Y + 2.42, -1.6]}>
        <mesh>
          <boxGeometry args={[1.6, 0.62, 3.6]} />
          <meshStandardMaterial color="#bfe0d2" transparent opacity={0.34} roughness={0.08} metalness={0.1} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.81, 0, 0]}>
            <boxGeometry args={[0.03, 0.66, 3.6]} />
            <meshStandardMaterial color="#8b9a92" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i} position={[0, 0.33, -1.5 + i * 1.0]}>
            <boxGeometry args={[1.62, 0.04, 0.04]} />
            <meshStandardMaterial color="#8b9a92" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>

      <SolarRoof y={DECK_Y + 2.76} width={1.66} depth={3.2} />
      <Windows rows={rows} />

      {/* rig — three gaff masts, sails set */}
      {[
        { z: 4.2, h: 6.6, w: 2.5 },
        { z: 0.4, h: 7.8, w: 2.9 },
        { z: -3.4, h: 6.2, w: 2.4 },
      ].map((mast, i) => (
        <group key={i}>
          <Spar a={[0, DECK_Y + 0.1, mast.z]} b={[0, DECK_Y + mast.h, mast.z]} radius={0.075} />
          <Spar a={[0.02, DECK_Y + mast.h - 0.6, mast.z]} b={[0.02, DECK_Y + mast.h - 0.6, mast.z - mast.w]} radius={0.045} />
          <Spar a={[0, DECK_Y + 1.1, mast.z]} b={[0, DECK_Y + 1.1, mast.z - mast.w * 0.92]} radius={0.04} />
          <Spar a={[0, DECK_Y + mast.h - 1.0, mast.z]} b={[0, DECK_Y + mast.h - 1.35, mast.z - mast.w * 0.95]} radius={0.03} />
          <Sail z={mast.z} height={mast.h - 1.7} width={mast.w * 0.92} tex={tex} y={DECK_Y + 1.15} />
          {[-1, 1].map((side) => (
            <Spar
              key={side}
              a={[0, DECK_Y + mast.h - 1.2, mast.z]}
              b={[side * 1.5, DECK_Y + 1.15, mast.z - 1.4]}
              radius={0.008}
              color="#c2b79c"
            />
          ))}
        </group>
      ))}
      {/* bowsprit + a single staysail forward of the foremast */}
      <Spar a={[0, DECK_Y + 0.35, HULL_LENGTH / 2 - 0.4]} b={[0, DECK_Y + 0.95, HULL_LENGTH / 2 + 2.4]} radius={0.055} />
      <Sail z={HULL_LENGTH / 2 - 0.4} height={3.4} width={2.9} tex={tex} y={DECK_Y + 0.9} jib />

      {/* stern lantern and the name on the transom */}
      <mesh position={[0, DECK_Y + 0.85, -HULL_LENGTH / 2 + 0.55]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#ffdca6" emissive="#ffb347" emissiveIntensity={1.6} />
      </mesh>

      <SceneLabel position={[0, DECK_Y + 10.4, 0]} text="Nirvana · Království srdce" scale={1.5} />
    </group>
  );
}

/** Humpback silhouette — the reason the route exists. */
function Whale({
  position,
  scale = 1,
  yaw = 0,
  phase = 0,
  breach = false,
}: {
  position: Point;
  scale?: number;
  yaw?: number;
  phase?: number;
  breach?: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const base = position[1];
    if (breach) {
      // A slow breach: the body rolls up, then settles back under the surface.
      const cycle = (Math.sin(t * 0.16 + phase) + 1) / 2;
      group.current.position.y = base + cycle * 2.1;
      group.current.rotation.x = -0.5 + cycle * 1.35;
    } else {
      group.current.position.y = base + Math.sin(t * 0.5 + phase) * 0.09;
      group.current.rotation.x = Math.sin(t * 0.4 + phase) * 0.07;
    }
  });

  return (
    <group ref={group} position={position} rotation={[0, yaw, 0]} scale={scale}>
      {/* body */}
      <mesh castShadow scale={[2.4, 0.72, 0.86]}>
        <sphereGeometry args={[0.62, 18, 12]} />
        <meshStandardMaterial color="#31536b" roughness={0.5} metalness={0.06} />
      </mesh>
      {/* head / rostrum */}
      <mesh position={[1.42, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.32, 0.9, 12]} />
        <meshStandardMaterial color="#2b4a60" roughness={0.6} />
      </mesh>
      {/* tail flukes */}
      <group position={[-1.5, 0.02, 0]}>
        <mesh rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.86, 0.045, 0.4]} />
          <meshStandardMaterial color="#26414f" roughness={0.6} />
        </mesh>
        <mesh rotation={[0, -0.35, 0]}>
          <boxGeometry args={[0.86, 0.045, 0.4]} />
          <meshStandardMaterial color="#26414f" roughness={0.6} />
        </mesh>
      </group>
      {/* pectoral fins (the long humpback arms) */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.35, -0.18, side * 0.5]} rotation={[side * 0.4, 0, -0.35]}>
          <boxGeometry args={[0.9, 0.05, 0.16]} />
          <meshStandardMaterial color="#2b4a60" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Blow — a thin additive cone that fades as it rises. */
function Blow({ position, phase }: { position: Point; phase: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const cycle = (Math.sin(t * 0.34 + phase) + 1) / 2;
    if (mesh.current) {
      mesh.current.scale.set(0.5 + cycle * 0.5, cycle * 1.5, 0.5 + cycle * 0.5);
      mesh.current.position.y = position[1] + cycle * 0.55;
    }
    if (material.current) material.current.opacity = Math.max(0, cycle - 0.35) * 0.5;
  });
  return (
    <mesh ref={mesh} position={position}>
      <coneGeometry args={[0.16, 0.9, 8, 1, true]} />
      <meshBasicMaterial ref={material} color="#eaf4ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
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
          top: { value: new THREE.Color('#1d3550') },
          low: { value: new THREE.Color('#f0c39a') },
        },
        vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 low; void main(){
        vec3 d=normalize(p);vec3 c=mix(low,top,smoothstep(-.05,.72,d.y));
        float s=max(dot(d,normalize(vec3(-.62,.08,-.78))),0.);
        c+=vec3(1.,.72,.38)*pow(s,1500.)*1.7+vec3(.42,.22,.1)*pow(s,26.);
        gl_FragColor=vec4(c,1.);
      }`,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[1800, 24, 16]} />
    </mesh>
  );
}

export function KralovstviSrdceScene({ lang }: { lang: Lang }) {
  const texture = useSailcloth();
  const reduced = useRef(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced.current = query.matches;
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <>
      <ScenePresentation
        camera={ARK_CAMERA}
        target={ARK_CONTROLS.target}
        atmosphere={{
          sun: [-0.62, 0.08, -0.78],
          zenith: '#1b3350',
          horizon: '#f2c69f',
          ground: '#16303f',
          sunColor: '#ffd3a2',
          sunSharpness: 300,
          clouds: 0.32,
          stars: 0.08,
          fog: '#9fb4c4',
          fogDensity: 0.0034,
          envIntensity: 1,
        }}
        post={{ bloom: 0.34, threshold: 0.86, exposure: 1.02, vignette: 0.5 }}
        intro={{ duration: 3.6 }}
      />
      <Sky />
      <AtlanticOcean level={-0.05} coastal={false} roughSea sky="#8fb0c8" deep="#05141f" shallow="#0b3a4d" />
      <Ark tex={texture} reduced={reduced} />
      {/* the pod the ark follows: two cruising, one breaching */}
      <Whale position={[-15.5, -0.15, 7.5]} yaw={0.6} scale={0.95} phase={0.4} />
      <Whale position={[13.5, -0.2, -9.5]} yaw={2.4} scale={0.85} phase={2.1} />
      <Whale position={[6.5, -0.5, 15.5]} yaw={-1.1} scale={1.05} phase={4.0} breach />
      <Blow position={[-15.5, 0.55, 7.5]} phase={0.4} />
      <Blow position={[13.5, 0.5, -9.5]} phase={2.1} />
    </>
  );
}

export const ARK_CAMERA = { position: [25, 8.8, 13] as Point, fov: 45, far: 2200 };
export const ARK_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.14,
  minDistance: 16,
  maxDistance: 110,
  maxPolarAngle: Math.PI / 2 - 0.06,
  target: [0, 5.6, 0] as Point,
  enablePan: false,
};

export function ArkLighting() {
  return (
    <>
      <ambientLight intensity={0.2} color="#eaf1f8" />
      <SkyFill sky="#cfe0ef" ground="#1d3442" intensity={0.52} />
      <KeyLight sun={[-0.62, 0.08, -0.78]} intensity={2.8} extent={60} distance={110} color="#ffd3a2" />
    </>
  );
}
