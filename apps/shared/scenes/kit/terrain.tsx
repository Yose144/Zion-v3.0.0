/** @jsxRuntime classic */
'use client';

/**
 * Ground, trees and water primitives shared by the project scenes.
 *
 * Each one is instanced or single-mesh by construction: a meadow is one draw call, a
 * forest is four (trunks + three canopy layers) regardless of how many trees it shows.
 * That keeps the draw-call budget in reach while the scenes get denser.
 */

import { React, useFrame, THREE } from '@genesis/runtime';

import { groundMaterial } from './materials';
import { OceanSurface } from './ocean';
import { makeNoise, ripple, tiled, type Noise } from './textures';

export type GroundKind = 'grass' | 'sand' | 'snow' | 'regolith';

export interface TerrainProps {
  size?: number;
  segments?: number;
  /** Horizontal offset of the terrain patch. */
  center?: [number, number];
  /** Height in world units; receives local coordinates and a shared noise helper. */
  height?: (x: number, z: number, noise: Noise) => number;
  kind?: GroundKind;
  /** Texture tiling across the patch. */
  repeat?: number;
  seed?: number;
  /** Per-vertex tint; defaults to a plausible meadow / dune / snow palette. */
  color?: (x: number, y: number, z: number, noise: Noise, kind: GroundKind) => [number, number, number];
  /** Extra vertical offset. */
  level?: number;
}

const noiseCache = new Map<number, Noise>();
function noiseFor(seed: number): Noise {
  const hit = noiseCache.get(seed);
  if (hit) return hit;
  const created = makeNoise(seed);
  noiseCache.set(seed, created);
  return created;
}

function defaultColor(kind: GroundKind): [number, number, number] {
  switch (kind) {
    case 'sand':
      return [0.62, 0.52, 0.36];
    case 'snow':
      return [0.78, 0.84, 0.9];
    case 'regolith':
      return [0.44, 0.43, 0.42];
    default:
      return [0.32, 0.42, 0.24];
  }
}

export function SceneTerrain({
  size = 900,
  segments = 160,
  center = [0, 0],
  height,
  kind = 'grass',
  repeat = 220,
  seed = 17,
  color,
  level = -0.06,
}: TerrainProps) {
  const geometry = React.useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const noise = noiseFor(seed);
    const position = geometry.getAttribute('position');
    const colors: number[] = [];
    const tint = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const localX = position.getX(i);
      const localZ = position.getZ(i);
      const worldX = localX + center[0];
      const worldZ = localZ + center[1];
      const y = height ? height(worldX, worldZ, noise) : 0;
      position.setY(i, y);
      const [r, g, b] = color ? color(worldX, y, worldZ, noise, kind) : defaultColor(kind);
      // Break up texture tiling with a low-frequency tint variation.
      const breakUp = 0.86 + noise.fbm(worldX * 0.012 + 3, worldZ * 0.012 + 9, 3) * 0.28;
      tint.setRGB(r * breakUp, g * breakUp, b * breakUp, THREE.LinearSRGBColorSpace);
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [size, segments, center, height, kind, seed, color]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} position={[0, level, 0]} receiveShadow material={groundMaterial(kind, repeat)} />;
}

export interface TreeItem {
  x: number;
  z: number;
  /** Trunk length multiplier. */
  s: number;
  /** Ground height at this position; omit for flat ground. */
  y?: number;
}

export interface SceneTreesProps {
  items: TreeItem[];
  tone?: 'leaf' | 'olive';
  trunk?: string;
  /** Crown spread multiplier. */
  spread?: number;
  /** How many stacked canopy layers to draw (1–3). */
  layers?: number;
  castsShadow?: boolean;
}

function CanopyLayer({ items, y, scale, index, tone, geometry, material, spread }: {
  items: TreeItem[];
  y: number;
  scale: number;
  index: number;
  tone: 'leaf' | 'olive';
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  spread: number;
}) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    const color = new THREE.Color();
    items.forEach((item, i) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.s * 7.3 + i);
      position.set(item.x, (item.y ?? 0) + y * item.s, item.z);
      size.set(scale * spread * item.s * (0.9 + (i % 3) * 0.12), scale * item.s * 0.62, scale * spread * item.s * (0.95 + (i % 4) * 0.07));
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(i, matrix);
      color.setHSL(0.245 + index * 0.012 + (i % 5) * 0.005, 0.3, 0.3 + (i % 4) * 0.04);
      node.setColorAt(i, color);
    });
    node.instanceMatrix.needsUpdate = true;
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [items, y, scale, index, spread]);
  void tone;
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false} castShadow receiveShadow />;
}

