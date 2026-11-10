/**
 * VENUŠE — fyzika závodního vozu bez prohlížeče.
 *
 * Zkoumá to, co by v prohlížeči bylo neviditelné nebo příliš pomalé:
 * strop rychlosti, nitro nádrž (drain/regen/drift regen), drift
 * (boční složka rychlosti), zeď a couvání. Simulace běží na stejném
 * `stepCraft()`, co používá hra i MP server — jedna fyzika.
 *
 * Spuštění:  npx tsx apps/nirvana/test/race-physics.mjs
 */

import {
  BOOST_SPEED,
  LATERAL_WALL,
  MAX_SPEED,
  NITRO_DRAIN,
  NITRO_MAX,
  NITRO_REGEN,
  REVERSE_MAX,
  spawnCraft,
  stepCraft,
  wrapAngle,
} from '../src/core/race/physics.ts';
import { TRACK_WIDTH, buildTrack, lateralOffset } from '../src/core/race/track.ts';
import { newLapState, rivalInput } from '../src/core/race/rivals.ts';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const track = buildTrack();
const DT = 1 / 60;

/** Rovná testovací trať — 320 bodů po 5 m (+X), na měření stropu rychlosti. */
function straightTrack() {
  const points = [];
  for (let i = 0; i < 320; i++) {
    points.push({ x: i * 5, z: 0, tx: 1, tz: 0, nx: 0, nz: 1 });
  }
  return points;
}

/** AI řízení (stejné jako boti) — feed-forward + lookahead na směr tratě. */
function makeDriver(craft) {
  const rival = {
    spec: { id: 'driver', nameCs: '', nameEn: '', color: '#fff', skill: 0.9 },
    craft,
    lap: newLapState(craft.sample),
  };
  return () => rivalInput(rival, track);
}

/** Nechte auto jet `seconds` sekund, každým krokem řídí `inputFor(craft)`. */
function drive(craft, inputFor, seconds, now0 = 0) {
  let now = now0;
  let last = null;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    now += DT * 1000;
    const input = typeof inputFor === 'function' ? inputFor(craft) : inputFor;
    last = stepCraft(craft, input, track, DT, now);
  }
  return last;
}

// ── spawn ─────────────────────────────────────────────────────────────
{
  const craft = spawnCraft(track, 0, 1.5);
  check('spawn: nitro plná', craft.nitro === NITRO_MAX, `nitro=${craft.nitro}`);
  check('spawn: rychlost 0', craft.speed === 0 && craft.vx === 0 && craft.vz === 0);
  check('spawn: sample index', craft.sample === 0, `sample=${craft.sample}`);
}

// ── zrychlení a strop ─────────────────────────────────────────────────
{
  // Na klikatém okruhu se jezdí ~40–49 (zatáčky žerou rychlost) — ověříme,
  // že auto dosáhne závodního tempa a drží se pod stropem.
  const craft = spawnCraft(track, 0, 0);
  const driver = makeDriver(craft);
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 0 }), 10);
  check('plyn: dosáhne závodního tempa', craft.speed > 36,
    `speed=${craft.speed.toFixed(2)}`);
  check('plyn: nedosahuje nad MAX_SPEED', craft.speed <= MAX_SPEED + 0.6,
    `speed=${craft.speed.toFixed(2)} max=${MAX_SPEED}`);
  drive(craft, { throttle: 0, steer: 0 }, 2);
  check('plyn vypnutý: zpomalení', craft.speed < MAX_SPEED - 1, `speed=${craft.speed.toFixed(2)}`);

  // Rovná trať: bez zatáček a stěn se má asymptoticky blížit MAX_SPEED.
  const straight = straightTrack();
  const car = spawnCraft(straight, 0, 0);
  let now = 0;
  for (let i = 0; i < 12 * 60; i++) {
    now += DT * 1000;
    stepCraft(car, { throttle: 1, steer: 0 }, straight, DT, now);
  }
  check('rovina: asymptota MAX_SPEED', Math.abs(car.speed - MAX_SPEED) < 2.5,
    `speed=${car.speed.toFixed(2)} max=${MAX_SPEED}`);
}

