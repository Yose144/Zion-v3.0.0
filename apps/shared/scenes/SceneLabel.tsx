/** @jsxRuntime classic */
'use client';

import { React, useEffect, useState, THREE } from '@genesis/runtime';

export function SceneLabel({ position, text }: { position: [number, number, number]; text: string }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  // Sprites stay in the scene's React root; no nested DOM roots to unmount.
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '600 28px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width + 36);
    canvas.height = 52;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(230, 210, 170, 0.5)';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.font = '600 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3e8d0';
    ctx.fillText(text, 18, 26);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    setTexture(next);
    return () => next.dispose();
  }, [text]);
  if (!texture) return null;
  return <sprite position={position} scale={[texture.image.width / 180, 52 / 180, 1]}>
    <spriteMaterial map={texture} transparent depthWrite={false} />
  </sprite>;
}

