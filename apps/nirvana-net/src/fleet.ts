/**
 * FLOTILA — společný volný let.
 *
 * **Relay, ne autoritativní simulace — a je to záměr.** Let nemá zásahy,
 * skóre ani soupeře, takže není co podvádět; klient počítá svůj pohyb sám
 * (stejná `stepShip` jako sólo) a server ho jen předává ostatním. Serverová
 * fyzika by znamenala platit latenci a složitost za ochranu, kterou hra
 * nepotřebuje (stejná úvaha jako u Lumi).
 *
 * Co server drží doopravdy:
 *  - **kdo je v místnosti a kterou lodí letí** (id lodi ověřené proti seznamu,
 *    ne proti tomu, co pošle klient),
 *  - **ověřené hodnoty stavu** — konečná čísla, souřadnice v hranicích
 *    prostoru, `dockId` jen ze seznamu skutečných doků,
 *  - duchy odpojených (3 s), aby loď nezmizela uprostřed oblohy.
 */

import type { Match, MatchSeat } from './match.js';
import type { ClientMessage, ServerMessage } from '../../nirvana/src/core/net/protocol.js';
import { SHIPS } from '../../nirvana/src/core/fleet/ships.js';

/** Hranice letového prostoru — stejné číslo jako `WORLD_RADIUS` v simulaci. */
const WORLD_RADIUS = 34;
/** Po jaké době bez zprávy pilota schováme (ms). */
const IDLE_MS = 12_000;
/** Jak dlouho po odchodu zůstane duch (ms). */
const GHOST_MS = 3_000;

const SHIP_IDS = new Set(SHIPS.map((ship) => ship.id));
/**
 * Doky, které server uzná. Je to **kopie seznamu z `docks.ts`**, a to záměrně:
 * `docks.ts` počítá polohy přes `three`, a server ho tahat nechce (deploy
 * nirvana-net nekopíruje `three`, takže `require('three')` by službu shodil
 * při startu). Když se doky v klientovi změní, musí se změnit i tady —
 * jinak by ostatní viděli loď „na doku", který server nezná.
 */
const DOCK_IDS = new Set(['nabukano-1', 'nabukano-2', 'nabukano-3', 'issobella']);

interface Pilot {
  id: string;
  name: string;
  avatarId: number | null;
  shipId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  docked: boolean;
  dockId?: string;
  seenAt: number;
  ghostUntil: number;
}

/** Start o kus dál pro každého dalšího pilota, ať lodě neprolétnou sebou. */
const START = { x: -6, y: 7, z: 24 };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Zabalí úhel do (−π, π] — klient posílá absolutní yaw, který roste otáčením. */
export function wrapAngle(angle: number): number {
  const tau = Math.PI * 2;
  let value = angle % tau;
  if (value > Math.PI) value -= tau;
  if (value <= -Math.PI) value += tau;
  return value;
}

