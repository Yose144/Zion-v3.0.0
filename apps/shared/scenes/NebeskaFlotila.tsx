/** @jsxRuntime classic */
'use client';

import { React, useFrame, useRef, THREE } from '@genesis/runtime';
import { ScenePresentation, motionTime } from './ScenePresentation';
import { KeyLight, SkyFill } from './kit';
import { NabukanoModel } from './kit/vessels';

type Lang = 'cs' | 'en';
type Point = [number, number, number];

/* ─── Nebeská flotila — Nabukano (L6) ─────────────────────────────────────
 * Kanonická podoba je studie 02: hřeben s rotujícím obytným prstencem a pod
 * ním dokovací rám se třemi kotvišti, na jehož konci visí lucerna.
 *
 * Scéna je společná pro web (náhled na /terranova/nabukano) i pro Nirvanu
 * (/present/nebeska-flotila) — model lodi jde z `kit/vessels.tsx`, takže se
 * nemůže rozejít s hlavní scénou vesmíru.
 *
 * Pozadí: Země jako obrovský oblouk dole (ne modrá koule: jsme na orbitě),
 * hvězdy nahoře, flotila uprostřed. Žádná planeta není „na dohled" velká —
 * kamera stojí pár jednotek od trupu.
 */

/** Obrys planety pod flotilou — jen spodní oblouk, ne celá koule. */
function EarthLimb() {
  return (
    <group>
      {/* tělo planety — dost velké, aby byl vidět jen oblouk */}
      <mesh position={[0, -112, -18]}>
        <sphereGeometry args={[104, 64, 48]} />
        <meshStandardMaterial color="#0d2b47" roughness={0.95} metalness={0.04} emissive="#061726" emissiveIntensity={0.35} />
      </mesh>
      {/* atmosféra — tenký svítící lem nad obzorem */}
      <mesh position={[0, -112, -18]} scale={1.006}>
        <sphereGeometry args={[104, 64, 48]} />
        <meshBasicMaterial color="#7fc4ff" transparent opacity={0.22} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* městská světla pod obzorem — jen náznak, ne mapa */}
      <mesh position={[0, -112, -18]} scale={1.001}>
        <sphereGeometry args={[104, 48, 36]} />
        <meshBasicMaterial color="#0b1a2a" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Prach a led — pomalé částice kolem flotily (respektuje reduced motion). */
function Dust() {
  const points = useRef<THREE.Points>(null);
  const geometry = React.useMemo(() => {
    const count = 220;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + (i % 17) * 0.55;
      const a = (i / count) * Math.PI * 2 + (i % 7) * 0.31;
      const y = Math.sin(i * 1.7) * 1.6;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.y = motionTime(clock) * 0.02;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.035} color="#cfe4ff" transparent opacity={0.5} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export function NebeskaFlotilaScene({ lang = 'cs' }: { lang?: Lang }) {
  return (
    <>
      <ScenePresentation
        camera={NEBESKA_CAMERA}
        target={NEBESKA_CONTROLS.target}
        atmosphere={{
          sun: [-0.35, 0.55, -0.75],
          zenith: '#04060f',
          horizon: '#0a1526',
          ground: '#010206',
          sunColor: '#dfe9ff',
          sunSharpness: 620,
          clouds: 0,
          stars: 1,
          fog: '#05070f',
          fogDensity: 0.0006,
          envIntensity: 0.55,
        }}
        post={{ bloom: 0.36, threshold: 0.82, exposure: 1.05, vignette: 0.42 }}
        intro={{ duration: 3.2 }}
      />
      <NebeskaFlotilaLighting />
      <EarthLimb />
      <Dust />
      {/* jméno scény v grafu — jazyk nemění geometrii, jen popisky v UI */}
      <group name={`nebeska-flotila-${lang}`} position={[0, 0, 0]} rotation={[0, 0.35, 0]}>
        <NabukanoModel />
      </group>
    </>
  );
}

/** Světlo: slabé okolní, tvrdý klíč od Slunce zleva a modrý odraz od planety. */
export function NebeskaFlotilaLighting() {
  return (
    <>
      <ambientLight intensity={0.22} color="#cfe0ff" />
      <SkyFill sky="#9dc4ff" ground="#0a1c2c" intensity={0.5} />
      <KeyLight sun={[-0.35, 0.55, -0.75]} intensity={3.1} extent={26} distance={60} color="#eaf2ff" />
      {/* odraz planety zdola — jinak je spodek trupu mrtvý */}
      <directionalLight position={[0, -6, 2]} intensity={0.45} color="#4a86c8" />
    </>
  );
}

export const NEBESKA_CAMERA = { position: [3.6, 1.8, 4.2] as Point, fov: 40, far: 4000 };

export const NEBESKA_CONTROLS = {
  autoRotate: true,
  autoRotateSpeed: 0.16,
  minDistance: 3.2,
  maxDistance: 40,
  maxPolarAngle: Math.PI * 0.62,
  target: [0, 0, 0] as Point,
  enablePan: false,
};
