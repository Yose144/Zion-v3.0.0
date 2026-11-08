/**
 * LinkEngine unit test — bez prohlížeče.
 *
 * Ověřuje, že jednotný engine:
 *   1. má pro každý cíl konečný anchor (žádné NaN / prázdné vektory),
 *   2. přelet na planetu skončí u planety (ne u Slunce jako dřív u Jupiteru),
 *   3. přelet zpět na Zemi vrátí `current='earth'`,
 *   4. `arkPosition` dává stejný bod jako scene (jedna formule).
 *
 * Spuštění: npx tsx apps/nirvana/test/links.mjs
 */
import * as THREE from 'three';
import {
  LinkEngine,
  createDefaultLinkTargets,
  frameFor,
  DEFAULT_LINK_EDGES,
} from '../src/core/scene/universe/LinkEngine.ts';
import { arkPosition, ARK_TILT, ARK_ORBIT_R, ARK_ANGLE0, ringStationPosition, ringPosition, worldAnchor, RING_R, RING_TILT, ringSpinAngle, orbitPosition, orbitBeltAngle } from '../src/core/scene/universe/positions.ts';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 5000);
camera.position.set(40, 6, 19);
const controls = { target: new THREE.Vector3(30, 0, 0) };
const ctx = {
  camera,
  controls,
  clock: { elapsedTime: 100 },
  earthPos: new THREE.Vector3(30, 0, 0),
  reducedMotion: false,
  lang: 'cs',
};

const engine = new LinkEngine();
const targets = createDefaultLinkTargets();
for (const t of targets) engine.register(t);
engine.setEdges(DEFAULT_LINK_EDGES);

console.log('=== cíl: registr ===');
ok('má Zemi', !!engine.getTarget('earth'));
ok('má Jupiter', !!engine.getTarget('jupiter'));
ok('má bránu', !!engine.getTarget('gate'));
ok('má archu', !!engine.getTarget('archa'));
  ok('má Saturn (Kroniky)', !!engine.getTarget('saturn'));

console.log('=== cíl: anchor je konečný ===');
for (const t of targets) {
  const a = t.anchor(ctx);
  ok(
    `anchor ${t.id} je konečný`,
    Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z),
    `${a.x},${a.y},${a.z}`,
  );
}

console.log('=== cíl: přelet na Mars skončí u Marsu ===');
const marsTarget = engine.getTarget('mars');
const marsPos = marsTarget.anchor(ctx);
engine.flyTo('mars');
let guard = 0;
while (engine.isTransitioning() && guard++ < 1000) {
  engine.update(ctx, 0.05);
}
ok('current = mars', engine.getCurrentFocus() === 'mars', engine.getCurrentFocus());
const dMars = camera.position.distanceTo(marsPos);
ok('kamera je u Marsu (< 12 j.)', dMars < 12, `d=${dMars.toFixed(2)}`);
ok('kamera není u Slunce (> 5 j.)', camera.position.length() > 5, `|cam|=${camera.position.length().toFixed(2)}`);
ok('controls.target je u Marsu', controls.target.distanceTo(marsPos) < 4, `d=${controls.target.distanceTo(marsPos).toFixed(2)}`);

console.log('=== cíl: návrat na Zemi ===');
engine.flyTo('earth');
guard = 0;
while (engine.isTransitioning() && guard++ < 1000) {
  engine.update(ctx, 0.05);
}
ok('current = earth', engine.getCurrentFocus() === 'earth', engine.getCurrentFocus());
ok('controls.target je u Země', controls.target.distanceTo(ctx.earthPos) < 2, `d=${controls.target.distanceTo(ctx.earthPos).toFixed(2)}`);

