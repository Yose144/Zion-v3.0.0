'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fleetPosition, fleetHeading, latLonToVec3, PLANET_R, RING_R } from './positions';
import { TextLabel } from './Label';

/**
 * Nebeská flotila — pohyblivý uzel L6 (kniha Nabukano).
 *
 * Kanonická podoba je **studie 02** (`heros/habuk/Nabukano_ Three-Berth
 * Docking Study.png`): dlouhý hřeben s rotujícím obytným prstencem a pod ním
 * **dokovací rám se třemi kotvišti**, na jehož konci visí skutečná lucerna.
 * Tři Marie přisedají zespodu — nevisí kolem trupu.
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
      {/* trup — nákladní je široký, průzkumný úzký */}
      <mesh castShadow>
        <boxGeometry args={[cargo ? 0.3 : 0.26, 0.045, cargo ? 0.15 : shuttle ? 0.075 : 0.06]} />
        <meshStandardMaterial color={HULL} roughness={0.45} metalness={0.35} />
      </mesh>
      {/* příď */}
      <mesh position={[cargo ? 0.18 : 0.16, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[cargo ? 0.055 : 0.028, 0.09, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.45} metalness={0.4} />
      </mesh>
      {/* nástavba / kokpit */}
      <mesh position={[-0.02, 0.032, 0]}>
        <boxGeometry args={[cargo ? 0.14 : 0.1, 0.026, cargo ? 0.09 : 0.05]} />
        <meshStandardMaterial color={DECK} roughness={0.7} />
      </mesh>
      {/* motorové gondoly — lunární transport je má vystrčené do stran */}
      {shuttle &&
        [1, -1].map((side) => (
          <mesh key={side} position={[-0.06, 0, side * 0.075]}>
            <capsuleGeometry args={[0.018, 0.06, 4, 8]} />
            <meshStandardMaterial color={HULL_LIGHT} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
      {/* teplá okna */}
      <mesh position={[-0.02, 0.018, cargo ? 0.078 : 0.033]}>
        <boxGeometry args={[cargo ? 0.12 : 0.08, 0.009, 0.004]} />
        <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2} />
      </mesh>
      {/* navigační světlo */}
      <mesh position={[cargo ? 0.14 : 0.12, 0.028, 0]}>
        <sphereGeometry args={[0.013, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SkyFleet({ onOpen, reducedMotion = false }: { onOpen: () => void; reducedMotion?: boolean }) {
  const carrier = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);

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
        {/* ── hřeben trupu ─────────────────────────────────────────── */}
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.1, 0.2]} />
          <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.4} />
        </mesh>
        {/* příď s můstkem */}
        <mesh position={[0.39, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.08, 0.22, 10]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.38} metalness={0.45} />
        </mesh>
        {/* záď + nádrže */}
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.22, 0.09, 0.18]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.5} metalness={0.4} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[-0.36, 0.075, s * 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 0.16, 10]} />
            <meshStandardMaterial color="#d9dde4" roughness={0.35} metalness={0.6} />
          </mesh>
        ))}
        {/* světelný pás oken na obou bocích trupu */}
        {[1, -1].map((s) => (
          <mesh key={`win-${s}`} position={[0.02, 0.018, s * 0.101]}>
            <boxGeometry args={[0.44, 0.012, 0.004]} />
            <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
          </mesh>
        ))}

        {/* ── rotující obytný prstenec (03) ─────────────────────────── */}
        <group ref={ring} position={[0.12, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.2, 0.028, 8, 36]} />
            <meshStandardMaterial color="#e9e3d4" roughness={0.45} metalness={0.35} emissive="#6a5320" emissiveIntensity={0.25} />
          </mesh>
          {/* okna prstence */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.22, 0.006, 6, 36]} />
            <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={1.6} />
          </mesh>
        </group>

        {/* ── dokovací rám se třemi kotvišti (06), pod trupem ───────── */}
        <group position={[0.02, -0.16, 0]}>
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
          {/* tři kotviště */}
          {SISTERS.map((s) => (
            <mesh key={`berth-${s.key}`} position={[s.x, -0.012, 0]}>
              <boxGeometry args={[0.3, 0.008, 0.26]} />
              <meshStandardMaterial color="#2c3b4c" metalness={0.5} roughness={0.55} />
            </mesh>
          ))}
          {/* tři doprovodné lodě v kotvištích */}
          {SISTERS.map((s) => (
            <group key={`ship-${s.key}`} position={[s.x, 0.012, 0]}>
              <SkyMaria color={s.color} type={s.type} />
            </group>
          ))}

          {/* ── lucerna na konci rámu (07) ─────────────────────────── */}
          <group position={[0.5, 0, 0]}>
            {/* závěs */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
              <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.4} />
            </mesh>
            {/* tělo lucerny */}
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[0.055, 0.065, 0.055]} />
              <meshStandardMaterial color="#ffd79a" emissive="#ffb254" emissiveIntensity={2.2} transparent opacity={0.92} />
            </mesh>
            {/* rám lucerny */}
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[0.062, 0.072, 0.062]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} wireframe />
            </mesh>
            {/* záře */}
            <mesh position={[0, -0.01, 0]} scale={0.16}>
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
export type FleetLeg = 'lumi' | 'issobella';

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
    const end = new THREE.Vector3(...fleetPosition(t));
    const start =
      leg === 'lumi'
        ? new THREE.Vector3(...latLonToVec3(LUMI.lat, LUMI.lon, PLANET_R + 0.04))
        : new THREE.Vector3(Math.cos(0.55) * RING_R, 0, Math.sin(0.55) * RING_R).applyEuler(RING_TILT);
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
