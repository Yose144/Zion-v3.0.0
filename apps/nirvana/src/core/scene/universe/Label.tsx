'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * 3D textový label jako sprite — canvas → CanvasTexture → sprite.
 * Nativní three.js objekt: žádný React root, žádné DOM overlay,
 * správná depth okluze (label za planetou se schová).
 */
export function TextLabel({
  text,
  position = [0, 0, 0],
  color = '#cfe3ff',
  height = 0.22,
  onClick,
}: {
  text: string;
  position?: [number, number, number];
  color?: string;
  height?: number; // světová výška textu
  onClick?: () => void;
}) {
  const { tex, aspect } = useMemo(() => {
    const font = '600 44px "Segoe UI", system-ui, sans-serif';
    const m = document.createElement('canvas').getContext('2d')!;
    m.font = font;
    const tw = Math.ceil(m.measureText(text).width) + 40;
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, 20, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, aspect: tw / 80 };
  }, [text, color]);

  return (
    <sprite
      position={position}
      scale={[height * aspect, height, 1]}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={
        onClick
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        onClick
          ? () => {
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}
