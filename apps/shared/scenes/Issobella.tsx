/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';
import { KeyLight, SkyFill } from './kit';

/**
 * Jazyky scény. `es` přidává aplikace (L-10) — scéna sama španělský text nemá,
 * takže se chová jako `en` (`cs` je false). Když scéna dostane vlastní ES text,
 * patří sem stejně jako cs/en.
 */
type Lang = 'cs' | 'en' | 'es';

/* ─── ISSOBELLA — orbitální observatoř · L6 ──────────────────────────────
 *
 * Stanice na prstenci Nové Země: kruhová pozorovatelna, ze které je vidět
 * planeta pod sebou a hvězdy za sklem. Uvnitř je **šatník** — kruh výklenků,
 * z nichž každý drží jedno z OASIS postav; klik na výklenek vybere avatara.
 *
 * Proč zrovna tohle: Issobella je v kánonu „orbitální věda“ a v nirvaně už
 * existuje jako stanice na prstenci. Šatník patří sem, protože výběr avatara
 * je akt identity — a ten se v tomto světě dělá v tichu nad planetou.
 *
 * Technicky: jen `three` + `@genesis/runtime` (žádné drei, žádné addons),
 * animace přes `motionTime`/`motionDelta`, labely přes `SceneLabel`
 * (každý = vlastní CanvasTexture — držet jich málo).
 */

export interface IssobellaAvatar {
  id: number;
  name: string;
  color: string;
}

const ISSOBELLA_CAMERA = {
  position: [0, 6.2, 19] as [number, number, number],
  fov: 46,
  far: 400,
};

const ISSOBELLA_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.12,
  minDistance: 6,
  maxDistance: 42,
  maxPolarAngle: Math.PI / 2 - 0.06,
  target: [0, 1.6, 0] as [number, number, number],
  enablePan: false,
};

const FLOOR_R = 13;
const RING_R = 13.6;
const URN_R = 7.6;
const URN_COUNT = 12;

/** Hvězdné pole — jedna instancovaná vrstva, ne tisíce meshů. */
function Stars() {
  const geometry = React.useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // rovnoměrně na kouli o poloměru 90–140
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 50;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(phi) * s * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(phi) * s * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#cfe3ff" size={0.55} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

/** Planeta pod stanicí — Nová Země z orbitu. */
function PlanetBelow() {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = motionTime(clock) * 0.02;
  });
  return (
    <group position={[0, -14, -38]}>
      <mesh ref={ref}>
        <sphereGeometry args={[22, 48, 48]} />
        <meshStandardMaterial color="#2a6fb0" roughness={0.75} metalness={0.05} emissive="#0a2340" emissiveIntensity={0.35} />
      </mesh>
      {/* atmosféra */}
      <mesh scale={1.04}>
        <sphereGeometry args={[22, 32, 32]} />
        <meshBasicMaterial color="#7fe3d4" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Kruhová podlaha se zlatými vlysy. */
function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FLOOR_R, 96]} />
        <meshStandardMaterial color="#161226" roughness={0.62} metalness={0.35} />
      </mesh>
      {[0.32, 0.55, 0.78].map((ratio) => (
        <mesh key={ratio} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[FLOOR_R * ratio, FLOOR_R * ratio + 0.06, 96]} />
          <meshBasicMaterial color="#e8b23a" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      ))}
      {/* vnější obrubou prosklený prstenec stanice */}
      <mesh position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_R, 0.22, 10, 96]} />
        <meshStandardMaterial color="#3a4a63" metalness={0.7} roughness={0.3} emissive="#0d1a2b" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_R - 1.1, 0.05, 8, 96]} />
        <meshBasicMaterial color="#7fe3d4" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* sloupky spojující podlahu s prstencem */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * RING_R, 1.2, Math.sin(a) * RING_R]}>
            <boxGeometry args={[0.16, 2.4, 0.16]} />
            <meshStandardMaterial color="#2c3348" metalness={0.6} roughness={0.42} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Ústřední podstavec — místo, kde stojí vybraný avatar. */
