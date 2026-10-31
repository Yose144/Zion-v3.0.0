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

const WATER_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec2 vUv;
  uniform sampler2D uNormalMap;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uRepeat;

  void main() {
    vec2 base = vUv * uRepeat;
    vec2 uv1 = base + vec2(uTime * 0.012, uTime * 0.021) * uSpeed;
    vec2 uv2 = base * 0.73 - vec2(uTime * 0.017, uTime * 0.009) * uSpeed;
    vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;
    // Flatten the ripple and tilt it into world space (plane lies on XZ).
    vec3 ripple = (n1 + n2) * vec3(0.35, 0.0, 0.35);
    vec3 normal = normalize(vec3(ripple.x, 1.0, ripple.z));

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float facing = clamp(dot(viewDir, normal), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.2);

    vec3 body = mix(uDeep, uShallow, 0.45);
    vec3 color = mix(body, uSky, clamp(fresnel * 1.15, 0.0, 0.92));

    // Sun glitter.
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 340.0);
    color += uSunColor * spec * 2.4;

    // A hint of sky gradient near the horizon keeps large water bodies from going flat.
    color += uSky * 0.05;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Animated water with a Fresnel reflection of the scene's sky colour. */
export function SceneWater({ width, depth = 1, position, tint, repeat = 3, speed = 1, sun = [-0.45, 0.35, -0.82], sky = '#c9d6e4', circle = false, segments = 72 }: SceneWaterProps) {
  const material = React.useMemo(() => {
    const maps = ripple(256);
    const normalMap = tiled(maps.normalMap, 1);
    return new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uNormalMap: { value: normalMap },
        uDeep: { value: new THREE.Color(tint ?? '#06232b') },
        uShallow: { value: new THREE.Color('#0d5560') },
        uSky: { value: new THREE.Color(sky) },
        uSunColor: { value: new THREE.Color('#ffd9a0') },
        uSunDir: { value: new THREE.Vector3(...sun).normalize() },
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uRepeat: { value: repeat },
      },
    });
  }, [tint, repeat, speed, sky, sun]);

  React.useEffect(() => () => {
    const map = material.uniforms.uNormalMap.value as THREE.Texture | null;
    map?.dispose();
    material.dispose();
  }, [material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} material={material}>
      {circle ? <circleGeometry args={[width / 2, segments]} /> : <planeGeometry args={[width, depth]} />}
    </mesh>
  );
}

/* ── palms ─────────────────────────────────────────────────────────── */

interface Part {
  geometry: THREE.BufferGeometry;
  color: string;
  matrix?: THREE.Matrix4;
}

/** Merge parts into one non-indexed geometry with per-vertex colour. */
function mergeParts(parts: Part[]): THREE.BufferGeometry {
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
export function ScenePalms({ items, tone = 'leaf' }: { items: PalmItem[]; tone?: 'leaf' | 'olive' }) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  const geometry = React.useMemo(() => {
    // Normalised palm: 1 unit tall, so instances scale uniformly by the tree height.
    const parts: Part[] = [];
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

    const fronds = 9;
    for (let i = 0; i < fronds; i++) {
      const angle = (i / fronds) * Math.PI * 2 + 0.25;
      const tilt = 0.35 + (i % 3) * 0.12;
      const matrix = new THREE.Matrix4()
        .makeTranslation(0, 1, 0)
        .multiply(new THREE.Matrix4().makeRotationY(angle))
        .multiply(new THREE.Matrix4().makeRotationZ(-tilt))
        .multiply(new THREE.Matrix4().makeScale(0.46, 0.46, 0.46));
      parts.push({ geometry: leaf, color: i % 3 === 0 ? '#3f6a2c' : i % 3 === 1 ? (tone === 'olive' ? '#7c8650' : '#4d7a34') : '#5d8a3c', matrix });
    }

    const nut = new THREE.SphereGeometry(0.045, 6, 5);
    parts.push({ geometry: nut, color: '#7a5a34', matrix: new THREE.Matrix4().makeTranslation(0, 0.98, 0) });
    const merged = mergeParts(parts);
    trunk.dispose();
    leaf.dispose();
    nut.dispose();
    return merged;
  }, [tone]);
  const material = React.useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);

  React.useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    items.forEach((item, i) => {
      const height = item.h ?? 6;
      const scale = item.s ?? 1;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.yaw ?? item.x * 0.7 + i);
      position.set(item.x, item.y ?? 0, item.z);
      size.set(height * scale, height * scale, height * scale);
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(i, matrix);
    });
    node.instanceMatrix.needsUpdate = true;
  }, [items]);

  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false} castShadow receiveShadow />;
}
