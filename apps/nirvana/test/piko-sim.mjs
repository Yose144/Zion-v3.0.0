/**
 * Te Pīko Ora — test vodních her bez prohlížeče.
 *
 * Ověřuje tři věci, na kterých hra stojí:
 *  1. **kánoe jede jen záběry** — držené pádlo je rytmus, ne plyn,
 *  2. **bóje platí jen v pořadí** — kurz se nedá přeskočit,
 *  3. **vlna má kapsu a balanc** — kdo řeže moc nebo stojí na okraji, spadne,
 *     a tři vlny se dojedou do konce.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/piko-sim.mjs
 */

import {
  CANOE,
  CANOE_TIME_LIMIT,
  GATE_POINTS,
  TARGET_SECONDS,
  canoeScore,
  createCanoe,
  stepCanoe,
} from '../src/core/piko/canoe.ts';
import {
  SURF,
  createSurf,
  pocketTargetFor,
  stepSurf,
  waveScore,
} from '../src/core/piko/surf.ts';
import {
  GATE_RADIUS,
  LAGOON,
  PIKO_GATES,
  START,
  waveHeightAt,
  waveProgressZ,
} from '../src/core/piko/world.ts';

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

/** Pustí simulaci na `seconds` sekund ve krocích po 1/60 s. */
function runCanoe(state, input, seconds, onStep) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const step = stepCanoe(state, input, dt);
    if (onStep) onStep(step, i);
  }
}

function runSurf(state, input, seconds, onStep) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const step = stepSurf(state, input, dt);
    if (onStep) onStep(step, i);
  }
}

/* ── svět ──────────────────────────────────────────────────────────── */

console.log('\nSvět — laguna, hladina, kurz');
{
  check('start je na vodě před břehem', START.z < LAGOON.beachZ && START.z > LAGOON.reefZ);
  check('kurz má šest bójí', PIKO_GATES.length === 6);
  check(
    'všechny bóje leží v laguně',
    PIKO_GATES.every(
      (gate) =>
        gate.x > LAGOON.minX + GATE_RADIUS &&
        gate.x < LAGOON.maxX - GATE_RADIUS &&
        gate.z > LAGOON.reefZ + GATE_RADIUS &&
        gate.z < LAGOON.beachZ - GATE_RADIUS,
    ),
  );

  const a = waveHeightAt(3, -20, 1.2);
  const b = waveHeightAt(3, -20, 1.2);
  check('hladina je deterministická', a === b);
  check('hladina zůstává malá', Math.abs(a) < 0.8);

  check('waveProgressZ začíná u útesu', Math.abs(waveProgressZ(0) + 60) < 1e-6);
  check('waveProgressZ končí u břehu', Math.abs(waveProgressZ(1) - 18) < 1e-6);
  check('waveProgressZ clamps', waveProgressZ(-5) === waveProgressZ(0));
}

/* ── kánoe ─────────────────────────────────────────────────────────── */

