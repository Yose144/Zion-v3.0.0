/**
 * DOKY — kde flotila kotví.
 *
 * Dvě místa, obě **pohyblivá**:
 *  - **Nabukano** (mateřská loď L6) obíhá Novou Zemi a má tři kotviště
 *    na dokovacím rámu pod trupem,
 *  - **Issobella** (stanice na prstenci L6) jede s prstencem, který se otáčí.
 *
 * Proč to není `if` ve scéně: pozice doku musí být **funkce času**, stejně
 * jako pozice lodi. Kdyby si simulace a scéna počítaly dok každá po svém,
 * hráč by přistál „do prázdna" — přesně ta past, kterou má Nirvana už
 * zapsanou u archy a flotily (`fleetPosition`, `arkPosition`).
 *
 * Souřadný systém je **lokální soustava Nové Země** (střed planety = počátek),
 * takže se let nepočítá přes polohu Země na oběžné dráze kolem Slunce —
 * v tomhle měřítku by to bylo 30 jednotek daleko od všeho.
 */

import * as THREE from 'three';
import { fleetHeading, fleetPosition, ringSpinAngle, RING_R, RING_TILT } from '@/core/scene/universe/positions';

/**
 * Nabukano se ve scéně kreslí se `scale={4}` (`SkyFleet`). Kotviště jsou
 * v modelovém prostoru, takže se násobí čtyřmi — kdyby se měřítko změnilo
 * na jednom místě a ne tady, lodě by kotvily mimo rám.
 */
export const NABUKANO_SCALE = 4;

/**
 * Tři kotviště z `apps/shared/scenes/kit/vessels.tsx`:
 * dokovací rám je na `[0.02, -0.15, 0]`, kotviště na `x = SISTERS[i].x`
 * (−0,30 / 0,02 / 0,34) a `y = −0,012` v rámu.
 */
const BERTHS: Array<[number, number, number]> = [
  [-0.28, -0.162, 0],
  [0.04, -0.162, 0],
  [0.36, -0.162, 0],
];

/** Kotviště jsou pod rámem — loď visí ~0,28 jednotky pod deskou. */
const BERTH_DROP = 0.28;

/** Issobella: stanice stojí na prstenci na `[RING_R, 0, 0]`, dok je pod ní. */
const ISSOBELLA_LOCAL: [number, number, number] = [RING_R, -0.95, 0];

export type DockKind = 'nabukano' | 'issobella';

export interface Dock {
  id: string;
  kind: DockKind;
  label: { cs: string; en: string };
  position: [number, number, number];
  /** Natočení trupu, který na doku stojí (nos = +Z). */
  yaw: number;
}

const _euler = new THREE.Euler(0, 0, 0, 'XYZ');
const _vector = new THREE.Vector3();

/**
 * Transformace prstence Issobelly — **stejná** jako `IssobellaRing`:
 * skupina má rotaci `[0.32, 0, -0.14]` a každý frame přepíše `rotation.y`
 * na `ringSpinAngle(t)`.
 */
function ringPoint(local: [number, number, number], t: number): [number, number, number] {
  _euler.set(RING_TILT[0], ringSpinAngle(t), RING_TILT[2]);
  _vector.set(local[0], local[1], local[2]).applyEuler(_euler);
  return [_vector.x, _vector.y, _vector.z];
}

/**
 * Všechny doky v čase `t`.
 *
 * Nabukano: kotviště se otáčejí s trupem (`fleetHeading`), takže se každé
 * počítá zvlášť — loď musí letět na místo, kde rám **bude**, ne kde byl.
 */
export function dockTargets(t: number): Dock[] {
  const docks: Dock[] = [];
  const [fx, fy, fz] = fleetPosition(t);
  const heading = fleetHeading(t);
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);

  BERTHS.forEach((berth, index) => {
    const x = berth[0] * NABUKANO_SCALE;
    const y = berth[1] * NABUKANO_SCALE;
    const z = berth[2] * NABUKANO_SCALE;
    docks.push({
      id: `nabukano-${index + 1}`,
      kind: 'nabukano',
      label: { cs: `Nabukano · kotviště ${index + 1}`, en: `Nabukano · berth ${index + 1}` },
      // R_y(h) aplikované na lokální bod (x, y, z)
      position: [fx + x * cos + z * sin, fy + y - BERTH_DROP, fz + (-x * sin + z * cos)],
      // trup nosí +X, naše loď +Z → yaw = heading + π/2
      yaw: heading + Math.PI / 2,
    });
  });

  const station = ringPoint(ISSOBELLA_LOCAL, t);
  docks.push({
    id: 'issobella',
    kind: 'issobella',
    label: { cs: 'Issobella · dok stanice', en: 'Issobella · station dock' },
    position: station,
    // loď stojí čelem ke stanici, tj. po tečně prstence
    yaw: ringSpinAngle(t) + Math.PI / 2,
  });

  return docks;
}

/** Nejbližší dok — kompas v HUD i logika přistání používají tenhle jediný. */
export function nearestDock(
  position: { x: number; y: number; z: number },
  docks: Dock[],
): { dock: Dock; distance: number } | null {
  let best: { dock: Dock; distance: number } | null = null;
  for (const dock of docks) {
    const distance = Math.hypot(dock.position[0] - position.x, dock.position[1] - position.y, dock.position[2] - position.z);
    if (!best || distance < best.distance) best = { dock, distance };
  }
  return best;
}
