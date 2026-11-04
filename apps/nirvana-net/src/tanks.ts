/**
 * TANKY (Saturn) — první hra, která plní jednotný kontrakt `Match` rovnou,
 * bez obalu nad starým modulem.
 *
 * Server drží **stejnou simulaci jako klient** (`core/saturn/tanks.ts`) a jen
 * do ní pumpuje mířidlo a výstřel. Pravidla (dostřel, vítr, krátery,
 * poškození) tedy nemůžou být na dvou místech.
 *
 * Zvláštnost proti aréně: hra je **tahová**. Server proto nepřijímá vstup
 * každý snímek, ale jen `aim` (absolutní úhel/sílu) a `shoot`; obojí platí
 * jen pro hráče na tahu.
 */

import {
  createTanks,
  fire,
  rematch,
  stepTanks,
  TANK_HP,
  type TankSide,
  type TanksState,
} from '../../nirvana/src/core/saturn/tanks.js';
import type { Match, MatchSeat } from './match.js';
import type { ServerMessage, TankSideId, TanksView } from '../../nirvana/src/core/net/protocol.js';

/** Po konci zápasu se po téhle době rozjede nový (stejná mapa se nepoužije). */
const RESTART_MS = 7000;
/** Kolik bodů stopy střely se posílá (delší je jen výpočet navíc). */
const TRAIL_POINTS = 60;

const SIDE_ID: Record<TankSide, TankSideId> = { player: 0, bot: 1 };
const SIDE_FROM_ID: [TankSide, TankSide] = ['player', 'bot'];

function view(sim: TanksState, side: TankSide, terrain: number[] | null): TanksView {
  const tanks = [sim.player, sim.bot].map((tank) => ({
    side: SIDE_ID[tank.side],
    x: Math.round(tank.x * 10) / 10,
    hp: tank.hp,
    angle: Math.round(tank.angle * 10) / 10,
    power: Math.round(tank.power * 10) / 10,
    alive: tank.alive,
  })) as TanksView['tanks'];

  return {
    you: SIDE_ID[side],
    turn: SIDE_ID[sim.turn],
    phase: sim.phase,
    wind: sim.wind,
    tanks,
    shot: sim.shot
      ? {
          x: Math.round(sim.shot.x * 10) / 10,
          y: Math.round(sim.shot.y * 10) / 10,
          trail: sim.shot.trail.slice(-TRAIL_POINTS * 2).map((value) => Math.round(value * 10) / 10),
        }
      : null,
    lastHit: sim.lastHit
      ? {
          x: Math.round(sim.lastHit.x),
          y: Math.round(sim.lastHit.y),
          damage: sim.lastHit.damage,
          by: SIDE_ID[sim.lastHit.by],
        }
      : null,
    wins: [sim.wins.player, sim.wins.bot],
    shots: sim.shotsFired,
    over: sim.over ? SIDE_ID[sim.over] : null,
    terrainVersion: sim.terrain.version,
    terrain,
  };
}

export function createTanksMatch(now: number): Match {
  let sim = createTanks(now, { autoBot: true });
  /** Kdo z lidí sedí na které straně. Prázdné sedlo hraje bot. */
  const sides = new Map<string, TankSide>();
  /** Poslední verze terénu, kterou hráč dostal (šetří 161 čísel na snapshot). */
  const sentTerrain = new Map<string, number>();
  let restartedAt = 0;

  const rebalance = () => {
    // první člověk vždy sedí vlevo, druhý vpravo; když někdo odejde,
    // zbylý se posune doleva a jeho pozice se hraje botem
    const ids = [...sides.keys()];
    sides.clear();
    ids.forEach((id, index) => sides.set(id, SIDE_FROM_ID[index] ?? 'bot'));
    sim.autoBot = sides.size < 2;
    for (const id of sentTerrain.keys()) {
      if (!sides.has(id)) sentTerrain.delete(id);
    }
  };

  return {
    game: 'tanks',
    join(id, seat: MatchSeat) {
      if (sides.has(id)) return;
      if (sides.size >= 2) return;
      sides.set(id, sides.size === 0 ? 'player' : 'bot');
      sim.autoBot = sides.size < 2;
      sentTerrain.delete(id);
      void seat;
    },
    leave(id) {
      if (!sides.delete(id)) return;
      rebalance();
      // když zůstal jen jeden člověk a ten byl vpravo, přesedne si doleva
      if (sides.size === 1) {
        const [only] = [...sides.keys()];
        if (only) sides.set(only, 'player');
      }
      sim.autoBot = sides.size < 2;
    },
    step(dt, ctx) {
      stepTanks(sim, dt);
      if (sim.phase === 'over') {
        if (restartedAt === 0) restartedAt = ctx.now;
        else if (ctx.now - restartedAt > RESTART_MS) {
          sim = rematch(sim, ctx.now);
          sentTerrain.clear();
          restartedAt = 0;
          sim.autoBot = sides.size < 2;
          ctx.system('nová mapa');
        }
      } else {
        restartedAt = 0;
      }
    },
    state: () => {
      if (sim.phase === 'over') return 'ended';
      // Lobby má ukázat „čeká na hráče", dokud je volné sedlo — i když mezitím
      // hraje bot. Jinak by místnost s jedním člověkem hlásila „hraje se".
      return sides.size < 2 ? 'waiting' : 'running';
    },
    snapshot(id, timeMs) {
      const side = sides.get(id) ?? 'player';
      let terrain: number[] | null = null;
      if (sentTerrain.get(id) !== sim.terrain.version) {
        terrain = Array.from(sim.terrain.heights, (value) => Math.round(value * 10) / 10);
        sentTerrain.set(id, sim.terrain.version);
      }
      void timeMs;
      return {
        t: 'snapshot',
        game: 'tanks',
        seq: sim.shotsFired,
        time: Date.now(),
        players: [],
        tanks: view(sim, side, terrain),
      } as ServerMessage;
    },
    message(id, message) {
      const side = sides.get(id);
      if (!side) return false;
      if (message.t === 'aim') {
        if (sim.turn !== side || sim.phase !== 'aim' || sim.over) return true;
        const tank = side === 'player' ? sim.player : sim.bot;
        // server validuje rozsah — klient nesmí poslat úhel 500
        const angle = Number.isFinite(message.angle) ? Math.min(90, Math.max(0, message.angle)) : tank.angle;
        const power = Number.isFinite(message.power) ? Math.min(100, Math.max(5, message.power)) : tank.power;
        tank.angle = angle;
        tank.power = power;
        return true;
      }
      if (message.t === 'shoot') {
        fire(sim, side);
        return true;
      }
      return false;
    },
    size: () => sides.size,
  };
}

/** Pro testy: kolik má hráč na dané straně životů. */
export function tanksHpForTest(side: TankSide): number {
  return TANK_HP;
}
