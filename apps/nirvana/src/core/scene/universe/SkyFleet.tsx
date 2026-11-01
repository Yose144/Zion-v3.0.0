'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fleetPosition, fleetHeading, latLonToVec3, moonPosition, PLANET_R, RING_R } from './positions';
import { LINK_ACTIVE_OPACITY, LINK_COLOR, LINK_OPACITY, LINK_RADIUS } from './links';
import { TextLabel } from './Label';
import { NabukanoModel } from '../../../../../shared/scenes/kit/vessels';

/**
 * Nebeská flotila — pohyblivý uzel L6 (kniha Nabukano).
 *
 * Geometrie lodi je v `apps/shared/scenes/kit/vessels.tsx` (jeden zdroj pro
 * scénu vesmíru, prezentaci i webový náhled). Tahle komponenta řeší jen to,
 * co je scéně vlastní: oběžnou dráhu, natočení po tečně, klik a popisek.
 *
 * Pozice i natočení jdou z `fleetPosition()`/`fleetHeading()` — stejný
 * vzorec používá fokus kamery, takže se nemohou rozejít.
 */
export function SkyFleet({ onOpen, reducedMotion = false }: { onOpen: () => void; reducedMotion?: boolean }) {
  const carrier = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const [x, y, z] = fleetPosition(t);
    if (carrier.current) {
      carrier.current.position.set(x, y, z);
      carrier.current.rotation.y = fleetHeading(t);
    }
  });

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <group ref={carrier} scale={4}>
      {/* hit area — flotila je z dálky malá, klikat se musí dát vždy */}
      <mesh
        visible={false}
        onClick={(e) => {
          stop(e);
          onOpen();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <sphereGeometry args={[0.8, 10, 8]} />
      </mesh>

      <group
        onClick={(e) => {
          stop(e);
          onOpen();
        }}
      >
        <NabukanoModel animate={!reducedMotion} />
      </group>

      <TextLabel text="Nabukano · Nebeská flotila" position={[0, 0.5, 0]} color="#9fe4ff" height={0.055} onClick={onOpen} />
    </group>
  );
}

/** Trasa (leg) — koncept, ne let. LUMI je pozemský uzel v Kostarice. */
export type FleetLeg = 'lumi' | 'issobella' | 'matrix';

/** Souřadnice pozemního uzlu LUMI (Nová Amerika, Kostarika) — stejné jako v freeworld-sites. */
const LUMI = { lat: 9.75, lon: -83.75 };
const RING_TILT = new THREE.Euler(0.32, 0, -0.14);
const TRIP_SECONDS = 6;

/**
 * Oblouk trasy od startu k flotile. Kreslí se jen vybraný leg; start i cíl se
 * zamrazí v okamžiku výběru (remount přes `key`), takže se geometrie nemusí
 * přepočítávat každý frame a oblouk se nerozjede pod rukama.
 *
 * Je to **animace konceptu**, ne simulace letu: žádná fyzika, žádný čas
 * příletu, žádný slib. Konec trasy je tam, kde flotila v tu chvíli je.
 */
export function FleetRoute({ leg, reducedMotion = false }: { leg: FleetLeg; reducedMotion?: boolean }) {
  const clock = useThree((s) => s.clock);
  const marker = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const startedAt = useRef<number | null>(null);

  const curve = useMemo(() => {
    const t = clock.elapsedTime;
    const fleet = new THREE.Vector3(...fleetPosition(t));
    // 'matrix' je jediný leg, který vede Z doku: flotila → Měsíc (Shackleton).
    const start =
      leg === 'matrix'
        ? fleet.clone()
        : leg === 'lumi'
          ? new THREE.Vector3(...latLonToVec3(LUMI.lat, LUMI.lon, PLANET_R + 0.04))
          : new THREE.Vector3(Math.cos(0.55) * RING_R, 0, Math.sin(0.55) * RING_R).applyEuler(RING_TILT);
    const end = leg === 'matrix' ? new THREE.Vector3(...moonPosition(t)) : fleet;
    const mid = start.clone().lerp(end, 0.5);
    // oblouk se zvedá podle vzdálenosti — krátký skok není půl kruhu
    mid.y += start.distanceTo(end) * 0.34;
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [leg, clock]);

  useFrame(({ clock: c }) => {
    if (startedAt.current === null) startedAt.current = c.elapsedTime;
    const u = reducedMotion ? 1 : Math.min(1, (c.elapsedTime - startedAt.current) / TRIP_SECONDS);
    if (marker.current) marker.current.position.copy(curve.getPointAt(u));
    if (glow.current) glow.current.opacity = u < 1 ? LINK_ACTIVE_OPACITY : LINK_OPACITY + Math.sin(c.elapsedTime * 2.4) * 0.15;
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 72, LINK_RADIUS, 5, false]} />
        <meshBasicMaterial
          color={LINK_COLOR}
          transparent
          opacity={LINK_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={marker} position={curve.getPointAt(0)}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshBasicMaterial ref={glow} color="#bfe9ff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}
