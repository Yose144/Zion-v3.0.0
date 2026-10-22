'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { zisAvatarUrl } from '@/lib/zis';
import GlowSprite from './GlowSprite';

interface ZisAvatarHologramProps {
  seed: string;
  src?: string | null;
  /** Radius of the circular hologram disc in world units. */
  size?: number;
  position?: [number, number, number];
  /** Accent color for the orbit ring + underglow. */
  accent?: string;
}

/**
 * Floating ZIS identity hologram for the OASIS world — the user's avatar
 * (explicit src or deterministic generated SVG) rasterized onto a circular
 * disc, wrapped in a slowly counter-rotating emissive ring with an
 * additive underglow. External `src` URLs that fail to load (CORS etc.)
 * fall back to the same-origin generated avatar.
 */
export default function ZisAvatarHologram({
  seed,
  src,
  size = 0.85,
  position = [0, 1.2, 0],
  accent = '#ffd700',
}: ZisAvatarHologramProps) {
  const fallbackUrl = zisAvatarUrl(seed, { sz: 256 });
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    let alive = true;
    let tex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    const load = (u: string, isFallback: boolean) => {
      loader.load(
        u,
        (t) => {
          if (!alive) return;
          t.colorSpace = THREE.SRGBColorSpace;
          tex = t;
          setTexture(t);
        },
        undefined,
        () => {
          if (!isFallback) load(fallbackUrl, true);
        },
      );
    };
    load(src ?? fallbackUrl, false);
    return () => {
      alive = false;
      tex?.dispose();
    };
  }, [src, fallbackUrl]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.9) * 0.06;
      groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.25;
    }
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.4;
  });

  if (!texture) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <circleGeometry args={[size, 48]} />
        <meshBasicMaterial map={texture} transparent opacity={0.96} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[size * 1.08, 0.018, 12, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.85} />
      </mesh>
      <GlowSprite color={accent} size={size * 2.6} opacity={0.35} />
    </group>
  );
}
