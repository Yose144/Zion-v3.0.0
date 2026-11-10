#!/usr/bin/env node
/**
 * Merkur — ragdoll engine bez prohlížeče.
 *
 * Ověřuje pravidla, která vidí hráč: loutka stojí, vstup hýbe tělem, švih
 * ubírá HP, kryt tlumí, KO ukončí kolo, přežití posouvá vlny, fotbal dává
 * góly a póza projde přes drát.
 *
 * Spuštění: npx tsx apps/nirvana/test/ragdoll.mjs
 */

import {
  ARENA_HALF,
  BALL_SECONDS,
  HILL_TARGET,
  KOTH_KO_BONUS,
  KOTH_SECONDS,
  MAX_HP,
  NO_INPUT,
  P,
  POINT_COUNT,
  PUNCH_REACH,
  applyPose,
  bodyCenterOf,
  botInput,
  comboMultiplier,
  createRagdollMatch,
  damageFighter,
  hitDamage,
  makeBotMemory,
  makeRagdollFighter,
  poseOf,
  resetRagdollMatch,
  stepRagdoll,
} from '../src/core/fight/ragdoll.ts';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const DT = 1 / 30;
const identity = (id) => ({ id, name: id, avatarId: null });

function play(match, ticks, inputA = () => NO_INPUT, inputB = () => NO_INPUT) {
  const events = [];
  let now = 0;
  let clock = 0;
  for (let tick = 0; tick < ticks; tick++) {
    now += DT * 1000;
    clock += DT;
    events.push(...stepRagdoll(match, inputA(tick, match, clock), inputB(tick, match, clock), DT, now));
  }
  return events;
}

// ── postoj ────────────────────────────────────────────────────────────
console.log('\n== postoj a pohyb ==');
{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  play(match, 30 * 3);
  const chest = bodyCenterOf(match.a);
  const feet = Math.max(match.a.y[P.FOOT_L], match.a.y[P.FOOT_R]);
  check('loutka stojí (hrudník > 1,2 m)', chest.y > 1.2, chest.y.toFixed(2));
  check('chodidla na zemi (< 0,25 m)', feet < 0.25, feet.toFixed(2));
  check('body zůstaly v kleci', match.a.x.every((x) => Math.abs(x) <= ARENA_HALF + 0.01));
}

{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  const before = bodyCenterOf(match.a).x;
  play(match, 30 * 1.5, () => ({ ...NO_INPUT, move: 1 }));
  const after = bodyCenterOf(match.a).x;
  check('pohyb posune tělo doprava', after - before > 1.5, `${before.toFixed(2)}→${after.toFixed(2)}`);
}

{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  const ground = match.a.y[P.PELVIS];
  play(match, 12, (tick) => ({ ...NO_INPUT, jump: tick === 0 }));
  const airborne = Math.max(...match.a.y.slice(0, POINT_COUNT));
  check('skok zvedne loutku', airborne > ground + 0.4, `${ground.toFixed(2)}→${airborne.toFixed(2)}`);
}

// ── zásah ─────────────────────────────────────────────────────────────
console.log('\n== zásah a kryt ==');
{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  for (let i = 0; i < POINT_COUNT; i++) match.a.x[i] += 4.2; // přiblížit k B
  play(match, 30 * 5, () => ({ ...NO_INPUT, move: 1, punch: true }));
  check('pěst ubírá HP', match.b.hp < MAX_HP, `hpB=${match.b.hp}`);
  check('počítají se zásahy', match.a.hits > 0, String(match.a.hits));
  check('nejtvrdší zásah má smysl', match.a.bestHit > 3, match.a.bestHit.toFixed(2));
}

{
  const free = hitDamage(9, 1, false);
  const guard = hitDamage(9, 1, true);
  check('kryt snižuje poškození', guard > 0 && guard < free, `free=${free} guard=${guard}`);
  check('pomalý dotek nepoškodí', hitDamage(2.5, 1, false) === 0);
  check('poškození má strop', hitDamage(60, 1.15, false) <= 28, String(hitDamage(60, 1.15, false)));
}

