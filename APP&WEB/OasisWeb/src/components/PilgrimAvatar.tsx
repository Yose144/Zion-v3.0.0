'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { zisAvatarUrl } from '@/lib/zis';
import { useGameStore } from '@/store/gameStore';

interface PilgrimAvatarProps {
  /** ZIS seed for the chest sigil emblem (user id or address). */
  seed?: string;
  /** Explicit avatar image URL (ZIS avatar) for the emblem. */
  src?: string | null;
  position?: [number, number, number];
  /** Idle bob+sway amplitude; 0 disables animation. */
  sway?: number;
}

const BODY_WIDTH: Record<string, number> = { slim: 0.82, standard: 1.0, heavy: 1.22 };

/**
 * Procedural in-world avatar — stylized humanoid built from primitives:
 * sphere head, capsule torso scaled by bodyType, arm/leg capsules, neon
 * emissive trim on joints and a circular chest emblem carrying the user's
 * ZIS avatar (generated sigil, uploaded image or NFT). Driven by the
 * shared avatarConfig ({callsign, bodyType, neonColor, augmentation}).
 */
export default function PilgrimAvatar({
  seed,
  src,
  position = [0, 0, 0],
  sway = 1,
}: PilgrimAvatarProps) {
  const avatarConfig = useGameStore((s) => s.avatarConfig);
  const neon = avatarConfig.neonColor || '#06b6d4';
  const w = BODY_WIDTH[avatarConfig.bodyType] ?? 1.0;

  const groupRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const [emblem, setEmblem] = useState<THREE.Texture | null>(null);

  const fallbackUrl = seed ? zisAvatarUrl(seed, { sz: 128 }) : null;
  useEffect(() => {
    const url = src ?? fallbackUrl;
    if (!url) return;
    let alive = true;
    let tex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    const load = (u: string, isFallback: boolean) => {
      loader.load(
        u,
        (t) => {
          if (!alive) { t.dispose(); return; }
          t.colorSpace = THREE.SRGBColorSpace;
          tex = t;
          setEmblem(t);
        },
        undefined,
        () => { if (!isFallback && fallbackUrl) load(fallbackUrl, true); },
      );
    };
    load(url, false);
    return () => { alive = false; tex?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackUrl]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 1.4) * 0.02 * sway;
      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.08 * sway;
    }
    if (armLRef.current) armLRef.current.rotation.x = Math.sin(t * 1.1) * 0.12 * sway;
    if (armRRef.current) armRRef.current.rotation.x = -Math.sin(t * 1.1) * 0.12 * sway;
  });

  const suit = new THREE.MeshStandardMaterial({ color: '#0d0d1a', roughness: 0.6, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 1.4, roughness: 0.3 });

  return (
    <group ref={groupRef} position={position}>
      {/* head */}
      <mesh position={[0, 1.05, 0]} material={suit}>
        <sphereGeometry args={[0.11, 24, 20]} />
      </mesh>
      {/* visor — neon band across the head */}
      <mesh position={[0, 1.06, 0.09]} material={trim}>
        <boxGeometry args={[0.14, 0.03, 0.05]} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.72, 0]} material={suit} scale={[w, 1, w]}>
        <capsuleGeometry args={[0.16, 0.28, 8, 16]} />
      </mesh>
      {/* chest emblem — ZIS sigil disc */}
      <mesh position={[0, 0.8, 0.17 * w]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.055, 24]} />
        {emblem ? (
          <meshBasicMaterial map={emblem} transparent />
        ) : (
          <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={0.8} />
        )}
      </mesh>
      {/* arms */}
      <group ref={armLRef} position={[-0.24 * w, 0.86, 0]}>
        <mesh position={[0, -0.16, 0]} material={suit}>
          <capsuleGeometry args={[0.045, 0.26, 6, 12]} />
        </mesh>
        <mesh position={[0, -0.32, 0]} material={trim}>
          <sphereGeometry args={[0.04, 12, 10]} />
        </mesh>
      </group>
      <group ref={armRRef} position={[0.24 * w, 0.86, 0]}>
        <mesh position={[0, -0.16, 0]} material={suit}>
          <capsuleGeometry args={[0.045, 0.26, 6, 12]} />
        </mesh>
        <mesh position={[0, -0.32, 0]} material={trim}>
          <sphereGeometry args={[0.04, 12, 10]} />
        </mesh>
      </group>
      {/* legs */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.08 * w, 0.3, 0]} material={suit}>
          <capsuleGeometry args={[0.05, 0.34, 6, 12]} />
        </mesh>
      ))}
      {/* neon boot caps */}
      {[-1, 1].map((side) => (
        <mesh key={`boot-${side}`} position={[side * 0.08 * w, 0.09, 0]} material={trim}>
          <sphereGeometry args={[0.05, 12, 10]} />
        </mesh>
      ))}
      {/* belt ring */}
      <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]} material={trim}>
        <torusGeometry args={[0.155 * w, 0.012, 8, 32]} />
      </mesh>
    </group>
  );
}
