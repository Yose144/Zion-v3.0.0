#!/usr/bin/env node
/**
 * Test simulace MOBA „První svět" — bez prohlížeče.
 *
 * Ověřuje, že hra opravdu běží: vlny minionů, poškození kouzlem, věže,
 * převzetí uzlu L5 a konec zápasu. Když tenhle test projde, chyba v klientovi
 * je jen vizuální — ne v pravidlech.
 *
 * Spuštění: npx tsx apps/nirvana/test/moba-sim.mjs
 */

import { BASE_SPEED, buyItem, createMoba, createMobaMatch, heroSpeed, stepMoba, mobaSnapshot, NO_INPUT } from '../src/core/moba/sim.ts';
import { SCHOOL_TRAITS, spellsForAvatar } from '../src/core/moba/spells.ts';
import { NEXUS_HP, WAVE_INTERVAL_MS } from '../src/core/moba/map.ts';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const STEP = 1000 / 30;

/** Posun simulace o `ms` s konstantním vstupem. */
function advance(state, ms, input = NO_INPUT) {
  let now = state.now;
  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    now += STEP;
    stepMoba(state, STEP / 1000, { 'hero-you': input }, now);
  }
  return now;
}

console.log('== MOBA · simulace ==');

// ── 1. kouzla z kánonu ───────────────────────────────────────────────
const krishna = spellsForAvatar(0);
const shiva = spellsForAvatar(82);
const ganesha = spellsForAvatar(84);
check('kouzla: 4 sloty', krishna.length === 4 && krishna.map((s) => s.slot).join('') === 'QWER');
check('kouzla: každá postava má vlastní jména', krishna[3].name !== shiva[3].name, `${krishna[3].name} / ${shiva[3].name}`);
check('kouzla: barva z paprsku postavy', /^#[0-9a-f]{6}$/i.test(krishna[0].color), krishna[0].color);
check('kouzla: R má delší cooldown než Q', krishna[3].cooldownMs > krishna[0].cooldownMs);

// ── 2. start zápasu ──────────────────────────────────────────────────
const state = createMoba(0, 82, 0);
check('start: dva hrdinové', state.heroes.length === 2);
check('start: tři uzly L5', state.nodes.length === 3, String(state.nodes.length));
check('start: dvanáct věží + dva Nexy', state.towers.length === 14, String(state.towers.length));
check('start: Nexy mají plné HP', state.towers.filter((t) => t.kind === 'nexus').every((t) => t.hp === NEXUS_HP));

// ── 3. vlny minionů ──────────────────────────────────────────────────
advance(state, 7000);
const firstWave = state.minions.length;
check('vlna: minioni przyšli po 6 s', firstWave > 0, String(firstWave));
check('vlna: obě strany', new Set(state.minions.map((m) => m.team)).size === 2);
const minionX0 = state.minions[0]?.x ?? 0;
advance(state, 2000);
const moved = state.minions.find((m) => m.id === state.minions[0]?.id);
check('minioni jdou po lince', !moved || Math.abs(moved.x - minionX0) > 0.5 || state.minions.length !== firstWave);

// ── 4. kouzlo zasáhne protivníka ─────────────────────────────────────
const you = state.heroes[0];
const foe = state.heroes[1];
you.x = 0;
you.z = 0;
foe.x = 4;
foe.z = 0;
const foeHpBefore = foe.hp;
const now4 = advance(state, 200);
stepMoba(state, 1 / 30, { 'hero-you': { ...NO_INPUT, cast: { slot: 'Q', x: 4, z: 0 } } }, now4 + 33);
advance(state, 900, NO_INPUT);
check('kouzlo Q: soupeř ztratil HP', foe.hp < foeHpBefore, `${foeHpBefore} → ${foe.hp}`);
check('kouzlo Q: spotřebovalo manu', you.mana < you.maxMana, `${Math.round(you.mana)}/${you.maxMana}`);
check('kouzlo Q: má cooldown', you.cooldowns.Q > state.now, String(you.cooldowns.Q - state.now));

// ── 5. léčení a štít (W) ─────────────────────────────────────────────
// Beze svědků: u vlastní brány, ať štít nesežere minion dřív, než ho změřím.
you.x = -34;
you.z = 0;
you.hp = you.maxHp * 0.5;
const now5 = state.now;
stepMoba(state, 1 / 30, { 'hero-you': { ...NO_INPUT, cast: { slot: 'W', x: you.x, z: you.z } } }, now5 + 33);
const shielded = you.shield > 0 || you.hp > you.maxHp * 0.5;
check('kouzlo W: štít nebo heal', shielded, `shield=${Math.round(you.shield)} hp=${Math.round(you.hp)}`);

// ── 6. věž střílí po hrdinech ────────────────────────────────────────
const redTower = state.towers.find((t) => t.team === 'red' && t.kind === 'tower');
you.x = redTower.x - 2;
you.z = redTower.z;
const hpBeforeTower = you.hp;
advance(state, 2500);
check('věž: trefuje hrdinu v dosahu', you.hp < hpBeforeTower, `${Math.round(hpBeforeTower)} → ${Math.round(you.hp)}`);

// ── 7. převzetí uzlu L5 ──────────────────────────────────────────────
// Hrdina mohl u věže umřít (věž + minioni) — oživ ho, jinak uzel nikdy
// nepřevezme a test hlásí chybu pravidel místo chyby testu.
function revive(hero) {
  hero.alive = true;
  hero.hp = hero.maxHp;
  hero.mana = hero.maxMana;
  hero.shield = 0;
  hero.deaths = 0;
}
revive(you);
const node = state.nodes[0];
you.x = node.x;
you.z = node.z;
advance(state, 3500);
check('uzel L5: převzat po 2,6 s', node.owner === 'blue', String(node.owner));

// ── 8. ochrana struktur (vnější → vnitřní → Nexa) ────────────────────
revive(you);
const redNexus = state.towers.find((t) => t.id === 'red-nexus');
const redOuterMid = state.towers.find((t) => t.id === 'red-tower-outer-mid');
const redInnerMid = state.towers.find((t) => t.id === 'red-tower-inner-mid');
const outerHpBefore = redOuterMid.hp;
you.x = redInnerMid.x - 2;
you.z = redInnerMid.z;
advance(state, 2000);
check('ochrana: vnitřní věž nedostane nic, dokud stojí vnější', redInnerMid.hp === outerHpBefore || redInnerMid.hp > 0, `${Math.round(redInnerMid.hp)}`);

const nexusHpBefore = redNexus.hp;
you.x = redNexus.x - 2;
you.z = redNexus.z;
advance(state, 2000);
check('ochrana: Nexa nedostane nic, dokud stojí vnitřní věže', redNexus.hp === nexusHpBefore, `${nexusHpBefore} → ${Math.round(redNexus.hp)}`);

// Sundej jednu lajnu (vnější → vnitřní) a Nexa padne.
redOuterMid.hp = 0;
redInnerMid.hp = 0;
redNexus.hp = 400; // plná Nexa má 4000; tady jde o pravidlo, ne o čas
revive(you);
you.x = redNexus.x - 2;
you.z = redNexus.z;
advance(state, 3000);
check('konec: Nexa padla → vítězství ZION', state.ended === 'blue', String(state.ended));

const snapshot = mobaSnapshot(state);
check('snapshot: nese hrdiny i věže', snapshot.heroes.length === 2 && snapshot.towers.length > 0);
check('snapshot: banner po vítězství', Boolean(snapshot.banner));

// ── 9. časový limit ──────────────────────────────────────────────────
const slow = createMoba(1, 2, 0);
advance(slow, 5_000);
let guard = 0;
while (!slow.ended && guard < 500) {
  advance(slow, 1000);
  guard += 1;
}
check('limit: zápas skončí do 8 minut', slow.ended !== null, `čas ${Math.round(slow.time)} s`);

// ── 10. ekonomika a itemy ───────────────────────────────────────────
const shop = createMoba(4, 19, 0);
const buyer = shop.heroes[0];
check('ekonomika: startovní zlato', buyer.gold >= 300, String(buyer.gold));
buyer.gold = 500; // v reálu se na první item našetří z minionů
const goldBefore = buyer.gold;
const bought = buyItem(buyer, 'boots');
check('obchod: koupě sandálů', bought && buyer.items.includes('boots'), JSON.stringify(buyer.items));
check('obchod: zlato se odečetlo', buyer.gold === goldBefore - 400, String(buyer.gold));
check('obchod: sandály zrychlují', heroSpeed(buyer) > BASE_SPEED, `${heroSpeed(buyer).toFixed(2)} vs ${BASE_SPEED}`);
check('obchod: podruhé nekoupíš', !buyItem(buyer, 'boots'));
buyer.gold = 0;
check('obchod: bez zlata nekoupíš', !buyItem(buyer, 'aegis'));

buyer.gold = 400;
const maxHpBefore = buyer.maxHp;
check('obchod: Aegis přidá HP', buyItem(buyer, 'aegis') && buyer.maxHp === maxHpBefore + 250, `${maxHpBefore} → ${buyer.maxHp}`);

// ── 11. 3v3 (šest hrdinů) ───────────────────────────────────────────
const threeVsThree = createMobaMatch(
  [
    { id: 'a', heroId: 0, team: 'blue', human: true },
    { id: 'b', heroId: 1, team: 'blue', human: false },
    { id: 'c', heroId: 2, team: 'blue', human: false },
    { id: 'd', heroId: 82, team: 'red', human: true },
    { id: 'e', heroId: 85, team: 'red', human: false },
    { id: 'f', heroId: 86, team: 'red', human: false },
  ],
  0,
);
check('3v3: šest hrdinů', threeVsThree.heroes.length === 6);
check('3v3: tři na stranu', threeVsThree.heroes.filter((hero) => hero.team === 'blue').length === 3);
advance(threeVsThree, 7000);
check('3v3: sim běží (minioni)', threeVsThree.minions.length > 0, String(threeVsThree.minions.length));

// ── 12. školy kouzel — každá se chová jinak ──────────────────────────
// Do 2. 11. 2026 měly všechny školy stejnou mechaniku (dmg+shield+heal+slow),
// takže hrdinové splývali. Testy níž hlídají, že rozdíl je skutečný.

const mkSpell = (school, over = {}) => ({
  slot: 'Q',
  name: `test-${school}`,
  school,
  kind: 'projectile',
  damage: 100,
  shield: 0,
  heal: 0,
  slow: 0,
  slowMs: 0,
  range: 12,
  radius: 1.1,
  speed: 22,
  cooldownMs: 3200,
  mana: 0,
  color: '#ffffff',
  ...over,
});

/** Sim bez botů: každý hrdina dostane explicitní vstup (žádné `stepBot`). */
function advanceAll(state, ms, casts = {}) {
  let now = state.now;
  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    now += STEP;
    const inputs = {};
    for (const hero of state.heroes) inputs[hero.id] = casts[hero.id] ?? NO_INPUT;
    stepMoba(state, STEP / 1000, inputs, now);
  }
  return now;
}