function Pedestal({ color }: { color: string }) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = motionTime(clock) * 0.18;
    const pulse = 1 + Math.sin(motionTime(clock) * 1.4) * 0.03;
    ref.current.scale.setScalar(pulse);
  });
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[1.8, 2.0, 0.32, 40]} />
        <meshStandardMaterial color="#1d1a30" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh ref={ref} position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.35, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* světelný sloup nad podstavcem */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[1.05, 1.25, 2.8, 32, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Jeden výklenek šatníku — drží jedno z OASIS postav. */
function Urn({
  avatar,
  index,
  selected,
  onSelect,
}: {
  avatar: IssobellaAvatar;
  index: number;
  selected: boolean;
  onSelect?: (id: number) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const glow = React.useRef<THREE.Mesh>(null);
  const a = (index / URN_COUNT) * Math.PI * 2;

  useFrame(({ clock }) => {
    if (!glow.current) return;
    const lift = Math.sin(motionTime(clock) * 1.1 + index) * 0.06;
    glow.current.position.y = 1.15 + lift;
  });

  return (
    <group position={[Math.cos(a) * URN_R, 0, Math.sin(a) * URN_R]}>
      {/* podstavec výklenku */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.46, 0.56, 0.56, 20]} />
        <meshStandardMaterial color="#221e38" roughness={0.55} metalness={0.5} />
      </mesh>
      {/* koule s barvou paprsku */}
      <mesh
        ref={glow}
        position={[0, 1.15, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(avatar.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[hover || selected ? 0.34 : 0.29, 20, 16]} />
        <meshBasicMaterial color={avatar.color} toneMapped={false} transparent opacity={selected ? 1 : 0.8} />
      </mesh>
      {/* prstenec kolem vybraného */}
      {selected && (
        <mesh position={[0, 1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.47, 32]} />
          <meshBasicMaterial color={avatar.color} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <SceneLabel text={avatar.name} position={[0, 0.05, 0.75]} scale={0.7} />
    </group>
  );
}

/** Vnitřní prstenec výklenků (šatník). */
function Wardrobe({
  avatars,
  selectedId,
  onSelect,
}: {
  avatars: IssobellaAvatar[];
  selectedId: number | null;
  onSelect?: (id: number) => void;
}) {
  return (
    <group>
      {avatars.slice(0, URN_COUNT).map((avatar, index) => (
        <Urn
          key={avatar.id}
          avatar={avatar}
          index={index}
          selected={selectedId === avatar.id}
          onSelect={onSelect}
        />
      ))}
      <mesh position={[0, 4.6, 0]}>
        <torusGeometry args={[URN_R, 0.05, 8, 96]} />
        <meshBasicMaterial color="#c8a2ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Holografické panely u stěn — jen světlo a linky, žádný text. */
function HoloPanels() {
  const group = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = motionTime(clock) * 0.02;
  });
  return (
    <group ref={group}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.26;
        return (
          <group key={i} position={[Math.cos(a) * (FLOOR_R - 1.2), 2.1, Math.sin(a) * (FLOOR_R - 1.2)]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh>
              <planeGeometry args={[2.6, 1.5]} />
              <meshBasicMaterial color="#3fd0ff" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[2.5, 1.4]} />
              <meshBasicMaterial color="#7fe3d4" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {[0.45, 0.05, -0.35].map((offset, line) => (
              <mesh key={line} position={[-0.2, offset, 0.02]}>
                <planeGeometry args={[1.6 - line * 0.35, 0.04]} />
                <meshBasicMaterial color="#7fe3d4" transparent opacity={0.5} toneMapped={false} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function IssobellaScene({
  lang,
  avatars = [],
  selectedId = null,
  onSelectAvatar,
}: {
  lang: Lang;
  avatars?: IssobellaAvatar[];
  selectedId?: number | null;
  onSelectAvatar?: (id: number) => void;
}) {
  const selected = avatars.find((avatar) => avatar.id === selectedId);
  return (
    <>
      <color attach="background" args={['#03040c']} />
      <fog attach="fog" args={['#050616', 45, 160]} />
      <Stars />
      <PlanetBelow />
      <Floor />
      <HoloPanels />
      <Pedestal color={selected?.color ?? '#7fe3d4'} />
      <Wardrobe avatars={avatars} selectedId={selectedId} onSelect={onSelectAvatar} />
      <SceneLabel
        text={lang === 'cs' ? 'ISSOBELLA · ŠATNÍK' : 'ISSOBELLA · WARDROBE'}
        position={[0, 5.4, 0]}
        scale={1.4}
      />
      <ScenePresentation
        camera={ISSOBELLA_CAMERA}
        target={ISSOBELLA_CONTROLS.target}
        atmosphere={{
          sun: [0.35, 0.5, 0.2],
          zenith: '#04061a',
          horizon: '#0a1030',
          ground: '#05040c',
          sunColor: '#cfe3ff',
          sunSharpness: 300,
          stars: 1,
          fog: '#050616',
        }}
      />
    </>
  );
}

export { ISSOBELLA_CAMERA, ISSOBELLA_CONTROLS };

export function IssobellaLighting() {
  return (
    <>
      <KeyLight sun={[8, 14, 10]} intensity={2.1} color="#dce6ff" />
      <SkyFill sky="#6f7dff" ground="#120a1e" intensity={0.75} />
      <ambientLight intensity={0.45} color="#9fb4ff" />
      <pointLight position={[0, 4.2, 0]} intensity={22} color="#7fe3d4" distance={26} decay={2} />
      <pointLight position={[0, -6, 0]} intensity={16} color="#2a6fb0" distance={40} decay={2} />
    </>
  );
}
