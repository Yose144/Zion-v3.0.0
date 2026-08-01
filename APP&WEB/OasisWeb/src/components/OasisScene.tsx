'use client';

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import TreeOfLife from './TreeOfLife';
import Galaxy from './Galaxy';
import GalaxyCore from './GalaxyCore';
import GalaxyMap from './GalaxyMap';
import Nebula from './Nebula';

interface CameraRigProps {
  started: boolean;
  onArrived?: () => void;
}

function CameraRig({ started, onArrived }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<ReturnType<typeof OrbitControls> | null>(null);
  const progress = useRef(0);
  const arrived = useRef(false);
  const notified = useRef(false);

  useFrame((state, delta) => {
    if (started && !arrived.current) {
      progress.current = Math.min(1, progress.current + delta * 0.22);
      const t = 1 - Math.pow(1 - progress.current, 3); // ease-out cubic

      // Fly from the outer rim of the galaxy toward the glowing center
      const startPos = new THREE.Vector3(0, 3.5, 34);
      const endPos = new THREE.Vector3(0, 0.9, 7.5);
      camera.position.lerpVectors(startPos, endPos, t);
      camera.lookAt(0, 0.6, 0);

      if (controlsRef.current) {
        // @ts-expect-error - drei OrbitControls ref is untyped
        controlsRef.current.update();
      }

      if (progress.current >= 1) {
        arrived.current = true;
        if (onArrived && !notified.current) {
          notified.current = true;
          onArrived();
        }
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

interface OasisSceneProps {
  started?: boolean;
  onArrived?: () => void;
}

export default function OasisScene({ started = true, onArrived }: OasisSceneProps) {
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

      {/* 55 OASIS worlds as a holographic galaxy map */}
      <GalaxyMap />

      {/* Arrival flight and controls */}
      <CameraRig started={started} onArrived={onArrived} />

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
