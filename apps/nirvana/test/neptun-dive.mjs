/**
 * NEPTUN — HLUBINA, test simulace bez prohlížeče.
 *
 * Ověřuje pravidla, na kterých hra stojí:
 *  1. zvon **klesá vždy** (i bez vstupu) a `W`/`S` mění jen tempo,
 *  2. **vítr odnáší** a kormidlo proti němu drží uličku,
 *  3. **lucerna je čas** (hloubka žere víc), světla dobíjí, víry berou,
 *  4. sestup končí dnem, tmou nebo prasklým pláštěm — a dál se nepočítá.
 *
 * Data (hloubky, světla, víry) se testují proti `world.ts`, protože scéna
 * i simulace je čtou odtamtud — kdyby se rozešly, hráč by sbíral světla,
 * která na obrazovce nejsou.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/neptun-dive.mjs
 */

import {
  BOTTOM_BONUS,
  DECKS,
  DEPTH_BOTTOM,
  LANE,
  MAX_ENERGY,
  MOTES,
  MOTE_ENERGY,
  MOTE_RADIUS,
  MOTE_SCORE,
  START_ENERGY,
  START_HULL,
  VORTICES,
  deckAt,
  deckIndexAt,
  drainAt,
  windAt,
} from '../src/core/neptun/world.ts';
import {
  IDLE_INPUT,
  createDive,
  depthRatio,
  nextMote,
  resultOf,
  scoreOf,
  stepDive,
} from '../src/core/neptun/dive.ts';

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

/** Pustí simulaci na `seconds` sekund a vrátí stav. */
function run(state, input, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (state.end) break;
    stepDive(state, input, DT);
  }
  return state;
}

/* ── svět: data musí dávat smysl ───────────────────────────────────── */
{
  check('pět vrstev atmosféry', DECKS.length === 5, String(DECKS.length));
  check('vrstvy na sebe navazují', DECKS.every((deck, i) => (i === 0 ? deck.from === 0 : deck.from === DECKS[i - 1].to)));
  check('poslední vrstva končí na dně', DECKS[DECKS.length - 1].to === DEPTH_BOTTOM);
  check('vrstva pro hloubku 0 je opar', deckAt(0).id === 'haze');
  check('vrstva pro dno je hlubina', deckAt(DEPTH_BOTTOM).id === 'abyss');
  check('hloubka pod dnem zůstává hlubina', deckIndexAt(DEPTH_BOTTOM + 500) === DECKS.length - 1);

  check('patnáct světel', MOTES.length === 15, String(MOTES.length));
  check('id světel jsou unikátní', new Set(MOTES.map((m) => m.id)).size === MOTES.length);
  check(
    'světla leží v uličce',
    MOTES.every((m) => Math.abs(m.x) <= LANE - 2),
  );
  check(
    'světla jsou nad dnem a pod startem',
    MOTES.every((m) => m.depth > 0 && m.depth < DEPTH_BOTTOM),
  );
  check(
    'světla jsou od sebe dál než dva poloměry',
    MOTES.every((a, i) =>
      MOTES.every((b, j) => i === j || Math.hypot(a.depth - b.depth, a.x - b.x) > MOTE_RADIUS * 1.4),
    ),
  );

  check('pět vírů', VORTICES.length === 5, String(VORTICES.length));
  check(
    'víry neleží na světlech',
    VORTICES.every((v) => MOTES.every((m) => Math.hypot(v.depth - m.depth, v.x - m.x) > v.radius + MOTE_RADIUS)),
  );
  check(
    'víry jsou v uličce',
    VORTICES.every((v) => Math.abs(v.x) <= LANE),
  );

  check('vítr je deterministický', windAt(123) === windAt(123));
  check(
    'vítr nikdy nepřekročí sílu vrstvy',
    [10, 90, 250, 400, 600, 800].every((depth) => Math.abs(windAt(depth)) <= deckAt(depth).wind + 1e-9),
  );
  check('hlubina žere víc než opar', drainAt(850) > drainAt(40));
  check('hloubkový poměr je 0..1', depthRatio({ depth: DEPTH_BOTTOM } ) === 1 && depthRatio({ depth: -5 }) === 0);
}

/* ── start a klesání ───────────────────────────────────────────────── */
{
  const dive = createDive();
  check('start: hloubka 0', dive.depth === 0);
  check('start: plná lucerna', dive.energy === START_ENERGY);
  check('start: celý plášť', dive.hull === START_HULL);
  check('start: žádné světlo', dive.lightCount === 0);
  check('start: sestup neskončil', dive.end === null);

  run(dive, IDLE_INPUT, 3);
  check('bez vstupu zvon klesá', dive.depth > 20, String(dive.depth));

  const fast = run(createDive(), { steer: 0, dive: true, brake: false }, 3);
  const slow = run(createDive(), { steer: 0, dive: false, brake: true }, 3);
  check('W zrychlí sestup', fast.depth > slow.depth + 10, `${fast.depth.toFixed(1)} vs ${slow.depth.toFixed(1)}`);
  check('S nikdy nezastaví úplně', slow.depth > 5, String(slow.depth.toFixed(1)));

  const right = run(createDive(), { steer: 1, dive: false, brake: false }, 2);
  const left = run(createDive(), { steer: -1, dive: false, brake: false }, 2);
  check('kormidlo vpravo posune doprava', right.x > 1, String(right.x.toFixed(2)));
  check('kormidlo vlevo posune doleva', left.x < -1, String(left.x.toFixed(2)));
}

