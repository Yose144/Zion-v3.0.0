'use client';

/**
 * Orbit — první pohled na svět.
 *
 * Kamera stojí, svět se hýbe. Je to levnější (žádný post-processing, žádné
 * ovládání kamery) a čitelnější: člověk vidí planetu, prstenec L6, Bránu
 * a markery portálů. Klik na marker otevře portál.
 */
import { Suspense, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { SceneMarker } from '@zion/world';
import { Gate } from './Gate';
import { IssobellaRing } from './IssobellaRing';
import { Markers } from './Markers';
import { NewEarth } from './NewEarth';
import { Starfield } from './Starfield';

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
  /** vypne animace (accessibility / prefers-reduced-motion) */
  idle?: boolean;
}

export function OrbitScene({ markers = [], onSelect, onGate, idle = true }: OrbitSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.55, 6.0], fov: 42, near: 0.1, far: 140 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#04050a']} />

      <CameraRig />
      <ambientLight intensity={0.24} />
      <directionalLight position={[4.5, 3.2, 4.5]} intensity={2.5} color="#fff4e2" />
      <pointLight position={[-6, -2, -4]} intensity={0.8} color="#3c6bff" distance={30} />

      <Suspense fallback={null}>
        <Starfield />
        <NewEarth idle={idle} />
        <IssobellaRing idle={idle} />
        <Gate onSelect={onGate} />
        <Markers markers={markers} onSelect={onSelect} />
      </Suspense>
    </Canvas>
  );
}
