/**
 * Test zbraní arény (2026-11-10) — čísla a chování bez WebGL.
 *
 * Rozšíření Q3 sady (brokovnice, blesk, plazma) musí držet tři věci:
 *  1. **čísla jsou z Q3 a nepřebíjí se navzájem** (brokovnice 11×10,
 *     blesk 8/50 ms, plazma 20+15 splash),
 *  2. **každá zbraň má vlastní munici a kadence** — žádná druhá tabulka
 *     v komponentě,
 *  3. **spread je deterministický**, když mu předáš vlastní RNG (testy
 *     nesmí záviset na Math.random).
 *
 * Spuštění: cd apps/nirvana && npx tsx test/arena-weapons.mjs
 */

const { WEAPONS, applyDamage, spreadVector, aimVector, ARMOR_ABSORB, botWeaponFor, BOT_FIRE } = await import(
  '../src/core/arena/weapons.ts'
);
const { ARENA_PICKUPS, ARENA_SOLO_PICKUPS } = await import('../src/core/arena/map.ts');
const { BOT_SKILLS, skillOptions } = await import('../src/core/arena/bot.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) základní sada (nesmí se rozbít) ───────────────────────────────
check('rail drží 100 dmg', WEAPONS.rail.damage === 100);
check('rail je nekonečný', WEAPONS.rail.ammo === Number.POSITIVE_INFINITY);
check('raketa má splash 100', WEAPONS.rocket.splash === 100 && WEAPONS.rocket.radius > 0);
check('MG je 8 dmg / 100 ms', WEAPONS.mg.damage === 8 && WEAPONS.mg.cooldownMs === 100);

// ── 2) brokovnice ────────────────────────────────────────────────────
check('brokovnice: 11 broků', WEAPONS.shotgun.pellets === 11, String(WEAPONS.shotgun.pellets));
check('brokovnice: 10 dmg na brok', WEAPONS.shotgun.damage === 10, String(WEAPONS.shotgun.damage));
check(
  'brokovnice: plný zásah = 110 (víc než 100 HP)',
  WEAPONS.shotgun.pellets * WEAPONS.shotgun.damage === 110,
  String(WEAPONS.shotgun.pellets * WEAPONS.shotgun.damage),
);
check('brokovnice: krátký dostřel', WEAPONS.shotgun.range <= 35, String(WEAPONS.shotgun.range));
check('brokovnice: pomalejší než MG', WEAPONS.shotgun.cooldownMs > WEAPONS.mg.cooldownMs);
check('brokovnice: má vlastní munici', WEAPONS.shotgun.ammo > 0 && Number.isFinite(WEAPONS.shotgun.ammo));

// ── 3) blesk ─────────────────────────────────────────────────────────
check('blesk: 8 dmg', WEAPONS.lightning.damage === 8, String(WEAPONS.lightning.damage));
check('blesk: kadence 50 ms', WEAPONS.lightning.cooldownMs === 50, String(WEAPONS.lightning.cooldownMs));
check('blesk: automatická', WEAPONS.lightning.automatic === true);
check('blesk: doletí dál než brokovnice', WEAPONS.lightning.range > WEAPONS.shotgun.range);
check(
  'blesk: 100 munice = 5 s palby',
  (WEAPONS.lightning.ammo * WEAPONS.lightning.cooldownMs) / 1000 === 5,
  String((WEAPONS.lightning.ammo * WEAPONS.lightning.cooldownMs) / 1000),
);
check(
  'blesk: DPS 160 (8 / 0,05 s)',
  WEAPONS.lightning.damage / (WEAPONS.lightning.cooldownMs / 1000) === 160,
);

// ── 4) plazma ────────────────────────────────────────────────────────
check('plazma: přímý zásah 20', WEAPONS.plasma.damage === 20, String(WEAPONS.plasma.damage));
check('plazma: splash 15', WEAPONS.plasma.splash === 15, String(WEAPONS.plasma.splash));
check('plazma: menší rádius než raketa', WEAPONS.plasma.radius < WEAPONS.rocket.radius);
check('plazma: rychlejší kadence než raketa', WEAPONS.plasma.cooldownMs < WEAPONS.rocket.cooldownMs);
check('plazma: letí rychleji než raketa', WEAPONS.plasma.speed > WEAPONS.rocket.speed, `${WEAPONS.plasma.speed} vs ${WEAPONS.rocket.speed}`);
check('plazma: má TTL', WEAPONS.plasma.ttlMs > 0, String(WEAPONS.plasma.ttlMs));

// ── 5) spread ────────────────────────────────────────────────────────
{
  const dir = aimVector(0, 0);
  let seed = 123456789;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const a = spreadVector(dir, WEAPONS.shotgun.spread, rng);
  const b = spreadVector(dir, WEAPONS.shotgun.spread, rng);
  check('spread: jiný brok = jiný směr', a.x !== b.x || a.z !== b.z);
  check('spread: směr zůstává dopředu', a.z < 0, `${a.x}, ${a.z}`);
  check('spread: nulový rozptyl = přesný směr', spreadVector(dir, 0, rng) === dir);
}

// ── 6) poškození a armor ─────────────────────────────────────────────
{
  const hit = applyDamage(100, 100, WEAPONS.shotgun.pellets * WEAPONS.shotgun.damage);
  check('brokovnice zblízka sundá i přes armor víc než třetinu HP', hit.hp <= 70, JSON.stringify(hit));
  const armored = applyDamage(100, 100, 40);
  check(
    'armor spolkne 66 %',
    armored.armor === Math.round(100 - 40 * ARMOR_ABSORB) && armored.hp === 100 - (40 - Math.round(40 * ARMOR_ABSORB)),
    JSON.stringify(armored),
  );
  const plasma = applyDamage(100, 0, WEAPONS.plasma.damage + WEAPONS.plasma.splash);
  check('plazma: 35 dmg bez armoru', plasma.hp === 65, String(plasma.hp));
}

// ── 7) pickupy a Quad (2026-11-10) ──────────────────────────────────
{
  const quad = ARENA_SOLO_PICKUPS.find((pickup) => pickup.powerup === 'quad');
  check('sólo má Quad pickup', Boolean(quad), JSON.stringify(ARENA_SOLO_PICKUPS.map((p) => p.id)));
  check('Quad má respawn 60 s', quad?.respawn === 60, String(quad?.respawn));
  check(
    'multiplayer má Quad (od proto 37)',
    ARENA_PICKUPS.some((pickup) => pickup.powerup === 'quad'),
  );
  check(
    'sólová mapa = multiplayer (jedna pravda o světě)',
    ARENA_SOLO_PICKUPS === ARENA_PICKUPS,
  );
  const haste = ARENA_SOLO_PICKUPS.find((pickup) => pickup.powerup === 'haste');
  const mega = ARENA_SOLO_PICKUPS.find((pickup) => pickup.kind === 'mega');
  check('sólo má Haste pickup', Boolean(haste), JSON.stringify(haste));
  check('sólo má Mega Health', Boolean(mega) && mega.respawn === 35, JSON.stringify(mega));
  check(
    'multiplayer má Haste i Mega',
    ARENA_PICKUPS.some((pickup) => pickup.powerup === 'haste') &&
      ARENA_PICKUPS.some((pickup) => pickup.kind === 'mega'),
  );
  check('powerupy mají respawn delší než běžné itemy', (haste?.respawn ?? 0) >= 45 && (quad?.respawn ?? 0) >= 60);
  check(
    'pickupy jsou v aréně (±20)',
    ARENA_SOLO_PICKUPS.every(
      (pickup) => Math.abs(pickup.x) <= 20 && Math.abs(pickup.z) <= 20 && pickup.y >= 0 && pickup.y <= 4,
    ),
    JSON.stringify(ARENA_SOLO_PICKUPS.map((p) => [p.x, p.y, p.z])),
  );
}

// ── 8) pěst (gauntlet) ─────────────────────────────────────────────
{
  check('pěst: 50 dmg', WEAPONS.gauntlet.damage === 50, String(WEAPONS.gauntlet.damage));
  check('pěst: dostřel 2,2 m', WEAPONS.gauntlet.range === 2.2, String(WEAPONS.gauntlet.range));
  check('pěst: 400 ms kadence', WEAPONS.gauntlet.cooldownMs === 400, String(WEAPONS.gauntlet.cooldownMs));
  check('pěst: nikdy nedojde munice', WEAPONS.gauntlet.ammo === Number.POSITIVE_INFINITY);
  check('boti pěst nepoužívají', botWeaponFor(0) === 'shotgun', botWeaponFor(0));
}

// ── 9) botí volba zbraně (2026-11-10) ──────────────────────────────
{
  check('bot zblízka bere brokovnici', botWeaponFor(2) === 'shotgun', botWeaponFor(2));
  check('bot na střední bere raketu', botWeaponFor(10) === 'rocket', botWeaponFor(10));
  check('bot na dálku bere MG', botWeaponFor(20) === 'mg', botWeaponFor(20));
  check('bot na dlouhou bere rail', botWeaponFor(30) === 'rail', botWeaponFor(30));
  check('hranice 5 m = brokovnice', botWeaponFor(5) === 'shotgun');
  check('hranice 14 m = raketa', botWeaponFor(14) === 'rocket');
  check('hranice 24 m = MG', botWeaponFor(24) === 'mg');
  check('rozbitá vzdálenost nespadne', botWeaponFor(Number.NaN) === 'rail');
  check('MG dávka je 4 rány', BOT_FIRE.mgBurst === 4, String(BOT_FIRE.mgBurst));
  check('brokovnice bota je 6 broků', BOT_FIRE.shotgunPellets === 6, String(BOT_FIRE.shotgunPellets));
  check('raketa není pokaždé', BOT_FIRE.rocketChance > 0 && BOT_FIRE.rocketChance < 1, String(BOT_FIRE.rocketChance));
}

// ── 10) obtížnosti a armor shardy (2026-11-10) ─────────────────────
{
  const nightmare = skillOptions('nightmare');
  const hard = skillOptions('hard');
  const easy = skillOptions('easy');
  check('nightmare existuje', BOT_SKILLS.nightmare !== undefined);
  check(
    'nightmare je přesnější a rychlejší než hard',
    nightmare.aimError < hard.aimError && nightmare.speed > hard.speed,
    `${nightmare.aimError}/${hard.aimError} · ${nightmare.speed}/${hard.speed}`,
  );
  check(
    'obtížnost nikdy nemění damage',
    !('damage' in nightmare) && !('damage' in easy),
    JSON.stringify(Object.keys(nightmare)),
  );
  check('easy je pomalejší než hard', easy.speed < hard.speed);

  const shards = ARENA_SOLO_PICKUPS.filter((pickup) => pickup.kind === 'shard');
  check('sólo má čtyři armor shardy', shards.length === 4, String(shards.length));
  check('shardy mají krátký respawn', shards.every((pickup) => pickup.respawn <= 15));
  check(
    'multiplayer má shardy',
    ARENA_PICKUPS.some((pickup) => pickup.kind === 'shard'),
  );
}

console.log('');
if (failures > 0) {
  console.log(`ARENA WEAPONS FAILED (${failures})`);
  process.exit(1);
}
console.log('ARENA WEAPONS OK');
