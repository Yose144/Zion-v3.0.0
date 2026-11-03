#!/usr/bin/env node
/**
 * Balance harness „Prvního světa" — odehraje N zápasů **bot vs bot** v čisté
 * simulaci (bez prohlížeče) a změří, co se ve hře opravdu děje.
 *
 * Proč: čísla ekonomiky, itemů, talentů a věží jsou odhad. Bez sehrávky
 * nejde poznat, jestli hra končí Nexou, nebo časem, jestli padají věže,
 * kolik je zabití a jestli boti stíhají utrácet.
 *
 * Spuštění: npx tsx apps/nirvana/test/moba-balance.mjs [počet zápasů]
 */

import { createMobaMatch, mobaSnapshot, stepMoba } from '../src/core/moba/sim.ts';
import { STRUCTURES } from '../src/core/moba/map.ts';

const MATCHES = Number(process.argv[2] ?? 24);
const STEP = 1 / 30;
const MAX_SECONDS = 480;

/** Dvojice hrdinů — deterministicky se točí, aby se potkaly různé školy. */
const HEROES = [0, 82, 84, 12, 27, 41, 63, 77, 105, 130, 168, 199];

function playMatch(index) {
  const blue = HEROES[index % HEROES.length];
  const red = HEROES[(index + 5) % HEROES.length];
  const now = 20_000_000 + index * 1_000_000;
  const state = createMobaMatch(
    [
      { id: 'b1', heroId: blue, team: 'blue', human: false },
      { id: 'b2', heroId: HEROES[(index + 3) % HEROES.length], team: 'blue', human: false },
      { id: 'r1', heroId: red, team: 'red', human: false },
      { id: 'r2', heroId: HEROES[(index + 7) % HEROES.length], team: 'red', human: false },
    ],
    now,
  );

  let steps = 0;
  let runesTaken = 0;
  let previousRunes = state.runes.length;
  let bossKills = 0;
  let previousBossAlive = state.boss.alive;

  while (!state.ended && state.time < MAX_SECONDS) {
    stepMoba(state, STEP, {}, now + state.time * 1000);
    steps += 1;
    if (state.runes.length < previousRunes) runesTaken += state.runes.length === 0 ? previousRunes : 1;
    previousRunes = state.runes.length;
    if (previousBossAlive && !state.boss.alive) bossKills += 1;
    previousBossAlive = state.boss.alive;
  }

  const snapshot = mobaSnapshot(state);
  const towersDown = STRUCTURES.filter(
    (structure) =>
      structure.kind !== 'nexus' && (state.towers.find((tower) => tower.id === structure.id)?.hp ?? 0) <= 0,
  ).length;
  const inhibitorsDown = STRUCTURES.filter(
    (structure) =>
      structure.kind === 'inhibitor' && (state.towers.find((tower) => tower.id === structure.id)?.hp ?? 0) <= 0,
  ).length;

  const heroes = state.heroes;
  return {
    index,
    winner: state.ended ?? 'timeout',
    seconds: Math.round(state.time),
    timeout: state.ended === null,
    towersDown,
    inhibitorsDown,
    bossKills,
    runesTaken,
    kills: heroes.reduce((sum, hero) => sum + hero.kills, 0),
    gold: Math.round(heroes.reduce((sum, hero) => sum + hero.gold, 0) / heroes.length),
    items: Math.round((heroes.reduce((sum, hero) => sum + hero.items.length, 0) / heroes.length) * 10) / 10,
    level: Math.round((heroes.reduce((sum, hero) => sum + hero.level, 0) / heroes.length) * 10) / 10,
    damage: Math.round(heroes.reduce((sum, hero) => sum + hero.damageDone, 0) / heroes.length),
    talents: heroes.reduce((sum, hero) => sum + Object.keys(hero.talentPicks).length, 0),
    heroes: snapshot.heroes.length,
    steps,
  };
}

const results = [];
for (let index = 0; index < MATCHES; index += 1) results.push(playMatch(index));

const avg = (key) => Math.round((results.reduce((sum, row) => sum + row[key], 0) / results.length) * 10) / 10;
const timeouts = results.filter((row) => row.timeout).length;
const blueWins = results.filter((row) => row.winner === 'blue').length;
const redWins = results.filter((row) => row.winner === 'red').length;

console.log(`\n== BALANCE — ${MATCHES} zápasů bot vs bot ==\n`);
console.log('  # | vítěz  | čas  | věže | inhib | boss | runy | kill | zlato | itemy | lvl | dmg  | talenty');
console.log('  --+--------+------+------+-------+------+------+------+-------+-------+-----+------+--------');
for (const row of results) {
  console.log(
    `  ${String(row.index).padStart(2)} | ${row.winner.padEnd(6)} | ${String(row.seconds).padStart(4)} | ` +
      `${String(row.towersDown).padStart(4)} | ${String(row.inhibitorsDown).padStart(5)} | ${String(row.bossKills).padStart(4)} | ` +
      `${String(row.runesTaken).padStart(4)} | ${String(row.kills).padStart(4)} | ${String(row.gold).padStart(5)} | ` +
      `${String(row.items).padStart(5)} | ${String(row.level).padStart(3)} | ${String(row.damage).padStart(4)} | ${row.talents}`,
  );
}

console.log('\n  Souhrn:');
console.log(`    průměrný čas       ${avg('seconds')} s (limit ${MAX_SECONDS} s)`);
console.log(`    timeout (bez Nexy) ${timeouts}/${MATCHES}`);
console.log(`    modrá / červená    ${blueWins} / ${redWins}`);
console.log(`    padlé věže         ${avg('towersDown')} z 18`);
console.log(`    padlé inhibitory   ${avg('inhibitorsDown')} z 6`);
console.log(`    boss zabití        ${avg('bossKills')} na zápas`);
console.log(`    runy sebrané       ${avg('runesTaken')} na zápas`);
console.log(`    zabití celkem      ${avg('kills')} na zápas`);
console.log(`    zlato na hrdinu    ${avg('gold')} (na konci)`);
console.log(`    itemy na hrdinu    ${avg('items')} z 6 slotů`);
console.log(`    level na hrdinu    ${avg('level')} z 15`);
console.log(`    poškození          ${avg('damage')} na hrdinu`);
console.log(`    talenty            ${avg('talents')} ze 2 na hrdinu`);
console.log('');
