/**
 * FLOTILA — test letu a dokování bez prohlížeče.
 *
 * Simulace je záměrně čistá (`core/fleet/flight.ts`), takže se dá změřit
 * všechno, co by v prohlížeči znamenalo klikat a čekat: zrychlení, zatáčení,
 * hranice prostoru, kolize s planetou a hlavně **přistání na pohyblivém doku**.
 *
 * Spuštění:  npx tsx apps/nirvana/test/fleet-flight.mjs
 */

import {
  BOOST_BURN,
  DOCK_HOLD,
  DOCK_MAX_SPEED,
  DOCK_RADIUS,
  NO_INPUT,
  PLANET_RADIUS,
  WORLD_RADIUS,
  createShip,
  forwardOf,
  stepShip,
  telemetry,
  undock,
} from '../src/core/fleet/flight.ts';
import { dockTargets, nearestDock } from '../src/core/fleet/docks.ts';
import { SHIPS, shipById } from '../src/core/fleet/ships.ts';

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

function near(a, b, tolerance = 1e-6) {
  return Math.abs(a - b) <= tolerance;
}

const spec = shipById('xwing');

/** Simuluje `seconds` sekund po krocích `dt` a vrací stav. */
function fly(state, input, seconds, dt = 1 / 60, docks = [], t = 0) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) stepShip(state, input, spec, dt, docks, t + i * dt);
  return state;
}

console.log('\n▸ start a základní stav');
{
  const ship = createShip(spec);
  check('loď stojí', ship.speed === 0 && !ship.docked);
  check('palivo boostu je plné', ship.boost === 1);
  const [fx, fy, fz] = forwardOf(ship);
  check('nos míří podle yaw (π = −Z)', near(fz, -1, 1e-6) && near(fx, 0, 1e-6) && near(fy, 0, 1e-6));
}

console.log('\n▸ plyn, brzda, boost');
{
  const ship = createShip(spec);
  fly(ship, { ...NO_INPUT, throttle: 1 }, 1);
  check('po sekundě plynu má rychlost', ship.speed > 3, `speed=${ship.speed.toFixed(2)}`);

  fly(ship, { ...NO_INPUT, throttle: 1 }, 4);
  check('rychlost nepřeleze maximum', ship.speed <= spec.maxSpeed + 1e-6, `speed=${ship.speed.toFixed(2)}`);

  const before = ship.speed;
  fly(ship, { ...NO_INPUT, brake: true }, 0.5);
  check('brzda zpomalí', ship.speed < before * 0.5, `${before.toFixed(2)} → ${ship.speed.toFixed(2)}`);

  const boosted = createShip(spec);
  fly(boosted, { ...NO_INPUT, throttle: 1 }, 3);
  const cruise = boosted.speed;
  fly(boosted, { ...NO_INPUT, throttle: 1, boost: true }, 1.5);
  check('boost zrychlí nad maximum', boosted.speed > cruise, `${cruise.toFixed(2)} → ${boosted.speed.toFixed(2)}`);
  check('boost spotřebuje palivo', boosted.boost < 1 - 1 / (BOOST_BURN * 2), `fuel=${boosted.boost.toFixed(2)}`);
}

console.log('\n▸ zatáčení a klopení');
{
  const ship = createShip(spec);
  fly(ship, { ...NO_INPUT, throttle: 1 }, 2);
  const yaw0 = ship.yaw;
  fly(ship, { ...NO_INPUT, throttle: 1, yaw: 1 }, 1);
  check('zatáčení mění yaw', Math.abs(ship.yaw - yaw0) > 0.5, `Δyaw=${(ship.yaw - yaw0).toFixed(2)}`);

  const slow = createShip(spec);
  const slowYaw0 = slow.yaw;
  fly(slow, { ...NO_INPUT, yaw: 1 }, 1);
  check(
    'stojící loď zatáčí méně než letící',
    Math.abs(slow.yaw - slowYaw0) < Math.abs(ship.yaw - yaw0),
    `${Math.abs(slow.yaw - slowYaw0).toFixed(2)} vs ${Math.abs(ship.yaw - yaw0).toFixed(2)}`,
  );

  const pitchShip = createShip(spec);
  fly(pitchShip, { ...NO_INPUT, throttle: 1, pitch: 1 }, 5);
  check('klopení je omezené', Math.abs(pitchShip.pitch) <= 1.15 + 1e-6, `pitch=${pitchShip.pitch.toFixed(2)}`);
}

console.log('\n▸ hranice prostoru a planeta');
{
  const ship = createShip(spec, { x: 0, y: 0, z: WORLD_RADIUS - 1, yaw: 0 });
  fly(ship, { ...NO_INPUT, throttle: 1 }, 4);
  const distance = Math.hypot(ship.x, ship.y, ship.z);
  check('loď zůstane v prostoru', distance <= WORLD_RADIUS + 1e-6, `r=${distance.toFixed(2)}`);

  const diving = createShip(spec, { x: 0, y: 0, z: 12, yaw: Math.PI });
  fly(diving, { ...NO_INPUT, throttle: 1 }, 3);
  const planetDistance = Math.hypot(diving.x, diving.y, diving.z);
  check('do planety se nedá vletět', planetDistance >= PLANET_RADIUS - 1e-6, `r=${planetDistance.toFixed(2)}`);
}

