#!/usr/bin/env node
/**
 * Test stopy za lucernou (L-3) — bez prohlížeče.
 *
 * Ověřuje přesně to, co se v komponentě nedá změřit rozumně:
 *  1. vzorky vznikají **pohybem**, ne každým snímkem (jinak je stopa jiná
 *     na 60 fps než na 20 fps — tedy jiná hra podle výkonu stroje),
 *  2. ohon má strop (`TRAIL_LEN`) a staré jiskry se zahazují (`TRAIL_TTL`),
 *  3. jas klesá se stářím a nikdy není záporný ani `NaN`.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/lumi-trail.mjs
 */

const {
  TRAIL_LEN,
  TRAIL_STEP,
  TRAIL_TTL,
  createTrail,
  pruneTrail,
  pushTrail,
  trailFade,
} = await import('../src/core/lumi/trail.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

console.log('\n== Lumi: stopa za lucernou ==');

const empty = createTrail();
check('stopa začíná prázdná', empty.length === 0);

check('první vzorek se přidá', pushTrail(empty, 10, 12, 0) === true && empty.length === 1);
check(
  'malý pohyb vzorek nepřidá',
  pushTrail(empty, 10 + TRAIL_STEP * 0.4, 12, 0.1) === false && empty.length === 1,
);
check(
  'pohyb nad krok vzorek přidá',
  pushTrail(empty, 10 + TRAIL_STEP * 2, 12, 0.2) === true && empty.length === 2,
);

// strop délky
const long = createTrail();
for (let index = 0; index < TRAIL_LEN * 3; index += 1) {
  pushTrail(long, index * TRAIL_STEP * 2, 0, index * 0.05);
}
check('ohon má strop', long.length === TRAIL_LEN, String(long.length));
check('nejnovější vzorek zůstal', long[long.length - 1].x === (TRAIL_LEN * 3 - 1) * TRAIL_STEP * 2);

// doznívání
const ttl = createTrail();
pushTrail(ttl, 5, 5, 0);
pushTrail(ttl, 12, 5, 0.4);
check('nic se neprune před TTL', pruneTrail(ttl, TRAIL_TTL * 0.8) === 0, String(ttl.length));
check('starší než TTL se zahodí', pruneTrail(ttl, TRAIL_TTL + 0.1) === 1 && ttl.length === 1);
check('úplně stará stopa zmizí', pruneTrail(ttl, TRAIL_TTL * 10) === 1 && ttl.length === 0);

// jas
const fresh = { x: 0, y: 0, t: 10 };
check('čerstvá jiskra svítí', trailFade(fresh, 10) === 1);
check('v polovině životnosti polovina', Math.abs(trailFade(fresh, 10 + TRAIL_TTL / 2) - 0.5) < 0.02);
check('po TTL zhasne', trailFade(fresh, 10 + TRAIL_TTL) === 0);
check('nezhasne do záporných čísel', trailFade(fresh, 10 + TRAIL_TTL * 5) === 0);
check('rozbitý čas nedá NaN', trailFade(fresh, Number.NaN) === 0);

// nezávislost na fps: stejná dráha, jiný počet snímků → stejný počet vzorků
function samplesAt(fps) {
  const points = createTrail();
  const dt = 1 / fps;
  for (let t = 0; t <= 2; t += dt) {
    // rovnoměrný let 6 jednotek za sekundu
    pushTrail(points, 6 * t, 0, t);
  }
  return points.length;
}
const at60 = samplesAt(60);
const at20 = samplesAt(20);
check('stopa není závislá na fps', Math.abs(at60 - at20) <= 1, `${at60} vs ${at20}`);

console.log('');
if (failures > 0) {
  console.log(`LUMI TRAIL FAILED (${failures})`);
  process.exit(1);
}
console.log('LUMI TRAIL OK');