/** A forest as four draw calls: trunks plus up to three canopy layers. */
export function SceneTrees({ items, tone = 'leaf', trunk = '#6a5238', spread = 1, layers = 3, castsShadow = true }: SceneTreesProps) {
  const trunks = React.useRef<THREE.InstancedMesh>(null);
  const trunkGeometry = React.useMemo(() => new THREE.CylinderGeometry(0.12, 0.2, 2, 6), []);
  const crownGeometry = React.useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const trunkMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({ color: trunk, roughness: 0.92 }), [trunk]);
  const leafMaterial = React.useMemo(() => {
    // Leaf colour is per-instance; the base material stays neutral.
    return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 });
  }, []);

  React.useEffect(() => () => {
    trunkGeometry.dispose();
    crownGeometry.dispose();
    trunkMaterial.dispose();
    leafMaterial.dispose();
  }, [trunkGeometry, crownGeometry, trunkMaterial, leafMaterial]);

  React.useLayoutEffect(() => {
    const node = trunks.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    items.forEach((item, i) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.s * 5 + i);
      position.set(item.x, (item.y ?? 0) + item.s, item.z);
      size.set(item.s * 0.9, item.s, item.s * 0.9);
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(i, matrix);
    });
    node.instanceMatrix.needsUpdate = true;
  }, [items]);

  const levels = [
    { y: 1.95, scale: 1.5, index: 0 },
    { y: 2.7, scale: 1.05, index: 1 },
    { y: 2.3, scale: 1.2, index: 2 },
  ].slice(0, Math.max(1, Math.min(3, layers)));

  return (
    <group>
      <instancedMesh ref={trunks} args={[trunkGeometry, trunkMaterial, items.length]} frustumCulled={false} castShadow={castsShadow} />
      {levels.map((level) => (
        <CanopyLayer
          key={level.index}
          items={items}
          y={level.y}
          scale={level.scale}
          index={level.index}
          tone={tone}
          geometry={crownGeometry}
          material={leafMaterial}
          spread={spread}
        />
      ))}
    </group>
  );
}

export interface SceneWaterProps {
  width: number;
  depth?: number;
  position: [number, number, number];
  /** Water body tint (linear-ish hex); the deep tone is derived from it. */
  tint?: string;
  repeat?: number;
  /** Ripple scroll speed. */
  speed?: number;
  /** Direction toward the sun; matches the scene's `<KeyLight sun>`. */
  sun?: [number, number, number];
  /** Sky colour reflected at grazing angles. */
  sky?: string;
  /** Circular pond instead of a rectangle. */
  circle?: boolean;
  segments?: number;
}

/** Animated water plane; delegates to the one ocean shader in `pool` mode. */
export function SceneWater({
  width,
  depth = 1,
  position,
  tint,
  repeat = 3,
  speed = 1,
  sun = [-0.45, 0.35, -0.82],
  sky = '#c9d6e4',
  circle = false,
}: SceneWaterProps) {
  return (
    <group position={[0, position[1], 0]}>
      <group position={[position[0], 0, position[2]]}>
        <OceanSurface
          mode="pool"
          level={0}
          width={width}
          depth={depth}
          circle={circle}
          segments={1}
          sky={sky}
          deep={tint ?? '#06232b'}
          shallow="#0d5560"
          sun={sun}
          ripple={0.35}
          rippleRepeat={repeat}
          roughness={0.35 * speed}
        />
      </group>
    </group>
  );
}

/* ── palms ─────────────────────────────────────────────────────────── */

export interface MergedPart {
  geometry: THREE.BufferGeometry;
  color: string;
  matrix?: THREE.Matrix4;
}

/** Merge parts into one non-indexed geometry with per-vertex colour.
 *  Exportováno pro scény, které skládají opakované dílce s vlastními transformacemi
 *  (lotosové plátky) — merge je jeden draw call a transformace zůstanou přesné. */
