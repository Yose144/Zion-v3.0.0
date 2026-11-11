/**
 * Test map arény (2026-11-11) —data, ne grafika.
 *
 * Tři mapy (`mars`, `q3dm3`, `q3dm6`) musí být hratelné bez ohledu na to,
 * jak vypadají: spawny nesmí být ve zdi, pickupy musí ležet na podlaze
 * (ne uvnitř sloupu — přesně tahle chyba už jednou nastala u shardů)
 * a boti se musí ze spawnu hráče do svých spawnů dojít po navigační mřížce.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/arena-maps.mjs
 */

const { ARENA_MAPS, ARENA_MAP_IDS, ARENA_MAP_DEFAULT } = await import('../src/core/arena/map.ts');
const { makeSolids, PLAYER, BOT_BODY } = await import('../src/core/arena/physics.ts');
const { buildNavGrid, cellIndex, nearestWalkable, findPath } = await import('../src/core/arena/nav.ts');
const { createBotMemory, stepBot, driveBot, skillOptions } = await import('../src/core/arena/bot.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const ARENA_HALF = 19.5;

/** Leží tělo (válec) v nějaké krabici? Stejná logika jako `overlaps`. */
function bodyBlocked(solids, x, z, y, radius, height) {
  for (const box of solids) {
    if (
      x + radius > box.minX &&
      x - radius < box.maxX &&
      y + height > box.minY &&
      y < box.maxY &&
      z + radius > box.minZ &&
      z - radius < box.maxZ
    ) {
      return box;
    }
  }
  return null;
}

/** Podlaha pod pickupem: krabice, jejíž horní hrana je blízko `y` a kryje x/z. */
function floorUnder(solids, pickup, tolerance = 0.4) {
  for (const box of solids) {
    const top = box.maxY;
    if (Math.abs(top - pickup.y) > tolerance) continue;
    if (pickup.x < box.minX || pickup.x > box.maxX) continue;
    if (pickup.z < box.minZ || pickup.z > box.maxZ) continue;
    return box;
  }
  return null;
}

// ── 1) katalog ───────────────────────────────────────────────────────
console.log('== katalog map ==');
check('katalog má tři mapy', ARENA_MAP_IDS.length === 3, String(ARENA_MAP_IDS.length));
check(
  'id v katalogu sedí s klíčem',
  ARENA_MAP_IDS.every((id) => ARENA_MAPS[id]?.id === id),
);
check('výchozí mapa je Mars', ARENA_MAP_DEFAULT.id === 'mars');
check(
  'každá mapa má jméno i poznámku cs+en',
  ARENA_MAP_IDS.every((id) => {
    const map = ARENA_MAPS[id];
    return Boolean(map.name.cs && map.name.en && map.note.cs && map.note.en);
  }),
);

for (const id of ARENA_MAP_IDS) {
  const map = ARENA_MAPS[id];
  const solids = makeSolids(map.boxes);
  console.log(`\n== ${id} — ${map.name.cs} ==`);

  // ── 2) spawny ──────────────────────────────────────────────────────
  const spawn = map.playerSpawn;
  check(
    'spawn hráče je v mezích mapy',
    Math.abs(spawn.x) <= ARENA_HALF && Math.abs(spawn.z) <= ARENA_HALF,
    `(${spawn.x}, ${spawn.z})`,
  );
  const blocked = bodyBlocked(solids, spawn.x, spawn.z, 0.2, PLAYER.radius, PLAYER.height);
  check('spawn hráče není ve zdi', blocked === null, blocked ? JSON.stringify(blocked) : '');

  check('mapa má aspoň tři spawny botů', map.botSpawns.length >= 3, String(map.botSpawns.length));
  for (const [index, bot] of map.botSpawns.entries()) {
    check(
      `spawn bota ${index} je v mezích`,
      Math.abs(bot.x) <= ARENA_HALF && Math.abs(bot.z) <= ARENA_HALF,
      `(${bot.x}, ${bot.z})`,
    );
    const botBlocked = bodyBlocked(solids, bot.x, bot.z, 0.2, BOT_BODY.radius, BOT_BODY.height);
    check(`spawn bota ${index} není ve zdi`, botBlocked === null, botBlocked ? JSON.stringify(botBlocked) : '');
  }

  // ── 3) navigace: boti se od hráče dojdou ───────────────────────────
  const grid = buildNavGrid(map.boxes);
  const from = nearestWalkable(grid, cellIndex(spawn.x, spawn.z));
  check('ze spawnu hráče je průchozí buňka', from >= 0, String(from));
  for (const [index, bot] of map.botSpawns.entries()) {
    const to = nearestWalkable(grid, cellIndex(bot.x, bot.z));
    // Ve hře stačí 700 uzlů (boti repathují po ~12 m), test musí projít celou mapu.
    const path = from >= 0 && to >= 0 ? findPath(grid, from, to, 40 * 40) : [];
    check(`bot ${index} má cestu ze spawnu hráče`, path.length > 0, `from=${from} to=${to}`);
  }

  // ── 3b) bot se opravdu dojde (ne jen že existuje cesta) ───────────
  const options = skillOptions('normal');
  const body = { x: map.botSpawns[0].x, y: 0.2, z: map.botSpawns[0].z, vx: 0, vy: 0, vz: 0, onGround: false };
  const memory = createBotMemory();
  const target = { id: 'player', x: spawn.x, y: 0.2, z: spawn.z, alive: true };
  const distanceTo = () => Math.hypot(body.x - target.x, body.z - target.z);
  const before = distanceTo();
  let clock = 0;
  for (let step = 0; step < 180; step++) {
    clock += 1000 / 30;
    const intent = stepBot(memory, body, [target], grid, solids, clock, 1 / 30, options);
    driveBot(memory, body, intent, 1 / 30, solids, BOT_BODY.radius, BOT_BODY.height, options.speed);
  }
  const after = distanceTo();
  check('bot se za 6 s přiblíží aspoň o 4 m', after < before - 4, `${before.toFixed(1)} → ${after.toFixed(1)} m`);

  // ── 4) pickupy ────────────────────────────────────────────────────
  check('mapa má aspoň osm pickupů', map.pickups.length >= 8, String(map.pickups.length));
  const ids = new Set(map.pickups.map((pickup) => pickup.id));
  check('id pickupů jsou unikátní', ids.size === map.pickups.length, `${ids.size}/${map.pickups.length}`);
  check(
    'pickupy jsou v mezích mapy',
    map.pickups.every((pickup) => Math.abs(pickup.x) <= ARENA_HALF && Math.abs(pickup.z) <= ARENA_HALF),
    map.pickups
      .filter((pickup) => Math.abs(pickup.x) > ARENA_HALF || Math.abs(pickup.z) > ARENA_HALF)
      .map((pickup) => `${pickup.id}(${pickup.x},${pickup.z})`)
      .join(' '),
  );

  const floating = map.pickups.filter((pickup) => floorUnder(solids, pickup) === null);
  check(
    'každý pickup leží na podlaze (ne ve vzduchu ani ve zdi)',
    floating.length === 0,
    floating.map((pickup) => `${pickup.id}(${pickup.x},${pickup.y},${pickup.z})`).join(' '),
  );

  const embedded = map.pickups.filter((pickup) =>
    bodyBlocked(solids, pickup.x, pickup.z, pickup.y + 0.7, 0.3, 0.3),
  );
  check(
    'žádný pickup není uvnitř kolizní krabice',
    embedded.length === 0,
    embedded.map((pickup) => pickup.id).join(' '),
  );

  check(
    'pickupy mají kladný respawn',
    map.pickups.every((pickup) => pickup.respawn > 0),
  );
  check(
    'powerupy mají dlouhý respawn (≥ 45 s)',
    map.pickups
      .filter((pickup) => pickup.kind === 'powerup')
      .every((pickup) => pickup.respawn >= 45),
  );
  check(
    'shardy mají krátký respawn (≤ 15 s)',
    map.pickups
      .filter((pickup) => pickup.kind === 'shard')
      .every((pickup) => pickup.respawn <= 15),
  );
  check(
    'mapa má Quad, Haste i Mega',
    map.pickups.some((pickup) => pickup.powerup === 'quad') &&
      map.pickups.some((pickup) => pickup.powerup === 'haste') &&
      map.pickups.some((pickup) => pickup.kind === 'mega'),
  );
  check('powerup má druh (quad/haste)', map.pickups
    .filter((pickup) => pickup.kind === 'powerup')
    .every((pickup) => pickup.powerup === 'quad' || pickup.powerup === 'haste'));
}

// ── 5) mapy se nesmí slít do jedné ───────────────────────────────────
console.log('\n== rozdílnost map ==');
const signature = (id) => {
  const map = ARENA_MAPS[id];
  return `${map.boxes.length}:${map.botSpawns.map((spawn) => `${spawn.x},${spawn.z}`).join('|')}`;
};
const signatures = ARENA_MAP_IDS.map(signature);
check('každá mapa má jiný půdorys', new Set(signatures).size === signatures.length, signatures.join(' / '));
check(
  'Q3 mapy mají víc krabic než Mars (bohatší půdorys)',
  ARENA_MAPS.q3dm3.boxes.length > ARENA_MAPS.mars.boxes.length &&
    ARENA_MAPS.q3dm6.boxes.length > ARENA_MAPS.mars.boxes.length,
  `${ARENA_MAPS.mars.boxes.length} / ${ARENA_MAPS.q3dm3.boxes.length} / ${ARENA_MAPS.q3dm6.boxes.length}`,
);

console.log(failures === 0 ? '\nARENA MAPS OK' : `\nARENA MAPS FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
