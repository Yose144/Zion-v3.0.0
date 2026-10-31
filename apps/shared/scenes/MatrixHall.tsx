/** @jsxRuntime classic */
'use client';

import { React, useFrame, useMemo, THREE } from '@genesis/runtime';

import { GlowSprite, useHallFloorTexture } from './MatrixDetail';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionDelta, motionTime, prefersReducedMotion } from './ScenePresentation';

type Lang = 'cs' | 'en';

const TARGET: [number, number, number] = [0, 1.5, -1];

/** Dva průvodci jdou sálem k třetí postavě. Takt 0 vstup, 1 průchod, 2 setkání. */
const WALKER_Z = [6.2, 0.2, -6.1];

function Figure({ coat }: { coat: string }) {
  return (
    <>
      {[-0.1, 0.1].map((x) => (
        <mesh key={`leg${x}`} position={[x, 0.23, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.048, 0.46, 6]} />
          <meshStandardMaterial color="#15171d" roughness={0.86} />
        </mesh>
      ))}
      <mesh position={[0, 0.64, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.235, 0.62, 10]} />
        <meshStandardMaterial color={coat} roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.01, 0]} castShadow>
        <sphereGeometry args={[0.185, 12, 10]} />
        <meshStandardMaterial color={coat} roughness={0.7} />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={`arm${x}`} position={[x, 0.86, 0]} rotation={[0, 0, x > 0 ? -0.14 : 0.14]} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.52, 6]} />
          <meshStandardMaterial color={coat} roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 1.23, 0]} castShadow>
        <sphereGeometry args={[0.155, 14, 12]} />
        <meshStandardMaterial color="#d7c4a8" roughness={0.6} />
      </mesh>
    </>
  );
}

function Walker({ beat, side, coat }: { beat: number; side: number; coat: string }) {
  const ref = React.useRef<THREE.Group>(null);
  const z = React.useRef(WALKER_Z[0]);
  useFrame((_, delta) => {
    const goal = WALKER_Z[Math.max(0, Math.min(2, beat))];
    const step = prefersReducedMotion() ? 1 : Math.min(1, motionDelta(delta) * 2.2);
    z.current += (goal - z.current) * step;
    if (ref.current) ref.current.position.set(side * 0.72, 0, z.current);
  });
  return (
    <group ref={ref} position={[side * 0.72, 0, WALKER_Z[0]]}>
      <Figure coat={coat} />
    </group>
  );
}