console.log('\n▸ doky');
{
  const docks = dockTargets(0);
  check('jsou čtyři doky (3× Nabukano + Issobella)', docks.length === 4, `count=${docks.length}`);
  check('tři patří Nabukanu', docks.filter((dock) => dock.kind === 'nabukano').length === 3);
  check('jeden patří Issobelle', docks.filter((dock) => dock.kind === 'issobella').length === 1);
  check(
    'všechny pozice jsou konečná čísla',
    docks.every((dock) => dock.position.every((value) => Number.isFinite(value))),
  );

  const later = dockTargets(60);
  const moved = docks.some((dock, index) => {
    const other = later[index];
    return Math.hypot(dock.position[0] - other.position[0], dock.position[2] - other.position[2]) > 0.3;
  });
  check('doky se hýbou v čase', moved);

  const nearest = nearestDock({ x: docks[0].position[0], y: docks[0].position[1], z: docks[0].position[2] }, docks);
  check('nejbližší dok se najde', nearest?.dock.id === docks[0].id, nearest?.dock.id);
}

console.log('\n▸ přistání');
{
  const t = 12;
  const docks = dockTargets(t);

  // loď přiletí na místo doku a stojí
  const ship = createShip(spec, {
    x: docks[0].position[0],
    y: docks[0].position[1],
    z: docks[0].position[2],
  });
  fly(ship, NO_INPUT, DOCK_HOLD * 0.5, 1 / 60, docks, t);
  check('v půlce držení ještě není zakotveno', !ship.docked && ship.dockProgress > 0.2, `progress=${ship.dockProgress.toFixed(2)}`);

  fly(ship, NO_INPUT, DOCK_HOLD, 1 / 60, docks, t);
  check('po DOCK_HOLD je zakotveno', ship.docked === docks[0].id, String(ship.docked));

  // zakotvená loď jede s dokem
  const laterDocks = dockTargets(t + 30);
  const dockNow = laterDocks.find((dock) => dock.id === docks[0].id);
  stepShip(ship, { ...NO_INPUT, throttle: 1 }, spec, 1 / 60, laterDocks, t + 30);
  check(
    'zakotvená loď drží pozici doku i po jeho pohybu',
    near(ship.x, dockNow.position[0], 1e-6) && near(ship.z, dockNow.position[2], 1e-6),
  );
  check('zakotvená loď stojí', ship.speed === 0);

  // odpojení
  undock(ship);
  check('po odpojení není zakotveno', !ship.docked && ship.dockProgress === 0);
  check('po odpojení má impuls', ship.speed > 0);
}

console.log('\n▸ přistání nesmí projít v plné rychlosti');
{
  const t = 20;
  const docks = dockTargets(t);
  const ship = createShip(spec, {
    x: docks[1].position[0],
    y: docks[1].position[1],
    z: docks[1].position[2],
  });
  ship.speed = DOCK_MAX_SPEED + 4;
  // držíme se u doku, ale letíme rychle: stav se posune, přesto se nesmí zakotvit
  for (let i = 0; i < 120; i += 1) {
    const dock = dockTargets(t + i / 60)[1];
    ship.x = dock.position[0];
    ship.y = dock.position[1];
    ship.z = dock.position[2];
    stepShip(ship, { ...NO_INPUT, throttle: 1 }, spec, 1 / 60, dockTargets(t + i / 60), t + i / 60);
  }
  check('rychlá loď se nezakotví', !ship.docked, `speed=${ship.speed.toFixed(1)}`);

  // a naopak: v dosahu a pomalu se zakotví i na Issobelle
  const issobella = dockTargets(t).find((dock) => dock.kind === 'issobella');
  const slow = createShip(spec, { x: issobella.position[0], y: issobella.position[1], z: issobella.position[2] });
  fly(slow, NO_INPUT, DOCK_HOLD + 0.5, 1 / 60, dockTargets(t), t);
  check('na Issobelle se zakotví', slow.docked === 'issobella', String(slow.docked));
}

console.log('\n▸ telemetrie');
{
  const docks = dockTargets(0);
  const ship = createShip(spec, { x: 0, y: 6, z: 16 });
  const data = telemetry(ship, docks);
  check('telemetrie má nejbližší dok', data.nearest !== null);
  check('vzdálenost je kladná', data.nearest.distance > 0);
  check('telemetrie nese palivo i ujetou dráhu', data.boost === 1 && data.travelled === 0);
}

console.log('\n▸ lodě se od sebe liší');
{
  check('je osm lodí', SHIPS.length === 8, `count=${SHIPS.length}`);
  const speeds = SHIPS.map((ship) => ship.maxSpeed);
  const fastest = SHIPS[speeds.indexOf(Math.max(...speeds))];
  const slowest = SHIPS[speeds.indexOf(Math.min(...speeds))];
  check('nejrychlejší je TIE Interceptor', fastest.id === 'tieinterceptor', fastest.id);
  check('Falcon je mezi loděmi', SHIPS.some((ship) => ship.id === 'falcon'));
  check('nejpomalejší je B-Wing', slowest.id === 'bwing', slowest.id);
  check(
    'každá loď má trysky',
    SHIPS.every((ship) => ship.engines.length > 0 && ship.engines.every((anchor) => anchor.every(Number.isFinite))),
  );
  check(
    'GLB cesty leží pod veřejným /models',
    SHIPS.every((ship) => ship.glb.startsWith('/models/fleet/') && ship.glb.endsWith('.glb')),
  );
}

console.log(`\n${failed === 0 ? '✓' : '✗'} fleet-flight: ${passed} prošlo, ${failed} selhalo\n`);
process.exit(failed === 0 ? 0 : 1);