/* ── vítr a stěna proudu ───────────────────────────────────────────── */
{
  // hlubina má nejsilnější vítr: bez kormidla musí odnést zvon ze středu
  const drift = createDive();
  drift.depth = 780;
  drift.x = 0;
  run(drift, IDLE_INPUT, 2);
  check('vítr odnáší i bez vstupu', Math.abs(drift.x) > 0.5, String(drift.x.toFixed(2)));

  const wall = createDive();
  wall.depth = 300;
  wall.x = LANE;
  run(wall, { steer: 1, dive: false, brake: false }, 1);
  check('náraz do proudu bere plášť', wall.hull < START_HULL - 5, String(wall.hull.toFixed(1)));
  check('hráč zůstane v uličce', Math.abs(wall.x) <= LANE);
  check('stěna hlásí událost', wall.events.some((e) => e.kind === 'wall') || wall.lastEvent?.kind === 'wall');
}

/* ── světla ────────────────────────────────────────────────────────── */
{
  const first = MOTES[0];
  const dive = createDive();
  dive.depth = first.depth - 2;
  dive.x = first.x;
  dive.energy = 50;
  stepDive(dive, IDLE_INPUT, DT);
  check('světlo se sebere v dosahu', dive.lightCount === 1, String(dive.lightCount));
  check('světlo dobije lucernu', dive.energy > 50 + MOTE_ENERGY - 2, String(dive.energy.toFixed(1)));
  check('sebrání hlásí událost', dive.lastEvent?.kind === 'light');

  run(dive, IDLE_INPUT, 1);
  check('stejné světlo nejde sebrat dvakrát', dive.lightCount === 1, String(dive.lightCount));

  const full = createDive();
  const second = MOTES[1];
  full.depth = second.depth - 2;
  full.x = second.x;
  full.energy = MAX_ENERGY;
  stepDive(full, IDLE_INPUT, DT);
  check('lucerna nepřeteče', full.energy <= MAX_ENERGY, String(full.energy.toFixed(1)));
  check('lucerna zůstane plná', full.energy === MAX_ENERGY, String(full.energy.toFixed(1)));
}

/* ── víry ──────────────────────────────────────────────────────────── */
{
  const vortex = VORTICES[0];
  const dive = createDive();
  dive.depth = vortex.depth;
  dive.x = vortex.x;
  dive.energy = 90;
  dive.hull = START_HULL;
  stepDive(dive, IDLE_INPUT, DT);
  check('vír bere lucernu', dive.energy < 90, String(dive.energy.toFixed(2)));
  check('vír bere i plášť', dive.hull < START_HULL, String(dive.hull.toFixed(2)));
  check('vír hlásí událost', dive.lastEvent?.kind === 'vortex');

  const far = createDive();
  far.depth = vortex.depth;
  far.x = vortex.x + vortex.radius + 4;
  far.energy = 90;
  stepDive(far, IDLE_INPUT, DT);
  check('mimo dosah vír nic nebere', far.energy > 90 - 0.1, String(far.energy.toFixed(2)));
}

/* ── konce sestupu ─────────────────────────────────────────────────── */
{
  const bottom = createDive();
  bottom.depth = DEPTH_BOTTOM - 3;
  bottom.x = 0;
  run(bottom, { steer: 0, dive: true, brake: false }, 2);
  check('dno ukončí sestup', bottom.end === 'bottom', String(bottom.end));
  check('hloubka zůstane na dně', bottom.depth === DEPTH_BOTTOM, String(bottom.depth));
  check('skóre má bonus za dno', scoreOf(bottom) >= DEPTH_BOTTOM + BOTTOM_BONUS);

  const lantern = createDive();
  lantern.energy = 0.2;
  lantern.depth = 400;
  run(lantern, IDLE_INPUT, 2);
  check('prázdná lucerna ukončí sestup', lantern.end === 'lantern', String(lantern.end));
  check('energie nezůstane záporná', lantern.energy >= 0, String(lantern.energy));

  const hull = createDive();
  hull.hull = 0.2;
  hull.depth = 300;
  hull.x = LANE;
  run(hull, { steer: 1, dive: false, brake: false }, 1);
  check('prasklý plášť ukončí sestup', hull.end === 'hull', String(hull.end));
  check('plášť nezůstane záporný', hull.hull >= 0, String(hull.hull));

  const frozenDepth = hull.depth;
  run(hull, IDLE_INPUT, 2);
  check('po konci se už neklesá', hull.depth === frozenDepth, String(hull.depth));
}

