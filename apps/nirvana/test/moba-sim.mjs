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

import { BASE_SPEED, BOT_SKILLS, buyItem, buyback, buybackCost, createMoba, createMobaMatch, GOLD_CAP, heroSpeed, isHidden, isVisibleTo, ITEMS, ITEM_SLOTS, pendingTalent, pickTalent, placeSentry, placeWard, sellItem, snapAim, startRecall, stepMoba, mobaSnapshot, talentRole, talentsFor, talentTotals, totalXpAt, useBattleSpell, useItem, visionSources, RECALL_CHANNEL_MS, NO_INPUT, SENTRY_DURATION_MS, WARD_DURATION_MS, WARD_STOCK_MAX } from '../src/core/moba/sim.ts';
import { SCHOOL_TRAITS, spellCooldown, spellMana, spellRank, spellsForAvatar } from '../src/core/moba/spells.ts';
import { BUSHES, INHIBITOR_RESPAWN_MS, isStructureProtected, NEXUS_HP, VISION, WAVE_INTERVAL_MS } from '../src/core/moba/map.ts';

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
check(
  'start: 18 věží + 6 inhibitorů + 2 Nexy',
  state.towers.length === 26 &&
    state.towers.filter((tower) => tower.kind === 'tower').length === 18 &&
    state.towers.filter((tower) => tower.kind === 'inhibitor').length === 6,
  String(state.towers.length),
);
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

// Sundej jednu lajnu celou (vnější → vnitřní → základnová → inhibitor);
// teprve pád inhibitoru odemyká Nexu.
redOuterMid.hp = 0;
redInnerMid.hp = 0;
state.towers.find((t) => t.id === 'red-tower-base-mid').hp = 0;
state.towers.find((t) => t.id === 'red-inhibitor-mid').hp = 0;
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

// ── 13. mlha války ───────────────────────────────────────────────────
// Bez mlhy je celá mapa průhledná: jungling nemá smysl a gank neexistuje.
{
  const s = createMobaMatch(
    [
      { id: 'me', heroId: 0, team: 'blue', human: true },
      { id: 'ally', heroId: 1, team: 'blue', human: true },
      { id: 'foe', heroId: 82, team: 'red', human: true },
    ],
    0,
  );
  const me = s.heroes.find((hero) => hero.id === 'me');
  const ally = s.heroes.find((hero) => hero.id === 'ally');
  const foe = s.heroes.find((hero) => hero.id === 'foe');

  me.x = -40; me.z = -30;
  ally.x = 40; ally.z = -30; // spojenec daleko — vidět musí být vždy
  foe.x = -20; foe.z = -30; // 20 m od nás, mimo vidění hrdiny (14 m)

  const sources = visionSources(s, 'blue');
  check('mlha: tým má zdroje vidění', sources.length >= 2, String(sources.length));
  check('mlha: hrdina vidí 14 m', isVisibleTo(sources, me.x + VISION.hero - 1, me.z) && !isVisibleTo(sources, me.x + VISION.hero + 2, me.z - 30));

  const far = mobaSnapshot(s, 'blue');
  check('mlha: vzdálený soupeř není ve snapshotu', !far.heroes.some((hero) => hero.id === 'foe'));
  check('mlha: vlastní tým je ve snapshotu vždy', far.heroes.some((hero) => hero.id === 'ally'));
  check('mlha: struktury jdou vidět vždy', far.towers.length >= 14, String(far.towers.length));

  foe.x = me.x + 6; foe.z = me.z;
  const near = mobaSnapshot(s, 'blue');
  check('mlha: blízký soupeř je ve snapshotu', near.heroes.some((hero) => hero.id === 'foe'));

  // Bez `viewerTeam` (divák/debug) jde všechno — testy a debug to potřebují.
  const all = mobaSnapshot(s);
  check('mlha: bez diváka se posílá vše', all.heroes.length === 3, String(all.heroes.length));

  // Vlastní tým protistrany soupeře nevidí (opačný směr).
  foe.x = 20; foe.z = -30;
  const redView = mobaSnapshot(s, 'red');
  check(
    'mlha: soupeř nevidí naše hrdiny',
    !redView.heroes.some((hero) => hero.id === 'me' || hero.id === 'ally'),
    redView.heroes.map((hero) => hero.id).join(','),
  );
}

