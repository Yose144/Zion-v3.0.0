/** @jsxRuntime classic */
'use client';

import { React, useFrame, useMemo, THREE } from '@genesis/runtime';

import { Antenna, EarthBall, Footprints, LunarGround, Radiators, Rocks, Rover, Starfield, SunGlow, useHullTexture, useSolarTexture, UtilityBox } from './MatrixDetail';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionDelta, motionTime } from './ScenePresentation';

type PointerEventLike = { stopPropagation: () => void };

type Lang = 'cs' | 'en';

const TARGET: [number, number, number] = [0, 2.0, 1.0];

function seeded(n: number) {
  let s = n;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function LunarSky() {
  return (
    <>
      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[320, 24, 16]} />
        <meshBasicMaterial color="#05060b" side={THREE.BackSide} />
      </mesh>
      <Starfield />
      <SunGlow />
    </>
  );
}

function EarthInSky() {
  return <EarthBall />;
}

function Craters() {
  const craters = useMemo(() => {
    const rnd = seeded(144000);
    return Array.from({ length: 13 }, (_, i) => ({
      x: (rnd() - 0.5) * 26,
      z: (rnd() - 0.5) * 22,
      r: 0.35 + rnd() * rnd() * 1.5,
      key: i,
    })).filter((c) => Math.hypot(c.x, c.z) > 4.6);
  }, []);
  return (
    <>
      {craters.map((c) => (
        <group key={c.key} position={[c.x, 0.006, c.z]}>
          {/* stupňovitá mísa: tři odstíny naznačí hloubku bez další geometrie terénu */}
          {[
            { scale: 1, color: '#6d675d', y: 0 },
            { scale: 0.74, color: '#5b554c', y: 0.002 },
            { scale: 0.44, color: '#4c473f', y: 0.004 },
          ].map((ring) => (
            <mesh key={ring.scale} rotation={[-Math.PI / 2, 0, 0]} position={[0, ring.y, 0]} receiveShadow>
              <circleGeometry args={[c.r * ring.scale, 22]} />
              <meshStandardMaterial color={ring.color} roughness={1} metalness={0.02} />
            </mesh>
          ))}
          {/* nízký val, ne drátěný kroužek */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
            <ringGeometry args={[c.r * 0.94, c.r * 1.06, 24]} />
            <meshStandardMaterial color="#90897d" roughness={1} metalness={0.02} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Habitat({
  position,
  radius,
  color,
  glass,
  enter,
  onEnter,
  hull,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
  glass?: boolean;
  enter?: boolean;
  onEnter?: () => void;
  hull?: THREE.Texture | null;
}) {
  const ring = React.useRef<THREE.Mesh>(null);
  React.useEffect(() => () => {
    if (enter) document.body.style.cursor = 'auto';
  }, [enter]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + 0.08 * Math.sin(motionTime(clock) * 2.2);
    ring.current.scale.set(s, s, 1);
  });
  const open = enter && onEnter
    ? (e: PointerEventLike) => {
        e.stopPropagation();
        onEnter();
      }
    : undefined;
  const hover = enter && onEnter
    ? (e: PointerEventLike) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }
    : undefined;
  return (
    <group
      position={position}
      onClick={open}
      onPointerOver={hover}
      onPointerOut={enter && onEnter ? () => { document.body.style.cursor = 'auto'; } : undefined}
    >
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.92, radius, 0.76, 20]} />
        <meshStandardMaterial
          key={hull ? 'tex' : 'flat'}
          map={hull ?? undefined}
          color={hull ? '#e9e3d7' : color}
          roughness={0.62}
          metalness={0.28}
        />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow>
        <sphereGeometry args={[radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={glass ? '#d7ffe8' : '#d9d3c8'}
          roughness={glass ? 0.18 : 0.42}
          metalness={glass ? 0.05 : 0.16}
          transparent={!!glass}
          opacity={glass ? 0.62 : 1}
          emissive={glass ? '#1c8a4e' : enter ? '#2a1848' : '#000000'}
          emissiveIntensity={glass ? 0.45 : enter ? 0.18 : 0}
        />
      </mesh>
      <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.98, 0.045, 8, 28]} />
        <meshStandardMaterial color="#b7b0a4" metalness={0.62} roughness={0.32} />
      </mesh>
      {[ -1.15, 1.15, Math.PI ].map((angle) => (
        <mesh key={angle} position={[Math.sin(angle) * radius * 0.94, 0.5, Math.cos(angle) * radius * 0.94]}>
          <boxGeometry args={[0.07, 0.26, 0.1]} />
          <meshStandardMaterial color="#1a1714" emissive="#f3ddb0" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {enter && (
        <>
          <mesh position={[0, 0.48, radius * 0.9]}>
            <boxGeometry args={[0.5, 0.72, 0.08]} />
            <meshStandardMaterial color="#241c33" metalness={0.35} roughness={0.45} emissive="#4c1d95" emissiveIntensity={0.45} />
          </mesh>
          <mesh position={[0, 0.5, radius * 0.96]}>
            <torusGeometry args={[0.46, 0.03, 8, 22]} />
            <meshStandardMaterial color="#d9d0c2" metalness={0.72} roughness={0.28} />
          </mesh>
          <mesh ref={ring} position={[0, 0.05, radius * 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.62, 0.8, 28]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.82} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Tunnel({ position, length, hull }: { position: [number, number, number]; length: number; hull?: THREE.Texture | null }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.32, 0.32, length, 12]} />
      <meshStandardMaterial key={hull ? 'tex' : 'flat'} map={hull ?? undefined} color={hull ? '#ded8cc' : '#b7b1a6'} roughness={0.55} metalness={0.3} />
    </mesh>
  );
}

function LandingPad() {
  return (
    <group position={[0.4, 0, 6.2]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[2.35, 2.35, 0.1, 28]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.8} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.92, 28]} />
        <meshBasicMaterial color="#c9b6ff" transparent opacity={0.42} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[0.72, 0.42, 0.72]} />
          <meshStandardMaterial color="#e7e1d6" roughness={0.4} metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.22, 0.08]} castShadow>
          <sphereGeometry args={[0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          <meshStandardMaterial color="#d5e8f8" roughness={0.18} metalness={0.12} emissive="#123a66" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 1.08, 0.38]}>
          <boxGeometry args={[0.42, 0.18, 0.05]} />
          <meshStandardMaterial color="#9fd0ff" emissive="#1a4a7a" emissiveIntensity={0.55} roughness={0.12} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.16, 0.22, 0.28, 10]} />
          <meshStandardMaterial color="#6a655c" metalness={0.5} roughness={0.45} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.55, 0.38, Math.sin(a) * 0.55]} rotation={[0, 0, Math.cos(a) * 0.5]}>
              <cylinderGeometry args={[0.035, 0.035, 0.7, 6]} />
              <meshStandardMaterial color="#8d877c" metalness={0.4} roughness={0.5} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function SolarArray() {
  const cells = useSolarTexture();
  return (
    <group position={[-6.4, 0, 2.4]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.1, 8]} />
        <meshStandardMaterial color="#6e6a62" metalness={0.4} roughness={0.5} />
      </mesh>
      {[ -1.15, 1.15 ].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.7, 0.05, 1.15]} />
          <meshStandardMaterial
            key={cells ? 'tex' : 'flat'}
            map={cells ?? undefined}
            color={cells ? '#ffffff' : '#1c3f73'}
            emissive="#0c274d"
            emissiveIntensity={0.18}
            metalness={0.55}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function GreenhouseGlow() {
  const ref = React.useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = motionTime(clock);
    ref.current.intensity = 1.6 + Math.sin(t * 1.3) * 0.45;
  });
  return <pointLight ref={ref} position={[3.8, 1.4, 0.2]} color="#7dffb0" distance={8} decay={2} />;
}

