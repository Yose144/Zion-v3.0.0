/**
 * @zion/scenes — WEB adaptér světa (three.js + @react-three/fiber).
 *
 * Tenhle balíček smí importovat three a React. `@zion/world` nikdy.
 * Všechny pozice a data pocházejí z domény — renderer nic nevymýšlí.
 *
 * Katalog světů (texty) je v `@zion/world`; tady je jen komponentová vazba.
 */

export { OrbitScene } from './OrbitScene';
export type { OrbitSceneProps, SceneHover } from './OrbitScene';
export { NewEarth } from './NewEarth';
export { IssobellaRing } from './IssobellaRing';
export { Gate } from './Gate';
export { Markers } from './Markers';
export { Starfield } from './Starfield';

export { WorldStage } from './worlds/WorldStage';
export { worldById, WORLDS } from './worlds/registry';
export type { WorldEntry, SceneCamera, Lang } from './worlds/registry';
export { OrbitRig } from './worlds/OrbitRig';
export type { WorldControls } from './worlds/OrbitRig';