console.log('=== cíl: pohyblivý cíl se sleduje (translate) ===');
engine.flyTo('earth');
guard = 0;
while (engine.isTransitioning() && guard++ < 1000) engine.update(ctx, 0.05);
const camBefore = camera.position.clone();
const tgtBefore = controls.target.clone();
// Země se posune o +2 v x; kamera i target musí jít s ní.
ctx.earthPos.x += 2;
engine.update(ctx, 0.05);
ok('kamera sleduje Zemi (+2 x)', Math.abs(camera.position.x - (camBefore.x + 2)) < 0.001, camera.position.x.toFixed(3));
ok('controls.target sleduje Zemi (+2 x)', Math.abs(controls.target.x - (tgtBefore.x + 2)) < 0.001, controls.target.x.toFixed(3));

console.log('=== cíl: frameFor respektuje velikost ===');
const small = { id: 'x', kind: 'moon', label: { cs: 'x', en: 'x' }, anchor: () => new THREE.Vector3(), size: 0.5, framing: { radius: 3.4 } };
const big = { ...small, size: 4 };
const fs = frameFor(small, ctx);
const fb = frameFor(big, ctx);
ok('větší objekt = dál', fb.cam.distanceTo(fb.target) > fs.cam.distanceTo(fs.target));

console.log('=== cíl: sousedé přes spoje ===');
const jN = engine.neighbors('jupiter');
ok('Jupiter má spoje na gate i Zemi', jN.includes('gate') && jN.includes('earth'), JSON.stringify(jN));
const gN = engine.neighbors('gate');
ok('Brána má spoj na Jupiter', gN.includes('jupiter'), JSON.stringify(gN));
ok('neexistující id nemá sousedy', engine.neighbors('nope').length === 0);

console.log('=== cíl: arkPosition je jedna formule ===');
const t0 = 0;
const [ax, ay, az] = arkPosition(t0);
const a0 = ARK_ANGLE0;
const local = new THREE.Vector3(Math.cos(a0) * ARK_ORBIT_R, 0, Math.sin(a0) * ARK_ORBIT_R);
const euler = new THREE.Euler(ARK_TILT[0], ARK_TILT[1], ARK_TILT[2]);
local.applyEuler(euler);
ok('arkPosition(0) = Euler(orbit)', Math.abs(ax - local.x) < 1e-6 && Math.abs(ay - local.y) < 1e-6 && Math.abs(az - local.z) < 1e-6, `${ax.toFixed(3)},${ay.toFixed(3)},${az.toFixed(3)} vs ${local.x.toFixed(3)},${local.y.toFixed(3)},${local.z.toFixed(3)}`);

console.log('=== cíl: L5 misie a světy jako navigační cíle ===');
{
  const { registerWorldTargets } = await import('../src/core/scene/universe/LinkEngine.ts');
  const mission = engine.getTarget('mission:uluru');
  ok('misie uluru je v registru', !!mission);
  if (mission) {
    const a = mission.anchor(ctx);
    ok('anchor misie je konečný', Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z));
    engine.flyTo('mission:uluru');
    let g = 0;
    while (engine.isTransitioning() && g++ < 1000) engine.update(ctx, 0.05);
    ok('current = mission:uluru', engine.getCurrentFocus() === 'mission:uluru', engine.getCurrentFocus());
    ok('kamera je u misie (< 10 j.)', camera.position.distanceTo(a) < 10, camera.position.distanceTo(a).toFixed(2));
  }

  registerWorldTargets(engine, [
    { id: 'w-ring', name: 'Ring World', layer: 6 },
    { id: 'w-orbit', name: 'Orbit World', layer: 4 },
  ]);
  const rw = engine.getTarget('world:w-ring');
  const ow = engine.getTarget('world:w-orbit');
  ok('prstencový svět je v registru', !!rw);
  ok('orbitální svět je v registru', !!ow);
  for (const t of [rw, ow]) {
    if (!t) continue;
    const a = t.anchor(ctx);
    ok(`anchor ${t.id} je konečný`, Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z));
  }
  engine.flyTo('world:w-ring');
  let g2 = 0;
  while (engine.isTransitioning() && g2++ < 1000) engine.update(ctx, 0.05);
  ok('current = world:w-ring', engine.getCurrentFocus() === 'world:w-ring', engine.getCurrentFocus());
  // stale world targets get removed
  registerWorldTargets(engine, [{ id: 'w-new', name: 'New', layer: 4 }]);
  ok('stale world cíl zmizel', !engine.getTarget('world:w-ring'));
  ok('nový world cíl existuje', !!engine.getTarget('world:w-new'));
}