console.log('\nKánoe — tempo, kormidlo, bóje');
{
  const idle = createCanoe();
  check('start: čelem k útesu', Math.abs(idle.heading - Math.PI) < 1e-6);
  runCanoe(idle, { paddle: false, steer: 0, brace: false }, 2);
  check('bez záběru se nerozjede', idle.speed === 0, `speed=${idle.speed}`);
  check('bez záběru se nepočítá čas', idle.elapsed === 0);

  const paddling = createCanoe();
  let strokes = 0;
  runCanoe(paddling, { paddle: true, steer: 0, brace: false }, 3, (step) => {
    if (step.stroke) strokes += 1;
  });
  check('tři sekundy drženého pádla = víc záběrů', strokes >= 4, `strokes=${strokes}`);
  check('záběry mají rytmus, ne 60/s', strokes <= 6, `strokes=${strokes}`);
  check('kánoe se rozjede', paddling.speed > 2, `speed=${paddling.speed.toFixed(2)}`);
  check('pluje k útesu (z klesá)', paddling.z < START.z - 3, `z=${paddling.z.toFixed(1)}`);
  check('čas se počítá', paddling.elapsed > 2.9 && paddling.elapsed < 3.1, `t=${paddling.elapsed}`);

  const capped = createCanoe();
  runCanoe(capped, { paddle: true, steer: 0, brace: false }, 20);
  check(
    'rychlost má strop',
    capped.speed <= CANOE.maxSpeed + 0.01,
    `speed=${capped.speed.toFixed(2)}`,
  );

  const steering = createCanoe();
  runCanoe(steering, { paddle: true, steer: 0, brace: false }, 4);
  const before = steering.heading;
  runCanoe(steering, { paddle: true, steer: 1, brace: false }, 1);
  check('kormidlo mění směr', Math.abs(steering.heading - before) > 0.2);

  const braked = createCanoe();
  runCanoe(braked, { paddle: true, steer: 0, brace: false }, 4);
  const fast = braked.speed;
  runCanoe(braked, { paddle: false, steer: 0, brace: true }, 1.2);
  check('brzda zpomalí', braked.speed < fast * 0.6, `${fast.toFixed(2)} → ${braked.speed.toFixed(2)}`);

  const reef = createCanoe();
  reef.x = LAGOON.maxX - 0.5;
  reef.heading = Math.PI / 2; // čelem ke kraji
  runCanoe(reef, { paddle: true, steer: 0, brace: false }, 3, () => {});
  check('okraj laguny je zeď', reef.x <= LAGOON.maxX && reef.x >= LAGOON.minX);

  // bóje jen v pořadí
  const gate = createCanoe();
  const first = PIKO_GATES[0];
  gate.x = first.x;
  gate.z = first.z;
  const firstStep = stepCanoe(gate, { paddle: false, steer: 0, brace: false }, 1 / 60);
  check('první bóje se počítá', firstStep.gate === 0 && gate.gates === 1);
  check('další bóje je druhá', gate.nextGate === 1);

  const skipped = createCanoe();
  const second = PIKO_GATES[1];
  skipped.x = second.x;
  skipped.z = second.z;
  const skipStep = stepCanoe(skipped, { paddle: false, steer: 0, brace: false }, 1 / 60);
  check('bóje mimo pořadí neplatí', skipStep.gate === null && skipped.gates === 0);

  // celý kurz
  const course = createCanoe();
  let finished = false;
  for (const point of PIKO_GATES) {
    course.x = point.x;
    course.z = point.z;
    const step = stepCanoe(course, { paddle: false, steer: 0, brace: false }, 1 / 60);
    if (step.finished) finished = true;
  }
  check('šest bójí = kurz dokončen', finished && course.finished && course.gates === 6);
  check('skóre kurzu sedí na funkci', course.score === canoeScore(6, course.elapsed));
  check('skóre je kladné', course.score > 0);

  check('časový limit kurz ukončí', (() => {
    const slow = createCanoe();
    slow.started = true;
    slow.elapsed = CANOE_TIME_LIMIT + 1;
    const step = stepCanoe(slow, { paddle: false, steer: 0, brace: false }, 1 / 60);
    return step.finished && slow.finished;
  })());

  check(
    'rychlejší kurz = víc bodů',
    canoeScore(6, 70) > canoeScore(6, 140),
    `${canoeScore(6, 70)} vs ${canoeScore(6, 140)}`,
  );
  check('bez bójí není časový bonus', canoeScore(0, 10) === 0);
  check(
    'maximum je 6 bójí + plný bonus',
    canoeScore(6, 0) === 6 * GATE_POINTS + 480,
    String(canoeScore(6, 0)),
  );
  check('cíl odpovídá zadání', TARGET_SECONDS === 100);
}

/* ── surf ──────────────────────────────────────────────────────────── */

