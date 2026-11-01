/** @jsxRuntime classic */
'use client';

/**
 * Nabukano — mateřská loď nebeské flotily.
 *
 * Jeden zdroj geometrie pro tři povrchy: hlavní scénu vesmíru v Nirvaně,
 * prezentaci `/present/nebeska-flotila` a webový 3D náhled na
 * `app.zionterranova.com/terranova/nabukano`. Kdyby se model kreslil na
 * každém povrchu zvlášť, rozejdou se detaily i cena (draw calls).
 *
 * Kanonická podoba = **studie 02** (`heros/habuk/Nabukano_ Three-Berth
 * Docking Study.png`): hřeben s rotujícím obytným prstencem a pod ním
 * dokovací rám se třemi kotvišti, na jehož konci visí lucerna.
 *
 * Pravidla: jen `three` + `@genesis/runtime` (žádné drei), procedurální
 * geometrie, okna instancovaná (jeden draw call na pás).
 */

import { React, useFrame, useRef, THREE } from '@genesis/runtime';
import { reducedMotion as prefersReduced } from './camera';

const HULL = '#22384f';
const HULL_LIGHT = '#3d5570';
const DECK = '#e6dcc6';
const GOLD = '#d8b46a';
const FRAME = '#8f9aa8';
const TANK = '#d9dde4';

/** Tři doprovodné lodě — jména z knihy, tvary z desky. */
export const SISTERS = [
  { key: 'santa', name: 'Santa María la Mayor', color: '#e0403d', x: -0.3, type: 'survey' as const },
  { key: 'fatima', name: 'Nossa Senhora de Fátima', color: '#f2efe4', x: 0.02, type: 'shuttle' as const },
  { key: 'nieves', name: 'María de las Nieves', color: '#e8bf6a', x: 0.34, type: 'cargo' as const },
];

export type SkyMariaType = 'survey' | 'shuttle' | 'cargo';