console.log('=== cíl: kamera na L6 svět sedí na stanici (off-by-one regrese) ===');
{
  // Původní bug: scéna kreslila stanice s offsetem (i+1, N+1), engine mířil
  // na (i, N) → kamera letěla o jeden slot vedle. Teď obě strany volají
  // `ringStationPosition` — tenhle test hlídá, že `worldAnchor` pro ring
  // slot dává přesně `ringStationPosition` pootočené rotací prstence.
  const worlds = [
    { id: 'r-a', name: 'A', layer: 6 },
    { id: 'r-b', name: 'B', layer: 6 },
    { id: 'r-c', name: 'C', layer: 6 },
  ];
  const t = 37.5; // libovolný čas — rotace prstence i Země
  const euler = new THREE.Euler(RING_TILT[0], ringSpinAngle(t), RING_TILT[2]);
  worlds.forEach((w, i) => {
    const expected = new THREE.Vector3(...ringStationPosition(w, i, worlds.length)).applyEuler(euler);
    const got = new THREE.Vector3(...worldAnchor(w, i, worlds.length, 'ring', t, ctx.earthPos));
    // worldAnchor vrací world-space (zemská soustava sedí na earthPos)
    expected.add(ctx.earthPos);
    const d = got.distanceTo(expected);
    ok(`worldAnchor ring ${w.id} = stanice scény`, d < 1e-6, `d=${d.toExponential(2)}`);
  });
  // Slot na úhlu 0 patří vlajkové IssobellaStation — žádný svět tam nesmí.
  const reserved = ringPosition(worlds[0], 0, worlds.length + 1, RING_R);
  const first = ringStationPosition(worlds[0], 0, worlds.length);
  ok('první svět není na rezervovaném slotu', Math.hypot(first[0] - reserved[0], first[2] - reserved[2]) > 1e-3);
  // Orbit slot zůstává na svém vzorci.
  const ow2 = { id: 'o-x', name: 'X', layer: 4 };
  const eo = new THREE.Euler(0, orbitBeltAngle(t), 0);
  const expO = new THREE.Vector3(...orbitPosition(ow2, 0, 1)).applyEuler(eo);
  expO.add(ctx.earthPos);
  const gotO = new THREE.Vector3(...worldAnchor(ow2, 0, 1, 'orbit', t, ctx.earthPos));
  ok('worldAnchor orbit = orbitPosition scény', gotO.distanceTo(expO) < 1e-6, gotO.distanceTo(expO).toExponential(2));
}

console.log('=== cíl: motion tokeny ===');
{
  const { MOTION, motionCss, dampFactor, damp, easeOutCubic } = await import('../src/core/design/motion.ts');
  ok('motionCss(0.24) = 240ms', motionCss(0.24) === '240ms', motionCss(0.24));
  const k = dampFactor(0.0167, MOTION.followRate);
  ok('dampFactor při 60 fps ~0,14', k > 0.12 && k < 0.16, k.toFixed(4));
  ok('dampFactor(0) = 0', dampFactor(0) === 0);
  ok('dampFactor roste s deltou', dampFactor(0.1) > dampFactor(0.01));
  let v = 0;
  for (let i = 0; i < 200; i++) v = damp(v, 10, 1 / 60, MOTION.followRate);
  ok('damp konverguje k cíli', Math.abs(v - 10) < 0.01, v.toFixed(4));
  ok('easeOutCubic(0)=0', easeOutCubic(0) === 0);
  ok('easeOutCubic(1)=1', easeOutCubic(1) === 1);
  ok('easeOutCubic roste', easeOutCubic(0.3) < easeOutCubic(0.6));
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} prošlo, ${fail} selhalo`);
process.exit(fail === 0 ? 0 : 1);