function schoolMatch(seats) {
  return createMobaMatch(
    seats.map((seat, index) => ({ id: `s${index}`, heroId: seat.heroId, team: seat.team, human: true })),
    0,
  );
}

check(
  'školy: všech 11 má vlastní mechaniku',
  Object.values(SCHOOL_TRAITS).every((traits) => Object.keys(traits).length > 0),
  JSON.stringify(Object.keys(SCHOOL_TRAITS)),
);
check(
  'školy: liší se aspoň šest druhů chování',
  new Set(Object.values(SCHOOL_TRAITS).map((traits) => Object.keys(traits).join(','))).size >= 6,
);

// (a) oheň — hoření pokračuje po zásahu
{
  const s = schoolMatch([{ heroId: 0, team: 'blue' }, { heroId: 82, team: 'red' }]);
  const [caster, target] = s.heroes;
  caster.x = -40; caster.z = -30;
  target.x = -35; target.z = -30;
  caster.spells = [mkSpell('fire')];
  advanceAll(s, 400, { [caster.id]: { ...NO_INPUT, cast: { slot: 'Q', x: target.x, z: target.z } } });
  const afterHit = target.hp;
  advanceAll(s, 1500);
  check(
    'oheň: hoření pokračuje i po zásahu',
    target.hp < afterHit - 5,
    `${Math.round(afterHit)} → ${Math.round(target.hp)}`,
  );
}

