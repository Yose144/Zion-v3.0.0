import type { ArenaBox } from './map';
import { toBox } from './physics';

/**
 * Navigace botů — **víceúrovňová** mřížka nad mapou.
 *
 * Mapa je z krabic, takže buňka 1×1 m má jednu „podlahu": nejvyšší plochu,
 * na které se dá stát a nad kterou je volno do výšky těla. Most (top 2) je
 * proto podlaha ve výšce 2, ne zeď — bot se po schodech vyškrábe nahoru.
 *
 * Co platí:
 *  - **tenké desky (trim, ≤ 0,25 m) se ignorují** — jsou dekorace, fyzika je
 *    přeskočí stejně jako `stepHeight` 0,55.
 *  - střechy vysokých zdí (> 6 m) nejsou podlaha; buňka uvnitř zdi zůstane
 *    neprůchozí, protože nad nižší plochou stojí hmota.
 *  - BFS povolí krok **nahoru do `NAV_CLIMB`** (1 m = dosah skoku) a **dolů
 *    libovolně** (bot seskočí). Skok dělá `bot.ts` podle výšky další buňky.
 */

export const NAV_SIZE = 40;
export const NAV_CELL = 1;
export const NAV_ORIGIN = -20;
/** Maximální stoupnutí mezi buňkami — nad to bot skáče (skok zvládne ~1,14 m). */
export const NAV_CLIMB = 1.0;
/** Výška těla — nad podlahou musí být tolik volna. */
const BODY_HIGH = 1.6;
/** Hranice „podlaha vs. střecha zdi": výš se za podlahu nepovažuje. */
const MAX_FLOOR = 6;
/** Tenčí krabice je deska (trim) — ani podlaha, ani překážka. */
const THIN = 0.25;

export interface NavGrid {
  /** 1 = průchozí, 0 = zeď. */
  cells: Uint8Array;
  /** Výška podlahy v buňce (pro schody a plošiny). */
  floor: Float32Array;
}

export function buildNavGrid(boxes: ArenaBox[]): NavGrid {
  const cells = new Uint8Array(NAV_SIZE * NAV_SIZE);
  const floor = new Float32Array(NAV_SIZE * NAV_SIZE);

  // Desky (trim) vyhodíme hned — jen by rozbily výšky o 0,12 m.
  const solids = boxes
    .filter((box) => box.h > THIN)
    .map(toBox)
    .filter((box) => box.maxY - box.minY > THIN);

  const overlaps = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) =>
    x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;

  for (let gz = 0; gz < NAV_SIZE; gz++) {
    for (let gx = 0; gx < NAV_SIZE; gx++) {
      const x = NAV_ORIGIN + gx * NAV_CELL + NAV_CELL / 2;
      const z = NAV_ORIGIN + gz * NAV_CELL + NAV_CELL / 2;
      const index = gz * NAV_SIZE + gx;

      let surface = -Infinity;

      for (const box of solids) {
        if (!overlaps(box, x, z)) continue;
        const top = box.maxY;
        if (top > MAX_FLOOR) continue; // střecha zdi není podlaha
        // nad plochou musí být volno do výšky těla (jinak je to strop)
        let clear = true;
        for (const other of solids) {
          if (other === box || !overlaps(other, x, z)) continue;
          if (other.minY < top + BODY_HIGH - 0.05 && other.maxY > top + 0.05) {
            clear = false;
            break;
          }
        }
        if (clear && top > surface) surface = top;
      }

      floor[index] = surface;
      cells[index] = surface === -Infinity ? 0 : 1;
    }
  }
  return { cells, floor };
}

export function cellIndex(x: number, z: number): number {
  const gx = Math.floor((x - NAV_ORIGIN) / NAV_CELL);
  const gz = Math.floor((z - NAV_ORIGIN) / NAV_CELL);
  if (gx < 0 || gz < 0 || gx >= NAV_SIZE || gz >= NAV_SIZE) return -1;
  return gz * NAV_SIZE + gx;
}

export function cellCenter(index: number): [number, number] {
  const gx = index % NAV_SIZE;
  const gz = Math.floor(index / NAV_SIZE);
  return [NAV_ORIGIN + gx * NAV_CELL + NAV_CELL / 2, NAV_ORIGIN + gz * NAV_CELL + NAV_CELL / 2];
}

/** Nejbližší průchozí buňka (hráč může stát na hraně nebo na schodu). */
export function nearestWalkable(grid: NavGrid, index: number, maxRing = 3): number {
  if (index >= 0 && grid.cells[index]) return index;
  const gx = index % NAV_SIZE;
  const gz = Math.floor(index / NAV_SIZE);
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= NAV_SIZE || nz >= NAV_SIZE) continue;
        const candidate = nz * NAV_SIZE + nx;
        if (grid.cells[candidate]) return candidate;
      }
    }
  }
  return -1;
}

/**
 * BFS cesta z `from` do `to`. Vrací seznam indexů buněk bez startovní.
 * `maxNodes` drží cenu na uzdě, když je cíl nedostupný.
 */
export function findPath(grid: NavGrid, from: number, to: number, maxNodes = 700): number[] {
  if (from < 0 || to < 0 || from === to) return [];
  if (!grid.cells[from] || !grid.cells[to]) return [];

  const prev = new Int32Array(NAV_SIZE * NAV_SIZE).fill(-1);
  const seen = new Uint8Array(NAV_SIZE * NAV_SIZE);
  const queue = new Int32Array(maxNodes);
  let head = 0;
  let tail = 0;

  queue[tail++] = from;
  seen[from] = 1;

  const neighbours = [1, -1, NAV_SIZE, -NAV_SIZE];
  while (head < tail && tail < maxNodes) {
    const current = queue[head++]!;
    if (current === to) break;

    for (const step of neighbours) {
      const next = current + step;
      if (next < 0 || next >= NAV_SIZE * NAV_SIZE) continue;
      // zákaz přetečení mezi řádky
      if (step === 1 && next % NAV_SIZE === 0) continue;
      if (step === -1 && current % NAV_SIZE === 0) continue;
      if (seen[next] || !grid.cells[next]) continue;
      // Nahoru jen do dosahu skoku, dolů libovolně (bot seskočí po schodech).
      if (grid.floor[next]! - grid.floor[current]! > NAV_CLIMB) continue;
      seen[next] = 1;
      prev[next] = current;
      queue[tail++] = next;
    }
  }

  if (!seen[to]) return [];

  const path: number[] = [];
  let node = to;
  while (node !== from && node >= 0) {
    path.push(node);
    node = prev[node]!;
  }
  path.reverse();
  return path;
}
