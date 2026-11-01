'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fleetPosition, fleetHeading, latLonToVec3, moonPosition, PLANET_R, RING_R } from './positions';
import { TextLabel } from './Label';
import { quality } from '../../../../../shared/scenes/kit/quality';

/**
 * Nebeská flotila — pohyblivý uzel L6 (kniha Nabukano).
 *
 * Kanonická podoba je **studie 02** (`heros/habuk/Nabukano_ Three-Berth
 * Docking Study.png`): dlouhý hřeben s rotujícím obytným prstenci a pod ním
 * **dokovací rám se třemi kotvišti**, na jehož konci visí skutečná lucerna.
 * Tři Marie přisedají zespodu — nevisí kolem trupu.
 *
 * Detail (N2): okna prstence i obytné přídě jsou **instancované** (jeden draw
 * call na řadu), rám má příhradovinu a svislé vzpěry, příď prosklenou zahradu
 * a lucerna má klec se čtyřmi sloupky. Počet instancí klesá s tierem kvality.
 *
 * Klik otevře okno flotily; scéna sama nikam nenaviguje. Pozice i natočení
 * jdou z `fleetPosition()`/`fleetHeading()` — stejný vzorec používá fokus
 * kamery, takže se nemohou rozejít.
 */

const HULL = '#22384f';
const HULL_LIGHT = '#3d5570';
const DECK = '#e6dcc6';
const GOLD = '#d8b46a';
const FRAME = '#8f9aa8';
const TANK = '#d9dde4';

/** Tři doprovodné lodě — jména z knihy, tvary z desky. */
const SISTERS = [
  { key: 'santa', color: '#e0403d', x: -0.3, type: 'survey' as const },
  { key: 'fatima', color: '#f2efe4', x: 0.02, type: 'shuttle' as const },
  { key: 'nieves', color: '#e8bf6a', x: 0.34, type: 'cargo' as const },
];

