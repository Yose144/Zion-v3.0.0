/**
 * REGISTR HER — každá hra jako `Match`.
 *
 * Staré moduly (`arena`, `race`, `fight`, `moba`) zůstávají bez zásahu do
 * svých pravidel; tady se jen obalí jednotným kontraktem z `match.ts`.
 * Nová hra (tanky) kontrakt plní rovnou.
 *
 * Když se přidá další hra, stačí sem jeden `case` — `index.ts` se nemění.
 */

import {
  addPlayer as addArenaPlayer,
  arenaSnapshot,
  createArena,
  removePlayer as removeArenaPlayer,
  setInput as setArenaInput,
  stepArena,
} from './arena.js';
import {
  addRacePlayer,
  createRace,
  raceSnapshot,
  removeRacePlayer,
  setRaceInput,
  stepRace,
} from './race.js';
import {
  addFightPlayer,
  createFight,
  fightSnapshot,
  removeFightPlayer,
  setFightInput,
  stepFight,
} from './fight.js';
import {
  addMobaSeat,
  buyMobaItem,
  createMobaRoom,
  mobaBuyback,
  mobaRoomSnapshot,
  pickMobaTalent,
  placeMobaSentry,
  placeMobaWard,
  removeMobaSeat,
  sellMobaItem,
  setMobaInput,
  startMobaRecall,
  stepMobaRoom,
  useMobaBattleSpell,
  useMobaItem,
} from './moba.js';
import { createTanksMatch } from './tanks.js';
import { createLumiMatch } from './lumi.js';
import { createFleetMatch } from './fleet.js';
import type { Match, MatchCtx, MatchSeat } from './match.js';
import type {
  ClientMessage,
  GameId,
  RoomMode,
  RoomState,
  ServerMessage,
} from '../../nirvana/src/core/net/protocol.js';

// ── aréna ──────────────────────────────────────────────────────────────

function arenaMatch(now: number, mode: RoomMode = 'bots'): Match {
  const sim = createArena(now, { bots: mode === 'bots' });
  const humans = () => [...sim.players.values()].filter((player) => !player.isBot).length;
  return {
    game: 'arena',
    join(id, seat) {
      addArenaPlayer(sim, id, seat.name, seat.avatarId ?? null, Date.now());
    },
    leave(id) {
      removeArenaPlayer(sim, id);
    },
    step(dt, ctx) {
      for (const event of stepArena(sim, dt, ctx.now)) ctx.emit(event);
    },
    state: () => {
      if (mode === 'humans' && humans() < 2) return 'waiting';
      return sim.state === 'running' ? 'running' : 'ended';
    },
    snapshot(_id, timeMs) {
      return {
        t: 'snapshot',
        game: 'arena',
        seq: sim.seq,
        time: timeMs,
        ...arenaSnapshot(sim, timeMs),
      } as ServerMessage;
    },
    message(id, message) {
      if (message.t !== 'input') return false;
      setArenaInput(sim, id, {
        forward: message.mz,
        strafe: message.mx,
        yaw: message.yaw,
        pitch: message.pitch,
        jump: message.jump,
        fire: message.fire,
        weapon: message.weapon === 1 ? 'rocket' : message.weapon === 2 ? 'mg' : 'rail',
      });
      return true;
    },
    size: () => sim.players.size,
  };
}

// ── závod ──────────────────────────────────────────────────────────────

function raceMatch(now: number): Match {
  const sim = createRace(now);
  return {
    game: 'race',
    join(id, seat) {
      addRacePlayer(sim, id, seat.name, seat.avatarId ?? null, Date.now());
    },
    leave(id) {
      removeRacePlayer(sim, id);
    },
    step(dt, ctx) {
      for (const event of stepRace(sim, dt, ctx.now)) ctx.emit(event);
    },
    state: () => (sim.phase === 'running' ? 'running' : sim.phase === 'ended' ? 'ended' : 'waiting'),
    snapshot(_id, timeMs) {
      return {
        t: 'snapshot',
        game: 'race',
        seq: sim.seq,
        time: timeMs,
        ...raceSnapshot(sim, timeMs),
      } as ServerMessage;
    },
    message(id, message) {
      if (message.t !== 'input') return false;
      // u závodu je `mz` plyn a `mx` zatáčení (stejná konvence jako sólo)
      setRaceInput(sim, id, { throttle: message.mz, steer: message.mx });
      return true;
    },
    size: () => sim.players.size,
  };
}

// ── duel (Merkur) ──────────────────────────────────────────────────────

