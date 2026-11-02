#!/usr/bin/env node
/**
 * Test simulace MOBA „První svět" — bez prohlížeče.
 *
 * Ověřuje, že hra opravdu běží: vlny minionů, poškození kouzlem, věže,
 * převzetí uzlu L5 a konec zápasu. Když tenhle test projde, chyba v klientovi
 * je jen vizuální — ne v pravidlech.
 *
 * Spuštění: npx tsx apps/nirvana/test/moba-sim.mjs
 */

import { createMoba, stepMoba, mobaSnapshot, NO_INPUT } from '../src/core/moba/sim.ts';
import { spellsForAvatar } from '../src/core/moba/spells.ts';
import { NEXUS_HP, WAVE_INTERVAL_MS } from '../src/core/moba/map.ts';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const STEP = 1000 / 30;

/** Posun simulace o `ms` s konstantním vstupem. */
function advance(state, ms, input = NO_INPUT) {
  let now = state.now;
  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    now += STEP;
    stepMoba(state, STEP / 1000, { 'hero-you': input }, now);
  }
  return now;
}

console.log('== MOBA · simulace ==');

// ── 1. kouzla z kánonu ───────────────────────────────────────────────
const krishna = spellsForAvatar(0);
const shiva = spellsForAvatar(82);
const ganesha = spellsForAvatar(84);
check('kouzla: 4 sloty', krishna.length === 4 && krishna.map((s) => s.slot).join('') === 'QWER');
check('kouzla: každá postava má vlastní jména', krishna[3].name !== shiva[3].name, `${krishna[3].name} / ${shiva[3].name}`);
check('kouzla: barva z paprsku postavy', /^#[0-9a-f]{6}$/i.test(krishna[0].color), krishna[0].color);
check('kouzla: R má delší cooldown než Q', krishna[3].cooldownMs > krishna[0].cooldownMs);

// ── 2. start zápasu ──────────────────────────────────────────────────
const state = createMoba(0, 82, 0);
check('start: dva hrdinové', state.heroes.length === 2);
check('start: tři uzly L5', state.nodes.length === 3, String(state.nodes.length));
check('start: dvanáct věží + dva Nexy', state.towers.length === 14, String(state.towers.length));
check('start: Nexy mají plné HP', state.towers.filter((t) => t.kind === 'nexus').every((t) => t.hp === NEXUS_HP));

// ── 3. vlny minionů ──────────────────────────────────────────────────
advance(state, 7000);
const firstWave = state.minions.length;
check('vlna: minioni przyšli po 6 s', firstWave > 0, String(firstWave));
check('vlna: obě strany', new Set(state.minions.map((m) => m.team)).size === 2);
const minionX0 = state.minions[0]?.x ?? 0;
advance(state, 2000);
const moved = state.minions.find((m) => m.id === state.minions[0]?.id);
check('minioni jdou po lince', !moved || Math.abs(moved.x - minionX0) > 0.5 || state.minions.length !== firstWave);

// ── 4. kouzlo zasáhne protivníka ─────────────────────────────────────
const you = state.heroes[0];
const foe = state.heroes[1];
you.x = 0;
you.z = 0;
foe.x = 4;
foe.z = 0;
const foeHpBefore = foe.hp;
const now4 = advance(state, 200);
stepMoba(state, 1 / 30, { 'hero-you': { ...NO_INPUT, cast: { slot: 'Q', x: 4, z: 0 } } }, now4 + 33);
advance(state, 900, NO_INPUT);
check('kouzlo Q: soupeř ztratil HP', foe.hp < foeHpBefore, `${foeHpBefore} → ${foe.hp}`);
check('kouzlo Q: spotřebovalo manu', you.mana < you.maxMana, `${Math.round(you.mana)}/${you.maxMana}`);
check('kouzlo Q: má cooldown', you.cooldowns.Q > state.now, String(you.cooldowns.Q - state.now));

// ── 5. léčení a štít (W) ─────────────────────────────────────────────
// Beze svědků: u vlastní brány, ať štít nesežere minion dřív, než ho změřím.
you.x = -34;
you.z = 0;
you.hp = you.maxHp * 0.5;
const now5 = state.now;
stepMoba(state, 1 / 30, { 'hero-you': { ...NO_INPUT, cast: { slot: 'W', x: you.x, z: you.z } } }, now5 + 33);
const shielded = you.shield > 0 || you.hp > you.maxHp * 0.5;
check('kouzlo W: štít nebo heal', shielded, `shield=${Math.round(you.shield)} hp=${Math.round(you.hp)}`);

// ── 6. věž střílí po hrdinech ────────────────────────────────────────
const redTower = state.towers.find((t) => t.team === 'red' && t.kind === 'tower');
you.x = redTower.x - 2;
you.z = redTower.z;
const hpBeforeTower = you.hp;
advance(state, 2500);
check('věž: trefuje hrdinu v dosahu', you.hp < hpBeforeTower, `${Math.round(hpBeforeTower)} → ${Math.round(you.hp)}`);

// ── 7. převzetí uzlu L5 ──────────────────────────────────────────────
const node = state.nodes[0];
you.x = node.x;
you.z = node.z;
you.hp = you.maxHp;
advance(state, 3500);
check('uzel L5: převzat po 2,6 s', node.owner === 'blue', String(node.owner));

// ── 8. konec zápasu ──────────────────────────────────────────────────
const redNexus = state.towers.find((t) => t.id === 'red-nexus');
redNexus.hp = 60;
you.x = redNexus.x - 2;
you.z = redNexus.z;
advance(state, 4000);
check('konec: Nexa padla → vítězství ZION', state.ended === 'blue', String(state.ended));

const snapshot = mobaSnapshot(state);
check('snapshot: nese hrdiny i věže', snapshot.heroes.length === 2 && snapshot.towers.length > 0);
check('snapshot: banner po vítězství', Boolean(snapshot.banner));

// ── 9. časový limit ──────────────────────────────────────────────────
const slow = createMoba(1, 2, 0);
advance(slow, 5_000);
let guard = 0;
while (!slow.ended && guard < 500) {
  advance(slow, 1000);
  guard += 1;
}
check('limit: zápas skončí do 8 minut', slow.ended !== null, `čas ${Math.round(slow.time)} s`);

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