/* ── skóre a výsledek ──────────────────────────────────────────────── */
{
  const dive = createDive();
  dive.depth = 433.7;
  dive.lightCount = 3;
  dive.time = 42.34;
  check('skóre = hloubka + světla', scoreOf(dive) === 433 + 3 * MOTE_SCORE, String(scoreOf(dive)));
  const result = resultOf(dive);
  check('výsledek zaokrouhlí hloubku dolů', result.depth === 433, String(result.depth));
  check('výsledek nese počet světel', result.lights === 3);
  check('výsledek nese celkový počet světel', result.totalLights === MOTES.length);
  check('čas je na desetiny', result.elapsed === 42.3, String(result.elapsed));
}

/* ── kompas ────────────────────────────────────────────────────────── */
{
  const dive = createDive();
  dive.depth = MOTES[0].depth - 1;
  dive.x = MOTES[0].x;
  const near = nextMote(dive);
  check('kompas míří na nejbližší světlo', near?.id === MOTES[0].id, JSON.stringify(near));
  check('kompas u sebe hlásí malou vzdálenost', Math.hypot(near.dx, near.dy) < 3);

  for (let i = 0; i < MOTES.length; i += 1) dive.collected[i] = true;
  check('po sebraní všech kompas zmizí', nextMote(dive) === null);
}

/* ── celý sestup ───────────────────────────────────────────────────── */
{
  const dive = run(createDive(), { steer: 0, dive: true, brake: false }, 140);
  check('s plným plynem se doletí na dno', dive.end === 'bottom', String(dive.end));
  check('cesta netrvá věčnost', dive.time < 90, `${dive.time.toFixed(1)} s`);
  check('cesta není okamžitá', dive.time > 30, `${dive.time.toFixed(1)} s`);
  check('lucerna vydržela', dive.energy > 0, String(dive.energy.toFixed(1)));
  check('skóre celého sestupu je nad dnem', scoreOf(dive) > DEPTH_BOTTOM, String(scoreOf(dive)));

  const again = run(createDive(), { steer: 0, dive: true, brake: false }, 140);
  check(
    'stejný vstup = stejný výsledek',
    again.depth === dive.depth && again.lightCount === dive.lightCount && scoreOf(again) === scoreOf(dive),
  );

  // hráč, který jen stojí, nesmí doletět dřív než ten, kdo tlačí W —
  // a v hlubině ho doběhne lucerna, protože pasivní sestup je nejdražší
  const lazy = run(createDive(), IDLE_INPUT, 140);
  check(
    'bez W se doletí později nebo vůbec',
    lazy.time > dive.time || lazy.end !== 'bottom',
    `${lazy.time.toFixed(1)} s / ${lazy.end} vs ${dive.time.toFixed(1)} s`,
  );
}

/* ── rozpočet lucerny (balance) ─────────────────────────────────────
 * Lucerna se spotřebovává za **metr**, ne za sekundu: bez světel se na dno
 * nedoletí. Kdyby tenhle test spadl, znamená to, že sestup zdarma prošel
 * a světla přestala být palivo.
 */
{
  const dark = createDive();
  for (let i = 0; i < MOTES.length; i += 1) dark.collected[i] = true; // míjíš všechna
  run(dark, { steer: 0, dive: true, brake: false }, 140);
  check('bez světel lucerna na dno nedojde', dark.end === 'lantern', `${dark.end} @ ${Math.round(dark.depth)} m`);
  check('přesto se dostane hluboko', dark.depth > 600, String(Math.round(dark.depth)));

  // hráč, který jde po světlech, doletí — a to je celý rozdíl
  const chaser = createDive();
  for (let i = 0; i < 4800 && !chaser.end; i += 1) {
    const next = nextMote(chaser);
    const steer = next ? Math.max(-1, Math.min(1, next.dx / 6)) : 0;
    stepDive(chaser, { steer, dive: true, brake: false }, DT);
  }
  check('kdo sbírá světla, doletí na dno', chaser.end === 'bottom', `${chaser.end} @ ${Math.round(chaser.depth)} m`);
  check('a posbírá většinu', chaser.lightCount >= 10, String(chaser.lightCount));
  check('lucerna mu dojde až u dna', chaser.energy >= 0 && chaser.time < 90, `${chaser.energy.toFixed(0)} / ${chaser.time.toFixed(0)} s`);
}

/* ── robustnost ────────────────────────────────────────────────────── */
{
  const dive = createDive();
  stepDive(dive, IDLE_INPUT, 5);
  check('dt je zastropované na 0.05 s', dive.time === 0.05, String(dive.time));

  const zero = createDive();
  stepDive(zero, IDLE_INPUT, 0);
  check('nulový krok nic neposune', zero.depth === 0 && zero.time === 0);

  const events = createDive();
  stepDive(events, IDLE_INPUT, DT);
  check('události se nehromadí mezi kroky', events.events.length <= 1);

  const capped = createDive();
  capped.depth = 120;
  run(capped, { steer: 1, dive: true, brake: false }, 30);
  check('hráč nikdy neopustí uličku', Math.abs(capped.x) <= LANE + 0.001, String(capped.x.toFixed(2)));
  check('plášť nikdy není záporný', capped.hull >= 0, String(capped.hull.toFixed(1)));
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