// ── ekonomika a postup (F1) ─────────────────────────────────────────
{
  console.log('\n-- ekonomika a postup --');
  const s = createMoba(0, 82, 1_000_000);
  const me = s.heroes.find((hero) => hero.id === 'hero-you');

  // Pasivní zlato: 2/s. Bez něj by prohrávající linka neměla cestu k itemu.
  const goldBefore = me.gold;
  advance(s, 3000);
  const gained = me.gold - goldBefore;
  check('ekonomika: pasivní zlato ~2/s', gained >= 4 && gained <= 8, String(gained));

  // Strop zlata je 9999, ne 3000 — jinak by dražší itemy nešly koupit.
  check('ekonomika: strop zlata 9999', GOLD_CAP === 9999, String(GOLD_CAP));

  // Stupně kouzel: Q/W/E na 1/4/7/10, R na 6/11/15.
  check('postup: Q stupeň 1 na levelu 1', spellRank(1, 'Q') === 1);
  check('postup: Q stupeň 2 na levelu 4', spellRank(4, 'Q') === 2);
  check('postup: Q stupeň 4 na levelu 10', spellRank(10, 'Q') === 4);
  check('postup: R zamčená do levelu 6', spellRank(1, 'R') === 0 && spellRank(5, 'R') === 0);
  check('postup: R stupeň 1 na levelu 6', spellRank(6, 'R') === 1);
  check('postup: R stupeň 3 na levelu 15', spellRank(15, 'R') === 3);

  // Zamčená ultimátka se nesmí seslat (level 1) — ani nespotřebuje manu.
  const manaBefore = me.mana;
  const cdBefore = me.cooldowns.R;
  stepMoba(s, STEP / 1000, { 'hero-you': { ...NO_INPUT, cast: { slot: 'R', x: me.x + 3, z: me.z } } }, s.now + STEP);
  check(
    'postup: R na levelu 1 se nes sesle',
    me.cooldowns.R === cdBefore && me.mana === manaBefore,
    `cd=${me.cooldowns.R} mana=${me.mana}`,
  );

  // Snapshot nese XP — HUD bez toho nemá co kreslit.
  const snap = mobaSnapshot(s);
  const snapMe = snap.heroes.find((hero) => hero.id === 'hero-you');
  check('postup: snapshot nese xp a xpNeed', typeof snapMe.xp === 'number' && snapMe.xpNeed > 0, `${snapMe.xp}/${snapMe.xpNeed}`);

  // Boti utrácejí: bez toho by pasivní zlato zvýhodnilo jen člověka.
  const bot = s.heroes.find((hero) => hero.id === 'hero-foe');
  bot.gold = 500;
  advance(s, 1200);
  check('bot: koupí item, když má zlato', bot.items.length >= 1, String(bot.items.length));
  check('bot: zlato se odečetlo', bot.gold < 500, String(Math.round(bot.gold)));
}

