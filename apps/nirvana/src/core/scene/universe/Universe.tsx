'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import { worldSlot, EARTH_ORBIT_R, EARTH_ORBIT_SPEED } from './positions';
import { NewEarth } from './NewEarth';
import { IssobellaRing } from './IssobellaRing';
import { StarGate } from './StarGate';
import { OrbitalWorlds } from './OrbitalWorlds';
import { SpaceBackdrop } from './SpaceBackdrop';
import { SolarSystem } from './SolarSystem';

/**
 * Vesmír Království srdce — heliocentrická soustava.
 * Slunce ve středu · planety na oběžných drahách · zemská soustava
 * (Nová Země + Issobella + OASIS pás + Brána) obíhá na vnější dráze.
 * Kamera kotví na zemi; odzoom až na pohled celého systému.
 */
export function Universe({
  worlds,
  portals,
  onOpen,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
}) {
  const earthSys = useRef<THREE.Group>(null);
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const earthAngle = useRef(Math.PI * 0.18);

  const split = useMemo(() => {
    const surface: WorldPoint[] = [];
    const ring: WorldPoint[] = [];
    const orbit: WorldPoint[] = [];
    for (const w of worlds) {
      const slot = worldSlot(w);
      if (slot === 'surface') surface.push(w);
      else if (slot === 'ring') ring.push(w);
      else orbit.push(w);
    }
    return { surface, ring, orbit };
  }, [worlds]);

  const surfacePortals = portals.filter((p) => p.scene.slot === 'surface' || p.scene.slot === 'core');
  const ringPortal = portals.find((p) => p.scene.slot === 'ring');
  const gatePortal = portals.find((p) => p.scene.slot === 'gate');

  useFrame((_, delta) => {
    // zemská soustava obíhá Slunce — celý vesmír se točí kolem něj
    earthAngle.current += delta * EARTH_ORBIT_SPEED;
    const ex = Math.cos(earthAngle.current) * EARTH_ORBIT_R;
    const ez = Math.sin(earthAngle.current) * EARTH_ORBIT_R;
    if (earthSys.current) earthSys.current.position.set(ex, 0, ez);
    lightTarget.position.set(ex, 0, ez);
    // světlo stojí na straně Slunce → planeta má vždy denní/noční stranu správně
    if (light.current) light.current.position.set(ex * 0.5, 5, ez * 0.5);
    if (controls.current) controls.current.target.set(ex, 0, ez);
  });

  return (
    <>
      <color attach="background" args={['#040614']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#5a7fc0', '#0b0e1a', 0.32]} />
      <directionalLight ref={light} intensity={1.25} target={lightTarget} />
      <primitive object={lightTarget} />
      <SpaceBackdrop />

      {/* zemská soustava — obíhá Slunce jako jeden svět */}
      <group ref={earthSys} position={[EARTH_ORBIT_R, 0, 0]}>
        <NewEarth
          worlds={split.surface}
          surfacePortals={surfacePortals}
          onOpen={onOpen}
          onSelectWorld={onSelectWorld}
        />
        <IssobellaRing
          worlds={split.ring}
          portal={ringPortal}
          onOpen={onOpen}
          onSelectWorld={onSelectWorld}
        />
        <OrbitalWorlds worlds={split.orbit} onSelectWorld={onSelectWorld} />
        {gatePortal && <StarGate portal={gatePortal} onOpen={onOpen} />}
      </group>

      <SolarSystem />

      <OrbitControls
        ref={controls as never}
        makeDefault
        autoRotate
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={7}
        maxDistance={1300}
        minPolarAngle={0.4}
        maxPolarAngle={2.7}
      />
    </>
  );
}
