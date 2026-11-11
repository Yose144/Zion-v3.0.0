#!/usr/bin/env node
/**
 * Merkur — sehrávka pro ladění (bez prohlížeče).
 *
 * Odehraje N zápasů bot vs bot v každém režimu a vypíše čísla, podle kterých
 * se ladí: délka, timeouty, zásahy, komba, zlomy krytu, góly, vlny, kopec.
 *
 * Spuštění: npx tsx apps/nirvana/test/ragdoll-balance.mjs [N]
 */

import {
  BALL_SECONDS,
  HILL_TARGET,
  botInput,
  createRagdollMatch,
  stepRagdoll,
} from '../src/core/fight/ragdoll.ts';

const DT = 1 / 30;
const RUNS = Math.max(2, Number(process.argv[2] ?? 24));
const DIFFICULTY = 'standard';

const empty = () => ({
  matches: 0,
  seconds: 0,
  timeouts: 0,
  winsA: 0,
  winsB: 0,
  draws: 0,
  hits: 0,
  kos: 0,
  guardBreaks: 0,
  ringouts: 0,
  maxCombo: 0,
  bestHit: 0,
});

const memory = (seed) => ({ nextThink: 0, pick: 'punch', guardUntil: 0, seed });

function count(tally, match, events) {
  for (const event of events) {
    if (event.kind === 'hit') {
      tally.hits += 1;
      tally.bestHit = Math.max(tally.bestHit, event.speed ?? 0);
      tally.maxCombo = Math.max(tally.maxCombo, event.combo ?? 0);
    } else if (event.kind === 'ko') tally.kos += 1;
    else if (event.kind === 'guard_break') tally.guardBreaks += 1;
    else if (event.kind === 'round_end' && event.reason === 'ringout') tally.ringouts += 1;
  }
  tally.maxCombo = Math.max(tally.maxCombo, match.a.combo, match.b.combo);
}

function runDuel(countRuns) {
  const tally = empty();
  for (let run = 0; run < countRuns; run++) {
    const match = createRagdollMatch('duel', { id: 'a', name: 'A', avatarId: null }, { id: 'b', name: 'B', avatarId: null });
    const memA = memory(1 + run * 17);
    const memB = memory(1 + run * 31);
    let now = 0;
    let clock = 0;
    let ticks = 0;
    const cap = 30 * 60 * 8;
    while (match.phase !== 'matchEnd' && ticks < cap) {
      now += DT * 1000;
      clock += DT;
      ticks += 1;
      count(tally, match, stepRagdoll(match, botInput(match, 'a', memA, DIFFICULTY, clock), botInput(match, 'b', memB, DIFFICULTY, clock), DT, now));
    }
    tally.matches += 1;
    tally.seconds += ticks * DT;
    if (match.phase !== 'matchEnd') tally.timeouts += 1;
    else if (match.a.wins > match.b.wins) tally.winsA += 1;
    else if (match.b.wins > match.a.wins) tally.winsB += 1;
    else tally.draws += 1;
  }
  return tally;
}

function runSumo(countRuns) {
  const tally = empty();
  for (let run = 0; run < countRuns; run++) {
    const match = createRagdollMatch('sumo', { id: 'a', name: 'A', avatarId: null }, { id: 'b', name: 'B', avatarId: null });
    const memA = memory(17 + run * 37);
    const memB = memory(19 + run * 41);
    let now = 0;
    let clock = 0;
    let ticks = 0;
    const cap = 30 * 60 * 6;
    while (match.phase !== 'matchEnd' && ticks < cap) {
      now += DT * 1000;
      clock += DT;
      ticks += 1;
      count(tally, match, stepRagdoll(match, botInput(match, 'a', memA, DIFFICULTY, clock), botInput(match, 'b', memB, DIFFICULTY, clock), DT, now));
    }
    tally.matches += 1;
    tally.seconds += ticks * DT;
    if (match.phase !== 'matchEnd') tally.timeouts += 1;
    else if (match.a.wins > match.b.wins) tally.winsA += 1;
    else if (match.b.wins > match.a.wins) tally.winsB += 1;
    else tally.draws += 1;
  }
  return tally;
}

function runSurvival(countRuns) {
  const tally = empty();
  let waves = 0;
  for (let run = 0; run < countRuns; run++) {
    const match = createRagdollMatch('survival', { id: 'a', name: 'A', avatarId: null }, { id: 'b', name: 'B', avatarId: null });
    const memA = memory(3 + run * 13);
    const memB = memory(7 + run * 19);
    let now = 0;
    let clock = 0;
    let ticks = 0;
    const cap = 30 * 60 * 6;
    while (match.phase !== 'matchEnd' && ticks < cap) {
      now += DT * 1000;
      clock += DT;
      ticks += 1;
      count(tally, match, stepRagdoll(match, botInput(match, 'a', memA, DIFFICULTY, clock), botInput(match, 'b', memB, DIFFICULTY, clock), DT, now));
    }
    tally.matches += 1;
    tally.seconds += ticks * DT;
    waves += match.wave;
    if (match.phase !== 'matchEnd') tally.timeouts += 1;
  }
  return { tally, waves: waves / countRuns };
}