function Shards({ beat }: { beat: number }) {
  const group = React.useRef<THREE.Group>(null);
  const pieces = useMemo(() => {
    let s = 4242;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 18 }, (_, i) => ({
      side: i % 2 === 0 ? -1 : 1,
      z: (rnd() - 0.5) * 10,
      y: 0.4 + rnd() * 2.2,
      spin: rnd() * 4,
      key: i,
    }));
  }, []);
  const burst = React.useRef(0);
  useFrame((_, delta) => {
    const goal = beat >= 1 && !prefersReducedMotion() ? 1 : 0;
    const step = prefersReducedMotion() ? 1 : Math.min(1, motionDelta(delta) * 1.8);
    burst.current += (goal - burst.current) * step;
    const root = group.current;
    if (!root) return;
    root.visible = burst.current > 0.04;
    root.children.forEach((child, i) => {
      const piece = pieces[i];
      if (!piece) return;
      const fly = burst.current;
      child.position.set(piece.side * (3.15 + fly * 1.4), piece.y * (1 - fly * 0.35), piece.z);
      child.rotation.set(fly * piece.spin, fly * 0.6, piece.side * fly);
    });
  });
  if (prefersReducedMotion()) return null;
  return (
    <group ref={group} visible={false}>
      {pieces.map((piece) => (
        <mesh key={piece.key}>
          <boxGeometry args={[0.08, 0.28, 0.35]} />
          <meshStandardMaterial color="#d9fff0" emissive="#143028" emissiveIntensity={0.4} transparent opacity={0.72} roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function GlassWall({ side, beat }: { side: number; beat: number }) {
  const ref = React.useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    const mat = ref.current;
    if (!mat) return;
    const broken = beat >= 1 && !prefersReducedMotion() ? 0.22 : 0.38;
    const step = prefersReducedMotion() ? 1 : Math.min(1, motionDelta(delta) * 2);
    mat.opacity += (broken - mat.opacity) * step;
  });
  return (
    <group>
      <mesh position={[side * 3.05, 1.7, -1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[16, 3.4]} />
        <meshStandardMaterial
          ref={ref}
          color="#c8ffe8"
          emissive="#0e3a2c"
          emissiveIntensity={0.35}
          transparent
          opacity={0.38}
          roughness={0.08}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* svislé rámy skla */}
      {[-8, -6, -4, -2, 0, 2, 4, 6].map((z) => (
        <mesh key={`mullion${z}`} position={[side * 3.05, 1.7, z]} castShadow>
          <boxGeometry args={[0.07, 3.4, 0.07]} />
          <meshStandardMaterial color="#2e343d" metalness={0.62} roughness={0.32} />
        </mesh>
      ))}
      {/* horní a dolní lišta */}
      {[0.06, 3.34].map((y) => (
        <mesh key={`rail${y}`} position={[side * 3.05, y, -1]}>
          <boxGeometry args={[0.09, 0.09, 16]} />
          <meshStandardMaterial color="#343b45" metalness={0.6} roughness={0.34} />
        </mesh>
      ))}
    </group>
  );
}

export function MatrixHallScene({ lang, beat, onAdvance }: { lang: Lang; beat: number; onAdvance?: () => void }) {
  const cs = lang === 'cs';
  const floor = useHallFloorTexture();
  const meet = React.useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!meet.current) return;
    const on = beat >= 2 ? 2.2 + Math.sin(motionTime(clock) * 1.4) * 0.3 : 0.15;
    const step = prefersReducedMotion() ? 1 : 0.08;
    meet.current.intensity += (on - meet.current.intensity) * (prefersReducedMotion() ? 1 : step);
  });
  const advance = onAdvance
    ? (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        if (beat < 2) onAdvance();
      }
    : undefined;
  return (
    <>
      <ScenePresentation camera={HALL_CAMERA} target={HALL_CONTROLS.target} spin={false} />
      <color attach="background" args={['#07080c']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={advance}>
        <planeGeometry args={[8, 18]} />
        <meshStandardMaterial
          key={floor ? 'tex' : 'flat'}
          map={floor ?? undefined}
          color={floor ? '#ffffff' : '#0f1116'}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      {/* světelné bazény na podlaze */}
      {[4.5, 0, -4.5, -8.2].map((z) => (
        <mesh key={`pool${z}`} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.15, 24]} />
          <meshBasicMaterial color="#9dffcf" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      {/* světelné pásy podél chodby */}
      {[-3.0, 3.0].map((x) => (
        <mesh key={`strip${x}`} position={[x, 0.014, -1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 15.5]} />
          <meshBasicMaterial color="#7dffb0" transparent opacity={0.5} />
        </mesh>
      ))}
      {[-6, -2, 2, 6].flatMap((z) => [-2.35, 2.35].map((x) => (
        <mesh key={`${x}:${z}`} position={[x, 1.6, z]} castShadow>
          <boxGeometry args={[0.28, 3.2, 0.28]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.45} />
        </mesh>
      )))}
      <GlassWall side={-1} beat={beat} />
      <GlassWall side={1} beat={beat} />
      <mesh position={[0, 3.35, -1]}>
        <boxGeometry args={[7.2, 0.12, 16]} />
        <meshStandardMaterial color="#101218" roughness={0.8} />
      </mesh>
      {/* stropní světla */}
      {[-1.8, 1.8].map((x) => (
        <mesh key={`ceiling${x}`} position={[x, 3.28, -1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.16, 15]} />
          <meshBasicMaterial color="#d9fff0" transparent opacity={0.55} />
        </mesh>
      ))}
      <Walker beat={beat} side={-1} coat="#1c1f28" />
      <Walker beat={beat} side={1} coat="#242833" />
      <group position={[0, 0, -7.2]}>
        <Figure coat="#3a342c" />
      </group>
      <Shards beat={beat} />
      <GlowSprite position={[0, 1.7, -7]} scale={6.5} color="#d6ffe8" opacity={beat >= 2 ? 0.34 : 0.16} />
      {/* čelní stěna, na kterou dopadá světlo setkání */}
      <mesh position={[0, 1.9, -9.4]}>
        <planeGeometry args={[7, 3.8]} />
        <meshStandardMaterial color="#0d1a16" emissive="#1d6d57" emissiveIntensity={0.55} roughness={0.6} metalness={0.2} />
      </mesh>
      <pointLight ref={meet} position={[0, 2.2, -7]} color="#d6ffe8" distance={8} decay={2} intensity={0.15} />
      <SceneLabel
        position={[0, 2.6, -7.2]}
        text={beat >= 2 ? (cs ? 'setkání' : 'meeting') : (cs ? 'na konci sálu' : 'end of the hall')}
      />
      <SceneLabel
        position={[0, 2.35, 6.2]}
        text={beat === 0 ? (cs ? 'vstup' : 'entry') : beat === 1 ? (cs ? 'průchod' : 'crossing') : (cs ? 'jsou u ní' : 'they have arrived')}
      />
    </>
  );
}

export const HALL_CAMERA = { position: [0, 3.2, 12.8] as [number, number, number], fov: 44, far: 80 };
export const HALL_CONTROLS = {
  autoRotate: false,
  autoRotateSpeed: 0,
  minDistance: 6,
  maxDistance: 22,
  maxPolarAngle: Math.PI / 2 - 0.08,
  target: TARGET,
  enablePan: false,
};

export function MatrixHallLighting() {
  return (
    <>
      <ambientLight intensity={0.45} color="#cfe0d6" />
      <hemisphereLight args={['#2a6350', '#101319', 0.75]} />
      <directionalLight position={[4, 8, 6]} intensity={1.6} color="#e7fff4" castShadow />
      <pointLight position={[0, 2.4, 4]} color="#7dffb0" intensity={1.5} distance={16} decay={2} />
      <pointLight position={[0, 2.2, -2]} color="#39f3a0" intensity={0.9} distance={12} decay={2} />
      <pointLight position={[-2.2, 2.9, 0.5]} color="#bfe9d8" intensity={0.5} distance={9} decay={2} />
      <pointLight position={[2.2, 2.9, 0.5]} color="#bfe9d8" intensity={0.5} distance={9} decay={2} />
    </>
  );
}