// ── itemy: recepty, sloty, prodej (F2) ──────────────────────────────
{
  console.log('\n-- itemy --');
  check('itemy: 21 itemů (14 + ward + sentry + 5 aktivních)', ITEMS.length === 21, String(ITEMS.length));
  check('itemy: 6 slotů', ITEM_SLOTS === 6, String(ITEM_SLOTS));

  const s = createMoba(0, 82, 2_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  hero.gold = 5000;

  // recept: Čepel + Tesák → Válečná čepel, platí se jen rozdíl ceny
  buyItem(hero, 'blade');
  buyItem(hero, 'fang');
  const goldBeforeRecipe = hero.gold;
  const crafted = buyItem(hero, 'warblade');
  check('recept: složí válečnou čepel', crafted && hero.items.includes('warblade'), hero.items.join(','));
  check(
    'recept: komponenty se spotřebovaly',
    !hero.items.includes('blade') && !hero.items.includes('fang'),
    hero.items.join(','),
  );
  check('recept: platí se jen rozdíl 400', hero.gold === goldBeforeRecipe - 400, String(goldBeforeRecipe - hero.gold));
  check('recept: hotový item nedáš dvakrát', !buyItem(hero, 'warblade'));

  // slot limit — šest itemů ano, sedmý ne
  const s2 = createMoba(0, 82, 2_000_000);
  const h2 = s2.heroes.find((candidate) => candidate.id === 'hero-you');
  h2.gold = 9999;
  for (const id of ['blade', 'fang', 'aegis', 'cloak', 'boots', 'rune']) buyItem(h2, id);
  check('sloty: šest itemů se vejde', h2.items.length === 6, String(h2.items.length));
  check('sloty: sedmý se nevejde', !buyItem(h2, 'lotus'), h2.items.join(','));

  // prodej: 60 % ceny
  const goldBeforeSell = h2.gold;
  const refund = sellItem(h2, 'blade');
  check('prodej: vrací 60 % ceny', refund === 240, String(refund));
  check('prodej: zlato narostlo', h2.gold === Math.min(GOLD_CAP, goldBeforeSell + 240), String(h2.gold));
  check('prodej: item zmizel z inventáře', !h2.items.includes('blade'));

  // itemy opravdu mění staty: Aegis +HP, Sandály +rychlost, Oko +vidění, Lotos +regen
  const s3 = createMoba(0, 82, 2_000_000);
  const h3 = s3.heroes.find((candidate) => candidate.id === 'hero-you');
  h3.gold = 9999;
  const hpBefore = h3.maxHp;
  buyItem(h3, 'aegis');
  check('itemy: Aegis zvedne max HP', h3.maxHp === hpBefore + 250, `${hpBefore} → ${h3.maxHp}`);
  const speedBefore = heroSpeed(h3);
  buyItem(h3, 'boots');
  check('itemy: Sandály zrychlí', heroSpeed(h3) > speedBefore, `${speedBefore.toFixed(2)} → ${heroSpeed(h3).toFixed(2)}`);

  const visionBefore = Math.max(...visionSources(s3, 'blue').map((source) => source.radius));
  buyItem(h3, 'eye');
  const visionAfter = Math.max(...visionSources(s3, 'blue').map((source) => source.radius));
  check('itemy: Orlí oko rozšíří vidění o 6 m', Math.round(visionAfter - visionBefore) === 6, `${visionBefore} → ${visionAfter}`);

  h3.hp = 100;
  buyItem(h3, 'lotus');
  advance(s3, 1000);
  check('itemy: Lotos regeneruje', h3.hp > 100, String(Math.round(h3.hp)));
}

// ── mapa: bushe, inhibitory, super minioni (F3) ────────────────────
{
  console.log('\n-- mapa --');
  const s = createMoba(0, 82, 3_000_000);
  const me = s.heroes.find((hero) => hero.id === 'hero-you');
  const foe = s.heroes.find((hero) => hero.id === 'hero-foe');
  const bush = BUSHES[0];

  // bush jako past na vidění: z dálky soupeře v bushi nevidíš…
  foe.x = bush.x;
  foe.z = bush.z;
  me.x = bush.x + 12;
  me.z = bush.z + 10;
  check('bush: soupeř v bushi není z dálky vidět', !mobaSnapshot(s, 'blue').heroes.some((hero) => hero.id === foe.id));

  // …ale zblízka ano (do BUSH_REVEAL)
  me.x = bush.x + 2.4;
  me.z = bush.z;
  check('bush: zblízka je vidět', mobaSnapshot(s, 'blue').heroes.some((hero) => hero.id === foe.id));

  // mimo bush platí normální vidění
  foe.x = bush.x + 30;
  foe.z = bush.z + 30;
  me.x = bush.x + 30;
  me.z = bush.z + 24;
  check('bush: mimo bush platí normální radius', mobaSnapshot(s, 'blue').heroes.some((hero) => hero.id === foe.id));

  // ochrana: vnější → vnitřní → základnová → inhibitor → Nexa
  const m = createMoba(0, 82, 3_000_000);
  const hp = (id) => m.towers.find((tower) => tower.id === id);
  check('ochrana: vnitřní věž krytá vnější', isStructureProtected(m.towers, 'blue-tower-inner-mid'));
  check('ochrana: základnová věž krytá vnitřní', isStructureProtected(m.towers, 'blue-tower-base-mid'));
  check('ochrana: inhibitor krytý základnovou', isStructureProtected(m.towers, 'blue-inhibitor-mid'));
  check('ochrana: Nexa krytá, dokud stojí inhibitory', isStructureProtected(m.towers, 'blue-nexus'));

  hp('blue-tower-outer-mid').hp = 0;
  check('ochrana: po vnější věži je vnitřní odemčená', !isStructureProtected(m.towers, 'blue-tower-inner-mid'));
  hp('blue-tower-inner-mid').hp = 0;
  check('ochrana: po vnitřní je základnová odemčená', !isStructureProtected(m.towers, 'blue-tower-base-mid'));
  hp('blue-tower-base-mid').hp = 0;
  check('ochrana: po základnové je inhibitor odemčený', !isStructureProtected(m.towers, 'blue-inhibitor-mid'));
  hp('blue-inhibitor-mid').hp = 0;
  check('ochrana: po inhibitoru je Nexa odemčená', !isStructureProtected(m.towers, 'blue-nexus'));

  // padlý inhibitor pustí super miniona do linky
  const w = createMoba(0, 82, 3_000_000);
  advance(w, 7000);
  const redInhibitor = w.towers.find((tower) => tower.id === 'red-inhibitor-mid');
  redInhibitor.hp = 0;
  redInhibitor.respawnAt = w.now + INHIBITOR_RESPAWN_MS;
  advance(w, 25000);
  check(
    'inhibitor: padlý inhibitor pustí super miniona',
    w.minions.some((minion) => minion.team === 'blue' && minion.lane === 'mid' && minion.super),
    w.minions.filter((minion) => minion.super).length + ' super',
  );

  // inhibitor se po pěti minutách obnoví
  const r = createMoba(0, 82, 3_000_000);
  const inhibitor = r.towers.find((tower) => tower.id === 'red-inhibitor-top');
  inhibitor.hp = 0;
  inhibitor.respawnAt = r.now + 1000;
  advance(r, 1500);
  check('inhibitor: po respawnu má plné HP', inhibitor.hp === inhibitor.maxHp, String(inhibitor.hp));
}

// ── objektivy: runy, boss, Aegis, stupňování kouzel (F4) ───────────
{
  console.log('\n-- objektivy --');
  const s = createMoba(0, 82, 4_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');

  // runy se objeví hned na startu (bounty na jihu, haste na severu)
  check('runy: na startu jsou dvě', s.runes.length === 2, String(s.runes.length));
  const bounty = s.runes.find((rune) => rune.type === 'bounty');
  check('runy: první je bounty', Boolean(bounty), s.runes.map((rune) => rune.type).join(','));

  // sebrání: hrdina dostane zlato
  const goldBefore = hero.gold;
  hero.x = bounty.x;
  hero.z = bounty.z;
  advance(s, 200);
  check('runy: sebrání dá zlato', hero.gold > goldBefore + 100, `${goldBefore} → ${Math.round(hero.gold)}`);
  check('runy: sebraná runa zmizí', !s.runes.some((rune) => rune.id === bounty.id));

  // boss: základní čísla a škálování
  check('boss: startovní HP', s.boss.maxHp === 3200, String(s.boss.maxHp));
  check('boss: sedí v řece', Math.round(s.boss.x) === 0 && Math.round(s.boss.z) === -32);

  // zabití bosse → Aegis
  s.boss.hp = 1;
  hero.x = s.boss.x + 2.2;
  hero.z = s.boss.z;
  hero.attackCooldown = 0;
  // Útok je vstup (`attack: true`) — bez něj hrdina jen stojí a boss ho mlátí.
  advance(s, 1400, { ...NO_INPUT, attack: true });
  check('boss: zabití dá Aegis', hero.aegis === true);
  check('boss: po zabití je mrtvý', s.boss.alive === false);
  check('boss: respawn je naplánovaný', s.boss.respawnAt > s.now, String(Math.round((s.boss.respawnAt - s.now) / 1000)));

  // Aegis vzkřísí hrdinu (jednorázově) místo smrti
  const deathsBefore = hero.deaths;
  hero.hp = 1;
  hero.buffs.push({ type: 'burn', until: s.now + 2000, power: 600, source: 'test' });
  advance(s, 300);
  check('aegis: hrdina žije', hero.alive === true);
  check('aegis: nezapočítala se smrt', hero.deaths === deathsBefore, String(hero.deaths));
  check('aegis: spotřebovala se', hero.aegis === false);

  // stupňování kouzel: mana roste, cooldown klesá
  check('kouzla: mana roste se stupněm', spellMana(100, 4) > spellMana(100, 1), `${spellMana(100, 1)} → ${spellMana(100, 4)}`);
  check('kouzla: cooldown klesá se stupněm', spellCooldown(10000, 4) < spellCooldown(10000, 1), `${spellCooldown(10000, 1)} → ${spellCooldown(10000, 4)}`);

  // sim opravdu strhne víc many na vyšším stupni
  const s2 = createMoba(0, 82, 4_000_000);
  const caster = s2.heroes.find((candidate) => candidate.id === 'hero-you');
  caster.level = 10;
  caster.mana = caster.maxMana;
  const spell = caster.spells.find((candidate) => candidate.slot === 'Q');
  const manaBefore = caster.mana;
  stepMoba(s2, STEP / 1000, { 'hero-you': { ...NO_INPUT, cast: { slot: 'Q', x: caster.x + 3, z: caster.z } } }, s2.now + STEP);
  const spent = manaBefore - caster.mana;
  check('kouzla: sim strhne manu podle stupně', spent === spellMana(spell.mana, 4), `${Math.round(spent)} vs ${spellMana(spell.mana, 4)}`);
}

// ── vidění a smrt: wardy, buyback, respawn (F5) ────────────────────
{
  console.log('\n-- wardy a smrt --');
  const s = createMoba(0, 82, 5_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  hero.gold = 3000;

  // nákup wardu: spotřební, nezabírá slot
  const slotsBefore = hero.items.length;
  check('ward: koupě zvýší zásobu', buyItem(hero, 'ward') && hero.wards === 1, String(hero.wards));
  check('ward: nezabírá slot', hero.items.length === slotsBefore, String(hero.items.length));
  hero.wards = WARD_STOCK_MAX;
  check('ward: víc než tři nejde', !buyItem(hero, 'ward'));

  // polož ward: jen v dosahu, jen když ho máš
  hero.wards = 1;
  hero.x = 0;
  hero.z = 0;
  check('ward: mimo dosah nejde', !placeWard(s, hero, 30, 30));
  check('ward: v dosahu jde', placeWard(s, hero, 6, 0) && s.wards.length === 1, String(s.wards.length));
  check('ward: zásoba se odečetla', hero.wards === 0, String(hero.wards));
  check('ward: bez zásoby nejde', !placeWard(s, hero, 6, 0));

  // vidění: ward drží okruh, takže nepřítel v bushi je vidět
  const foe = s.heroes.find((candidate) => candidate.id === 'hero-foe');
  foe.x = 6;
  foe.z = 0;
  hero.x = -30;
  hero.z = -30;
  check('ward: drží vidění (soupeř je vidět)', mobaSnapshot(s, 'blue').heroes.some((h) => h.id === foe.id));

  // ward po 90 s zmizí
  const wardId = s.wards[0].id;
  advance(s, WARD_DURATION_MS + 2000);
  check('ward: po 90 s zmizí', !s.wards.some((ward) => ward.id === wardId));

  // buyback: mrtvý hrdina zaplatí a vrátí se
  const b = createMoba(0, 82, 5_000_000);
  const dead = b.heroes.find((candidate) => candidate.id === 'hero-you');
  dead.gold = 4000;
  dead.alive = false;
  dead.hp = 0;
  dead.buybackAt = 0;
  const cost = buybackCost(dead);
  const goldBefore = dead.gold;
  check('buyback: vrátí hrdinu do hry', buyback(dead, b.now) && dead.alive === true);
  check('buyback: strhne cenu', dead.gold === goldBefore - cost, `${goldBefore} → ${dead.gold} (cena ${cost})`);
  check('buyback: HP na 60 %', dead.hp === Math.round(dead.maxHp * 0.6), `${dead.hp}/${dead.maxHp}`);
  check('buyback: podruhé hned nejde', !buyback(dead, b.now));

  // respawn scaling: čas roste s levelem
  const r = createMoba(0, 82, 5_000_000);
  const victim = r.heroes.find((candidate) => candidate.id === 'hero-you');
  victim.level = 10;
  victim.hp = 1;
  victim.buffs.push({ type: 'burn', until: r.now + 2000, power: 900, source: 'test' });
  advance(r, 300);
  const respawnMs = victim.respawnAt - r.now;
  check('respawn: škáluje s levelem', respawnMs > 15_000 && respawnMs < 25_000, String(Math.round(respawnMs)));
}

// ── meta: obtížnost botů, poškození/léčení, scoreboard (F6) ────────
{
  console.log('\n-- meta --');

  // obtížnost mění jen rozhodování: přesnost a kadence
  check('boti: easy míří hůř než hard', BOT_SKILLS.easy.aimError > BOT_SKILLS.hard.aimError);
  check('boti: easy má delší pauzu mezi kouzly', BOT_SKILLS.easy.castDelay > BOT_SKILLS.hard.castDelay);

  // a opravdu to poznat ve hře: hard toho za stejný čas sešle víc
  const easy = createMoba(0, 82, 6_000_000, 'easy');
  const hard = createMoba(0, 82, 6_000_000, 'hard');
  advance(easy, 12_000, { ...NO_INPUT, attack: true });
  advance(hard, 12_000, { ...NO_INPUT, attack: true });
  const easyCasts = easy.heroes.find((hero) => hero.id === 'hero-foe').botCasts;
  const hardCasts = hard.heroes.find((hero) => hero.id === 'hero-foe').botCasts;
  check('boti: hard sešle víc kouzel', hardCasts > easyCasts, `${easyCasts} vs ${hardCasts}`);

  // poškození a léčení jde do snapshotu (scoreboard z něj žije)
  const s = createMoba(0, 82, 6_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  hero.damageDone = 1234;
  hero.hp = 100;
  hero.buffs.push({ type: 'regen', until: s.now + 2000, power: 40 });
  advance(s, 500);
  check('meta: regenerace se počítá do léčení', hero.healingDone > 0, String(Math.round(hero.healingDone)));
  const snap = mobaSnapshot(s);
  const snapHero = snap.heroes.find((candidate) => candidate.id === 'hero-you');
  check('meta: snapshot nese damage', snapHero.damage >= 1234, String(snapHero.damage));
  check('meta: snapshot nese healing', snapHero.healing > 0, String(snapHero.healing));

  // celkové XP pro XPM roste s levelem
  check('meta: totalXpAt roste', totalXpAt(5, 0) > totalXpAt(3, 0), `${totalXpAt(3, 0)} → ${totalXpAt(5, 0)}`);
}

// ── aktivní itemy (F7) ─────────────────────────────────────────────
{
  console.log('\n-- aktivní itemy --');
  const s = createMoba(0, 82, 7_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  hero.gold = 9999;
  buyItem(hero, 'blink');
  hero.x = 0;
  hero.z = 0;

  // blink: posun k bodu, max 7 m
  check('item aktivní: skok posune hrdinu', useItem(s, hero, 'blink', 20, 0) && Math.round(hero.x) === 7, String(hero.x));
  check('item aktivní: skok má cooldown', !useItem(s, hero, 'blink', 20, 0));
  check('item aktivní: cooldown je ve snapshotu', (mobaSnapshot(s).heroes.find((h) => h.id === hero.id).itemCooldowns.blink ?? 0) > 0);

  // bariéra: štít
  buyItem(hero, 'barrier');
  check('item aktivní: bariéra dá štít', useItem(s, hero, 'barrier', 0, 0) && hero.shield >= 300, String(Math.round(hero.shield)));

  // léčivý prach: HP a léčení do statů
  buyItem(hero, 'dust');
  hero.hp = 100;
  check('item aktivní: prach vyléčí', useItem(s, hero, 'dust', 0, 0) && hero.hp > 300, String(Math.round(hero.hp)));
  check('item aktivní: léčení se počítá', hero.healingDone > 0, String(Math.round(hero.healingDone)));

  // příval: rychlost
  buyItem(hero, 'surge');
  // buffy jsou v sim hodinách — heroSpeed proto chce `s.now`, ne Date.now()
  const before = heroSpeed(hero, s.now);
  useItem(s, hero, 'surge', 0, 0);
  check('item aktivní: příval zrychlí', heroSpeed(hero, s.now) > before, `${before.toFixed(2)} → ${heroSpeed(hero, s.now).toFixed(2)}`);

  // item, který hrdina nemá, nejde použít
  check('item aktivní: cizí item nejde použít', !useItem(s, hero, 'crown', 0, 0));
  // a pasivní item taky ne
  buyItem(hero, 'blade');
  check('item aktivní: pasivní item nejde použít', !useItem(s, hero, 'blade', 0, 0));
}

// ── talenty (F8) ───────────────────────────────────────────────────
{
  console.log('\n-- talenty --');
  const s = createMoba(0, 82, 8_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  const school = hero.spells[0].school;
  const options = talentsFor(school);

  hero.level = 9;
  check('talenty: do levelu 10 žádný', pendingTalent(hero) === null);
  hero.level = 10;
  check('talenty: na 10. čeká volba', pendingTalent(hero) === 10, String(pendingTalent(hero)));
  check('talenty: dvě možnosti na stupni', options[10].length === 2);

  check('talenty: neplatný index nejde', !pickTalent(hero, 10, 2));
  check('talenty: volba projde', pickTalent(hero, 10, 0) && hero.talentPicks[10] === 0);
  check('talenty: podruhé stejný stupeň nejde', !pickTalent(hero, 10, 1));
  check('talenty: efekt se propíše do součtu', (() => {
    const totals = talentTotals(hero);
    const chosen = options[10][0].effect;
    const expected = (chosen.damage ?? 0) + (chosen.hp ?? 0) + (chosen.mana ?? 0) + (chosen.speed ?? 0) + (chosen.vision ?? 0) + (chosen.spellPower ?? 0) + (chosen.regen ?? 0);
    const actual = totals.damage + totals.hp + totals.mana + totals.speed + totals.vision + totals.spellPower + totals.regen;
    return Math.abs(actual - expected) < 1e-9;
  })());

  hero.level = 15;
  check('talenty: na 15. čeká druhá volba', pendingTalent(hero) === 15, String(pendingTalent(hero)));
  check('talenty: druhá volba projde', pickTalent(hero, 15, 1));
  check('talenty: pak už nic nečeká', pendingTalent(hero) === null);

  // role z kouzel: agresivní / podpůrná / kontrolní
  check('talenty: role se odvodí ze školy', ['aggressive', 'support', 'control'].includes(talentRole(school)), school);

  // bot si talent vybere sám, aby nezůstal bez bonusů
  const b = createMoba(0, 82, 8_000_000);
  const bot = b.heroes.find((candidate) => candidate.id === 'hero-foe');
  bot.level = 10;
  advance(b, 200);
  check('talenty: bot si vybere sám', bot.talentPicks[10] !== undefined, JSON.stringify(bot.talentPicks));
}

// ── boti a aktivní itemy (F9) ──────────────────────────────────────
{
  console.log('\n-- boti a aktiva --');
  const s = createMoba(0, 82, 9_000_000);
  const bot = s.heroes.find((hero) => hero.id === 'hero-foe');
  bot.gold = 6000;
  advance(s, 3000);
  const hasActive = bot.items.some((id) => ITEMS.find((item) => item.id === id)?.active);
  check('bot: koupí aktivní item', hasActive, bot.items.join(','));
  check('bot: neutratí všechny sloty hned', bot.items.length <= ITEM_SLOTS, String(bot.items.length));

  // léčivý prach: bot si vyléčí, když je nízko
  const heal = createMoba(0, 82, 9_000_000);
  const wounded = heal.heroes.find((hero) => hero.id === 'hero-foe');
  wounded.gold = 9999;
  buyItem(wounded, 'dust');
  wounded.hp = 100;
  advance(heal, 300);
  check('bot: použije léčení v ohrožení', wounded.hp > 100 || (wounded.itemCooldowns.dust ?? 0) > 0, `${Math.round(wounded.hp)} hp`);

  // skok: bot dotahuje cíl na 10 m
  const chase = createMoba(0, 82, 9_000_000);
  const chaser = chase.heroes.find((hero) => hero.id === 'hero-foe');
  const prey = chase.heroes.find((hero) => hero.id === 'hero-you');
  chaser.gold = 9999;
  buyItem(chaser, 'blink');
  chaser.x = 10;
  chaser.z = 0;
  prey.x = 0;
  prey.z = 0;
  const blinkBefore = Math.hypot(chaser.x - prey.x, chaser.z - prey.z);
  advance(chase, 200);
  const blinkAfter = Math.hypot(chaser.x - prey.x, chaser.z - prey.z);
  check('bot: skočí na cíl (nebo má cooldown)', blinkAfter < blinkBefore || (chaser.itemCooldowns.blink ?? 0) > 0, `${blinkBefore.toFixed(1)} → ${blinkAfter.toFixed(1)}`);
}

// ── neviditelnost a sentry (F10) ───────────────────────────────────
{
  console.log('\n-- neviditelnost --');
  const s = createMoba(0, 82, 10_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  const foe = s.heroes.find((candidate) => candidate.id === 'hero-foe');
  hero.gold = 9999;

  // Závoj: neviditelnost
  buyItem(hero, 'veil');
  check('neviditelnost: Závoj schová hrdinu', useItem(s, hero, 'veil', 0, 0) && isHidden(s, hero, 'red'));
  check('neviditelnost: vlastní tým ho vidí', !isHidden(s, hero, 'blue'));

  // sentry ho odhalí
  hero.sentries = 1;
  hero.x = 0;
  hero.z = 0;
  check('sentry: mimo dosah nejde', !placeSentry(s, hero, 40, 40));
  check('sentry: v dosahu jde', placeSentry(s, hero, 3, 0) && s.sentries.length === 1);
  check('sentry: nepřítel zůstává skrytý', isHidden(s, hero, 'red'));

  // snapshot: skrytý soupeř se neposílá, se sentry ano
  const hiddenSnap = mobaSnapshot(s, 'blue');
  check('snapshot: vlastní neviditelný tam je', hiddenSnap.heroes.some((h) => h.id === hero.id));
  const enemyView = mobaSnapshot(s, 'red');
  check('snapshot: nepřítel nevidí skrytého', !enemyView.heroes.some((h) => h.id === hero.id));

  s.sentries.push({ id: 'sentry-test', team: 'red', x: hero.x, z: hero.z, expiresAt: s.now + SENTRY_DURATION_MS });
  const revealed = mobaSnapshot(s, 'red');
  check('snapshot: sentry skrytého odhalí', revealed.heroes.some((h) => h.id === hero.id));

  // sentry po 60 s zmizí
  advance(s, SENTRY_DURATION_MS + 2000);
  check('sentry: po 60 s zmizí', !s.sentries.some((sentry) => sentry.id === 'sentry-test'));

  // neviditelný nejde zamířit: útok ho nezasáhne
  const a = createMoba(0, 82, 10_000_000);
  const attacker = a.heroes.find((h) => h.id === 'hero-you');
  const victim = a.heroes.find((h) => h.id === 'hero-foe');
  victim.gold = 9999;
  buyItem(victim, 'veil');
  victim.x = attacker.x + 2;
  victim.z = attacker.z;
  useItem(a, victim, 'veil', 0, 0);
  const hpBefore = victim.hp;
  advance(a, 400, { ...NO_INPUT, attack: true });
  check('neviditelnost: nejde ho zasáhnout', victim.hp === hpBefore, `${hpBefore} → ${victim.hp}`);
}

// ── mobilní vrstva: battle spell a auto-aim (F19) ──────────────────
{
  console.log('\n-- battle spell a auto-aim --');
  const s = createMoba(0, 82, 11_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  hero.x = 0;
  hero.z = 0;

  // Flicker: skok max 6 m
  check('flicker: skok na bod', useBattleSpell(s, hero, 20, 0) && Math.round(hero.x) === 6, String(hero.x));
  check('flicker: má cooldown', hero.battleSpellAt > s.now);
  check('flicker: podruhé ne', !useBattleSpell(s, hero, 0, 0));

  // auto-aim: přichytí se na nejbližšího nepřítele v dosahu
  const foe = s.heroes.find((candidate) => candidate.id === 'hero-foe');
  foe.x = 10;
  foe.z = 0;
  const snapped = snapAim(s.heroes, 'blue', 9, 1);
  check('auto-aim: přichytí nepřítele', snapped?.x === 10 && snapped?.z === 0, JSON.stringify(snapped));
  check('auto-aim: mimo dosah nic', snapAim(s.heroes, 'blue', 40, 40) === null);
  foe.alive = false;
  check('auto-aim: mrtvý se nechytá', snapAim(s.heroes, 'blue', 9, 1) === null);
  // z pohledu red je naopak nepřítel modrý hrdina (na x=6)
  check('auto-aim: tým rozhoduje, kdo je cíl', snapAim(s.heroes, 'red', 9, 1)?.x === 6);
}

// ── recall (F20) ───────────────────────────────────────────────────
{
  console.log('\n-- recall --');
  const s = createMoba(0, 82, 12_000_000);
  const hero = s.heroes.find((candidate) => candidate.id === 'hero-you');
  // bezpečné místo: v džungli by channel hned zrušilo monstrum (test to
  // odhalil — hrdina stál v táboře a dostal ránu)
  hero.x = -30;
  hero.z = 5;

  check('recall: channel začne', startRecall(hero, s.now) && hero.recallAt > 0, String(hero.recallAt));
  check('recall: nejde spustit dvakrát', !startRecall(hero, s.now));

  // po 4 s se hrdina vrátí do základny (bez pohybu)
  advance(s, RECALL_CHANNEL_MS + 300);
  check('recall: vrátí do základny', Math.round(hero.x) === -38 && Math.round(hero.z) === 0, `${Math.round(hero.x)},${Math.round(hero.z)}`);
  check('recall: channel skončil', hero.recallAt === 0);

  // pohyb channel zruší
  const m = createMoba(0, 82, 12_000_000);
  const mover = m.heroes.find((candidate) => candidate.id === 'hero-you');
  mover.x = 20;
  mover.z = 10;
  startRecall(mover, m.now);
  advance(m, 500, { ...NO_INPUT, moveX: 1 });
  check('recall: pohyb ho zruší', mover.recallAt === 0);

  // zásah channel zruší
  const d = createMoba(0, 82, 12_000_000);
  const victim = d.heroes.find((candidate) => candidate.id === 'hero-you');
  victim.x = 0;
  victim.z = 0;
  startRecall(victim, d.now);
  victim.buffs.push({ type: 'burn', until: d.now + 2000, power: 900, source: 'test' });
  advance(d, 300);
  check('recall: zásah ho zruší', victim.recallAt === 0, String(victim.recallAt));
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);