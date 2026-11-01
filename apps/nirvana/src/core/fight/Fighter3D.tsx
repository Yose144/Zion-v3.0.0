'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { AvatarLook } from '../avatars/kit';
import { KICK, PUNCH, type Fighter } from './duel';

/**
 * Bojovník z primitiv, obrácený čelem k +X. Rodič určuje pozici a `facing`
 * se promítne otočením.group. Animace čte stav přímo ze `Fighter` (sólo i
 * multiplayer používají týž typ), takže žádný vlastní herní stav nevzniká.
 */
export function Fighter3D({
  state,
  look,
}: {
  state: MutableRefObject<Fighter>;
  look: AvatarLook;
}) {
  const flip = useRef<THREE.Group>(null);
  const frontArm = useRef<THREE.Group>(null);
  const backArm = useRef<THREE.Group>(null);
  const frontLeg = useRef<THREE.Group>(null);
  const fist = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);

  const colors = useMemo(
    () => ({
      robe: new THREE.Color(look.palette.robe),
      trim: new THREE.Color(look.palette.trim),
      glow: new THREE.Color(look.palette.glow),
    }),
    [look.palette],
  );

  useFrame((threeState) => {
    const fighter = state.current;
    const group = flip.current;
    if (!group) return;

    group.rotation.y = fighter.facing === 1 ? 0 : Math.PI;

    // KO — padne dozadu (lokálně záporně kolem Z) a klesne
    const koLean = fighter.ko ? -1.25 : 0;
    group.rotation.z += (koLean - group.rotation.z) * 0.18;
    group.position.y += ((fighter.ko ? -0.55 : 0) - group.position.y) * 0.18;

    // zkrácená porucha — rychlé chvění
    const shake = fighter.stun > 0 ? Math.sin(threeState.clock.elapsedTime * 42) * 0.035 : 0;

    // úder: start = závah, aktivní = natažené, recovery = stažení
    const attacking = fighter.attack;
    let armOut = 0;
    let legUp = 0;
    let showFist = false;
    if (attacking) {
      const spec = attacking.kind === 'punch' ? PUNCH : KICK;
      const total = spec.startup + spec.active + spec.recovery;
      const progress = Math.min(1, attacking.elapsed / total);
      if (attacking.elapsed < spec.startup) {
        armOut = -0.25 * (attacking.elapsed / spec.startup);
      } else if (attacking.elapsed < spec.startup + spec.active) {
        armOut = 1;
        showFist = true;
      } else {
        const rec = (attacking.elapsed - spec.startup - spec.active) / spec.recovery;
        armOut = 1 - rec;
      }
      if (attacking.kind === 'kick') {
        legUp = armOut; // kop zvedne nohu, pěst ponechá ruku
        if (!showFist && progress < 1) legUp = Math.max(legUp, 1 - progress);
      }
    }
    const lean = THREE.MathUtils.clamp(fighter.vx / 6, -1, 1) * 0.12;

    if (frontArm.current) {
      const punch = attacking?.kind === 'punch' ? armOut : 0;
      frontArm.current.rotation.z = -1.1 * punch + (fighter.blocking ? -1.9 : 0);
      frontArm.current.position.x = 0.18 + punch * 0.34 + shake;
      frontArm.current.position.y = 1.16 + (fighter.blocking ? 0.06 : 0) + punch * 0.05;
    }
    if (backArm.current) {
      backArm.current.rotation.z = fighter.blocking ? -1.9 : -0.35 - lean * 2;
      backArm.current.position.x = -0.12 + shake;
    }
    if (frontLeg.current) {
      frontLeg.current.rotation.z = -1.25 * legUp;
      frontLeg.current.position.x = 0.1 + legUp * 0.12 + shake;
    }
    if (fist.current) {
      fist.current.visible = showFist;
      fist.current.position.set(0.95 + armOut * 0.25, 1.16, 0);
    }
    if (shield.current) {
      shield.current.visible = fighter.blocking && !fighter.ko;
    }
    group.rotation.x = lean;
  });

  return (
    <group ref={flip}>
      {/* trup */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.36, 0.66, 0.5]} />
        <meshStandardMaterial color={colors.robe} roughness={0.85} />
      </mesh>
      {/* hlava */}
      <mesh position={[0.03, 1.56, 0]}>
        <sphereGeometry args={[0.17, 14, 12]} />
        <meshStandardMaterial color={colors.trim} roughness={0.7} />
      </mesh>
      {/* ramena */}
      <mesh position={[0.02, 1.36, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.66]} />
        <meshStandardMaterial color={colors.trim} roughness={0.8} />
      </mesh>
      {/* přední paže (úderná) — pivot u ramene */}
      <group ref={frontArm} position={[0.18, 1.16, 0]}>
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.44, 0.13, 0.13]} />
          <meshStandardMaterial color={colors.robe} roughness={0.85} />
        </mesh>
      </group>
      {/* zadní paže */}
      <group ref={backArm} position={[-0.12, 1.16, 0]}>
        <mesh position={[-0.16, 0, 0]}>
          <boxGeometry args={[0.4, 0.13, 0.13]} />
          <meshStandardMaterial color={colors.robe} roughness={0.85} />
        </mesh>
      </group>
      {/* pěst / chodidlo — svítí jen v aktivním okně */}
      <mesh ref={fist} visible={false}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshBasicMaterial color={colors.glow} toneMapped={false} />
      </mesh>
      {/* nohy */}
      <mesh position={[-0.1, 0.42, 0.12]}>
        <boxGeometry args={[0.16, 0.84, 0.16]} />
        <meshStandardMaterial color={colors.trim} roughness={0.9} />
      </mesh>
      <group ref={frontLeg} position={[0.1, 0.84, -0.12]}>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.16, 0.84, 0.16]} />
          <meshStandardMaterial color={colors.trim} roughness={0.9} />
        </mesh>
      </group>
      {/* blok — světelná deska před obličejem */}
      <mesh ref={shield} position={[0.42, 1.15, 0]} rotation={[0, Math.PI / 2, 0]} visible={false}>
        <planeGeometry args={[0.7, 1.1]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
