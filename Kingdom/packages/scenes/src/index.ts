/**
 * @zion/scenes — WEB adaptér světa (three.js / @react-three/fiber).
 *
 * F0: prázdné. Naplní se ve F2 z `apps/shared/scenes` (13 světů) a
 * `apps/nirvana/src/core/scene` (univerzum: orbit, planeta, prstence, brána).
 *
 * Pravidlo: tenhle balíček smí importovat three a React. `@zion/world` nikdy.
 */

export interface SceneEntry {
  /** id světa, shodné s portálem `worlds/<id>` */
  id: string;
  /** jazykový název */
  title: { cs: string; en: string };
  /** modul se načítá lazy — scéna nikdy neblokuje první paint */
  load: () => Promise<unknown>;
}

export const SCENES: SceneEntry[] = [];

export function sceneById(id: string): SceneEntry | undefined {
  return SCENES.find((s) => s.id === id);
}
