/**
 * Port: deterministic, seeded random.
 * Pure function PRNG — no platform dependencies, identical results in UE5/TS.
 */

export interface Random {
  /** Return a float in [0, 1). */
  next(): number;

  /** Integer in [min, max). */
  int(min: number, max: number): number;

  /** Pick a random element. */
  pick<T>(items: T[]): T;

  /** True with given chance in [0, 1]. */
  maybe(chance: number): boolean;
}

/** Seeded 32-bit PRNG (mulberry32). Portable and deterministic. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  return {
    next() {
      state += 0x6d2b79f5;
      let r = Math.imul(state ^ (state >>> 15), state | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },

    int(min, max) {
      if (min >= max) return min;
      return min + this.next() * (max - min) | 0;
    },

    pick(items) {
      return items[this.int(0, items.length)];
    },

    maybe(chance) {
      return this.next() < chance;
    },
  };
}