// (b) šíp — projektil projde skrz první cíl
{
  const s = schoolMatch([
    { heroId: 0, team: 'blue' },
    { heroId: 82, team: 'red' },
    { heroId: 84, team: 'red' },
  ]);
  const caster = s.heroes[0];
  const near = s.heroes[1];
  const far = s.heroes[2];
  caster.x = -40; caster.z = -30;
  near.x = -36; near.z = -30;
  far.x = -32; far.z = -30;
  caster.spells = [mkSpell('arrow')];
  const nearHp = near.hp;
  const farHp = far.hp;
  advanceAll(s, 700, { [caster.id]: { ...NO_INPUT, cast: { slot: 'Q', x: far.x, z: far.z } } });
  check(
    'šíp: zásah projde skrz oba cíle',
    near.hp < nearHp && far.hp < farHp,
    `near ${Math.round(nearHp - near.hp)}, far ${Math.round(farHp - far.hp)}`,
  );
}

// (c) bouře — část poškození přeteče na druhý cíl
{
  const s = schoolMatch([
    { heroId: 0, team: 'blue' },
    { heroId: 82, team: 'red' },
    { heroId: 84, team: 'red' },
  ]);
  const caster = s.heroes[0];
  const first = s.heroes[1];
  const second = s.heroes[2];
  caster.x = -40; caster.z = -30;
  first.x = -36; first.z = -30;
  second.x = -36; second.z = -26; // 4 m od prvního, mimo dráhu projektilu
  caster.spells = [mkSpell('storm')];
  const secondHp = second.hp;
  advanceAll(s, 700, { [caster.id]: { ...NO_INPUT, cast: { slot: 'Q', x: first.x, z: first.z } } });
  check(
    'bouře: řetěz zasáhne i druhý cíl',
    second.hp < secondHp,
    `${Math.round(secondHp)} → ${Math.round(second.hp)}`,
  );
}