/** Doprovodná loď: průzkumný člun / lunární transport / nákladní koráb. */
function SkyMaria({ color, type }: { color: string; type: 'survey' | 'shuttle' | 'cargo' }) {
  const cargo = type === 'cargo';
  const shuttle = type === 'shuttle';
  return (
    <group scale={cargo ? 1.15 : shuttle ? 0.95 : 0.8}>
      <mesh castShadow>
        <boxGeometry args={[cargo ? 0.3 : 0.26, 0.045, cargo ? 0.15 : shuttle ? 0.075 : 0.06]} />
        <meshStandardMaterial color={HULL} roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[cargo ? 0.18 : 0.16, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[cargo ? 0.055 : 0.028, 0.09, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[-0.02, 0.032, 0]}>
        <boxGeometry args={[cargo ? 0.14 : 0.1, 0.026, cargo ? 0.09 : 0.05]} />
        <meshStandardMaterial color={DECK} roughness={0.7} />
      </mesh>
      {shuttle &&
        [1, -1].map((side) => (
          <mesh key={side} position={[-0.06, 0, side * 0.075]}>
            <capsuleGeometry args={[0.018, 0.06, 4, 8]} />
            <meshStandardMaterial color={HULL_LIGHT} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
      <mesh position={[-0.02, 0.018, cargo ? 0.078 : 0.033]}>
        <boxGeometry args={[cargo ? 0.12 : 0.08, 0.009, 0.004]} />
        <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2} />
      </mesh>
      <mesh position={[cargo ? 0.14 : 0.12, 0.028, 0]}>
        <sphereGeometry args={[0.013, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

const dummy = new THREE.Object3D();

/** Matice pro instancované prvky — počítá se jednou, ne každý frame. */
function useInstances(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  build: (d: THREE.Object3D, i: number) => void,
  count: number,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      build(dummy, i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function SkyFleet({ onOpen, reducedMotion = false }: { onOpen: () => void; reducedMotion?: boolean }) {
  const carrier = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const tier = quality().tier;
  const dense = tier === 'A';
  const ringWindows = dense ? 32 : 20;
  const hullWindows = dense ? 10 : 6;
  const braces = dense ? 14 : 8;

  // ── instancované prvky trupu ────────────────────────────────────────────
  const ringWinRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    ringWinRef,
    (d, i) => {
      const a = (i / ringWindows) * Math.PI * 2;
      d.position.set(0.12 + 0.205 * 0, Math.cos(a) * 0.205, Math.sin(a) * 0.205);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    },
    ringWindows,
    [ringWindows],
  );

  const hullWinRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    hullWinRef,
    (d, i) => {
      const row = i % 2;
      const col = Math.floor(i / 2);
      const x = 0.24 + col * 0.032;
      d.position.set(x, row ? 0.05 : -0.01, 0.101);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    },
    hullWindows * 2,
    [hullWindows],
  );

  const hullWinBack = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = hullWinBack.current;
    if (!mesh) return;
    for (let i = 0; i < hullWindows * 2; i++) {
      const row = i % 2;
      const col = Math.floor(i / 2);
      dummy.position.set(0.24 + col * 0.032, row ? 0.05 : -0.01, -0.101);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [hullWindows]);

  const tanksRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    tanksRef,
    (d, i) => {
      d.position.set(-0.34, i ? 0.06 : -0.06, 0);
      d.rotation.set(0, 0, Math.PI / 2);
      d.scale.setScalar(1);
    },
    2,
    [],
  );

  const braceRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    braceRef,
    (d, i) => {
      const t = i / Math.max(1, braces - 1);
      d.position.set(-0.42 + t * 0.84, 0, 0);
      d.rotation.set(i % 2 ? 0.55 : -0.55, 0, Math.PI / 2);
      d.scale.set(1, 1, 1);
    },
    braces,
    [braces],
  );

  const strutRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    strutRef,
    (d, i) => {
      d.position.set(-0.3 + i * 0.2, -0.07, 0);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    },
    4,
    [],
  );

  const berthRef = useRef<THREE.InstancedMesh>(null);
  useInstances(
    berthRef,
    (d, i) => {
      d.position.set(SISTERS[i].x, -0.012, 0);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    },
    SISTERS.length,
    [],
  );

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const [x, y, z] = fleetPosition(t);
    if (carrier.current) {
      carrier.current.position.set(x, y, z);
      carrier.current.rotation.y = fleetHeading(t);
    }
    // obytný prstenec se otáčí kolem podélné osy trupu (lokální x)
    if (ring.current) ring.current.rotation.x = t * 0.35;
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
        {/* ── hřeben a obytná příď (01 můstek, 02 knihovna / jídelna) ── */}
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.08, 0.16]} />
          <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.4} />
        </mesh>
        {/* obytný válec vpředu — okna jsou instancovaná v pruzích */}
        <mesh position={[0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.075, 0.07, 0.3, 16]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.38} metalness={0.45} />
        </mesh>
        {/* prosklená zahrada (03) — pás zeleně za trupem */}
        <mesh position={[0.3, 0.062, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 12, 1, true, -0.6, 1.2]} />
          <meshStandardMaterial color="#9fd8a8" emissive="#2f7d4a" emissiveIntensity={0.9} transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
        {/* okna obytné přídě — dva pásy, oba boky, jeden draw call na pás */}
        <instancedMesh ref={hullWinRef} args={[undefined, undefined, hullWindows * 2]} frustumCulled={false}>
          <boxGeometry args={[0.02, 0.012, 0.004]} />
          <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
        </instancedMesh>
        <instancedMesh ref={hullWinBack} args={[undefined, undefined, hullWindows * 2]} frustumCulled={false}>
          <boxGeometry args={[0.02, 0.012, 0.004]} />
          <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
        </instancedMesh>
        {/* příď */}
        <mesh position={[0.56, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.07, 0.12, 12]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.35} metalness={0.5} />
        </mesh>
        {/* záď + nádrže (06 v desce = technické zázemí) */}
        <mesh position={[-0.45, 0, 0]}>
          <boxGeometry args={[0.18, 0.075, 0.15]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.5} metalness={0.4} />
        </mesh>
        <instancedMesh ref={tanksRef} args={[undefined, undefined, 2]} frustumCulled={false}>
          <cylinderGeometry args={[0.03, 0.03, 0.15, 10]} />
          <meshStandardMaterial color={TANK} roughness={0.35} metalness={0.6} />
        </instancedMesh>
        {/* solární křídla + radiátory */}
        {[1, -1].map((s) => (
          <mesh key={`wing-${s}`} position={[-0.38, s * 0.03, s * 0.13]} rotation={[s * 0.25, 0, 0]}>
            <boxGeometry args={[0.16, 0.004, 0.06]} />
            <meshStandardMaterial color="#1a2a55" emissive="#2b4a9e" emissiveIntensity={0.35} roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={`rad-${s}`} position={[-0.42, s * 0.075, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.12, 0.003, 0.2]} />
            <meshStandardMaterial color="#c9cfd8" roughness={0.35} metalness={0.7} />
          </mesh>
        ))}

        {/* ── rotující obytný prstenec (03) ─────────────────────────── */}
        <group ref={ring} position={[0.12, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.2, 0.026, 8, dense ? 40 : 24]} />
            <meshStandardMaterial color="#e9e3d4" roughness={0.45} metalness={0.35} emissive="#6a5320" emissiveIntensity={0.25} />
          </mesh>
          {/* okna prstence — instancovaná kolem obvodu */}
          <instancedMesh ref={ringWinRef} args={[undefined, undefined, ringWindows]} frustumCulled={false}>
            <boxGeometry args={[0.018, 0.012, 0.012]} />
            <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={1.8} />
          </instancedMesh>
          {/* zelený pás prstence */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.222, 0.004, 5, dense ? 36 : 20]} />
            <meshStandardMaterial color="#2f9e52" emissive="#1d7a3f" emissiveIntensity={0.5} roughness={0.8} />
          </mesh>
        </group>

        {/* ── dokovací rám se třemi kotvišti (06), pod trupem ───────── */}
        <group position={[0.02, -0.15, 0]}>
          {/* dvě kolejnice */}
          {[1, -1].map((s) => (
            <mesh key={`rail-${s}`} position={[0, 0, s * 0.15]}>
              <boxGeometry args={[0.86, 0.012, 0.02]} />
              <meshStandardMaterial color={FRAME} metalness={0.75} roughness={0.35} />
            </mesh>
          ))}
          {/* příčníky */}
          {[-0.42, -0.14, 0.14, 0.42].map((x) => (
            <mesh key={`cross-${x}`} position={[x, 0, 0]}>
              <boxGeometry args={[0.014, 0.012, 0.32]} />
              <meshStandardMaterial color={FRAME} metalness={0.75} roughness={0.35} />
            </mesh>
          ))}
          {/* příhradovina mezi kolejnicemi — instancovaná, střídavé diagonály */}
          <instancedMesh ref={braceRef} args={[undefined, undefined, braces]} frustumCulled={false}>
            <boxGeometry args={[0.006, 0.006, 0.3]} />
            <meshStandardMaterial color="#7e8896" metalness={0.7} roughness={0.4} />
          </instancedMesh>
          {/* svislé vzpěry k trupu */}
          <instancedMesh ref={strutRef} args={[undefined, undefined, 4]} frustumCulled={false}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 6]} />
            <meshStandardMaterial color="#9aa3b2" metalness={0.75} roughness={0.4} />
          </instancedMesh>
          {/* tři kotviště */}
          <instancedMesh ref={berthRef} args={[undefined, undefined, SISTERS.length]} frustumCulled={false}>
            <boxGeometry args={[0.3, 0.008, 0.26]} />
            <meshStandardMaterial color="#2c3b4c" metalness={0.5} roughness={0.55} />
          </instancedMesh>
          {/* tři doprovodné lodě v kotvištích */}
          {SISTERS.map((s) => (
            <group key={`ship-${s.key}`} position={[s.x, 0.012, 0]}>
              <SkyMaria color={s.color} type={s.type} />
            </group>
          ))}

          {/* ── lucerna na konci rámu (07) ─────────────────────────── */}
          <group position={[0.5, 0, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
              <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[0.055, 0.065, 0.055]} />
              <meshStandardMaterial color="#ffd79a" emissive="#ffb254" emissiveIntensity={2.2} transparent opacity={0.92} />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[0.062, 0.072, 0.062]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} wireframe />
            </mesh>
            {/* čtyři sloupky klece */}
            {[
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ].map(([sx, sz]) => (
              <mesh key={`post-${sx}-${sz}`} position={[sx * 0.028, -0.01, sz * 0.028]}>
                <boxGeometry args={[0.004, 0.07, 0.004]} />
                <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.3} />
              </mesh>
            ))}
            <mesh position={[0, -0.01, 0]} scale={0.095}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshBasicMaterial color="#ffcf8a" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </group>
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
    if (glow.current) glow.current.opacity = u < 1 ? 0.85 : 0.35 + Math.sin(c.elapsedTime * 2.4) * 0.15;
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 72, 0.011, 5, false]} />
        <meshBasicMaterial color="#7fd3ff" transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={marker} position={curve.getPointAt(0)}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshBasicMaterial ref={glow} color="#bfe9ff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}
