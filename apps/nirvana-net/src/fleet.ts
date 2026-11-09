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
/** Po jaké době bez zprávy pilota usne do ducha (ms). */
const IDLE_MS = Number(process.env.NIRVANA_NET_RELAY_IDLE_MS ?? 12_000);
/** Jak dlouho po odchodu zůstane duch (ms). */
const GHOST_MS = 3_000;
/**
 * Ticho (skrytá karta, výpadek sítě) **není odchod** — sedlo v místnosti
 * pořád drží, ať už je socket otevřený, nebo běží resume grace. Proto
 * entity po `IDLE_MS` jen „usne" do ducha na neurčito: `flight` ho zase
 * oživí a `leave()` (skutečný odchod) mu `ghostUntil` zkrátí na `GHOST_MS`,
 * takže `step` ho pak normálně smaže. `MAX_SAFE_INTEGER` = „do odchodu".
 */
const DORMANT_UNTIL = Number.MAX_SAFE_INTEGER;

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
  /** Poslední odmítnuté kotviště (obsazené jiným pilotem) — pro HUD. */
  dockConflict?: string;
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
      const existing = pilots.get(id);
      if (existing) {
        /**
         * Rejoin po resume (`joinRoom` dělá `leave` + `join` na stejném id):
         * pilot už v místnosti je — většinou duch po výpadku. Oživíme ho
         * **na místě**: pozice, natočení i dok zůstávají, obnoví se jen
         * identita a loď (a jen když ji klient tentokrát poslal).
         */
        existing.name = seat.name;
        existing.avatarId = seat.avatarId ?? null;
        if (wanted && SHIP_IDS.has(wanted)) existing.shipId = wanted;
        existing.ghostUntil = 0;
        existing.dockConflict = undefined;
        existing.seenAt = Date.now();
        return;
      }
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
        // Ticho ≠ odchod: sedlo pořád drží, takže entity jen usne do ducha.
        if (now - pilot.seenAt > IDLE_MS) pilot.ghostUntil = DORMANT_UNTIL;
      }
    },

    state,

    /**
     * `id` nemusí být pilot — divák (`?watch=`) sedlo nemá a přesto musí
     * dostávat snapshoty. Dřív se tu vracelo `null` pro každého, kdo není
     * v `pilots`, takže hlediště u flotily zůstalo prázdné (odhalil
     * `fleet-online.mjs`). U relay hry není co skrývat, takže divák vidí
     * totéž co hráči.
     */
    snapshot(id: string): ServerMessage | null {
      const me = pilots.get(id);
      return {
        t: 'snapshot',
        game: 'fleet',
        seq: pilots.size,
        time: Math.max(0, Date.now() - startedAt),
        players: [],
        fleet: {
          // Obsazená kotviště — klient je ukáže v HUD, aby člověk letěl
          // na volné a ne aby se dozvěděl až odmítnutím.
          occupied: [
            ...new Set(
              // Duch kotviště nedrží — stejně jako u kontroly konfliktu.
              [...pilots.values()].filter((p) => !p.ghostUntil && p.docked && p.dockId).map((p) => p.dockId!),
            ),
          ],
          ...(me?.dockConflict ? { conflict: me.dockConflict } : {}),
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
      // `dockId` bere jen existující dok: kdyby klient poslal cokoli, ostatní
      // by u něj viděli loď „na doku", který v mapě není.
      const wants =
        message.docked === true && message.dockId && DOCK_IDS.has(message.dockId) ? message.dockId : null;

      /**
       * **Jedno kotviště = jedna loď.** Dřív server `dockId` jen přeposílal,
       * takže dva piloti mohli stát ve stejném bodě a prolínat se.
       * Držení se hlásí klient (relay), takže se tu jen kontroluje, jestli
       * místo není obsazené jiným **živým** pilotem — duch kotviště nedrží.
       */
      if (wants) {
        const taken = [...pilots.values()].some(
          (other) => other.id !== id && !other.ghostUntil && other.docked && other.dockId === wants,
        );
        if (taken) {
          pilot.docked = false;
          pilot.dockId = undefined;
          pilot.dockConflict = wants;
        } else {
          pilot.docked = true;
          pilot.dockId = wants;
          pilot.dockConflict = undefined;
        }
      } else {
        pilot.docked = false;
        pilot.dockId = undefined;
        pilot.dockConflict = undefined;
      }

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

