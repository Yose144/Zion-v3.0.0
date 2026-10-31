/** @jsxRuntime classic */
'use client';

import { React, useEffect, useFrame, THREE } from '@genesis/runtime';

/**
 * Screen-space declutter registry shared by all labels of one canvas.
 *
 * Sprites do not know about each other, so on narrow viewports long labels
 * collide or run past the frame. Each label publishes its projected rectangle
 * plus a priority score; `resolveSceneLabels` runs once per frame from the
 * shared presentation layer and keeps the highest-priority rectangles while
 * hiding the rest.
 */
type LabelEntry = {
  sprite: THREE.Sprite;
  camera: THREE.Camera | null;
  scale: number;
  distance: number;
  rect: [number, number, number, number];
  onScreen: boolean;
  ready: boolean;
};

const entries = new Set<LabelEntry>();
const winners = new WeakMap<THREE.Camera, Set<LabelEntry>>();
/** Pixels a label must stay clear of the viewport edge before it is drawn. */
const EDGE = 4;
/** Pixels two labels must keep between them to stay readable. */
const GAP = 6;

function overlaps(a: [number, number, number, number], b: [number, number, number, number]) {
  return a[0] < b[2] + GAP && a[2] + GAP > b[0] && a[1] < b[3] + GAP && a[3] + GAP > b[1];
}

/** Resolve label overlap for one canvas before the labels refresh their own rectangles. */
export function resolveSceneLabels(camera: THREE.Camera) {
  const active = [...entries].filter(entry => entry.camera === camera && entry.ready);
  const previous = winners.get(camera);
  const accepted = new Set<LabelEntry>();
  const rects: [number, number, number, number][] = [];
  const priority = (entry: LabelEntry) => entry.distance / Math.max(1, entry.scale);
  const ordered = active.sort((a, b) => priority(a) - priority(b));
  const take = (entry: LabelEntry) => {
    if (!entry.onScreen || accepted.has(entry)) return;
    if (!rects.every(rect => !overlaps(entry.rect, rect))) return;
    accepted.add(entry);
    rects.push(entry.rect);
  };
  // Keep the previous frame's winners first: a rotating camera must not make labels flicker.
  for (const entry of ordered) if (previous?.has(entry)) take(entry);
  for (const entry of ordered) take(entry);
  for (const entry of active) entry.sprite.visible = accepted.has(entry);
  winners.set(camera, accepted);
}

export function SceneLabel({ position, text, scale = 1 }: { position: [number, number, number]; text: string; scale?: number }) {
  const sprite = React.useRef<THREE.Sprite>(null);
  const world = React.useMemo(() => new THREE.Vector3(), []);
  const view = React.useMemo(() => new THREE.Vector3(), []);
  const entry = React.useRef<LabelEntry | null>(null);
  useEffect(() => {
    const target = sprite.current;
    if (!target) return;
    const value: LabelEntry = { sprite: target, camera: null, scale, distance: Infinity, rect: [0, 0, 0, 0], onScreen: false, ready: false };
    entry.current = value;
    entries.add(value);
    return () => {
      entries.delete(value);
      if (entry.current === value) entry.current = null;
    };
  }, [scale]);
  useFrame(({ camera, size }) => {
    const value = entry.current;
    const target = sprite.current;
    if (!value || !target || !texture?.image || !(camera instanceof THREE.PerspectiveCamera)) return;
    target.getWorldPosition(world);
    const distance = camera.position.distanceTo(world);
    const mobile = size.width < 600;
    const fontPixels = (mobile ? 10.5 : 12) * Math.min(1.15, Math.sqrt(scale));
    const pixelScale = Math.min(fontPixels / 28, (mobile ? 150 : 240) / texture.image.width);
    const worldPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / size.height;
    target.scale.set(texture.image.width * pixelScale * worldPixel, texture.image.height * pixelScale * worldPixel, 1);
    const width = texture.image.width * pixelScale;
    const height = texture.image.height * pixelScale;
    view.copy(world).applyMatrix4(camera.matrixWorldInverse);
    world.project(camera);
    const px = (world.x * 0.5 + 0.5) * size.width;
    const py = (-world.y * 0.5 + 0.5) * size.height;
    value.camera = camera;
    value.scale = scale;
    value.distance = distance;
    value.rect = [px - width / 2, py - height / 2, px + width / 2, py + height / 2];
    value.onScreen = view.z < -camera.near && value.rect[0] >= EDGE && value.rect[1] >= EDGE
      && value.rect[2] <= size.width - EDGE && value.rect[3] <= size.height - EDGE;
    value.ready = true;
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
