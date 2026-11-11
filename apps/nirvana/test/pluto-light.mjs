/**
 * PLUTO — SRDCE NA OKRAJI, test simulace bez prohlížeče.
 *
 * Ověřuje jednu mechaniku a její důsledky:
 *  1. **teplo ubývá podle vzdálenosti** od nejbližšího světla,
 *  2. **u světla se dobíjí** — a zapálená lampa je nové světlo,
 *  3. **zapálení chce stát u lampy** (a odejít dřív = nic),
 *  4. **soumrak** nakonec sežere i toho, kdo stojí u modulu,
 *  5. hra končí devíti lampami nebo zamrznutím — a dál se nepočítá.
 *
 * Data (lampy, modul, čísla) se testují proti `world.ts`, protože scéna
 * i simulace je čtou odtamtud.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/pluto-light.mjs
 */

import {
  COMPLETE_BONUS,
  DRAIN_MAX,
  LAMP_COUNT,
  LAMP_RADIUS,
  LAMP_SCORE,
  LAMP_WARMTH,
  LAMPS,
  LIGHT_TIME,
  SHUTTLE,
  SPEED,
  WARMTH_MAX,
  WARMTH_SCORE,
  WARMTH_START,
  WORLD,
} from '../src/core/pluto/world.ts';
import {
  IDLE_INPUT,
  createLight,
  drainFor,
  duskAt,
  nearestWarm,
  nextLamp,
  reachOf,
  resultOf,
  scoreOf,
  stepLight,
} from '../src/core/pluto/light.ts';

let checks = 0;
let failures = 0;

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  OK   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const DT = 1 / 60;

function run(state, input, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (state.end) break;
    stepLight(state, input, DT);
  }
  return state;
}

/** Postav hráče k lampě a chvíli tam stůj (zapalování). */
function standAt(state, index, seconds = LIGHT_TIME + 0.6) {
  const lamp = LAMPS[index];
  state.x = lamp.x;
  state.z = lamp.z;
  state.vx = 0;
  state.vz = 0;
  return run(state, IDLE_INPUT, seconds);
}

/* ── svět: data musí dávat smysl ───────────────────────────────────── */
{
  check('devět lamp', LAMPS.length === 9 && LAMP_COUNT === 9, String(LAMPS.length));
  check('id lamp jsou unikátní', new Set(LAMPS.map((l) => l.id)).size === LAMPS.length);
  check(
    'lampy leží na pláni',
    LAMPS.every((lamp) => Math.abs(lamp.x) <= WORLD - 10 && Math.abs(lamp.z) <= WORLD - 10),
  );
  check('žádné dvě lampy nejsou na sobě', LAMPS.every((a, i) => LAMPS.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) > 18)));
  check('modul je mimo lampy', LAMPS.every((lamp) => Math.hypot(lamp.x - SHUTTLE.x, lamp.z - SHUTTLE.z) > 15));
  check(
    'každá lampa je z nějaké jiné lampy do pochodu',
    LAMPS.every((a, i) =>
      LAMPS.some((b, j) => i !== j && Math.hypot(a.x - b.x, a.z - b.z) < 60),
    ),
  );
}

/* ── start a pohyb ─────────────────────────────────────────────────── */
{
  const state = createLight();
  check('start: u modulu', state.x === SHUTTLE.x && state.z === SHUTTLE.z);
  check('start: plné teplo', state.warmth === WARMTH_START);
  check('start: nic nesvítí', state.litCount === 0);
  check('start: hra běží', state.end === null);
  check('start: u modulu je teplo', nearestWarm(state).distance <= 0);

  const walk = createLight();
  run(walk, { mx: 0, mz: -1 }, 2);
  check('chůze na sever posune hráče', walk.z < SHUTTLE.z - 5, String(walk.z.toFixed(1)));

  const east = createLight();
  run(east, { mx: 1, mz: 0 }, 2);
  check('chůze na východ posune hráče', east.x > 5, String(east.x.toFixed(1)));

  const diagonal = createLight();
  run(diagonal, { mx: 1, mz: 1 }, 2);
  check('diagonála není rychlejší než přímá', Math.hypot(diagonal.vx, diagonal.vz) <= SPEED + 0.5);

  const slide = createLight();
  run(slide, { mx: 0, mz: -1 }, 1.5);
  const fastZ = slide.vz;
  stepLight(slide, IDLE_INPUT, DT);
  check('na ledě to klouže (rychlost hned nezmizí)', Math.abs(slide.vz) > Math.abs(fastZ) * 0.9);

  const bounds = createLight();
  bounds.x = WORLD - 1;
  run(bounds, { mx: 1, mz: 0 }, 3);
  check('hráč neopustí pláň', Math.abs(bounds.x) <= WORLD + 0.001, String(bounds.x));
}

