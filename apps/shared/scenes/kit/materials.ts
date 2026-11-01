/**
 * Shared PBR material presets.
 *
 * Materials are cached instances keyed by name + tiling: switching meshes to a preset
 * lowers the number of shader programs and texture bindings per scene. They rely on
 * `scene.environment` for reflections (set by `<SceneEnvironment>`), so never assign
 * `envMap` per material.
 */

import { THREE } from '@genesis/runtime';

import { quality } from './quality';
import { basalt, foliage, grass, marble, marbleDark, plaster, regolith, ripple, sand, snow, stone, tiled, wood } from './textures';

const cache = new Map<string, THREE.MeshStandardMaterial>();

export interface StandardOptions {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  flatShading?: boolean;
  vertexColors?: boolean;
}

function standard(
  key: string,
  build: () => StandardOptions & { map?: THREE.Texture | null; normalMap?: THREE.Texture | null },
): THREE.MeshStandardMaterial {
  const hit = cache.get(key);
  if (hit) return hit;
  const options = build();
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? '#ffffff',
    roughness: options.roughness ?? 0.7,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.FrontSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 1,
    flatShading: options.flatShading ?? false,
    vertexColors: options.vertexColors ?? false,
    map: options.map ?? null,
    normalMap: options.normalMap ?? null,
    envMapIntensity: options.envMapIntensity ?? 0.9,
  });
  if (options.normalScale !== undefined && material.normalMap) {
    material.normalScale = new THREE.Vector2(options.normalScale, options.normalScale);
  }
  material.name = key;
  cache.set(key, material);
  return material;
}

/** Polished white marble with veining. */
export const marbleWhite = (repeat = 2) =>
  standard(`marble-white-${repeat}`, () => {
    const maps = marble(quality().textureSize >= 512 ? 512 : 256);
    return {
      color: '#ffffff',
      roughness: 0.34,
      metalness: 0,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      normalScale: 0.28,
      envMapIntensity: 1.15,
    };
  });

/** Mate white marble for steps and balustrades — less specular than the polished preset. */
export const marbleMatte = (repeat = 2) =>
  standard(`marble-matte-${repeat}`, () => {
    const maps = marble(256);
    return {
      color: '#f1eee4',
      roughness: 0.72,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      normalScale: 0.8,
      envMapIntensity: 0.8,
    };
  });

export const marbleDarkStone = (repeat = 2) =>
  standard(`marble-dark-${repeat}`, () => {
    const maps = marbleDark(256);
    return {
      roughness: 0.45,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 1,
    };
  });

/** Gold leaf and gilded domes. */
export const gold = (roughness = 0.28) =>
  standard(`gold-${roughness}`, () => ({
    color: '#d8b25e',
    metalness: 1,
    roughness,
    envMapIntensity: 1.6,
    emissive: '#3a2405',
    emissiveIntensity: 0.35,
  }));

/** Brushed bronze for rails, bells and fittings. */
export const bronze = () =>
  standard('bronze', () => ({ color: '#8a6234', metalness: 1, roughness: 0.42, envMapIntensity: 1.3 }));

/** Dark architectural glass with a slight sheen. */
export const glass = () =>
  standard('glass', () => ({
    color: '#2b3a46',
    metalness: 0.2,
    roughness: 0.12,
    envMapIntensity: 1.8,
    transparent: true,
    opacity: 0.72,
  }));

/** Daylight glass for greenhouses and station domes. */
export const glassClear = () =>
  standard('glass-clear', () => ({
    color: '#cfe6ee',
    metalness: 0,
    roughness: 0.06,
    envMapIntensity: 2,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  }));

export const stoneWarm = (repeat = 3, tint = '#ffffff') =>
  standard(`stone-warm-${repeat}-${tint}`, () => {
    const maps = stone(256, 'warm');
    return {
      color: tint,
      roughness: 0.82,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.7,
    };
  });

export const stoneCool = (repeat = 3, tint = '#ffffff') =>
  standard(`stone-cool-${repeat}-${tint}`, () => {
    const maps = stone(256, 'cool');
    return {
      color: tint,
      roughness: 0.78,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.8,
    };
  });