function runBall(countRuns) {
  const tally = empty();
  let goalsA = 0;
  let goalsB = 0;
  for (let run = 0; run < countRuns; run++) {
    const match = createRagdollMatch('ball', { id: 'a', name: 'A', avatarId: null }, { id: 'b', name: 'B', avatarId: null });
    const memA = memory(5 + run * 11);
    const memB = memory(9 + run * 23);
    let now = 0;
    let clock = 0;
    let ticks = 0;
    const cap = 30 * (BALL_SECONDS + 60);
    while (match.phase !== 'matchEnd' && ticks < cap) {
      now += DT * 1000;
      clock += DT;
      ticks += 1;
      count(tally, match, stepRagdoll(match, botInput(match, 'a', memA, DIFFICULTY, clock), botInput(match, 'b', memB, DIFFICULTY, clock), DT, now));
    }
    tally.matches += 1;
    tally.seconds += ticks * DT;
    goalsA += match.a.score;
    goalsB += match.b.score;
    if (match.phase !== 'matchEnd') tally.timeouts += 1;
    if (match.a.score > match.b.score) tally.winsA += 1;
    else if (match.b.score > match.a.score) tally.winsB += 1;
    else tally.draws += 1;
  }
  return { tally, goalsA: goalsA / countRuns, goalsB: goalsB / countRuns };
}

function runKoth(countRuns) {
  const tally = empty();
  let hillA = 0;
  let hillB = 0;
  for (let run = 0; run < countRuns; run++) {
    const match = createRagdollMatch('koth', { id: 'a', name: 'A', avatarId: null }, { id: 'b', name: 'B', avatarId: null });
    const memA = memory(11 + run * 7);
    const memB = memory(13 + run * 29);
    let now = 0;
    let clock = 0;
    let ticks = 0;
    const cap = 30 * 60 * 4;
    while (match.phase !== 'matchEnd' && ticks < cap) {
      now += DT * 1000;
      clock += DT;
      ticks += 1;
      count(tally, match, stepRagdoll(match, botInput(match, 'a', memA, DIFFICULTY, clock), botInput(match, 'b', memB, DIFFICULTY, clock), DT, now));
    }
    tally.matches += 1;
    tally.seconds += ticks * DT;
    hillA += match.hill.a;
    hillB += match.hill.b;
    if (match.phase !== 'matchEnd') tally.timeouts += 1;
    if (match.hill.a >= HILL_TARGET || match.hill.a > match.hill.b) tally.winsA += 1;
    else if (match.hill.b >= HILL_TARGET || match.hill.b > match.hill.a) tally.winsB += 1;
    else tally.draws += 1;
  }
  return { tally, hillA: hillA / countRuns, hillB: hillB / countRuns };
}

function line(name, tally, extra = '') {
  const m = Math.max(1, tally.matches);
  console.log(
    `${name.padEnd(10)} ${String(tally.matches).padStart(3)}×  ` +
      `čas ${(tally.seconds / m).toFixed(1).padStart(5)} s  ` +
      `A:B ${String(tally.winsA).padStart(2)}:${String(tally.winsB).padEnd(2)} (remízy ${tally.draws}, timeout ${tally.timeouts})  ` +
      `zásahy ${(tally.hits / m).toFixed(1).padStart(5)}  ` +
      `KO ${(tally.kos / m).toFixed(1).padStart(4)}  ` +
      `kombo ${tally.maxCombo}  ` +
      `kryt zlomen ${(tally.guardBreaks / m).toFixed(2).padStart(4)}  ` +
      `nejtvrdší ${tally.bestHit.toFixed(1)} m/s${extra ? `  ${extra}` : ''}`,
  );
}

console.log(`\nMERKUR — sehrávka ${RUNS} zápasů na mód (bot ${DIFFICULTY})\n`);
line('duel', runDuel(RUNS));
const sumo = runSumo(RUNS);
line('sumo', sumo, `ring-out ${(sumo.ringouts / Math.max(1, sumo.matches)).toFixed(1)}`);
const survival = runSurvival(RUNS);
line('survival', survival.tally, `průměrná vlna ${survival.waves.toFixed(1)}`);
const ball = runBall(RUNS);
line('ball', ball.tally, `góly ${ball.goalsA.toFixed(1)}:${ball.goalsB.toFixed(1)}`);
const koth = runKoth(RUNS);
line('koth', koth.tally, `kopec ${koth.hillA.toFixed(1)}:${koth.hillB.toFixed(1)} s`);
console.log('');