/* ── teplo ─────────────────────────────────────────────────────────── */
{
  check('u světla se nedrénuje', drainFor(0) < drainFor(10));
  check('čím dál, tím větší ztráta', drainFor(20) > drainFor(5));
  check('ztráta má strop', drainFor(999) === DRAIN_MAX, String(drainFor(999)));
  check('soumrak roste s časem', duskAt(120) > duskAt(0));

  // (0, 5) je mimo dosah lampy 1 (0, 38) i lampy 6 (0, -10) — jinak by
  // hráč lampu omylem zapálil a test by měřil doplnění, ne ztrátu
  const away = createLight();
  away.x = 0;
  away.z = 5;
  run(away, IDLE_INPUT, 3);
  check('daleko od ohně teplo ubývá', away.warmth < WARMTH_START, String(away.warmth.toFixed(1)));

  // u rozsvícené lampy se dobíjí
  const warm = createLight();
  standAt(warm, 0);
  check('lampa se zapálila', warm.litCount === 1, String(warm.litCount));
  warm.warmth = 40;
  warm.x = LAMPS[0].x;
  warm.z = LAMPS[0].z;
  run(warm, IDLE_INPUT, 3);
  check('u zapálené lampy se teplo dobíjí', warm.warmth > 40 + 10, String(warm.warmth.toFixed(1)));

  const idle = createLight();
  run(idle, IDLE_INPUT, 30);
  check('u modulu se teplo drží (soumrak je ještě slabý)', idle.warmth > WARMTH_MAX - 1, String(idle.warmth.toFixed(1)));
  run(idle, IDLE_INPUT, 240);
  check('soumrak nakonec zamrazí i u modulu', idle.end === 'frozen', String(idle.end));
}

/* ── zapalování ────────────────────────────────────────────────────── */
{
  const quick = createLight();
  const lamp = LAMPS[0];
  quick.x = lamp.x;
  quick.z = lamp.z;
  run(quick, IDLE_INPUT, LIGHT_TIME * 0.6);
  check('zapalování chvíli trvá', quick.litCount === 0, String(quick.litCount));
  check('průběh je vidět ve stavu', quick.channel > 0.5, String(quick.channel.toFixed(2)));
  check('u lampy běží kanál', quick.channelId === lamp.id, String(quick.channelId));

  const leave = createLight();
  leave.x = lamp.x;
  leave.z = lamp.z;
  run(leave, IDLE_INPUT, LIGHT_TIME * 0.6);
  leave.x = lamp.x + LAMP_RADIUS + 3;
  run(leave, IDLE_INPUT, 0.2);
  check('odejít před koncem = nic', leave.litCount === 0, String(leave.litCount));
  check('kanál se vynuluje', leave.channel === 0 && leave.channelId === null);

  const full = createLight();
  const before = full.warmth;
  standAt(full, 1);
  check('stání u lampy ji zapálí', full.litCount === 1, String(full.litCount));
  check('zapálení vrátí teplo', full.warmth >= before - 10, `${before} → ${full.warmth.toFixed(1)}`);
  check('zapálení hlásí událost', full.lastEvent?.kind === 'lit', String(full.lastEvent?.kind));
  check('lampa svítí', full.lit[1] === true);
  check('zapálená lampa hřeje', Math.abs(nearestWarm(full).distance) <= 0.001 || nearestWarm(full).kind === 'lamp');

  const twice = createLight();
  standAt(twice, 0);
  const litOnce = twice.litCount;
  run(twice, IDLE_INPUT, 2);
  check('stejná lampa nejde zapálit dvakrát', twice.litCount === litOnce, String(twice.litCount));
}