// ── nitro ─────────────────────────────────────────────────────────────
{
  const craft = spawnCraft(track, 0, 0);
  const driver = makeDriver(craft);
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 0 }), 8);
  const nitroBefore = craft.nitro;
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 1 }), 2);
  check('nitro: nádrž se vypila', craft.nitro < nitroBefore - NITRO_DRAIN * 1.5,
    `nitro ${nitroBefore.toFixed(2)} → ${craft.nitro.toFixed(2)}`);
  check('nitro: rychlost nad MAX_SPEED', craft.speed > MAX_SPEED + 3,
    `speed=${craft.speed.toFixed(2)} max=${MAX_SPEED}`);
  check('nitro: strop pod BOOST_SPEED', craft.speed < BOOST_SPEED + 1,
    `speed=${craft.speed.toFixed(2)} boost=${BOOST_SPEED}`);

  // regen bez driftu
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 0 }), 5);
  check('nitro: regen bez driftu', craft.nitro > 0.05 && craft.nitro < NITRO_MAX + 0.01,
    `nitro=${craft.nitro.toFixed(2)}`);

  // boost s prázdnou nádrží = žádný tah navíc
  craft.nitro = 0;
  const speedEmpty = craft.speed;
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 1 }), 1);
  check('nitro: prázdná nádrž nezvedá strop', craft.nitro <= 0.06 && craft.speed <= BOOST_SPEED + 0.01,
    `speed=${craft.speed.toFixed(2)} (bylo ${speedEmpty.toFixed(2)}) nitro=${craft.nitro.toFixed(3)}`);
}

// ── drift ─────────────────────────────────────────────────────────────
{
  const craft = spawnCraft(track, 0, 0);
  const driver = makeDriver(craft);
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 0 }), 5);
  const speedBefore = Math.hypot(craft.vx, craft.vz);

  // kontrolovaný drift: ručka + mírné zatáčení na 0,7 s
  let sawDrift = false;
  let maxAbsVl = 0;
  const steps = Math.round(0.7 / DT);
  for (let i = 0; i < steps; i++) {
    const s = stepCraft(craft, { throttle: 0.5, steer: 0.7, handbrake: 1 }, track, DT, i * DT * 1000);
    if (s.drifting) sawDrift = true;
    maxAbsVl = Math.max(maxAbsVl, Math.abs(s.slide));
  }
  check('drift: detekován drifting', sawDrift);
  check('drift: boční složka rychlosti', maxAbsVl > 2.5, `max|vl|=${maxAbsVl.toFixed(2)}`);
  const speedAfter = Math.hypot(craft.vx, craft.vz);
  check('drift: auto neztuhne', speedAfter > 8,
    `${speedBefore.toFixed(1)} → ${speedAfter.toFixed(1)}`);

  // drift regen — měřeno JEN na krocích, kde drifting=true a rychlost > 7
  const c2 = spawnCraft(track, 60, 0);
  const driver2 = makeDriver(c2);
  drive(c2, () => ({ ...driver2(), throttle: 1, boost: 0 }), 5);
  c2.nitro = 0.2;
  let gained = 0;
  let driftSteps = 0;
  const steps2 = Math.round(1.6 / DT);
  for (let i = 0; i < steps2; i++) {
    const before = c2.nitro;
    const s = stepCraft(c2, { throttle: 0.6, steer: 0.6, handbrake: 1 }, track, DT, 10_000 + i * DT * 1000);
    if (s.drifting && Math.abs(s.slide) > 2.4) {
      gained += c2.nitro - before;
      driftSteps += 1;
    }
  }
  const perSec = driftSteps > 0 ? gained / (driftSteps * DT) : 0;
  check('drift: kroky drifting zaznamenány', driftSteps > 10, `driftSteps=${driftSteps}`);
  check('drift: nitro regen rychlejší než normál', perSec > NITRO_REGEN * 1.8,
    `regen=${perSec.toFixed(3)}/s normál=${NITRO_REGEN}/s driftBonus=${0.18}`);
}

