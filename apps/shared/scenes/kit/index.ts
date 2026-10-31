/**
 * Shared render kit for the thirteen project scenes.
 *
 * Only `three` and `@genesis/runtime` may be imported from here: the scenes are compiled
 * into two applications, and pulling React Three Fiber helpers into this directory would
 * resolve a second R3F/React instance in the consumer bundle.
 */

export { quality, setQualityTier, type QualitySettings, type QualityTier } from './quality';
export {
  basalt,
  disposeSurfaces,
  foliage,
  grass,
  makeNoise,
  marble,
  marbleDark,
  plaster,
  regolith,
  sand,
  snow,
  stone,
  surface,
  tiled,
  wood,
  type Noise,
  type SurfaceMaps,
} from './textures';
export {
  basaltRock,
  bronze,
  disposeMaterials,
  glass,
  glassClear,
  gold,
  grassGround,
  lamp,
  leafCanopy,
  marbleDarkStone,
  marbleMatte,
  marbleWhite,
  plasterWall,
  regolithGround,
  sandGround,
  snowGround,
  stoneCool,
  stoneWarm,
  groundMaterial,
  terrainGround,
  timber,
  type GroundKind as GroundKindName,
  unlit,
  water,
  type StandardOptions,
} from './materials';
export { KeyLight, SceneEnvironment, SceneSky, SkyFill, type EnvironmentProps, type KeyLightProps, type SkyOptions } from './environment';
export { ScenePost, sceneRenderStats, type ScenePostProps } from './post';
export { SceneMotes, type SceneMotesProps } from './particles';
export { OceanSurface, type OceanSurfaceProps } from './ocean';
export {
  ScenePalms,
  SceneTerrain,
  SceneTrees,
  SceneWater,
  type GroundKind,
  type SceneTreesProps,
  type SceneWaterProps,
  type PalmItem,
  type TerrainProps,
  type TreeItem,
} from './terrain';
export { CinematicIntro, reducedMotion, useReducedMotion, type CinematicIntroProps } from './camera';