{
  // KO přes veřejné pravidlo (deterministické, nezávisí na fyzice)
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  const events = [];
  damageFighter(match, match.b, 100, match.a, 0, events);
  play(match, 2);
  check('KO nastaví ko', match.b.ko === true);
  check('KO ukončí kolo', match.phase === 'roundEnd', match.phase);
  check('vítěz dostal bod', match.a.wins === 1, String(match.a.wins));
  check('KO event', events.some((e) => e.kind === 'ko'));
}

{
  // časový limit rozhodne podle HP
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 0.02;
  match.a.hp = 70;
  match.b.hp = 30;
  const events = play(match, 4);
  const round = events.find((e) => e.kind === 'round_end');
  check('čas rozhodne vyšší HP', round?.winner === match.a.id, JSON.stringify(round));
}

// ── přežití ───────────────────────────────────────────────────────────
console.log('\n== přežití ==');
{
  const match = createRagdollMatch('survival', identity('a'), identity('b'));
  match.phase = 'playing';
  const events = [];
  damageFighter(match, match.b, 999, match.a, 0, events);
  play(match, 2);
  check('poražený soupeř ukončí vlnu', events.some((e) => e.kind === 'wave_end') || match.phase === 'roundEnd');
  match.timer = 0.01;
  play(match, 2);
  check('po vlně přijde další', match.wave === 2 && match.b.hp > 60, `wave=${match.wave} hpB=${match.b.hp}`);
  check('hráč si nese HP', match.a.hp > 0);
}

// ── ragdoll fotbal ────────────────────────────────────────────────────
console.log('\n== ragdoll fotbal ==');
{
  const match = createRagdollMatch('ball', identity('a'), identity('b'));
  match.phase = 'playing';
  const ball = match.ball;
  ball.x = ARENA_HALF - 0.8;
  ball.y = 0.6;
  ball.vx = 12;
  const events = play(match, 4);
  const goal = events.find((e) => e.kind === 'goal');
  check('míč za čarou = gól pro A', goal?.side === 'a' && match.a.score === 1, JSON.stringify(goal));
  check('po gólu pauza', match.phase === 'roundEnd', match.phase);
  match.timer = 0.01;
  play(match, 2);
  check('výkop dostane inkasující strana', match.ball.x > 1, String(match.ball.x));
  check('hra pokračuje', match.phase === 'playing', match.phase);
}

{
  const match = createRagdollMatch('ball', identity('a'), identity('b'));
  match.phase = 'playing';
  match.elapsed = BALL_SECONDS - 0.01;
  match.a.score = 2;
  match.b.score = 1;
  const events = play(match, 2);
  check('fotbal končí po 90 s', match.phase === 'matchEnd', match.phase);
  check('vítěz fotbalu = vyšší skóre', events.some((e) => e.kind === 'match_end' && e.winner === match.a.id));
}

// ── trénink ───────────────────────────────────────────────────────────
console.log('\n== trénink ==');
{
  const match = createRagdollMatch('practice', identity('a'), identity('b'));
  match.phase = 'playing';
  match.b.hp = 4;
  damageFighter(match, match.b, 20, match.a, 0, []);
  check('figurína se po KO znovu postaví', match.b.hp === MAX_HP && !match.b.ko, `hp=${match.b.hp}`);
  play(match, 60);
  check('trénink nikdy neskončí', match.phase === 'playing', match.phase);
}

// ── póza / drát ───────────────────────────────────────────────────────
console.log('\n== póza a bot ==');
{
  const fighter = makeRagdollFighter(identity('a'), -3.4, 1);
  const pose = poseOf(fighter);
  check('póza má 22 čísel', pose.length === 22, String(pose.length));
  fighter.x.fill(0);
  fighter.y.fill(0);
  applyPose(fighter, pose);
  check('póza projde tam a zpět', Math.abs(fighter.x[P.CHEST] - pose[P.CHEST * 2]) < 0.01);
}

{
  const sample = (difficulty) => {
    const match = createRagdollMatch('duel', identity('a'), identity('b'));
    match.phase = 'playing';
    const memory = makeBotMemory();
    let decisions = 0;
    for (let frame = 0; frame < 300; frame++) {
      const before = memory.nextThink;
      botInput(match, 'b', memory, difficulty, frame / 30);
      if (memory.nextThink !== before) decisions += 1;
    }
    return decisions;
  };
  check('mistr se rozhoduje častěji', sample('champion') > sample('gentle'));
}

