/**
 * Test aspektů kouzel — bez prohlížeče.
 *
 * Aspekt je **volba před zápasem**: stejná škola, dva způsoby hraní.
 * Test proto hlídá tři věci, na kterých to stojí:
 *  1. obě varianty existují pro **každou** školu a mají jiné jméno,
 *  2. je to obchod, ne buff — ostrá varianta bere obranu, ochranná bere
 *     poškození (kdyby jedna byla lepší, výběr by nebyl volba),
 *  3. sim volbu opravdu použije (hrdinova kouzla i `hero.aspect`),
 *     a boti dostanou variantu deterministicky, aby se hráč setkal s oběma.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/moba-aspects.mjs
 */

const { SPELL_SCHOOLS, aspectsFor, schoolOfAvatar, spellsForAvatar } = await import(
  '../src/core/moba/spells.ts'
);
const { createMoba, createMobaMatch } = await import('../src/core/moba/sim.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const SCHOOLS = [
  'ward',
  'fire',
  'arrow',
  'blade',
  'cosmic',
  'mind',
  'nature',
  'storm',
  'song',
  'shadow',
  'beast',
];

// ── 1) každá škola má dvě pojmenované varianty ───────────────────────
let named = 0;
let distinct = 0;
for (const school of SCHOOLS) {
  const [a, b] = aspectsFor(school);
  if (a.name.cs && a.name.en && b.name.cs && b.name.en) named += 1;
  if (a.name.cs !== b.name.cs) distinct += 1;
}
check('všech 11 škol má pojmenované aspekty', named === 11, `${named}/11`);
check('varianty se jmenují jinak', distinct === 11, `${distinct}/11`);
check('seznam škol sedí s implementací', SPELL_SCHOOLS.length === SCHOOLS.length && SPELL_SCHOOLS.every((s) => SCHOOLS.includes(s)));

// ── 2) obchod, ne buff ──────────────────────────────────────────────
const [sharp, guard] = aspectsFor('fire');
check('ostrá varianta přidává poškození', sharp.damage > 1, String(sharp.damage));
check('ochranná varianta ubírá poškození', guard.damage < 1, String(guard.damage));
check('ostrá ubírá štít', sharp.shield < 1, String(sharp.shield));
check('ochranná přidává štít', guard.shield > 1, String(guard.shield));
check('ostrá ubírá léčení', sharp.heal < 1, String(sharp.heal));
check('ochranná přidává léčení', guard.heal > 1, String(guard.heal));
check('ostrá je o něco rychlejší', sharp.cooldown < guard.cooldown, `${sharp.cooldown} / ${guard.cooldown}`);
check(
  'poškození × obrana se nevyrovná (žádná varianta není zdarma)',
  sharp.damage * guard.shield > 0 && sharp.shield * guard.damage < 1,
  `sharp.dmg=${sharp.damage} guard.shield=${guard.shield}`,
);

// ── 3) kouzla se opravdu liší ───────────────────────────────────────
const sharpQ = spellsForAvatar(0, 'a').find((spell) => spell.slot === 'Q');
const guardQ = spellsForAvatar(0, 'b').find((spell) => spell.slot === 'Q');
check('Q: ostrá varianta má větší poškození', sharpQ.damage > guardQ.damage, `${sharpQ.damage} / ${guardQ.damage}`);
check('Q: ostrá varianta má menší rádius', sharpQ.radius < guardQ.radius, `${sharpQ.radius} / ${guardQ.radius}`);
check('Q: cooldown se liší', sharpQ.cooldownMs !== guardQ.cooldownMs, `${sharpQ.cooldownMs} / ${guardQ.cooldownMs}`);

const sharpW = spellsForAvatar(0, 'a').find((spell) => spell.slot === 'W');
const guardW = spellsForAvatar(0, 'b').find((spell) => spell.slot === 'W');
check('W: ochranná varianta má víc štítu', guardW.shield > sharpW.shield, `${guardW.shield} / ${sharpW.shield}`);

// determinismus
const again = spellsForAvatar(0, 'b');
check(
  'stejná postava + stejný aspekt = stejná kouzla',
  JSON.stringify(again) === JSON.stringify(spellsForAvatar(0, 'b')),
);
check('jméno kouzla se aspektem nemění', sharpQ.name === guardQ.name);

// ── 4) sim volbu použije ────────────────────────────────────────────
const solo = createMoba(0, 82, 0, 'normal', 'flicker', 'b');
check('sólo: hrdina má aspekt b', solo.heroes[0].aspect === 'b', solo.heroes[0].aspect);
check(
  'sólo: kouzla odpovídají aspektu',
  JSON.stringify(solo.heroes[0].spells) === JSON.stringify(spellsForAvatar(0, 'b')),
);
check('sólo: soupeř (bot) má také aspekt', solo.heroes[1].aspect === 'a' || solo.heroes[1].aspect === 'b');

const match = createMobaMatch(
  [
    { id: 'a', heroId: 0, team: 'blue', human: true, aspect: 'a' },
    { id: 'b', heroId: 1, team: 'red', human: true, aspect: 'b' },
    { id: 'c', heroId: 2, team: 'blue', human: false },
  ],
  0,
);
const byId = new Map(match.heroes.map((hero) => [hero.id, hero]));
check('místnost: hráč 1 má aspekt a', byId.get('a')?.aspect === 'a', byId.get('a')?.aspect);
check('místnost: hráč 2 má aspekt b', byId.get('b')?.aspect === 'b', byId.get('b')?.aspect);
check(
  'bot má aspekt podle id (sudé a, liché b)',
  byId.get('c')?.aspect === 'a',
  `${byId.get('c')?.aspect} (heroId 2)`,
);

// škola se čte i bez stavby kouzel (pick screen ji potřebuje dřív)
check('schoolOfAvatar vrací školu', SCHOOLS.includes(schoolOfAvatar(0)), String(schoolOfAvatar(0)));

console.log('');
if (failures > 0) {
  console.log(`MOBA ASPECTS FAILED (${failures})`);
  process.exit(1);
}
console.log('MOBA ASPECTS OK');
