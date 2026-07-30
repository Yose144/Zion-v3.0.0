'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import World from './World';
import TreeOfLife from './TreeOfLife';
import Galaxy from './Galaxy';
import GalaxyCore from './GalaxyCore';
import Nebula from './Nebula';

const TERRITORIES = [
  { id: 'sadhu', name: 'Údolí Ticha', color: '#8b5cf6', angle: 0, size: 0.55, info: 'Sádhové, meditace a Ekam Deeksha.' },
  { id: 'neo', name: 'Věž Kódu', color: '#22d3ee', angle: 45, size: 0.5, info: 'Neo — objevitel pravdy, audit a stop Golden Egg.' },
  { id: 'trinity', name: 'Mostní Přístav', color: '#f59e0b', angle: 90, size: 0.5, info: 'Trinity — propojení světů a cross-chain mosty.' },
  { id: 'morpheus', name: 'Strážcová Pevnost', color: '#10b981', angle: 135, size: 0.55, info: 'Morpheus — ochrana, uzly a vedení guild.' },
  { id: 'hanuman', name: 'Seva Zahrada', color: '#ec4899', angle: 180, size: 0.5, info: 'Dárce/Hanuman — služba bez ega a humanitární tithe.' },
  { id: 'sita', name: 'Zelená Země', color: '#14b8a6', angle: 225, size: 0.55, info: 'Sítá — péče o půdu a obnova krajiny.' },
  { id: 'arjuna', name: 'Bojovnice Pravdy', color: '#ef4444', angle: 270, size: 0.5, info: 'Arjuna — ochrana cesty a dharma rozhodnutí.' },
  { id: 'radha', name: 'Zahrada Radhy', color: '#f97316', angle: 315, size: 0.55, info: 'Rádha — radost, hudba a uvítání nováčků.' },
];

function CameraRig({ started }: { started: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<ReturnType<typeof OrbitControls> | null>(null);
  const progress = useRef(0);
  const arrived = useRef(false);

  useFrame((state, delta) => {
    if (started && !arrived.current) {
      progress.current = Math.min(1, progress.current + delta * 0.24);
      const t = 1 - Math.pow(1 - progress.current, 3); // ease-out cubic

      // Fly from the outer rim of the galaxy toward the glowing center
      const startPos = new THREE.Vector3(0, 3.5, 34);
      const endPos = new THREE.Vector3(0, 1.2, 13);
      camera.position.lerpVectors(startPos, endPos, t);
      camera.lookAt(0, 0.6, 0);

      if (controlsRef.current) {
        // @ts-expect-error - drei OrbitControls ref is untyped
        controlsRef.current.update();
      }

      if (progress.current >= 1) {
        arrived.current = true;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef as any}
      target={[0, 0.6, 0]}
      enablePan={arrived.current}
      enableZoom={arrived.current}
      enableRotate={arrived.current}
      autoRotate={arrived.current}
      autoRotateSpeed={0.3}
      enableDamping
      dampingFactor={0.05}
    />
  );
}

function TerritoryRing() {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 5.5;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.03;
    }
  });

  const worlds = useMemo(
    () =>
      TERRITORIES.map((t) => {
        const rad = (t.angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const z = Math.sin(rad) * radius;
        return { ...t, position: [x, 0, z] as [number, number, number] };
      }),
    []
  );

  return (
    <group ref={groupRef}>
      {worlds.map((w) => (
        <World key={w.id} id={w.id} name={w.name} color={w.color} position={w.position} size={w.size} info={w.info} />
      ))}
    </group>
  );
}

interface OasisSceneProps {
  started?: boolean;
}

export default function OasisScene({ started = true }: OasisSceneProps) {
  return (
    <Canvas camera={{ position: [0, 3.5, 34], fov: 55 }} dpr={[1, 2]}>
      <color attach="background" args={['#02030a']} />
      <fog attach="fog" args={['#02030a', 22, 55]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 8, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-12, -6, -12]} intensity={0.6} color="#a855f7" />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#22d3ee" />

      {/* Distant star backdrop */}
      <Stars radius={180} depth={120} count={8000} factor={4} saturation={0} fade speed={0.4} />

      {/* Galaxy disk + core + nebula */}
      <Galaxy />
      <GalaxyCore />
      <Nebula />

      {/* Oasis center */}
      <TreeOfLife />
      <TerritoryRing />

      {/* Arrival flight and controls */}
      <CameraRig started={started} />

      {/* Bloom for glow */}
      <EffectComposer>
        <Bloom
          intensity={0.75}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.5}
          mipmapBlur
          radius={0.6}
        />
      </EffectComposer>
    </Canvas>
  );
}
