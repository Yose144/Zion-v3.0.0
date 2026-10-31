/** @jsxRuntime classic */
'use client';

import { React, useEffect, useFrame, THREE } from '@genesis/runtime';

export function SceneLabel({ position, text, scale = 1 }: { position: [number, number, number]; text: string; scale?: number }) {
  const sprite = React.useRef<THREE.Sprite>(null);
  const world = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!sprite.current || !texture || !(camera instanceof THREE.PerspectiveCamera)) return;
    sprite.current.getWorldPosition(world);
    const distance = camera.position.distanceTo(world);
    const mobile = size.width < 600;
    const fontPixels = (mobile ? 11 : 12) * Math.min(1.15, Math.sqrt(scale));
    const pixelScale = Math.min(fontPixels / 28, (mobile ? 170 : 240) / texture.image.width);
    const worldPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / size.height;
    sprite.current.scale.set(texture.image.width * pixelScale * worldPixel, texture.image.height * pixelScale * worldPixel, 1);
  });
  // Sprites stay in the scene's React root; no nested DOM roots to unmount.
  const texture = React.useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = '600 28px sans-serif';
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > 430) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
    canvas.width = Math.ceil(Math.max(...lines.map(value => ctx.measureText(value).width)) + 36);
    canvas.height = lines.length * 34 + 18;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(230, 210, 170, 0.5)';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.font = '600 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3e8d0';
    lines.forEach((value, i) => ctx.fillText(value, 18, 26 + i * 34));
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    return next;
  }, [text]);
  // Replace the material map in the same commit before disposing the old map.
  // Disposing in the canvas-creation effect can re-upload its still-mounted map.
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return <sprite ref={sprite} position={position}>
    <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
  </sprite>;
}

