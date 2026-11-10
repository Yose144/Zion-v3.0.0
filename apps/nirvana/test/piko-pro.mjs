/**
 * Te Pīko Ora — test profi vrstvy (pas, medaile, duch, stříkající voda).
 *
 * Všechno jsou čisté funkce bez prohlížeče:
 *  - medaile se nikdy nesnižují a skin se odemyká jen ve svém módu,
 *  - ghost se ukládá jen při rekordu a interpoluje se podle času,
 *  - částice se recyklují (pool) a stejné semínko dá stejný výstřik.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/piko-pro.mjs
 */

import {
  CANOE_SKINS,
  PIKO_MEDALS,
  SURF_SKINS,
  activeSkin,
  applyRun,
  betterMedal,
  emptyPassport,
  medalFor,
  medalRank,
  setSkin,
  unlockedSkins,
} from '../src/core/piko/passport.ts';
import {
  GHOST_MAX,
  GHOST_STEP,
  createGhostRun,
  ghostLength,
  pushGhost,
  sampleGhost,
} from '../src/core/piko/ghost.ts';
import { SPLASH_MAX, SplashField } from '../src/core/piko/effects.ts';

let checks = 0;
let failures = 0;
function check(name, ok, detail = '') {
  checks += 1;
  if (ok) console.log(`  OK   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function path(count = 10) {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 0.2,
    x: index,
    z: -10 - index,
    heading: index * 0.1,
  }));
}

/* ── medaile a pas ─────────────────────────────────────────────────── */

console.log('\nMedaile');
{
  check('kánoe: nula nemá medaili', medalFor(0, 'canoe') === 'none');
  check('kánoe: bronz od hranice', medalFor(PIKO_MEDALS.canoe.bronze, 'canoe') === 'bronze');
  check('kánoe: stříbro od hranice', medalFor(PIKO_MEDALS.canoe.silver, 'canoe') === 'silver');
  check('kánoe: zlato od hranice', medalFor(PIKO_MEDALS.canoe.gold, 'canoe') === 'gold');
  check('surf: bronz od hranice', medalFor(PIKO_MEDALS.surf.bronze, 'surf') === 'bronze');
  check('surf: zlato nad hranicí', medalFor(2000, 'surf') === 'gold');
  check('medaile se nesnižuje', betterMedal('gold', 'bronze') === 'gold');
  check('vyšší medaile vyhraje', betterMedal('bronze', 'silver') === 'silver');
  check('pořadí medailí', medalRank('none') < medalRank('bronze') && medalRank('bronze') < medalRank('gold'));
  check('pas začíná prázdný', emptyPassport().runs === 0 && emptyPassport().best.canoe === 0);
  check('výchozí skiny', emptyPassport().skins.canoe === CANOE_SKINS[0].id && emptyPassport().skins.surf === SURF_SKINS[0].id);
  check('na začátku je odemčený jen výchozí', unlockedSkins(emptyPassport(), 'canoe').length === 1);
}

console.log('\nPas — rekord, medaile, skiny, duch');
{
  const empty = emptyPassport();
  const first = applyRun(empty, { mode: 'canoe', score: 800, elapsed: 42.5, ghostPoints: path() });
  check('první jízda je rekord', first.improved);
  check('první jízda dá bronz', first.medal === 'bronze');
  check('rekord se uloží', first.passport.best.canoe === 800);
  check('čas rekordu se uloží', first.passport.bestTime.canoe === 42.5);
  check('počet jízd roste', first.passport.runs === 1);
  check('duch se uloží při rekordu', first.ghostSaved && first.passport.ghost.canoe?.score === 800);
  check(
    'bronz odemkne moana, ne ahi',
    first.newSkins.some((skin) => skin.id === 'moana') && !first.newSkins.some((skin) => skin.id === 'ahi'),
  );
  check('vstupní pas se nemutuje', empty.runs === 0 && empty.best.canoe === 0);

  const worse = applyRun(first.passport, { mode: 'canoe', score: 780, elapsed: 30, ghostPoints: path() });
  check('horší jízda není rekord', !worse.improved);
  check('rekord zůstal', worse.passport.best.canoe === 800);
  check('čas rekordu se nepřepsal', worse.passport.bestTime.canoe === 42.5);
  check('duch zůstal z rekordu', worse.passport.ghost.canoe?.score === 800 && !worse.ghostSaved);
  check('nic nového se neodemklo', worse.newSkins.length === 0);

  const gold = applyRun(worse.passport, { mode: 'canoe', score: 1100, elapsed: 31, ghostPoints: path() });
  check('zlato je nový rekord', gold.improved && gold.medal === 'gold');
  check('zlato se uloží', gold.passport.medals.canoe === 'gold');
  check('zlato odemkne ahi', gold.newSkins.some((skin) => skin.id === 'ahi'));
  check('duch se aktualizoval', gold.passport.ghost.canoe?.score === 1100);

  const noGhost = applyRun(empty, { mode: 'surf', score: 100, elapsed: 5, ghostPoints: path(3) });
  check('krátký běh neuloží ducha', !noGhost.ghostSaved && noGhost.passport.ghost.surf === null);

  check('zamčený skin nejde vybrat', setSkin(empty, 'canoe', 'ahi') === null);
  const chosen = setSkin(gold.passport, 'canoe', 'ahi');
  check('odemčený skin jde vybrat', chosen?.skins.canoe === 'ahi');
  check('aktivní skin respektuje medaili', activeSkin(chosen, 'canoe').id === 'ahi');
  const tampered = {
    ...gold.passport,
    medals: { ...gold.passport.medals, canoe: 'none' },
    skins: { ...gold.passport.skins, canoe: 'ahi' },
  };
  check('zamčený skin se nepoužije', activeSkin(tampered, 'canoe').id === CANOE_SKINS[0].id);
  check('surf skin se neplete s kánoí', activeSkin(gold.passport, 'surf').id === SURF_SKINS[0].id);
}

/* ── ghost ─────────────────────────────────────────────────────────── */

console.log('\nDuch');
{
  const points = [];
  pushGhost(points, 0, 0, 0, 0);
  pushGhost(points, GHOST_STEP / 2, 99, 99, 0);
  pushGhost(points, GHOST_STEP, 4, -4, 1);
  pushGhost(points, GHOST_STEP * 2, 8, -8, 2);
  check('vzorky mají časový krok', points.length === 3, String(points.length));
  check('délka záznamu sedí', ghostLength(points) === GHOST_STEP * 2);

  const mid = sampleGhost(points, GHOST_STEP * 1.5);
  check('vzorek se interpoluje', mid !== null && Math.abs(mid.x - 6) < 1e-6, `x=${mid?.x}`);
  check('interpoluje se i natočení', mid !== null && Math.abs(mid.heading - 1.5) < 1e-6, `h=${mid?.heading}`);
  check('před začátkem je první bod', sampleGhost(points, -5)?.x === 0);
  check('po konci je poslední bod', sampleGhost(points, 99)?.x === 8);
  check('prázdný záznam nic nevrací', sampleGhost([], 1) === null);

  const wrapped = [
    { t: 0, x: 0, z: 0, heading: 3.1 },
    { t: 1, x: 0, z: 0, heading: -3.1 },
  ];
  const around = sampleGhost(wrapped, 0.5);
  check('natočení jde kratší cestou', around !== null && Math.abs(around.heading) > 3.13, `h=${around?.heading}`);

  check('krátký záznam se neuloží', createGhostRun('canoe', 1, path(7)) === null);
  check('dlouhý záznam se uloží', createGhostRun('canoe', 1, path(8)) !== null);

  const many = [];
  for (let index = 0; index < GHOST_MAX + 50; index++) {
    pushGhost(many, index * GHOST_STEP, index, index, 0);
  }
  check('záznam má strop', many.length === GHOST_MAX, String(many.length));
  check('strop maže začátek', many[0].t > 0);
}

/* ── stříkající voda ───────────────────────────────────────────────── */

console.log('\nStříkající voda');
{
  const field = new SplashField();
  check('pool má strop', field.particles.length === SPLASH_MAX);
  field.spawn(1, 0.2, 2, 10, 0.7, 360, 7);
  check('výstřik oživí částice', field.alive() === 10, String(field.alive()));
  field.update(0.2);
  check('částice žijí', field.alive() === 10);
  // krok je zastropovaný na 0,05 s (proti tunelování), takže se simuluje po krocích
  for (let index = 0; index < 60; index++) field.update(0.05);
  check('po dvou sekundách jsou mrtvé', field.alive() === 0, String(field.alive()));
  check('mrtvé částice jsou pod hladinou', field.particles[0].y === -100);

  const a = new SplashField();
  const b = new SplashField();
  a.spawn(0, 0.2, 0, 6, 0.6, 360, 42);
  b.spawn(0, 0.2, 0, 6, 0.6, 360, 42);
  check(
    'stejné semínko dá stejný výstřik',
    a.particles[0].x === b.particles[0].x && a.particles[0].vz === b.particles[0].vz,
  );

  field.spawn(0, 0.2, 0, SPLASH_MAX + 10, 1, 360, 1);
  check('výstřik nepřeteče pool', field.alive() <= SPLASH_MAX, String(field.alive()));
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