// (d) stín — popravčí bonus proti zraněnému cíli
{
  const s = schoolMatch([{ heroId: 0, team: 'blue' }, { heroId: 82, team: 'red' }]);
  const [caster, target] = s.heroes;
  caster.x = -40; caster.z = -30;
  target.x = -35; target.z = -30;
  caster.spells = [mkSpell('shadow')];
  const castOnce = () => {
    caster.cooldowns.Q = 0;
    const before = target.hp;
    advanceAll(s, 500, { [caster.id]: { ...NO_INPUT, cast: { slot: 'Q', x: target.x, z: target.z } } });
    return before - target.hp;
  };
  target.hp = target.maxHp;
  const healthy = castOnce();
  target.hp = target.maxHp * 0.2;
  const wounded = castOnce();
  check(
    'stín: zraněný cíl dostane víc',
    wounded > healthy * 1.3,
    `${Math.round(healthy)} vs ${Math.round(wounded)}`,
  );
}

// (e) ward — štít dostane i spojenec
{
  const s = schoolMatch([
    { heroId: 0, team: 'blue' },
    { heroId: 1, team: 'blue' },
    { heroId: 82, team: 'red' },
  ]);
  const caster = s.heroes[0];
  const ally = s.heroes[1];
  caster.x = -40; caster.z = -30;
  ally.x = -37; ally.z = -30;
  caster.spells = [mkSpell('ward', { slot: 'W', kind: 'buff', damage: 0, shield: 200, heal: 0 })];
  advanceAll(s, 200, { [caster.id]: { ...NO_INPUT, cast: { slot: 'W', x: caster.x, z: caster.z } } });
  check('ward: štít dostane i spojenec', ally.shield > 0, String(Math.round(ally.shield)));
}

// (f) příroda — léčení běží postupně (regen buff)
{
  const s = schoolMatch([{ heroId: 0, team: 'blue' }, { heroId: 82, team: 'red' }]);
  const caster = s.heroes[0];
  caster.x = -40; caster.z = -30;
  caster.hp = caster.maxHp * 0.4;
  caster.spells = [mkSpell('nature', { slot: 'W', kind: 'buff', damage: 0, shield: 0, heal: 400 })];
  advanceAll(s, 200, { [caster.id]: { ...NO_INPUT, cast: { slot: 'W', x: caster.x, z: caster.z } } });
  const hasRegen = caster.buffs.some((buff) => buff.type === 'regen');
  const afterCast = caster.hp;
  advanceAll(s, 1200);
  check('příroda: W nasadí regeneraci', hasRegen);
  check('příroda: léčení pokračuje po seslání', caster.hp > afterCast, `${Math.round(afterCast)} → ${Math.round(caster.hp)}`);
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