export function createFleetMatch(now: number): Match {
  const pilots = new Map<string, Pilot>();
  const startedAt = now;

  function liveCount(): number {
    let live = 0;
    for (const pilot of pilots.values()) if (!pilot.ghostUntil) live += 1;
    return live;
  }

  const state = (): 'waiting' | 'running' | 'ended' => {
    const live = liveCount();
    if (live === 0) return 'ended';
    if (live === 1) return 'waiting';
    return 'running';
  };

  return {
    game: 'fleet' as never,

    join(id: string, seat: MatchSeat) {
      // Nejdřív loď: sedlo ji nese z `join`, `shipId` z `MatchSeat` rozšířením.
      const wanted = (seat as MatchSeat & { shipId?: string }).shipId;
      const shipId = wanted && SHIP_IDS.has(wanted) ? wanted : 'xwing';
      const offset = pilots.size * 1.4;
      pilots.set(id, {
        id,
        name: seat.name,
        avatarId: seat.avatarId ?? null,
        shipId,
        x: START.x + offset,
        y: START.y,
        z: START.z,
        // nos ke středu soustavy, stejně jako sólo start
        yaw: 2.68,
        pitch: 0,
        roll: 0,
        speed: 0,
        docked: false,
        seenAt: Date.now(),
        ghostUntil: 0,
      });
    },

    leave(id: string) {
      const pilot = pilots.get(id);
      if (!pilot) return;
      // Neodebírat hned — loď zmizet v půlce oblohy je rušivé. Reconnect se
      // stejným id pilota oživí (stejně jako u Lumi).
      pilot.ghostUntil = Date.now() + GHOST_MS;
    },

    step() {
      const now = Date.now();
      for (const [id, pilot] of pilots) {
        if (pilot.ghostUntil) {
          if (now > pilot.ghostUntil) pilots.delete(id);
          continue;
        }
        if (now - pilot.seenAt > IDLE_MS) pilots.delete(id);
      }
    },

    state,

    snapshot(id: string): ServerMessage | null {
      const me = pilots.get(id);
      if (!me) return null;
      return {
        t: 'snapshot',
        game: 'fleet',
        seq: pilots.size,
        time: Math.max(0, Date.now() - startedAt),
        players: [],
        fleet: {
          // Vlastní stav klient nepotřebuje — predikuje si ho sám.
          pilots: [...pilots.values()]
            .filter((pilot) => pilot.id !== id)
            .map((pilot) => ({
              id: pilot.id,
              name: pilot.name,
              avatarId: pilot.avatarId,
              shipId: pilot.shipId,
              x: pilot.x,
              y: pilot.y,
              z: pilot.z,
              yaw: pilot.yaw,
              pitch: pilot.pitch,
              roll: pilot.roll,
              speed: pilot.speed,
              docked: pilot.docked,
              ...(pilot.dockId ? { dockId: pilot.dockId } : {}),
              ...(pilot.ghostUntil ? { ghost: true as const } : {}),
            })),
        },
      };
    },

    message(id: string, message: ClientMessage): boolean {
      const pilot = pilots.get(id);
      if (!pilot) return false;
      if (message.t !== 'flight') return false;

      // Vrátil se dřív, než duch vypršel (reconnect) — je zase živý.
      if (pilot.ghostUntil) pilot.ghostUntil = 0;

      pilot.x = clamp(message.x, -WORLD_RADIUS, WORLD_RADIUS);
      pilot.y = clamp(message.y, -WORLD_RADIUS, WORLD_RADIUS);
      pilot.z = clamp(message.z, -WORLD_RADIUS, WORLD_RADIUS);
      pilot.yaw = wrapAngle(message.yaw);
      pilot.pitch = clamp(message.pitch, -1.2, 1.2);
      pilot.roll = clamp(message.roll, -1, 1);
      pilot.speed = clamp(message.speed, -30, 40);
      pilot.docked = message.docked === true;
      // `dockId` bere jen existující dok: kdyby klient poslal cokoli, ostatní
      // by u něj viděli loď „na doku", který v mapě není.
      pilot.dockId = pilot.docked && message.dockId && DOCK_IDS.has(message.dockId) ? message.dockId : undefined;
      if (pilot.docked && !pilot.dockId) pilot.docked = false;

      pilot.seenAt = Date.now();
      return true;
    },

    // Duch nedrží sedlo — kapacita místnosti se uvolní hned při odchodu.
    size: () => liveCount(),
  };
}

/** Pro testy: seznam doků, který server uznává (musí sedět s `docks.ts`). */
export function knownDocks(): string[] {
  return [...DOCK_IDS];
}

/** Pro testy: rozměry, na kterých server staví (nesmí se rozejít se sim). */
export function fleetBounds(): { worldRadius: number; ghostMs: number; idleMs: number } {
  return { worldRadius: WORLD_RADIUS, ghostMs: GHOST_MS, idleMs: IDLE_MS };
}