function fightMatch(now: number, mode: RoomMode = 'bots'): Match {
  const sim = createFight(now, { bots: mode === 'bots' });
  return {
    game: 'fight',
    join(id, seat) {
      addFightPlayer(sim, id, seat.name, seat.avatarId ?? null, Date.now());
    },
    leave(id) {
      removeFightPlayer(sim, id);
    },
    step(dt, ctx) {
      for (const event of stepFight(sim, dt, ctx.now)) ctx.emit(event);
    },
    state: () =>
      sim.match.phase === 'playing' ? 'running' : sim.match.phase === 'matchEnd' ? 'ended' : 'waiting',
    snapshot(_id, timeMs) {
      return {
        t: 'snapshot',
        game: 'fight',
        seq: sim.seq,
        time: timeMs,
        ...fightSnapshot(sim, timeMs),
      } as ServerMessage;
    },
    message(id, message) {
      if (message.t !== 'input') return false;
      setFightInput(sim, id, {
        move: message.mx,
        jump: message.jump,
        punch: message.fire && message.weapon === 0,
        kick: message.fire && message.weapon === 1,
        block: message.block === true,
      });
      return true;
    },
    size: () => (sim.seats.a.id ? 1 : 0) + (sim.seats.b.id ? 1 : 0),
  };
}

// ── MOBA (První svět) ──────────────────────────────────────────────────

function mobaMatch(now: number): Match {
  // MOBA má pevnou sestavu 5v5 — bez botů by jedna strana neměla koho postavit.
  const sim = createMobaRoom(now);
  return {
    game: 'moba',
    join(id, seat) {
      addMobaSeat(sim, id, seat.heroId ?? seat.avatarId ?? 0, Date.now(), seat.battleSpell, seat.aspect);
    },
    leave(id) {
      removeMobaSeat(sim, id);
    },
    step(dt, ctx) {
      stepMobaRoom(sim, dt, ctx.now);
      if (process.env.NIRVANA_DEBUG_MOBA && sim.sim && sim.sim.projectiles.length > 0) {
        console.log('DBG step proj', sim.sim.projectiles.length, 'phase', sim.phase);
      }
    },
    state: () =>
      sim.phase === 'running' ? 'running' : sim.phase === 'ended' ? 'ended' : 'waiting',
    snapshot(id, timeMs) {
      // **Mlha války:** snapshot se počítá pro tým diváka, ne pro všechny.
      const team = sim.seats.get(id)?.team;
      const view = mobaRoomSnapshot(sim, timeMs, team);
      if (process.env.NIRVANA_DEBUG_MOBA) {
        console.log('DBG snapshot', id, team, 'proj', view.moba.projectiles.length, 'simProj', sim.sim?.projectiles.length);
      }
      return {
        t: 'snapshot',
        game: 'moba',
        seq: sim.seq,
        time: timeMs,
        players: [],
        moba: view.moba,
        countdown: view.countdown,
        state:
          view.phase === 'running' ? 'running' : view.phase === 'ended' ? 'ended' : 'countdown',
      } as ServerMessage;
    },
    message(id, message) {
      switch (message.t) {
        case 'input':
          if (process.env.NIRVANA_DEBUG_MOBA && message.castSlot) {
            console.log('DBG cast from', id, message.castSlot, message.castX, message.castZ);
          }
          setMobaInput(sim, id, {
            moveX: message.mx,
            moveZ: message.mz,
            cast: message.castSlot
              ? { slot: message.castSlot, x: message.castX ?? 0, z: message.castZ ?? 0 }
              : null,
            attack: message.attack === true,
          });
          return true;
        case 'buy':
          buyMobaItem(sim, id, message.item);
          return true;
        case 'sell':
          sellMobaItem(sim, id, message.item);
          return true;
        case 'ward':
          placeMobaWard(sim, id, message.x, message.z);
          return true;
        case 'sentry':
          placeMobaSentry(sim, id, message.x, message.z);
          return true;
        case 'recall':
          startMobaRecall(sim, id);
          return true;
        case 'battlespell':
          useMobaBattleSpell(sim, id, message.x, message.z);
          return true;
        case 'talent':
          pickMobaTalent(sim, id, message.tier, message.pick);
          return true;
        case 'use':
          useMobaItem(sim, id, message.item, message.x ?? 0, message.z ?? 0);
          return true;
        case 'buyback':
          mobaBuyback(sim, id);
          return true;
        default:
          return false;
      }
    },
    size: () => sim.seats.size,
  };
}

// ── registr ────────────────────────────────────────────────────────────

export function createMatch(game: GameId, now: number, mode: RoomMode = 'bots'): Match {
  switch (game) {
    case 'arena':
      return arenaMatch(now, mode);
    case 'race':
      return raceMatch(now);
    case 'fight':
      return fightMatch(now, mode);
    case 'moba':
      return mobaMatch(now);
    case 'tanks':
      return createTanksMatch(now, mode);
    case 'lumi':
      return createLumiMatch(now);
    case 'fleet':
      return createFleetMatch(now);
    default: {
      // nový `GameId` bez obalu = chyba při překladu, ne až v produkci
      const exhaustive: never = game;
      throw new Error(`neznámá hra: ${String(exhaustive)}`);
    }
  }
}

export type { Match, MatchCtx, MatchSeat };
