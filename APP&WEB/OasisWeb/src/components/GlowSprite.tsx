'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

function createRadialGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.45)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

interface GlowSpriteProps {
  color: string;
  size: number;
  opacity?: number;
}

export default function GlowSprite({ color, size, opacity = 0.6 }: GlowSpriteProps) {
  const texture = useMemo(createRadialGlowTexture, []);
  const material = useMemo(() => {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return mat;
  }, [texture, color, opacity]);

  return <sprite material={material} scale={[size, size, 1]} />;
}
