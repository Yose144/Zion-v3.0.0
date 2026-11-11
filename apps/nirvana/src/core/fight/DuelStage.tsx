'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { dampFactor } from '@/core/design/motion';
import {
  ARENA_HALF,
  BALL_HALF,
  GOAL_HEIGHT,
  HILL_HALF,
  P,
  bodyCenterOf,
  type RagdollBall,
  type RagdollFighter,
} from './ragdoll';

/**
 * MERKUR — klec v merkurím úsvitu (ragdoll éra).
 *
 * Scéna je jedna pro sólo i multiplayer (lekce z Venuše: vizuál tratě je
 * jeden soubor). `goals` přidá branky pro ragdoll fotbal.
 */
export function DuelStage({ goals = false, hill = false }: { goals?: boolean; hill?: boolean }) {
  const sunGeo = useMemo(() => new THREE.CircleGeometry(11, 40), []);
  const haloGeo = useMemo(() => new THREE.RingGeometry(11.3, 15.2, 40), []);
  const half = goals ? BALL_HALF : ARENA_HALF;
  return (
    <>
      <color attach="background" args={['#2b1a1a']} />
      <fog attach="fog" args={['#2b1a1a', 24, 100]} />

      <ambientLight intensity={0.78} color="#e4c49b" />
      <hemisphereLight args={['#edb87d', '#30201b', 1.05]} />
      <directionalLight position={[14, 20, 8]} intensity={2.1} color="#ffe0b3" />
      <pointLight position={[0, 5, 4]} intensity={34} color="#ffb877" distance={34} decay={2} />

      {/* strž pod klecí — delší, aby v záběru nebyl vidět okraj */}
      <mesh position={[0, -0.25, -8]}>
        <boxGeometry args={[half * 2 + 6, 0.5, 40]} />
        <meshStandardMaterial color="#89765f" roughness={0.92} />
      </mesh>
      {/* King of the Hill — zóna uprostřed */}
      {hill && <HillZone />}

      {/* středová linka */}
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 8]} />
        <meshBasicMaterial color="#ffb46a" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* sloupky a břevno — "klec" */}
      {[-half - 1.2, half + 1.2].map((x) => (
        <mesh key={x} position={[x, 1.5, -3.4]}>
          <boxGeometry args={[0.24, 3, 0.24]} />
          <meshStandardMaterial color="#4c4438" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3, -3.4]}>
        <boxGeometry args={[half * 2 + 2.8, 0.14, 0.14]} />
        <meshStandardMaterial color="#4c4438" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* branky pro ragdoll fotbal */}
      {goals && (
        <group>
          {[-1, 1].map((side) => {
            const x = side * BALL_HALF;
            const tint = side < 0 ? '#7fd1e3' : '#ffb46a';
            return (
              <group key={side}>
                {/* tyče */}
                {[-1.7, 1.7].map((z) => (
                  <mesh key={z} position={[x, GOAL_HEIGHT / 2, z]}>
                    <boxGeometry args={[0.14, GOAL_HEIGHT, 0.14]} />
                    <meshStandardMaterial color={tint} metalness={0.35} roughness={0.55} emissive={tint} emissiveIntensity={0.16} />
                  </mesh>
                ))}
                {/* břevno */}
                <mesh position={[x, GOAL_HEIGHT, 0]}>
                  <boxGeometry args={[0.14, 0.14, 3.54]} />
                  <meshStandardMaterial color={tint} metalness={0.35} roughness={0.55} emissive={tint} emissiveIntensity={0.16} />
                </mesh>
                {/* síť za brankou */}
                <mesh position={[x + side * 0.8, GOAL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[3.4, GOAL_HEIGHT]} />
                  <meshBasicMaterial color={tint} transparent opacity={0.08} side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
                {/* branková čára */}
                <mesh position={[x, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.1, 3.6]} />
                  <meshBasicMaterial color={tint} transparent opacity={0.55} toneMapped={false} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* merkurí hřbety v dálce */}
      {[
        [-16, 2.4, -34, 26, 5, 8],
        [10, 3.4, -44, 34, 7, 10],
        [30, 2, -30, 20, 4, 7],
      ].map(([x, y, z, w, h, d], index) => (
        <mesh key={index} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#573b2d" roughness={1} />
        </mesh>
      ))}

      {/* slunce nízko nad obzorem (Merkur je k němu blízko — záměrně malé a jasné) */}
      <mesh geometry={sunGeo} position={[-30, 10, -67]}>
        <meshBasicMaterial color="#ffe9b0" toneMapped={false} fog={false} />
      </mesh>
      <mesh geometry={haloGeo} position={[-30, 10, -67.2]}>
        <meshBasicMaterial color="#ffcf7a" transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </>
  );
}

/**
 * King of the Hill zóna — světelný pás a prstenec. Drží se jen v rozsahu
 * `HILL_HALF`; kdo tam stojí sám, bere si čas.
 */
function HillZone() {
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((frame) => {
    if (!ringMaterial.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(frame.clock.elapsedTime * 2.2);
    ringMaterial.current.opacity = 0.16 + pulse * 0.16;
  });
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HILL_HALF * 2, 5]} />
        <meshBasicMaterial color="#c8f56a" transparent opacity={0.09} toneMapped={false} depthWrite={false} />
      </mesh>
      {[-HILL_HALF, HILL_HALF].map((x) => (
        <mesh key={x} position={[x, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 5]} />
          <meshBasicMaterial color="#c8f56a" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HILL_HALF * 0.7, HILL_HALF * 0.76, 40]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color="#c8f56a"
          transparent
          opacity={0.2}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[HILL_HALF, HILL_HALF, 2.2, 32, 1, true]} />
        <meshBasicMaterial color="#c8f56a" transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Kamera bokem jako u klasického beating baru. Střed záběru sleduje střed
 * mezi loutkami (a v ragdoll fotbale i míč, aby neutekl ze záběru).
 */
export function DuelCamera({
  a,
  b,
  ball = null,
  wide = false,
  xr = false,
  cameraRef = null,
}: {
  a: MutableRefObject<RagdollFighter>;
  b: MutableRefObject<RagdollFighter>;
  ball?: MutableRefObject<RagdollBall | null> | null;
  /** Ragdoll fotbal: musí být vidět obě branky (klec je 20 m široká). */
  wide?: boolean;
  /** Ve VR kameru řídí headset — nesaháme na ni. */
  xr?: boolean;
  /** Pro plovoucí čísla (2D canvas nad scénou) — kamera z r3f. */
  cameraRef?: MutableRefObject<THREE.Camera | null> | null;
}) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.2, 0), []);
  const desired = useMemo(() => new THREE.Vector3(0, 2.1, 12), []);
  const previousHp = useRef({ a: a.current.hp, b: b.current.hp });
  const hitShake = useRef(0);

  useFrame((frame, delta) => {
    if (cameraRef) cameraRef.current = camera;
    if (xr) return;
    const centerA = bodyCenterOf(a.current);
    const centerB = bodyCenterOf(b.current);
    const ballNow = ball?.current ?? null;

    let midX = (centerA.x + centerB.x) / 2;
    let spread = Math.abs(centerA.x - centerB.x);
    if (ballNow) {
      // míč je součást záběru — jinak by při dlouhém kopu zmizel
      midX = (midX * 2 + ballNow.x) / 3;
      spread = Math.max(spread, Math.abs(centerA.x - ballNow.x), Math.abs(centerB.x - ballNow.x));
    }
    midX = THREE.MathUtils.clamp(midX, -3.2, 3.2);
    spread = Math.min(spread, 15);

    const k = dampFactor(delta);
    desired.set(
      midX,
      wide ? 3.6 : 2.05,
      wide ? 23 + Math.min(3, spread * 0.14) : 9.0 + Math.min(4.6, spread * 0.28),
    );
    camera.position.lerp(desired, k);
    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = wide ? 62 : 42;
      const desiredFov = baseFov + Math.min(wide ? 8 : 19, Math.max(0, spread - (wide ? 8 : 4)) * (wide ? 0.8 : 1.25));
      camera.fov += (desiredFov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    if (a.current.hp < previousHp.current.a || b.current.hp < previousHp.current.b) hitShake.current = 0.14;
    previousHp.current.a = a.current.hp;
    previousHp.current.b = b.current.hp;
    hitShake.current = Math.max(0, hitShake.current - delta);
    if (hitShake.current > 0) {
      const strength = hitShake.current / 0.14;
      camera.position.x += Math.sin(frame.clock.elapsedTime * 82) * 0.055 * strength;
      camera.position.y += Math.cos(frame.clock.elapsedTime * 67) * 0.035 * strength;
    }
    target.set(midX, 1.2, 0);
    camera.lookAt(target);
  });
  return null;
}

/** Míč — kreslí se přímo z enginu (sólo) nebo ze snapshotu (online). */
export function RagdollBall3D({ ball }: { ball: MutableRefObject<RagdollBall | null> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const current = ball.current;
    if (!mesh.current || !current) return;
    mesh.current.position.set(current.x, current.y, 0);
    mesh.current.rotation.z -= (current.vx / 12) * 0.08;
    if (shadow.current && shadowMaterial.current) {
      const airborne = Math.min(1, Math.max(0, (current.y - 0.42) / 2.6));
      shadow.current.position.set(current.x, 0.018, 0);
      shadow.current.scale.setScalar(1 - airborne * 0.5);
      shadowMaterial.current.opacity = 0.28 * (1 - airborne * 0.65);
    }
  });
  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial ref={shadowMaterial} color="#1a0d08" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.42, 18, 14]} />
        <meshStandardMaterial color="#f4e0b8" roughness={0.55} metalness={0.08} emissive="#ffb46a" emissiveIntensity={0.14} />
      </mesh>
    </>
  );
}