{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 20;
  const aRef = match.a;
  const bRef = match.b;
  resetRagdollMatch(match);
  check('reset vrátí zápas na začátek', match.phase === 'countdown' && match.a.wins === 0 && match.round === 1);
  check('reset zachová objekty (refy rendereru)', match.a === aRef && match.b === bRef);
}

// ── kombo a výdrž krytu ───────────────────────────────────────────────
console.log('\n== kombo a kryt ==');
{
  check('kombo začíná na 1,0', comboMultiplier(0) === 1, String(comboMultiplier(0)));
  check('kombo roste', comboMultiplier(3) > comboMultiplier(1), `${comboMultiplier(1)} < ${comboMultiplier(3)}`);
  check('kombo má strop', comboMultiplier(99) === 1.5, String(comboMultiplier(99)));

  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  for (let i = 0; i < POINT_COUNT; i++) match.a.x[i] += 4.2;
  let maxCombo = 0;
  let now = 0;
  for (let tick = 0; tick < 30 * 10; tick++) {
    now += DT * 1000;
    stepRagdoll(match, { ...NO_INPUT, move: 1, punch: true }, NO_INPUT, DT, now);
    maxCombo = Math.max(maxCombo, match.a.combo);
  }
  check('série zásahů zvedne kombo', maxCombo >= 2, `maxCombo=${maxCombo} hits=${match.a.hits}`);
}
{
  const match = createRagdollMatch('duel', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = 60;
  const events = [];
  events.push(...play(match, 30 * 1, () => ({ ...NO_INPUT, block: true })));
  events.push(...play(match, 30 * 3, () => ({ ...NO_INPUT, block: true })));
  check('kryt ubírá výdrž', match.a.guardMeter < 0.9, String(match.a.guardMeter));
  check('kryt se po vyčerpání zlomí', events.some((e) => e.kind === 'guard_break'), JSON.stringify(events.filter((e) => e.kind === 'guard_break')));
  play(match, 30 * 2, () => NO_INPUT);
  check('výdrž se regeneruje', match.a.guardMeter > 0.2, String(match.a.guardMeter));
}

// ── král kopce ────────────────────────────────────────────────────────
console.log('\n== král kopce ==');
{
  const match = createRagdollMatch('koth', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = KOTH_SECONDS;
  // A do zóny, B daleko
  for (let i = 0; i < POINT_COUNT; i++) match.a.x[i] += 3.4;
  play(match, 30 * 2);
  check('držení kopce roste', match.hill.a > 1.4, String(match.hill.a));
  check('soupeř mimo zónu nedrží', match.hill.b === 0, String(match.hill.b));

  // B dovnitř → souboj v zóně držení zastaví
  const before = match.hill.a;
  for (let i = 0; i < POINT_COUNT; i++) match.a.x[i] -= 1.2;
  for (let i = 0; i < POINT_COUNT; i++) match.b.x[i] -= 2.2;
  play(match, 30 * 1);
  check('souboj v zóně držení zastaví', match.hill.a - before < 0.2, `${before}→${match.hill.a}`);
}
{
  const match = createRagdollMatch('koth', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = KOTH_SECONDS;
  for (let i = 0; i < POINT_COUNT; i++) match.a.x[i] += 3.4;
  match.hill.a = HILL_TARGET - 0.05;
  const events = play(match, 6);
  check('12 s držení vyhraje zápas', match.phase === 'matchEnd' && match.hill.a >= HILL_TARGET, match.phase);
  check('hill_win event', events.some((e) => e.kind === 'hill_win'));
}
{
  const match = createRagdollMatch('koth', identity('a'), identity('b'));
  match.phase = 'playing';
  match.timer = KOTH_SECONDS;
  damageFighter(match, match.b, 999, match.a, 0, []);
  check('KO dá vítězi kus kopce', match.hill.a >= KOTH_KO_BONUS, String(match.hill.a));
  play(match, 30 * 3);
  check('poražený se v kothu vrátí', !match.b.ko && match.b.hp === MAX_HP, `ko=${match.b.ko} hp=${match.b.hp}`);
}

console.log(`\nragdoll: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