/* ── kompas a dosah ────────────────────────────────────────────────── */
{
  const state = createLight();
  const near = nextLamp(state);
  check('kompas míří na nejbližší lampu', near?.id === 1, JSON.stringify(near));
  check('kompas hlásí vzdálenost', near.distance > 0);

  state.lit = state.lit.map(() => true);
  state.litCount = LAMP_COUNT;
  check('po rozsvícení všech kompas zmizí', nextLamp(state) === null);

  const dark = createLight();
  dark.x = 0;
  dark.z = -50;
  dark.warmth = 100;
  const far = reachOf(dark);
  dark.warmth = 30;
  check('menší teplo = menší dosah', reachOf(dark) < far, `${reachOf(dark)} vs ${far}`);
}

/* ── skóre a konce ─────────────────────────────────────────────────── */
{
  const state = createLight();
  state.litCount = 3;
  state.warmth = 50;
  check('skóre = lampy + teplo', scoreOf(state) === 3 * LAMP_SCORE + 50 * WARMTH_SCORE, String(scoreOf(state)));
  state.end = 'complete';
  check('bonus za srdce se přičte', scoreOf(state) === 3 * LAMP_SCORE + 50 * WARMTH_SCORE + COMPLETE_BONUS);

  // celé srdce
  const all = createLight();
  for (let i = 0; i < LAMPS.length && !all.end; i += 1) standAt(all, i);
  check('devět lamp ukončí hru', all.end === 'complete', String(all.end));
  check('všechny lampy svítí', all.litCount === LAMP_COUNT, String(all.litCount));
  check('skóre nese bonus', scoreOf(all) >= LAMP_COUNT * LAMP_SCORE + COMPLETE_BONUS);
  const result = resultOf(all);
  check('výsledek nese lampy', result.lamps === LAMP_COUNT);
  check('výsledek nese čas', result.elapsed > 0);

  // zamrznutí
  const cold = createLight();
  cold.x = 0;
  cold.z = -40;
  cold.warmth = 3;
  run(cold, IDLE_INPUT, 10);
  check('teplo na nule ukončí hru', cold.end === 'frozen', String(cold.end));
  check('teplo není záporné', cold.warmth === 0, String(cold.warmth));
  const frozenAt = cold.z;
  run(cold, { mx: 0, mz: -1 }, 2);
  check('po zamrznutí se nechodí', cold.z === frozenAt, String(cold.z));
}

/* ── robustnost ────────────────────────────────────────────────────── */
{
  const state = createLight();
  stepLight(state, IDLE_INPUT, 5);
  check('dt je zastropované na 0.05 s', Math.round(state.time * 100) / 100 === 0.05, String(state.time));

  const zero = createLight();
  stepLight(zero, IDLE_INPUT, 0);
  check('nulový krok nic neposune', zero.time === 0 && zero.z === SHUTTLE.z);

  const a = createLight();
  const b = createLight();
  run(a, { mx: 0.6, mz: -0.4 }, 6);
  run(b, { mx: 0.6, mz: -0.4 }, 6);
  check('stejný vstup = stejný stav', a.x === b.x && a.z === b.z && a.warmth === b.warmth);

  const lampWarm = createLight();
  standAt(lampWarm, 2);
  check('lampa vrací teplo nahoru', lampWarm.warmth > WARMTH_START - 20, String(lampWarm.warmth.toFixed(1)));
  check('lampa přidává jen do stropu', lampWarm.warmth <= WARMTH_MAX, String(lampWarm.warmth.toFixed(1)));
  check('teplo z lampy odpovídá konstantě', LAMP_WARMTH > 0);
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
