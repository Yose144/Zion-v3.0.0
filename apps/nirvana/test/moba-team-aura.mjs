/**
 * Test týmové aury za Prastaré stvoření — bez prohlížeče.
 *
 * Řeka byla jen sólo buff pro zabijáka; tým ji neměl důvod řešit. Teď
 * zabití Prastarého stvoření dá auru **celému živému týmu** (poloviční,
 * aby jeden hrdina nenesl celý zápas) a banner to řekne nahlas.
 *
 * Ověřuje:
 *  1. aura zasáhne jen živé spojence (mrtvý na respawnu ji nedostane),
 *  2. soupeř ji nedostane,
 *  3. síla je nižší než sólo buff zabijáka (obchod, ne dvojitá odměna),
 *  4. buffy mají konečný čas a sim je po expiraci sundá,
 *  5. snapshot je nese (HUD je z nich kreslí).
 *
 * Spuštění: cd apps/nirvana && npx tsx test/moba-team-aura.mjs
 */

const { createMobaMatch, grantTeamAura, mobaSnapshot, stepMoba, NO_INPUT } = await import(
  '../src/core/moba/sim.ts'
);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const STEP = 1000 / 30;

function advance(state, ms) {
  let now = state.now;
  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    now += STEP;
    stepMoba(state, STEP / 1000, { 'a': NO_INPUT, 'b': NO_INPUT, 'c': NO_INPUT }, now);
  }
  return now;
}

// tři spojenci + jeden soupeř
const state = createMobaMatch(
  [
    { id: 'a', heroId: 0, team: 'blue', human: true, aspect: 'a' },
    { id: 'b', heroId: 1, team: 'blue', human: true, aspect: 'b' },
    { id: 'c', heroId: 2, team: 'blue', human: true, aspect: 'a' },
    { id: 'x', heroId: 82, team: 'red', human: true, aspect: 'b' },
  ],
  0,
);

const byId = new Map(state.heroes.map((hero) => [hero.id, hero]));
byId.get('a').x = 30;
byId.get('b').x = 30;
byId.get('c').x = 30;
byId.get('x').x = -30;

const before = {
  a: byId.get('a').buffs.length,
  b: byId.get('b').buffs.length,
  x: byId.get('x').buffs.length,
};

const affected = grantTeamAura(state, byId.get('a'), state.now);
check('aura zasáhne všechny tři živé spojence', affected === 3, `affected=${affected}`);
check('spojenci dostali buffy', byId.get('a').buffs.length > before.a && byId.get('b').buffs.length > before.b);
check('soupeř buff nedostal', byId.get('x').buffs.length === before.x, String(byId.get('x').buffs.length));

const aura = byId.get('b').buffs;
check(
  'aura obsahuje sílu, vidění i rychlost',
  aura.some((b) => b.type === 'strength') && aura.some((b) => b.type === 'ward') && aura.some((b) => b.type === 'speed'),
  JSON.stringify(aura.map((b) => b.type)),
);
const strength = aura.find((b) => b.type === 'strength');
check('síla aury je pod sólo buffem (0,12 vs 0,4)', strength.power === 0.12, String(strength.power));
check('aura má konečný čas', strength.until > state.now && strength.until <= state.now + 95000, String(strength.until - state.now));

// mrtvý spojenec auru nedostane
const ghost = createMobaMatch(
  [
    { id: 'a', heroId: 0, team: 'blue', human: true },
    { id: 'b', heroId: 1, team: 'blue', human: true },
  ],
  0,
);
const dead = ghost.heroes.find((hero) => hero.id === 'b');
dead.alive = false;
dead.hp = 0;
const count = grantTeamAura(ghost, ghost.heroes.find((hero) => hero.id === 'a'), ghost.now);
check('mrtvý spojenec auru nedostane', count === 1, `affected=${count}`);

// snapshot buffy nese
const shot = mobaSnapshot(state);
const blueHero = shot.heroes.find((hero) => hero.id === 'b');
check('snapshot nese buffy hráče', Array.isArray(blueHero?.buffs) && blueHero.buffs.length > 0, JSON.stringify(blueHero?.buffs?.length));
check(
  'snapshot má i typ buffu',
  blueHero.buffs.some((buff) => ['strength', 'ward', 'speed'].includes(buff.type)),
  JSON.stringify(blueHero.buffs.map((buff) => buff.type)),
);

// expirace: po 130 s už aura není aktivní
advance(state, 95000);
const later = mobaSnapshot(state).heroes.find((hero) => hero.id === 'b');
const stillActive = (later?.buffs ?? []).filter(
  (buff) => buff.until > (later?.buffs ? state.now : 0),
);
check('po 95 s aura vypršela', stillActive.length === 0, `aktivní=${stillActive.length}`);

console.log('');
if (failures > 0) {
  console.log(`TEAM AURA FAILED (${failures})`);
  process.exit(1);
}
console.log('TEAM AURA OK');
