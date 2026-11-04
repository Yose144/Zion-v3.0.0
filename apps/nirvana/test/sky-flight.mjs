/**
 * Test letu ve Křídlech — bez prohlížeče i bez WebGL.
 *
 * Hra stojí na třech věcech a každá se dá změřit:
 *  1. **pláštěnka zvedá, ale dochází** — bez energie padáš, s ní stoupáš,
 *  2. **proud vzduchu tě nese a dobije** — jinak by hráč uvízl,
 *  3. **cesta jde dohrát** — se všemi sedmi světly se otevře svatyně,
 *     a bez nich ne (jinak by šlo „vyhrát" hned na startu).
 *
 * Bonus: skóre nesmí být záporné ani při hodinovém kochání.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/sky-flight.mjs
 */

const {
  ENERGY_MAX,
  createFlight,
  currentAt,
  missingLights,
  skyScore,
  stepFlight,
} = await import('../src/core/sky/flight.ts');
const { SKY_LIGHTS, SKY_SHRINE } = await import('../src/core/sky/world.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const STEP = 1 / 60;
const NO = { up: false, down: false, left: false, right: false };

function fly(state, seconds, input = NO) {
  for (let t = 0; t < seconds; t += STEP) stepFlight(state, input, STEP);
  return state;
}

// ── 1) start ─────────────────────────────────────────────────────────
const start = createFlight();
check('start: plná energie', start.energy === ENERGY_MAX, String(start.energy));
check('start: sedm světel', start.total === 7 && start.lights.length === 0);
check('start: hra neběží jako hotová', start.finished === false);

// ── 2) pláštěnka ─────────────────────────────────────────────────────
const lift = createFlight();
const startY = lift.y;
fly(lift, 1.2, { ...NO, up: true });
check('pláštěnka zvedá', lift.y > startY, `${startY} → ${lift.y.toFixed(1)}`);
check('pláštěnka spotřebovává energii', lift.energy < ENERGY_MAX, String(lift.energy.toFixed(1)));

const drop = createFlight();
const dropY = drop.y;
fly(drop, 1.2);
check('bez pláštěnky padáš', drop.y < dropY, `${dropY} → ${drop.y.toFixed(1)}`);
check('klouzání energii dobíjí', drop.energy >= ENERGY_MAX - 0.01);

// dojde energie → padáš i se stisknutým tlačítkem
const spent = createFlight();
spent.energy = 0;
const spentY = spent.y;
fly(spent, 0.8, { ...NO, up: true });
check('bez energie tlačítko nepomůže', spent.y < spentY, `${spentY} → ${spent.y.toFixed(1)}`);

// ── 3) proud vzduchu ─────────────────────────────────────────────────
check('proud existuje na svém místě', currentAt(26, 30) > 0, String(currentAt(26, 30)));
check('mimo proud nic', currentAt(5, 95) === 0, String(currentAt(5, 95)));

const carried = createFlight();
carried.x = 26;
carried.y = 30;
carried.energy = 20;
const carriedY = carried.y;
fly(carried, 0.8);
check('proud nese nahoru', carried.y > carriedY, `${carriedY} → ${carried.y.toFixed(1)}`);
check('proud dobíjí energii', carried.energy > 20, String(carried.energy.toFixed(1)));

// ── 4) hranice ───────────────────────────────────────────────────────
const wall = createFlight();
fly(wall, 3, { ...NO, left: true, up: true });
check('hráč nezmizí vlevo', wall.x >= 0 && Number.isFinite(wall.x), String(wall.x));
check('hráč nezmizí dole', wall.y >= 0 && Number.isFinite(wall.y), String(wall.y));

const ceiling = createFlight();
fly(ceiling, 6, { ...NO, up: true });
check('hráč nevyletí nad mapu', ceiling.y <= 100, String(ceiling.y.toFixed(1)));

// ── 5) světla ────────────────────────────────────────────────────────
const collector = createFlight();
for (const light of SKY_LIGHTS) {
  collector.x = light.x;
  collector.y = light.y;
  fly(collector, 0.1);
}
check('všech sedm světel jde sebrat', collector.lights.length === 7, String(collector.lights.length));
check('chybí nula světel', missingLights(collector) === 0, String(missingLights(collector)));
check('světlo dobije energii', collector.energy > 0);

// světlo se nedá sebrat dvakrát
const twice = createFlight();
twice.x = SKY_LIGHTS[0].x;
twice.y = SKY_LIGHTS[0].y;
fly(twice, 0.1);
const afterFirst = twice.lights.length;
fly(twice, 0.6);
check('světlo se nedá sebrat dvakrát', twice.lights.length === afterFirst, `${afterFirst} → ${twice.lights.length}`);

// ── 6) svatyně ───────────────────────────────────────────────────────
const premature = createFlight();
premature.x = SKY_SHRINE.x;
premature.y = SKY_SHRINE.y;
fly(premature, 0.3);
check('svatyně bez světel neotevře', premature.finished === false);

const finish = createFlight();
for (const light of SKY_LIGHTS) {
  finish.x = light.x;
  finish.y = light.y;
  fly(finish, 0.1);
}
finish.x = SKY_SHRINE.x;
finish.y = SKY_SHRINE.y;
fly(finish, 0.3);
check('se všemi světly se svatyně otevře', finish.finished === true);

// ── 7) skóre ─────────────────────────────────────────────────────────
const fast = createFlight();
fast.lights = [1, 2, 3, 4, 5, 6, 7];
fast.finished = true;
fast.time = 40;
const slow = { ...fast, time: 400 };
check('dokončená cesta má kladné skóre', skyScore(fast) > 0, String(skyScore(fast)));
check('rychlejší cesta má víc', skyScore(fast) > skyScore(slow), `${skyScore(fast)} vs ${skyScore(slow)}`);
check('skóre nikdy není záporné', skyScore(slow) >= 0, String(skyScore(slow)));
check('nedokončená cesta počítá jen světla', skyScore({ ...fast, finished: false }) === 700, String(skyScore({ ...fast, finished: false })));

// ── 8) determinismus ─────────────────────────────────────────────────
const a = createFlight();
const b = createFlight();
fly(a, 2, { ...NO, up: true, right: true });
fly(b, 2, { ...NO, up: true, right: true });
check('stejný vstup = stejný stav', a.x === b.x && a.y === b.y && a.energy === b.energy);

console.log('');
if (failures > 0) {
  console.log(`SKY FLIGHT FAILED (${failures})`);
  process.exit(1);
}
console.log('SKY FLIGHT OK');
