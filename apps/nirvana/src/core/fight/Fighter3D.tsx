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
  const backLeg = useRef<THREE.Group>(null);
  const fist = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);
  const hitFlash = useRef<THREE.Mesh>(null);
  const hitMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const previousHp = useRef<number | null>(null);
  const flashLeft = useRef(0);

  const colors = useMemo(
    () => ({
      robe: new THREE.Color(look.palette.robe),
      trim: new THREE.Color(look.palette.trim),
      glow: new THREE.Color(look.palette.glow),
    }),
    [look.palette],
  );

  useFrame((threeState, delta) => {
    const fighter = state.current;
    const group = flip.current;
    if (!group) return;

    if (previousHp.current !== null && fighter.hp < previousHp.current) flashLeft.current = 0.18;
    previousHp.current = fighter.hp;
    flashLeft.current = Math.max(0, flashLeft.current - delta);

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
    const movement = THREE.MathUtils.clamp(Math.abs(fighter.vx) / 4.2, 0, 1);
    const gait = Math.sin(threeState.clock.elapsedTime * 11) * 0.42 * movement;
    const lean = THREE.MathUtils.clamp(fighter.vx / 6, -1, 1) * 0.12;

    if (frontArm.current) {
      const punch = attacking?.kind === 'punch' ? armOut : 0;
      frontArm.current.rotation.z = -0.42 - 1.1 * punch + (fighter.blocking ? -1.25 : 0);
      frontArm.current.position.x = 0.18 + punch * 0.34 + shake;
      frontArm.current.position.y = 1.24 + (fighter.blocking ? 0.06 : 0) + punch * 0.05;
    }
    if (backArm.current) {
      backArm.current.rotation.z = fighter.blocking ? -1.65 : 0.48 - lean * 2;
      backArm.current.position.x = -0.12 + shake;
    }
    if (frontLeg.current) {
      frontLeg.current.rotation.z = -0.12 - 1.25 * legUp + gait;
      frontLeg.current.position.x = 0.1 + legUp * 0.12 + shake + gait * 0.08;
    }
    if (backLeg.current) {
      backLeg.current.rotation.z = 0.16 - gait;
    }
    if (fist.current) {
      fist.current.visible = showFist;
      fist.current.position.set(0.95 + armOut * 0.25, 1.16, 0);
    }
    if (shield.current) {
      shield.current.visible = fighter.blocking && !fighter.ko;
    }
    if (hitFlash.current && hitMaterial.current) {
      const active = flashLeft.current > 0 && !fighter.ko;
      hitFlash.current.visible = active;
      hitMaterial.current.opacity = active ? (flashLeft.current / 0.18) * 0.72 : 0;
      const scale = active ? 1 + (0.18 - flashLeft.current) * 2.2 : 1;
      hitFlash.current.scale.setScalar(scale);
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
      {/* Taktická zpětná vazba zásahu — krátký záblesk na těle zasaženého. */}
      <mesh ref={hitFlash} position={[0, 1.12, 0.28]} visible={false}>
        <ringGeometry args={[0.18, 0.42, 16]} />
        <meshBasicMaterial ref={hitMaterial} color={colors.glow} transparent opacity={0} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* ramena */}
      <mesh position={[0.02, 1.36, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.66]} />
        <meshStandardMaterial color={colors.trim} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.78, 0.255]}>
        <boxGeometry args={[0.38, 0.09, 0.035]} />
        <meshStandardMaterial color={colors.glow} metalness={0.35} roughness={0.5} />
      </mesh>
      {/* přední paže (úderná) — pivot u ramene */}
      <group ref={frontArm} position={[0.18, 1.16, 0]}>
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.44, 0.13, 0.13]} />
          <meshStandardMaterial color={colors.robe} roughness={0.85} />
        </mesh>
        <mesh position={[0.41, 0, 0]}>
          <sphereGeometry args={[0.105, 10, 8]} />
          <meshStandardMaterial color={colors.trim} metalness={0.2} roughness={0.55} />
        </mesh>
      </group>
      {/* zadní paže */}
      <group ref={backArm} position={[-0.12, 1.16, 0]}>
        <mesh position={[-0.16, 0, 0]}>
          <boxGeometry args={[0.4, 0.13, 0.13]} />
          <meshStandardMaterial color={colors.robe} roughness={0.85} />
        </mesh>
        <mesh position={[-0.36, 0, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={colors.trim} metalness={0.2} roughness={0.55} />
        </mesh>
      </group>
      {/* pěst / chodidlo — svítí jen v aktivním okně */}
      <mesh ref={fist} visible={false}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshBasicMaterial color={colors.glow} toneMapped={false} />
      </mesh>
      {/* nohy */}
      <group ref={backLeg} position={[-0.1, 0.84, 0.12]}>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.16, 0.84, 0.16]} />
          <meshStandardMaterial color={colors.trim} roughness={0.9} />
        </mesh>
      </group>
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