export function mergeParts(parts: MergedPart[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (const part of parts) {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    if (part.matrix) geometry.applyMatrix4(part.matrix);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    color.set(part.color);
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      colors.push(color.r, color.g, color.b);
    }
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

export interface PalmItem {
  x: number;
  z: number;
  y?: number;
  /** Trunk length in world units. */
  h?: number;
  /** Uniform scale. */
  s?: number;
  /** Rotation around Y. */
  yaw?: number;
}

/**
 * Palms as a single instanced mesh: trunk, fronds and crown are merged into one geometry
 * with vertex colours, so a whole grove costs one draw call instead of nine per tree.
 */
export function ScenePalms({ items, tone = 'leaf', variants = 3 }: { items: PalmItem[]; tone?: 'leaf' | 'olive'; variants?: number }) {
  const group = React.useRef<THREE.Group>(null);

  const build = (variant: number) => {
    // Normalised palm: 1 unit tall, so instances scale uniformly by the tree height.
    const parts: MergedPart[] = [];
    const trunk = new THREE.CylinderGeometry(0.028, 0.055, 1, 7).translate(0, 0.5, 0);
    parts.push({ geometry: trunk, color: '#6a5138' });

    // A drooping leaf: a plane along +X, bent downward, base at the origin.
    const leaf = new THREE.PlaneGeometry(1, 0.26, 10, 2);
    leaf.translate(0.5, 0, 0);
    const position = leaf.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const t = position.getX(i);
      position.setY(i, position.getY(i) + 0.24 * Math.sin(t * Math.PI) - 0.38 * t * t);
    }
    leaf.computeVertexNormals();

    const fronds = 9 + variant;
    for (let i = 0; i < fronds; i++) {
      const angle = (i / fronds) * Math.PI * 2 + 0.25 + variant * 0.4;
      const tilt = 0.3 + ((i + variant) % 4) * 0.12;
      const length = 0.42 + ((i * 7 + variant * 3) % 5) * 0.02;
      const matrix = new THREE.Matrix4()
        .makeTranslation(0, 1, 0)
        .multiply(new THREE.Matrix4().makeRotationY(angle))
        .multiply(new THREE.Matrix4().makeRotationZ(-tilt))
        .multiply(new THREE.Matrix4().makeScale(length, length, length));
      parts.push({ geometry: leaf, color: i % 3 === 0 ? '#3f6a2c' : i % 3 === 1 ? (tone === 'olive' ? '#7c8650' : '#4d7a34') : '#5d8a3c', matrix });
    }

    const nut = new THREE.SphereGeometry(0.045, 6, 5);
    parts.push({ geometry: nut, color: '#7a5a34', matrix: new THREE.Matrix4().makeTranslation(0, 0.98, 0) });
    const merged = mergeParts(parts);
    trunk.dispose();
    leaf.dispose();
    nut.dispose();
    return merged;
  };

  const geometries = React.useMemo(
    () => Array.from({ length: Math.max(1, variants) }, (_, index) => build(index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tone, variants],
  );
  const material = React.useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);

  React.useEffect(() => () => {
    for (const geometry of geometries) geometry.dispose();
    material.dispose();
  }, [geometries, material]);

  // Split the grove between the variants so neighbouring palms are not identical.
  const buckets = React.useMemo(() => {
    const list: PalmItem[][] = Array.from({ length: geometries.length }, () => []);
    items.forEach((item, index) => list[index % list.length].push(item));
    return list;
  }, [items, geometries.length]);

  React.useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    node.children.forEach((child, bucketIndex) => {
      const mesh = child as THREE.InstancedMesh;
      const bucket = buckets[bucketIndex] ?? [];
      bucket.forEach((item, i) => {
        const height = item.h ?? 6;
        const scale = item.s ?? 1;
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.yaw ?? item.x * 0.7 + i);
        position.set(item.x, item.y ?? 0, item.z);
        size.set(height * scale, height * scale, height * scale);
        matrix.compose(position, quaternion, size);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.count = bucket.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [buckets]);

  return (
    <group ref={group}>
      {geometries.map((geometry, index) => (
        <instancedMesh
          key={index}
          args={[geometry, material, Math.max(1, buckets[index]?.length ?? 1)]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
