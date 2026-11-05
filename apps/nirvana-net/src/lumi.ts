/**
 * LUMI — společné létání.
 *
 * **Tahle hra nemá autoritativní simulaci, a je to záměr.** Lumi nemá zásahy,
 * skóre ani soupeře, takže není co podvádět: klient počítá svůj let sám
 * (stejný `stepFlight` jako sólo) a server ho jen **předává ostatním**.
 * Kdyby tu běžela serverová fyzika, platili bychom latenci a složitost za
 * ochranu, kterou hra nepotřebuje.
 *
 * Co server drží doopravdy:
 *  - **sebraná světla místnosti** — aby si je dva lidé nescbírali dvakrát
 *    a svatyně se otevřela, až když je má opravdu celá skupina,
 *  - kdo je v místnosti a kdo už doletěl.
 *
 * Kdo se přidá později, vidí už sebraná světla (dostane je ve snapshotu) —
 * jinak by musel hledat světla, která na obrazovce nejsou.
 */

import type { Match, MatchSeat } from './match.js';
import type { ClientMessage, ServerMessage } from '../../nirvana/src/core/net/protocol.js';

export type LumiPath = 'calm' | 'wind' | 'light';

interface Flyer {
  id: string;
  name: string;
  avatarId: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  finished: boolean;
  /** Kdy naposledy poslal stav (ms) — pro úklid tichých klientů. */
  seenAt: number;
  /**
   * Duch: hráč odešel, ale ostatní ho ještě chvíli vidí na poslední pozici.
   * Odejít uprostřed letu je pro ostatní rušivé — postava zmizí v půlce
   * oblohy. Duch to zjemní a hlavně nerozbije počet letců v místnosti.
   */
  ghostUntil: number;
}

const SPAWN = { x: 10, y: 12 };
/** Po jak dlouhé době bez zprávy letce schováme z obrazovky. */
const IDLE_MS = 12_000;
/** Jak dlouho po odchodu zůstane na obloze duch (ms). */
const GHOST_MS = 3_000;
/** Kolik světel má cesta (stejné číslo jako v klientovi). */
const TOTAL_LIGHTS = 7;

export function createLumiMatch(now: number): Match & { path: () => LumiPath } {
  const flyers = new Map<string, Flyer>();
  const lights = new Set<number>();
  let path: LumiPath = 'calm';
  let startedAt = now;

  const state = (): 'waiting' | 'running' | 'ended' => {
    const live = liveCount();
    if (live === 0) return 'ended';
    if (live === 1) return 'waiting';
    return 'running';
  };

  /** Živí letci — duch se do počtu nepočítá (jinak by místnost 3 s „hrála"). */
  function liveCount(): number {
    let live = 0;
    for (const flyer of flyers.values()) if (!flyer.ghostUntil) live += 1;
    return live;
  }

  return {
    game: 'lumi' as never,
    path: () => path,

    join(id: string, seat: MatchSeat) {
      // Cestu určuje první, kdo místnost založí; pozdější se přidají.
      const wanted = (seat as MatchSeat & { path?: LumiPath }).path;
      if (wanted && flyers.size === 0) path = wanted;
      if (flyers.size === 0) startedAt = Date.now();
      flyers.set(id, {
        id,
        name: seat.name,
        avatarId: seat.avatarId ?? null,
        x: SPAWN.x,
        y: SPAWN.y,
        vx: 0,
        vy: 0,
        energy: 100,
        finished: false,
        seenAt: Date.now(),
        ghostUntil: 0,
      });
    },

    leave(id: string) {
      const flyer = flyers.get(id);
      if (!flyer) return;
      // Neodebírat hned: ostatní ho ještě 3 s vidí na poslední pozici.
      // Když se stihne vrátit (reconnect se stejným id), `message()` ho oživí.
      flyer.ghostUntil = Date.now() + GHOST_MS;
    },

    step() {
      const now = Date.now();
      for (const [id, flyer] of flyers) {
        if (flyer.ghostUntil) {
          if (now > flyer.ghostUntil) flyers.delete(id);
          continue;
        }
        if (now - flyer.seenAt > IDLE_MS) flyers.delete(id);
      }
    },

    state,

    snapshot(id: string): ServerMessage | null {
      const me = flyers.get(id);
      if (!me) return null;
      return {
        t: 'snapshot',
        game: 'lumi',
        seq: lights.size,
        time: Math.max(0, Date.now() - startedAt),
        // prázdná pole: Lumi neposílá arénové hráče ani projektily
        players: [],
        lumi: {
          path,
          lights: [...lights].sort((a, b) => a - b),
          open: lights.size >= TOTAL_LIGHTS,
          // vlastní stav klient nepotřebuje — predikuje si ho sám
          flyers: [...flyers.values()]
            .filter((flyer) => flyer.id !== id)
            .map(({ id: flyerId, name, avatarId, x, y, vx, vy, energy, finished, ghostUntil }) => ({
              id: flyerId,
              name,
              avatarId,
              x,
              y,
              vx,
              vy,
              energy,
              finished,
              // duch = hráč odešel; klient ho dokresluje s klesající průhledností
              ...(ghostUntil ? { ghost: true as const } : {}),
            })),
        },
      };
    },

    message(id: string, message: ClientMessage): boolean {
      const flyer = flyers.get(id);
      if (!flyer) return false;
      if (message.t !== 'fly') return false;

      // Vrátil se dřív, než duch vypršel (reconnect) — je zase živý.
      if (flyer.ghostUntil) flyer.ghostUntil = 0;

      flyer.x = message.x;
      flyer.y = message.y;
      flyer.vx = message.vx;
      flyer.vy = message.vy;
      flyer.energy = message.energy;
      flyer.seenAt = Date.now();
      if (message.finished) flyer.finished = true;

      // Sdílená světla: bere se jen id 1..7, jednou.
      if (typeof message.collect === 'number') {
        const light = Math.round(message.collect);
        if (light >= 1 && light <= TOTAL_LIGHTS) lights.add(light);
      }
      return true;
    },

    // Duch nedrží sedlo — kapacita místnosti se uvolní hned při odchodu.
    size: () => liveCount(),
  };
}
