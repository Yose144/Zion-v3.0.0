/**
 * Test vnějších planet — datová část, bez prohlížeče.
 *
 * Ověřuje, že Uran, Neptun i Pluto jsou **skutečné cíle**:
 *  1. každý má dosier se šesti čísly a textem v obou jazycích,
 *  2. každý je v katalogu planet označený jako vstup (`game` + `cta`),
 *  3. `createDefaultLinkTargets()` je zaregistruje jako letové cíle
 *     (jinak by klik nic nedělal a planeta by zůstala mrtvá koule),
 *  4. řetěz „dál" vede uranus → neptune → pluto → konec.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/outer-worlds.mjs
 */

const { OUTER_WORLDS, OUTER_ORDER } = await import('../src/core/outer/worlds.ts');
const { PLANETS } = await import('../src/core/scene/universe/planetCatalog.ts');
const { createDefaultLinkTargets } = await import('../src/core/scene/universe/LinkEngine.ts');
const THREE = await import('three');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  OK   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

check('tři vnější světy', OUTER_ORDER.length === 3, `světů=${OUTER_ORDER.length}`);

for (const id of OUTER_ORDER) {
  const world = OUTER_WORLDS[id];
  check(`${id}: má jméno a epiteton v cs+en`, Boolean(world.name && world.epithet.cs && world.epithet.en));
  check(`${id}: dosier má 6 čísel`, world.facts.length === 6, `faktů=${world.facts.length}`);
  check(
    `${id}: každé číslo má cs+en`,
    world.facts.every((fact) => fact.label.cs && fact.label.en && fact.value.cs && fact.value.en),
  );
  check(`${id}: text je v obou jazycích`, world.lore.cs.length > 40 && world.lore.en.length > 40);
  check(`${id}: má texturu nebo procedural`, world.texture !== undefined);
}

check(
  'řetěz vede Uranus → Neptune → Pluto → konec',
  OUTER_WORLDS.uranus.next === 'neptune' &&
    OUTER_WORLDS.neptune.next === 'pluto' &&
    OUTER_WORLDS.pluto.next === null,
);

// ── katalog planet ────────────────────────────────────────────────────
for (const id of OUTER_ORDER) {
  const planet = PLANETS.find((entry) => entry.id === id);
  check(`${id}: je v katalogu planet`, Boolean(planet));
  check(`${id}: je označen jako vstup (game)`, planet?.game === id, `game=${planet?.game}`);
  check(`${id}: má CTA v obou jazycích`, Boolean(planet?.cta?.cs && planet?.cta?.en));
}

check(
  'Pluto je procedurální (v repu není textura)',
  PLANETS.find((entry) => entry.id === 'pluto')?.procedural === true,
);

// ── registrace do navigace ────────────────────────────────────────────
const targets = createDefaultLinkTargets();
const ids = new Set(targets.map((target) => target.id));
for (const id of OUTER_ORDER) {
  check(`${id}: jde na něj doletět`, ids.has(id), [...ids].join(', '));
}
const outerTarget = targets.find((target) => target.id === 'uranus');
check('Uran je zaregistrovaný jako planeta', outerTarget?.kind === 'planet', `kind=${outerTarget?.kind}`);
const anchor = outerTarget?.anchor?.({
  clock: { elapsedTime: 12 },
  reducedMotion: false,
  earthPos: new THREE.Vector3(),
});
check(
  'Uran má konečný anchor (žádné NaN)',
  Boolean(anchor) && Number.isFinite(anchor.x) && Number.isFinite(anchor.y) && Number.isFinite(anchor.z),
  JSON.stringify(anchor ?? null),
);

console.log('');
if (failures > 0) {
  console.log(`OUTER WORLDS FAILED (${failures})`);
  process.exit(1);
}
console.log('OUTER WORLDS OK');