/** Doprovodná loď: průzkumný člun / lunární transport / nákladní koráb. */
export function SkyMaria({ color, type }: { color: string; type: SkyMariaType }) {
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

/** Pomocník pro instancované matice — spočítá se jednou, ne každý frame. */
function useInstanced(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  count: number,
  build: (dummy: THREE.Object3D, i: number) => void,
  deps: unknown[],
) {
  React.useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
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

/**
 * Celý Nabukano. `detail` = false je lehká varianta pro malý náhled
 * (méně instancí, žádná klec lucerny).
 */
export function NabukanoModel({ detail = true, animate = true }: { detail?: boolean; animate?: boolean }) {
  const ring = useRef<THREE.Group>(null);
  const ringWindows = detail ? 32 : 16;
  const hullWindows = detail ? 10 : 5;
  const braces = detail ? 14 : 6;

  const ringWinRef = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    ringWinRef,
    ringWindows,
    (d, i) => {
      const a = (i / ringWindows) * Math.PI * 2;
      d.position.set(0, Math.cos(a) * 0.205, Math.sin(a) * 0.205);
    },
    [ringWindows],
  );

  const hullWinFront = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    hullWinFront,
    hullWindows * 2,
    (d, i) => {
      const row = i % 2;
      const col = Math.floor(i / 2);
      d.position.set(0.24 + col * 0.032, row ? 0.05 : -0.01, 0.101);
    },
    [hullWindows],
  );

  const hullWinBack = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    hullWinBack,
    hullWindows * 2,
    (d, i) => {
      const row = i % 2;
      const col = Math.floor(i / 2);
      d.position.set(0.24 + col * 0.032, row ? 0.05 : -0.01, -0.101);
    },
    [hullWindows],
  );

  const tanksRef = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    tanksRef,
    2,
    (d, i) => {
      d.position.set(-0.34, i ? 0.06 : -0.06, 0);
      d.rotation.set(0, 0, Math.PI / 2);
    },
    [],
  );

  const braceRef = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    braceRef,
    braces,
    (d, i) => {
      const t = i / Math.max(1, braces - 1);
      d.position.set(-0.42 + t * 0.84, 0, 0);
      d.rotation.set(i % 2 ? 0.55 : -0.55, 0, Math.PI / 2);
    },
    [braces],
  );

  const strutRef = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    strutRef,
    4,
    (d, i) => {
      d.position.set(-0.3 + i * 0.2, -0.07, 0);
    },
    [],
  );

  const berthRef = useRef<THREE.InstancedMesh>(null);
  useInstanced(
    berthRef,
    SISTERS.length,
    (d, i) => {
      d.position.set(SISTERS[i].x, -0.012, 0);
    },
    [],
  );

  useFrame((_, delta) => {
    if (!animate || !ring.current || prefersReduced()) return;
    ring.current.rotation.x += delta * 0.35;
  });

  const seg = detail ? 16 : 10;

  return (
    <group>
      {/* ── hřeben a obytná příď (01 můstek, 02 knihovna / jídelna) ── */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.08, 0.16]} />
        <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.075, 0.07, 0.3, seg]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.38} metalness={0.45} />
      </mesh>
      {/* prosklená zahrada (03) */}
      <mesh position={[0.3, 0.062, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, 0.16, 12, 1, true, -0.6, 1.2]} />
        <meshStandardMaterial color="#9fd8a8" emissive="#2f7d4a" emissiveIntensity={0.9} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={hullWinFront} args={[undefined, undefined, hullWindows * 2]} frustumCulled={false}>
        <boxGeometry args={[0.02, 0.012, 0.004]} />
        <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
      </instancedMesh>
      <instancedMesh ref={hullWinBack} args={[undefined, undefined, hullWindows * 2]} frustumCulled={false}>
        <boxGeometry args={[0.02, 0.012, 0.004]} />
        <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
      </instancedMesh>
      <mesh position={[0.56, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.07, 0.12, seg]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.35} metalness={0.5} />
      </mesh>
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
        <mesh key={`rad-${s}`} position={[-0.42, s * 0.075, 0]}>
          <boxGeometry args={[0.12, 0.003, 0.2]} />
          <meshStandardMaterial color="#c9cfd8" roughness={0.35} metalness={0.7} />
        </mesh>
      ))}

      {/* ── rotující obytný prstenec ── */}
      <group ref={ring} position={[0.12, 0, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.2, 0.026, 8, detail ? 40 : 20]} />
          <meshStandardMaterial color="#e9e3d4" roughness={0.45} metalness={0.35} emissive="#6a5320" emissiveIntensity={0.25} />
        </mesh>
        <instancedMesh ref={ringWinRef} args={[undefined, undefined, ringWindows]} frustumCulled={false}>
          <boxGeometry args={[0.018, 0.012, 0.012]} />
          <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={1.8} />
        </instancedMesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.222, 0.004, 5, detail ? 36 : 18]} />
          <meshStandardMaterial color="#2f9e52" emissive="#1d7a3f" emissiveIntensity={0.5} roughness={0.8} />
        </mesh>
      </group>

      {/* ── dokovací rám se třemi kotvišti, pod trupem ── */}
      <group position={[0.02, -0.15, 0]}>
        {[1, -1].map((s) => (
          <mesh key={`rail-${s}`} position={[0, 0, s * 0.15]}>
            <boxGeometry args={[0.86, 0.012, 0.02]} />
            <meshStandardMaterial color={FRAME} metalness={0.75} roughness={0.35} />
          </mesh>
        ))}
        {[-0.42, -0.14, 0.14, 0.42].map((x) => (
          <mesh key={`cross-${x}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.014, 0.012, 0.32]} />
            <meshStandardMaterial color={FRAME} metalness={0.75} roughness={0.35} />
          </mesh>
        ))}
        <instancedMesh ref={braceRef} args={[undefined, undefined, braces]} frustumCulled={false}>
          <boxGeometry args={[0.006, 0.006, 0.3]} />
          <meshStandardMaterial color="#7e8896" metalness={0.7} roughness={0.4} />
        </instancedMesh>
        <instancedMesh ref={strutRef} args={[undefined, undefined, 4]} frustumCulled={false}>
          <cylinderGeometry args={[0.005, 0.005, 0.14, 6]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.75} roughness={0.4} />
        </instancedMesh>
        <instancedMesh ref={berthRef} args={[undefined, undefined, SISTERS.length]} frustumCulled={false}>
          <boxGeometry args={[0.3, 0.008, 0.26]} />
          <meshStandardMaterial color="#2c3b4c" metalness={0.5} roughness={0.55} />
        </instancedMesh>
        {SISTERS.map((s) => (
          <group key={`ship-${s.key}`} position={[s.x, 0.012, 0]}>
            <SkyMaria color={s.color} type={s.type} />
          </group>
        ))}

        {/* ── lucerna na konci rámu ── */}
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
          {detail &&
            [
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
  );
}
