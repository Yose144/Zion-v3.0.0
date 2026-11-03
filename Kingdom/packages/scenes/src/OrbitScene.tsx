'use client';

/**
 * Orbit — první pohled na svět.
 *
 * Tažením se kamera točí kolem planety (OrbitRig, bez drei), kolečko
 * zůstává stránce — je to embed pás, ne plná scéna. Levné materiály,
 * žádný post-processing. Klik na marker otevře portál, hover ukáže
 * jeho jméno v DOM tooltipu.
 */
import { Suspense, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { SceneMarker } from '@zion/world';
import { Gate } from './Gate';
import { IssobellaRing } from './IssobellaRing';
import { Markers } from './Markers';
import { NewEarth } from './NewEarth';
import { Starfield } from './Starfield';
import { OrbitRig } from './worlds/OrbitRig';
import { useReducedMotion } from './worlds/kit/camera';

/** Cíl hoveru — marker portálu nebo Brána. */
export interface SceneHover {
  id: string;
  title: string;
}

/** Kamera se musí dívat na počátek — bez toho míří mimo planetu. */
function CameraRig() {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

export interface OrbitSceneProps {
  markers?: SceneMarker[];
  onSelect?: (id: string) => void;
  onGate?: () => void;
  /** hover nad markerem / Branou — pro DOM tooltip mimo plátno */
  onHover?: (target: SceneHover | null) => void;
  /** popisek Brány pro tooltip */
  gateLabel?: string;
  /** vypne ambientní animace i autoRotate (accessibility / prefers-reduced-motion) */
  idle?: boolean;
}

export function OrbitScene({
  markers = [],
  onSelect,
  onGate,
  onHover,
  gateLabel,
  idle = true,
}: OrbitSceneProps) {
  const reduced = useReducedMotion();
  const animate = idle && !reduced;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.55, 6.0], fov: 42, near: 0.1, far: 140 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#04050a']} />

      <CameraRig />
      <OrbitRig
        target={[0, 0.28, 0]}
        autoRotate={animate}
        autoRotateSpeed={0.12}
        minDistance={3.0}
        maxDistance={10}
        maxPolarAngle={Math.PI * 0.58}
        enablePan={false}
        enableZoom={false}
      />
      <ambientLight intensity={0.24} />
      <directionalLight position={[4.5, 3.2, 4.5]} intensity={2.5} color="#fff4e2" />
      <pointLight position={[-6, -2, -4]} intensity={0.8} color="#3c6bff" distance={30} />

      <Suspense fallback={null}>
        <Starfield />
        <NewEarth idle={animate} />
        <IssobellaRing idle={animate} />
        <Gate onSelect={onGate} onHover={onHover} label={gateLabel} idle={animate} />
        <Markers markers={markers} onSelect={onSelect} onHover={onHover} idle={animate} />
      </Suspense>
    </Canvas>
  );
}