// ── zatáčení bez ručky ────────────────────────────────────────────────
{
  const craft = spawnCraft(track, 0, 0);
  const driver = makeDriver(craft);
  drive(craft, () => ({ ...driver(), throttle: 1, boost: 0 }), 3);
  const h0 = craft.heading;
  drive(craft, { throttle: 1, steer: 0.5 }, 0.4);
  const dh = Math.abs(wrapAngle(craft.heading - h0));
  check('zatáčení: heading se mění', dh > 0.03, `dh=${dh.toFixed(3)}`);
  // bez ručky boční složka zůstává malá (pneu drží)
  const fx = Math.sin(craft.heading), fz = Math.cos(craft.heading);
  const rx = Math.cos(craft.heading), rz = -Math.sin(craft.heading);
  const vl = craft.vx * rx + craft.vz * rz;
  const vf = Math.abs(craft.vx * fx + craft.vz * fz);
  check('zatáčení: bez driftu vl malá', Math.abs(vl) < vf * 0.5, `vl=${vl.toFixed(2)} vf=${vf.toFixed(2)}`);
}

// ── zeď: pozice po clampu zůstává v trati ─────────────────────────────
{
  const craft = spawnCraft(track, 0, TRACK_WIDTH / 2 - 0.3);
  const point = track[0];
  // postrč mimo trať
  craft.heading = Math.atan2(point.nx, point.nz);
  craft.vx = point.nx * 20;
  craft.vz = point.nz * 20;
  let hitCount = 0;
  let maxPostLateral = 0;
  for (let i = 0; i < Math.round(2 / DT); i++) {
    const s = stepCraft(craft, { throttle: 0.5, steer: 0 }, track, DT, i * DT * 1000);
    if (s.hitWall) hitCount += 1;
    // PO clampu: přepočítej boční odchylku vůči *aktuálnímu* sample
    maxPostLateral = Math.max(maxPostLateral, Math.abs(lateralOffset(track[craft.sample], craft.x, craft.z)));
  }
  check('zeď: pozice zůstává v trati', maxPostLateral <= LATERAL_WALL + 0.02,
    `maxPostLateral=${maxPostLateral.toFixed(3)} wall=${LATERAL_WALL}`);
  check('zeď: auto se nezaseklo', Math.hypot(craft.vx, craft.vz) > 1,
    `speed=${Math.hypot(craft.vx, craft.vz).toFixed(2)}`);
  check('zeď: hitWall reportován', hitCount > 0, `hits=${hitCount}`);
}

// ── couvání ───────────────────────────────────────────────────────────
{
  const craft = spawnCraft(track, 0, 0);
  drive(craft, { throttle: -1, steer: 0 }, 2);
  check('brzda→couvání', craft.speed < 0 && craft.speed >= REVERSE_MAX - 0.5,
    `speed=${craft.speed.toFixed(2)}`);
}

// ── grip: boční rychlost ──────────────────────────────────────────────
{
  const p = track[0];
  const heading = Math.atan2(p.tx, p.tz);

  const c1 = spawnCraft(track, 0, 0);
  c1.vx = p.nx * 8;
  c1.vz = p.nz * 8;
  drive(c1, { throttle: 0.2, steer: 0 }, 0.5);
  const vl1 = Math.abs(c1.vx * Math.cos(c1.heading) - c1.vz * Math.sin(c1.heading));
  check('grip: boční rychlost utlumena', vl1 < 2, `vl=${vl1.toFixed(2)}`);

  const c2 = spawnCraft(track, 0, 0);
  c2.vx = p.nx * 8;
  c2.vz = p.nz * 8;
  drive(c2, { throttle: 0.2, steer: 0, handbrake: 1 }, 0.5);
  const vl2 = Math.abs(c2.vx * Math.cos(c2.heading) - c2.vz * Math.sin(c2.heading));
  check('grip: ručka uvolní boky', vl2 > vl1 * 3, `vl=${vl2.toFixed(2)} vs ${vl1.toFixed(2)}`);
}

// ── TRACK_WIDTH sanity ────────────────────────────────────────────────
check('track: šířka odpovídá fyzice', TRACK_WIDTH === 11, `width=${TRACK_WIDTH}`);

console.log(`\n${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