export function MatrixScene({ lang, onEnterHall }: { lang: Lang; onEnterHall?: () => void }) {
  const cs = lang === 'cs';
  const hull = useHullTexture();
  return (
    <>
      <ScenePresentation camera={MATRIX_CAMERA} target={MATRIX_CONTROLS.target} />
      <LunarSky />
      <EarthInSky />
      <LunarGround />
      <Craters />
      <Rocks />
      <Footprints />
      <Habitat position={[-3.5, 0, -0.2]} radius={1.35} color="#c8c2b6" hull={hull} />
      <Habitat position={[0.15, 0, 0.15]} radius={1.72} color="#d5cfc3" hull={hull} enter onEnter={onEnterHall} />
      <Habitat position={[3.8, 0, 0.2]} radius={1.22} color="#c8c2b6" glass hull={hull} />
      <Tunnel position={[-1.7, 0.62, -0.02]} length={2.15} hull={hull} />
      <Tunnel position={[2.0, 0.62, 0.18]} length={2.05} hull={hull} />
      <Radiators position={[-5.05, 0, 1.15]} />
      <UtilityBox position={[2.9, 0, 1.9]} rotation={-0.5} />
      <Antenna position={[-4.95, 0, -1.75]} />
      <Rover position={[2.6, 0, 4.4]} rotation={0.6} />
      <LandingPad />
      <SolarArray />
      <GreenhouseGlow />
      <SceneLabel
        position={[0.1, 4.1, 0.1]}
        scale={1.2}
        text={cs ? 'MATRIX · lunární základna' : 'MATRIX · lunar base'}
      />
      <SceneLabel position={[0.15, 2.55, 2.15]} text={cs ? 'hala · vstoupit' : 'hall · enter'} />
      <SceneLabel position={[3.8, 2.7, 0.2]} text={cs ? 'skleník' : 'greenhouse'} />
      <SceneLabel position={[0.4, 2.15, 6.2]} text={cs ? 'přistávací plocha' : 'landing pad'} />
      <SceneLabel position={[-60, 11.4, -80]} scale={1.4} text={cs ? 'Země' : 'Earth'} />
    </>
  );
}

export const MATRIX_CAMERA = { position: [12.5, 6.6, 16.5] as [number, number, number], fov: 40, far: 900 };
export const MATRIX_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.22,
  minDistance: 8,
  maxDistance: 70,
  maxPolarAngle: Math.PI / 2 - 0.06,
  target: TARGET,
  enablePan: false,
};

export function MatrixLighting() {
  return (
    <>
      <ambientLight intensity={0.12} color="#c9d4e8" />
      <hemisphereLight args={['#dfe7f5', '#26231e', 0.22]} />
      {/* nízké slunce (~7°) — dlouhé stíny jako na jižním pólu Měsíce */}
      <directionalLight
        position={[-70, 9, 12]}
        intensity={3.4}
        color="#fff3e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />
      {/* earthshine — modré světlo odražené od Země */}
      <directionalLight position={[-60, 8, -80]} intensity={0.4} color="#8ab6ea" />
    </>
  );
}
