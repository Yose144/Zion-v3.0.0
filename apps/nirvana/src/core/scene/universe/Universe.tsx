'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import type { HiranState } from '@/core/hiran/presence';
import { worldSlot, EARTH_ORBIT_R, EARTH_ORBIT_SPEED } from './positions';
import { NewEarth } from './NewEarth';
import { SailingArk } from './SailingArk';
import { SkyFleet, FleetRoute, type FleetLeg } from './SkyFleet';
import { IssobellaRing } from './IssobellaRing';
import { OrbitalWorlds } from './OrbitalWorlds';
import { SpaceBackdrop } from './SpaceBackdrop';
import { SolarSystem } from './SolarSystem';
import { HiranSun } from './HiranSun';
import type { PlanetId } from './planetCatalog';
import { useLinkEngine, registerWorldTargets } from './LinkEngine';

/** Portrait / úzké viewporty: širší fov + větší počáteční odstup,
 *  ať planeta nezaplní celý záběr a zůstane vidět kontext. */
function ResponsiveFraming() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const didInit = useRef(false);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = aspect < 0.75 ? 66 : aspect < 1.1 ? 60 : 54;
    camera.updateProjectionMatrix();
    if (!didInit.current) {
      didInit.current = true;
      const d = aspect < 0.75 ? 1.85 : aspect < 1.1 ? 1.45 : 1;
      // kamera stojí u Země (ta je na 30) — ne u Slunce, jinak záběr driftuje
      camera.position.set(EARTH_ORBIT_R + 11 * d, 6 * d, 19 * d);
    }
  }, [camera, size]);
  return null;
}

/** Kamera stojí na Zemi. Když se otevře Hiran, odletí ke Slunci a zůstane
 *  na jeho oběžné dráze; Země obíhá dál, takže scéna nezamrzne. */

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
  onSelectPlanet,
  onSelectMission,
  focus = 'earth',
  hiranState = 'idle',
  fleetLeg = null,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  /** Klik na planetu — přiletí a otevře panel s CTA. */
  onSelectPlanet?: (id: PlanetId) => void;
  /** Klik na L5 misii na glóbu — stejná navigace jako planeta. */
  onSelectMission?: (key: string) => void;
  focus?: string;
  hiranState?: HiranState;
  fleetLeg?: FleetLeg | null;
}) {
  const earthSys = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const earthAngle = useRef(Math.PI * 0.18);
  const [reducedMotion, setReducedMotion] = useState(false);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const linkEngine = useLinkEngine();
  const earthPosVec = useMemo(() => new THREE.Vector3(EARTH_ORBIT_R, 0, 0), []);
  const lastFleet = useRef(new THREE.Vector3());

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  // Změna fokusu = označit cíl v engine. Skutečný přelet spustí update()
  // ve `useFrame` s živým kontextem (kamera, controls, čas, poloha Země).
  useEffect(() => {
    linkEngine.flyTo(focus);
  }, [focus, linkEngine]);

  // Světy jsou data — registrují se do stejného engine jako planety a misie.
  useEffect(() => {
    registerWorldTargets(linkEngine, worlds);
  }, [worlds, linkEngine]);

  // Hluboký odkaz / rychlý výběr může předběhnout katalog: `world:` cíl
  // vznikne až s worlds — pak se focus doletí znovu (jinak by zůstal na Zemi).
  useEffect(() => {
    if (!focus.startsWith('world:')) return;
    if (linkEngine.getCurrentFocus() === focus) return;
    if (!linkEngine.getTarget(focus)) return;
    linkEngine.flyTo(focus);
  }, [worlds, focus, linkEngine]);

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

  useFrame((state, delta) => {
    const { clock } = state;
    if (typeof window !== 'undefined') {
      (window as any).__nirvanaCamera = camera;
      (window as any).__nirvanaControls = controls.current;
      (window as any).__nirvanaLink = linkEngine;
    }
    // zemská soustava obíhá Slunce — celý vesmír se točí kolem něj
    if (!reducedMotion) earthAngle.current += delta * EARTH_ORBIT_SPEED;
    const ex = Math.cos(earthAngle.current) * EARTH_ORBIT_R;
    const ez = Math.sin(earthAngle.current) * EARTH_ORBIT_R;
    earthPosVec.set(ex, 0, ez);
    if (earthSys.current) earthSys.current.position.set(ex, 0, ez);
    lightTarget.position.set(ex, 0, ez);
    // světlo stojí na straně Slunce → planeta má vždy denní/noční stranu správně
    if (light.current) light.current.position.set(ex * 0.5, 5, ez * 0.5);
    if (!controls.current) return;

    // Všechny přelety i sledování pohyblivých cílů (včetně Země) řeší engine.
    linkEngine.update(
      {
        camera,
        controls: controls.current,
        clock,
        earthPos: earthPosVec,
        reducedMotion,
        lang: 'cs',
      },
      delta,
    );
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
        <NewEarth onOpenMatrix={() => onOpen('matrix')} onSelectMission={onSelectMission} />
        <SailingArk onOpen={() => onOpen('archa')} />
        <SkyFleet onOpen={() => onOpen('fleet')} reducedMotion={reducedMotion} />
        {fleetLeg && <FleetRoute key={fleetLeg} leg={fleetLeg} reducedMotion={reducedMotion} />}
        <IssobellaRing
          worlds={split.ring}
          portal={ringPortal}
          onOpen={onOpen}
          onSelectWorld={onSelectWorld}
        />
        <OrbitalWorlds worlds={split.orbit} onSelectWorld={onSelectWorld} />
      </group>

      {/* brána už nebydlí v zemské soustavě — je dítětem Jupiteru */}
      <SolarSystem
        onOpenPark={() => onOpen('park')}
        onSelectPlanet={onSelectPlanet}
        focused={focus}
        gatePortal={gatePortal}
        onOpenPortal={onOpen}
      />
      <HiranSun state={hiranState} onOpen={() => onOpen('hiran')} detail={focus === 'sun'} />

      <ResponsiveFraming />
      <OrbitControls
        ref={controls as never}
        makeDefault
        target={[EARTH_ORBIT_R, 0, 0]}
        autoRotate={!reducedMotion && !linkEngine.isTransitioning()}
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={3}
        maxDistance={1300}
        minPolarAngle={0.4}
        maxPolarAngle={2.7}
      />
    </>
  );
}