export const basaltRock = (repeat = 4) =>
  standard(`basalt-${repeat}`, () => {
    const maps = basalt(256);
    return {
      roughness: 0.86,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.7,
    };
  });

export const sandGround = (repeat = 8) =>
  standard(`sand-${repeat}`, () => {
    const maps = sand(256);
    return {
      roughness: 0.92,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.6,
    };
  });

export const grassGround = (repeat = 10, tint = '#ffffff') =>
  standard(`grass-${repeat}-${tint}`, () => {
    const maps = grass(256);
    return {
      color: tint,
      roughness: 0.95,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.55,
    };
  });

export const regolithGround = (repeat = 6) =>
  standard(`regolith-${repeat}`, () => {
    const maps = regolith(quality().textureSize >= 512 ? 512 : 256);
    return {
      roughness: 0.96,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.5,
    };
  });

export const timber = (repeat = 2, tone: 'light' | 'dark' = 'dark') =>
  standard(`timber-${tone}-${repeat}`, () => {
    const maps = wood(256, tone);
    return {
      roughness: 0.72,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.7,
    };
  });

export const plasterWall = (repeat = 3, tint: 'white' | 'ochre' = 'white') =>
  standard(`plaster-${tint}-${repeat}`, () => {
    const maps = plaster(256, tint);
    return {
      roughness: 0.88,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.65,
    };
  });

export const snowGround = (repeat = 6) =>
  standard(`snow-${repeat}`, () => {
    const maps = snow(256);
    return {
      roughness: 0.7,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.9,
    };
  });

export const leafCanopy = (tone: 'leaf' | 'olive' = 'leaf') =>
  standard(`leaf-${tone}`, () => {
    const maps = foliage(128, tone);
    return {
      roughness: 0.82,
      map: maps.map,
      normalMap: maps.normalMap,
      envMapIntensity: 0.55,
    };
  });

/** Still or gently moving water: high environment reflection, ripple normal map. */
export const water = (repeat = 4, tone = '#0a2c36') =>
  standard(`water-${repeat}-${tone}`, () => {
    const maps = ripple(256);
    return {
      color: tone,
      metalness: 0,
      roughness: 0.06,
      envMapIntensity: 1.05,
      normalMap: tiled(maps.normalMap, repeat),
      normalScale: 0.12,
    };
  });

/** Terrain: grass texture multiplied by per-vertex colour, for large displaced ground. */
export const terrainGround = (repeat = 60) =>
  standard(`terrain-${repeat}`, () => {
    const maps = grass(256);
    return {
      vertexColors: true,
      roughness: 0.95,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: 0.5,
    };
  });


export type GroundKind = 'grass' | 'sand' | 'snow' | 'regolith' | 'water';

/**
 * Ground material for `<SceneTerrain>` and `<SceneWater>`: the terrain variants take
 * per-vertex colour from the geometry, the water variant is a reflective surface.
 */
export function groundMaterial(kind: GroundKind, repeat = 200): THREE.MeshStandardMaterial {
  if (kind === 'water') return water(repeat);
  return standard(`ground-${kind}-${repeat}`, () => {
    const maps = kind === 'sand' ? sand(256) : kind === 'snow' ? snow(256) : kind === 'regolith' ? regolith(256) : grass(256);
    return {
      vertexColors: true,
      roughness: kind === 'snow' ? 0.7 : 0.95,
      map: tiled(maps.map, repeat),
      normalMap: tiled(maps.normalMap, repeat),
      envMapIntensity: kind === 'snow' ? 0.9 : 0.5,
    };
  });
}

/** Emissive material for lamps, windows and light strips. */
export const lamp = (color = '#ffd9a0', intensity = 2.4) =>
  standard(`lamp-${color}-${intensity}`, () => ({
    color: '#ffffff',
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
    envMapIntensity: 0.2,
  }));

/** Placeholder for the sky dome and other unlit surfaces. */
export const unlit = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ color, toneMapped: false });

export function disposeMaterials(): void {
  for (const material of cache.values()) {
    material.map?.dispose();
    material.normalMap?.dispose();
    material.dispose();
  }
  cache.clear();
}
