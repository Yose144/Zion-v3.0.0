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
}

const SPAWN = { x: 10, y: 12 };
/** Po jak dlouhé době bez zprávy letce schováme z obrazovky. */
const IDLE_MS = 12_000;
/** Kolik světel má cesta (stejné číslo jako v klientovi). */
const TOTAL_LIGHTS = 7;

export function createLumiMatch(now: number): Match & { path: () => LumiPath } {
  const flyers = new Map<string, Flyer>();
  const lights = new Set<number>();
  let path: LumiPath = 'calm';
  let startedAt = now;

  const state = (): 'waiting' | 'running' | 'ended' => {
    if (flyers.size === 0) return 'ended';
    if (flyers.size === 1) return 'waiting';
    return 'running';
  };

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
      });
    },

    leave(id: string) {
      flyers.delete(id);
    },

    step() {
      const now = Date.now();
      for (const [id, flyer] of flyers) {
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
            .map(({ id: flyerId, name, avatarId, x, y, vx, vy, energy, finished }) => ({
              id: flyerId,
              name,
              avatarId,
              x,
              y,
              vx,
              vy,
              energy,
              finished,
            })),
        },
      };
    },

    message(id: string, message: ClientMessage): boolean {
      const flyer = flyers.get(id);
      if (!flyer) return false;
      if (message.t !== 'fly') return false;

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

    size: () => flyers.size,
  };
}