console.log('\nSurf — kapsa, balanc, tři vlny');
{
  const ready = createSurf();
  check('start: první vlna, čeká', ready.wave === 1 && ready.phase === 'ready');
  check('start: plný balanc', ready.balance === 100);

  let takeoffs = 0;
  runSurf(ready, { steer: 0, pump: false }, SURF.waveWait + 0.2, (step) => {
    if (step.event === 'takeoff') takeoffs += 1;
  });
  check('vlna přijde sama', takeoffs === 1 && ready.phase === 'riding');
  check('na vlně má rychlost', ready.speed > 6, `speed=${ready.speed.toFixed(1)}`);

  const pumped = createSurf();
  pumped.phase = 'riding';
  pumped.speed = 7;
  runSurf(pumped, { steer: 0, pump: true }, 2);
  const calm = createSurf();
  calm.phase = 'riding';
  calm.speed = 7;
  runSurf(calm, { steer: 0, pump: false }, 2);
  check(
    'pumpování zrychlí',
    pumped.speed > calm.speed,
    `${pumped.speed.toFixed(2)} vs ${calm.speed.toFixed(2)}`,
  );

  const carving = createSurf();
  carving.phase = 'riding';
  carving.speed = 9;
  carving.balance = 100;
  runSurf(carving, { steer: 1, pump: true }, 2);
  check('tvrdý řez bere balanc', carving.balance < 100, `balance=${carving.balance.toFixed(1)}`);

  const recovering = createSurf();
  recovering.phase = 'riding';
  recovering.speed = 9;
  recovering.balance = 60;
  recovering.x = pocketTargetFor(recovering);
  runSurf(recovering, { steer: 0, pump: false }, 2);
  check('klidná jízda v kapse balanc vrací', recovering.balance > 60, `balance=${recovering.balance.toFixed(1)}`);

  const shoulder = createSurf();
  shoulder.phase = 'riding';
  shoulder.speed = 9;
  shoulder.balance = 100;
  shoulder.x = 68;
  const far = pocketTargetFor(shoulder);
  check('okraj vlny je daleko od kapsy', Math.abs(shoulder.x - far) > SURF.pocketTolerance);
  runSurf(shoulder, { steer: 0, pump: false }, 3);
  check('mimo kapsu balanc ubývá', shoulder.balance < 100, `balance=${shoulder.balance.toFixed(1)}`);

  // uvíznutí: na okraji vlny s tvrdým řezem nemá prkno rychlost a vlna uteče
  const lost = createSurf();
  lost.phase = 'riding';
  lost.speed = 6;
  lost.balance = 100;
  lost.x = 68;
  let lostStep = null;
  runSurf(lost, { steer: 1, pump: false }, 4, (step) => {
    if (step.event === 'bogged') lostStep = step;
  });
  check('na okraji s řezem hráč ztratí vlnu', lostStep !== null, `speed=${lost.speed.toFixed(2)}`);
  check('uvíznutí nepřidá čistou jízdu', lost.waveScores[lost.waveScores.length - 1] < waveScore(SURF.length, 20, true));

  const wipeout = createSurf();
  wipeout.phase = 'riding';
  wipeout.speed = 9;
  wipeout.balance = 6;
  let wiped = null;
  runSurf(wipeout, { steer: 1, pump: true }, 1.2, (step) => {
    if (step.event === 'wipeout') wiped = step;
  });
  check('nulový balanc = pád', wiped !== null && wipeout.wipes === 1);
  check('po pádu přijde další vlna', wipeout.wave === 2 && wipeout.phase === 'between');

  // tři vlny do konce (každá se „dojede“ nastavením vzdálenosti)
  const set = createSurf();
  set.phase = 'riding';
  set.speed = 9;
  let wavesDone = 0;
  for (let wave = 0; wave < 3; wave++) {
    set.distance = SURF.length;
    const step = stepSurf(set, { steer: 0, pump: false }, 1 / 60);
    if (step.waveDone) wavesDone += 1;
    if (!set.finished) {
      runSurf(set, { steer: 0, pump: false }, SURF.waveWait + 0.3, (next) => {
        if (next.waveDone) wavesDone += 1;
      });
    }
  }
  check('tři vlny = konec', set.finished && set.phase === 'done' && wavesDone === 3, `wavesDone=${wavesDone}`);
  check('tři vlny = tři zápisy skóre', set.waveScores.length === 3);
  check('skóre je součet vln', set.score === set.waveScores.reduce((a, b) => a + b, 0));
  check('skóre je kladné', set.score > 0, String(set.score));

  check('skóre vlny: vzdálenost + kapsa + čistota', waveScore(100, 10, true) === 220);
  check('pád nepřidá čistou jízdu', waveScore(100, 10, false) === waveScore(100, 10, true) - 60);
  check('skóre nikdy není záporné', waveScore(-5, -5, false) === 0);
  check(
    'maximum sady je tři čisté vlny',
    SURF.waves * waveScore(SURF.length, 20, true) === 1140,
    String(SURF.waves * waveScore(SURF.length, 20, true)),
  );

  const clamped = createSurf();
  clamped.phase = 'riding';
  clamped.speed = 9;
  stepSurf(clamped, { steer: 1, pump: false }, 5);
  check('dt je zastropované na 0.05 s', clamped.elapsed === 0.05, String(clamped.elapsed));
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
