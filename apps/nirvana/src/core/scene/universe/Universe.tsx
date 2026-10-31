'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import type { HiranState } from '@/core/hiran/presence';
import { worldSlot, EARTH_ORBIT_R, EARTH_ORBIT_SPEED } from './positions';
import { NewEarth } from './NewEarth';
import { IssobellaRing } from './IssobellaRing';
import { StarGate } from './StarGate';
import { OrbitalWorlds } from './OrbitalWorlds';
import { SpaceBackdrop } from './SpaceBackdrop';
import { SolarSystem } from './SolarSystem';
import { HiranSun } from './HiranSun';

/** Portrait / úzké viewporty: širší fov + větší počáteční odstup,
 *  ať planeta nezaplní celý záběr a zůstane vidět kontext. */
function ResponsiveFraming() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const didInit = useRef(false);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = aspect < 0.75 ? 64 : aspect < 1.1 ? 58 : 52;
    camera.updateProjectionMatrix();
    if (!didInit.current) {
      didInit.current = true;
      const d = aspect < 0.75 ? 1.85 : aspect < 1.1 ? 1.45 : 1;
      camera.position.set(15 * d, 5 * d, 19 * d);
    }
  }, [camera, size]);
  return null;
}

/** Kamera stojí na Zemi. Když se otevře Hiran, odletí ke Slunci a zůstane
 *  na jeho oběžné dráze; Země obíhá dál, takže scéna nezamrzne. */
const SUN_CAM = new THREE.Vector3(17, 8, 17);
const SUN_TARGET = new THREE.Vector3(0, 0, 0);

/**
 * Vesmír Království srdce — heliocentrická soustava.
 * Slunce ve středu (a v něm Hiran) · planety na oběžných drahách · zemská
 * soustava (Nová Země + Issobella + OASIS pás + Brána) obíhá na vnější dráze.
 */
export function Universe({
  worlds,
  portals,
  onOpen,
  onSelectWorld,
  focus = 'earth',
  hiranState = 'idle',
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  focus?: 'earth' | 'sun';
  hiranState?: HiranState;
}) {
  const earthSys = useRef<THREE.Group>(null);
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const earthAngle = useRef(Math.PI * 0.18);
  const [reducedMotion, setReducedMotion] = useState(false);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const focusRef = useRef(focus);
  const progress = useRef(1);
  const fromCam = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  // Změna fokusu = nový přelet. Výchozí bod se zamrazí, cíl je pevný.
  useEffect(() => {
    focusRef.current = focus;
    progress.current = 0;
    fromCam.current.copy(camera.position);
    if (controls.current) fromTarget.current.copy(controls.current.target);
  }, [focus, camera]);

  const split = useMemo(() => {
    const ring: WorldPoint[] = [];
    const orbit: WorldPoint[] = [];
    for (const w of worlds) {
      if (w.layer === 5) continue; // L5 světy = jen menu (World portal), ne scéna
      if (worldSlot(w) === 'ring') ring.push(w);
      else orbit.push(w);
    }
    return { ring, orbit };
  }, [worlds]);

  const ringPortal = portals.find((p) => p.scene.slot === 'ring');
  const gatePortal = portals.find((p) => p.scene.slot === 'gate');

  useFrame((_, delta) => {
    // zemská soustava obíhá Slunce — celý vesmír se točí kolem něj
    if (!reducedMotion) earthAngle.current += delta * EARTH_ORBIT_SPEED;
    const ex = Math.cos(earthAngle.current) * EARTH_ORBIT_R;
    const ez = Math.sin(earthAngle.current) * EARTH_ORBIT_R;
    if (earthSys.current) earthSys.current.position.set(ex, 0, ez);
    lightTarget.position.set(ex, 0, ez);
    // světlo stojí na straně Slunce → planeta má vždy denní/noční stranu správně
    if (light.current) light.current.position.set(ex * 0.5, 5, ez * 0.5);
    if (!controls.current) return;

    if (focusRef.current === 'sun') {
      const p = (progress.current = Math.min(1, progress.current + delta / 1.6));
      const t = 1 - Math.pow(1 - p, 3);
      controls.current.target.lerpVectors(fromTarget.current, SUN_TARGET, t);
      if (p < 1) camera.position.lerpVectors(fromCam.current, SUN_CAM, t);
    } else {
      controls.current.target.set(ex, 0, ez);
    }
  });

  return (
    <>
      <color attach="background" args={['#040614']} />
      <ambientLight intensity={0.48} />
      <hemisphereLight args={['#829fd0', '#080b18', 0.38]} />
      <directionalLight ref={light} color="#fff1d4" intensity={1.35} target={lightTarget} />
      <primitive object={lightTarget} />
      <SpaceBackdrop />

      {/* zemská soustava — obíhá Slunce jako jeden svět */}
      <group ref={earthSys} position={[EARTH_ORBIT_R, 0, 0]}>
        <NewEarth />
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
      <HiranSun state={hiranState} onOpen={() => onOpen('hiran')} />

      <ResponsiveFraming />
      <OrbitControls
        ref={controls as never}
        makeDefault
        autoRotate={!reducedMotion}
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
