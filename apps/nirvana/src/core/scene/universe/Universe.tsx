'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import type { HiranState } from '@/core/hiran/presence';
import { worldSlot, EARTH_ORBIT_R, EARTH_ORBIT_SPEED, planetPosition, fleetPosition, moonPosition } from './positions';
import { NewEarth } from './NewEarth';
import { SailingArk } from './SailingArk';
import { SkyFleet, FleetRoute, type FleetLeg } from './SkyFleet';
import { IssobellaRing } from './IssobellaRing';
import { StarGate } from './StarGate';
import { OrbitalWorlds } from './OrbitalWorlds';
import { SpaceBackdrop } from './SpaceBackdrop';
import { PLANETS, SolarSystem, orbitRadius } from './SolarSystem';
import { HiranSun } from './HiranSun';

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
const SUN_CAM = new THREE.Vector3(17, 8, 17);
const SUN_TARGET = new THREE.Vector3(0, 0, 0);
/** Zdvižení kamery nad rovinu dráhy (aby se flotila nekoukala do hrany). */
const FLEET_CAM_LIFT = new THREE.Vector3(0, 1.6, 0);
const FLEET_UP = new THREE.Vector3(0, 1, 0);
const FLEET_CAM_TANGENT = new THREE.Vector3();

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
  focus = 'earth',
  hiranState = 'idle',
  fleetLeg = null,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  /** Klik na planetu — přiletí a otevře panel s CTA. */
  onSelectPlanet?: (id: 'mars' | 'venus' | 'jupiter' | 'mercury') => void;
  focus?: 'earth' | 'sun' | 'jupiter' | 'mars' | 'venus' | 'mercury' | 'fleet' | 'moon';
  hiranState?: HiranState;
  fleetLeg?: FleetLeg | null;
}) {
  const earthSys = useRef<THREE.Group>(null);
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const earthAngle = useRef(Math.PI * 0.18);
  const lastEarth = useRef(new THREE.Vector3(EARTH_ORBIT_R, 0, 0));
  const [reducedMotion, setReducedMotion] = useState(false);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const focusRef = useRef(focus);
  const progress = useRef(1);
  const fromCam = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());
  const jupiterTarget = useMemo(() => new THREE.Vector3(), []);
  const jupiterCam = useMemo(() => new THREE.Vector3(), []);
  const jupiterOffset = useMemo(() => new THREE.Vector3(24, 13, 28), []);
  const fleetTarget = useMemo(() => new THREE.Vector3(), []);
  const lastFleet = useRef(new THREE.Vector3());
  const fleetCam = useMemo(() => new THREE.Vector3(), []);

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

  useFrame(({ clock }, delta) => {
    // zemská soustava obíhá Slunce — celý vesmír se točí kolem něj
    if (!reducedMotion) earthAngle.current += delta * EARTH_ORBIT_SPEED;
    const ex = Math.cos(earthAngle.current) * EARTH_ORBIT_R;
    const ez = Math.sin(earthAngle.current) * EARTH_ORBIT_R;
    if (earthSys.current) earthSys.current.position.set(ex, 0, ez);
    lightTarget.position.set(ex, 0, ez);
    // světlo stojí na straně Slunce → planeta má vždy denní/noční stranu správně
    if (light.current) light.current.position.set(ex * 0.5, 5, ez * 0.5);
    if (!controls.current) return;

    // Země obíhá Slunce → kamera i cíl se posouvají s ní, aby záběr neutíkal.
    // (Dřív controls mířily na Slunce a Země nám proplouvala záběrem.)
    if (focusRef.current === 'earth' && progress.current >= 1) {
      const dx = ex - lastEarth.current.x;
      const dz = ez - lastEarth.current.z;
      if (dx !== 0 || dz !== 0) {
        camera.position.x += dx;
        camera.position.z += dz;
        controls.current.target.x += dx;
        controls.current.target.z += dz;
      }
    }
    lastEarth.current.set(ex, 0, ez);

    const focusPlanet = PLANETS.find((planet) => planet.id === focusRef.current);
    if (focusPlanet) {
      // Planeta obíhá — cíl i kamera se musí počítat každý frame stejným vzorcem.
      const index = PLANETS.indexOf(focusPlanet);
      const [px, py, pz] = planetPosition(
        focusPlanet.id,
        index,
        orbitRadius(focusPlanet.au),
        focusPlanet.speed,
        clock.elapsedTime,
      );
      const distance = Math.max(3.6, focusPlanet.size * 3.4 + 1.6);
      jupiterTarget.set(px, py + focusPlanet.size * 0.4, pz);
      jupiterCam.set(px + distance * 0.75, py + distance * 0.5, pz + distance);
      const p = (progress.current = Math.min(1, progress.current + delta / 1.8));
      const t = 1 - Math.pow(1 - p, 3);
      controls.current.target.lerpVectors(fromTarget.current, jupiterTarget, t);
      if (p < 1) camera.position.lerpVectors(fromCam.current, jupiterCam, t);
    } else if (focusRef.current === 'sun') {
      const p = (progress.current = Math.min(1, progress.current + delta / 1.6));
      const t = 1 - Math.pow(1 - p, 3);
      controls.current.target.lerpVectors(fromTarget.current, SUN_TARGET, t);
      if (p < 1) camera.position.lerpVectors(fromCam.current, SUN_CAM, t);
    } else if (focusRef.current === 'moon') {
      // Měsíc obíhá Zemi — cíl i kamera jedním vzorcem jako scéna.
      const mt = reducedMotion ? 0 : clock.elapsedTime;
      const [mx, my, mz] = moonPosition(mt);
      fleetTarget.set(ex + mx, my, ez + mz);
      const radial = fleetTarget.clone().normalize();
      const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
      fleetCam
        .copy(fleetTarget)
        .addScaledVector(radial, 3.2)
        .addScaledVector(tangent, 2.4)
        .add(FLEET_CAM_LIFT);
      const p = (progress.current = Math.min(1, progress.current + delta / 1.6));
      const t = 1 - Math.pow(1 - p, 3);
      controls.current.target.lerpVectors(fromTarget.current, fleetTarget, t);
      if (p < 1) {
        camera.position.lerpVectors(fromCam.current, fleetCam, t);
      } else if (lastFleet.current.lengthSq() > 0) {
        camera.position.addScaledVector(lastFleet.current, -1).add(fleetTarget);
      }
      lastFleet.current.copy(fleetTarget);
    } else if (focusRef.current === 'fleet') {
      // Flotila obíhá Zemi — cíl se musí počítat stejným vzorcem jako scéna.
      const ft = reducedMotion ? 0 : clock.elapsedTime;
      const [fx, fy, fz] = fleetPosition(ft);
      fleetTarget.set(ex + fx, fy, ez + fz);
      // Kamera stojí dál od Slunce než flotila: díváme se dovnitř soustavy,
      // takže slunce je za námi a ve záběru je flotila proti planetě.
      // Pohled z boku: čistě radiální kamera vidí trup zepředu (zkrácený).
      // Radiála + tečna dráhy dá 3/4 záběr, kde je vidět hřeben i rám s lucernou.
      const radial = fleetTarget.clone().normalize();
      const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
      fleetCam
        .copy(fleetTarget)
        .addScaledVector(radial, 4.0)
        .addScaledVector(tangent, 5.2)
        .add(FLEET_CAM_LIFT);
      const p = (progress.current = Math.min(1, progress.current + delta / 1.6));
      const t = 1 - Math.pow(1 - p, 3);
      controls.current.target.lerpVectors(fromTarget.current, fleetTarget, t);
      if (p < 1) {
        camera.position.lerpVectors(fromCam.current, fleetCam, t);
      } else if (lastFleet.current.lengthSq() > 0) {
        // Flotila obíhá dál. Bez tohohle by kamera zůstala stát a loď by
        // odplouvala ze záběru (0,34 jednotky za sekundu).
        camera.position.addScaledVector(lastFleet.current, -1).add(fleetTarget);
      }
      lastFleet.current.copy(fleetTarget);
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
        <NewEarth onOpenMatrix={() => onOpen('matrix')} />
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
        {gatePortal && <StarGate portal={gatePortal} onOpen={onOpen} />}
      </group>

      <SolarSystem onOpenPark={() => onOpen('park')} onSelectPlanet={onSelectPlanet} focused={focus} />
      <HiranSun state={hiranState} onOpen={() => onOpen('hiran')} detail={focus === 'sun'} />

      <ResponsiveFraming />
      <OrbitControls
        ref={controls as never}
        makeDefault
        target={[EARTH_ORBIT_R, 0, 0]}
        autoRotate={!reducedMotion}
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
