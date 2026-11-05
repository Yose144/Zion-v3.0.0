/**
 * Test deníku Lumi — bez prohlížeče.
 *
 * Deník je jediná trvalá stopa příběhu: světlo, které hráč sebere, zůstane
 * čitelné i po zavření hry. Test hlídá:
 *  1. prázdný stav a poškozený záznam (nesmí shodit hru),
 *  2. slití světel z více cest (bez duplicit, seřazené),
 *  3. počítadla cest a voleb (nechat / darovat),
 *  4. `missingInJournal` pro „do plného deníku zbývá".
 *
 * Spuštění: cd apps/nirvana && npx tsx test/lumi-journal.mjs
 */

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

const { EMPTY_JOURNAL, isPathUnlocked, loadJournal, missingInJournal, recordJourney } = await import(
  '../src/core/lumi/journal.ts'
);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) prázdný stav ──────────────────────────────────────────────────
store.clear();
const empty = loadJournal();
check('prázdný deník nemá světla', empty.found.length === 0 && empty.runs === 0);
check('prázdný deník má nulové dary', empty.gifts.keep === 0 && empty.gifts.give === 0);
check('EMPTY_JOURNAL je konstanta', EMPTY_JOURNAL.found.length === 0);

// ── 2) první cesta ───────────────────────────────────────────────────
const first = recordJourney([1, 2, 3], 'give');
check('zapisují se sebraná světla', first.found.join(',') === '1,2,3', first.found.join(','));
check('počet cest roste', first.runs === 1, String(first.runs));
check('darování se počítá', first.gifts.give === 1 && first.gifts.keep === 0, JSON.stringify(first.gifts));

// ── 3) druhá cesta: slití bez duplicit ───────────────────────────────
const second = recordJourney([3, 4, 5], 'keep');
check('světla se slévají', second.found.join(',') === '1,2,3,4,5', second.found.join(','));
check('duplicity se nepočítají', second.found.filter((id) => id === 3).length === 1);
check('světla jsou seřazená', second.found.every((id, index) => index === 0 || second.found[index - 1] < id));
check('druhá cesta se počítá', second.runs === 2, String(second.runs));
check('nechání se počítá', second.gifts.keep === 1 && second.gifts.give === 1, JSON.stringify(second.gifts));

// ── 4) plný deník ────────────────────────────────────────────────────
const full = recordJourney([1, 2, 3, 4, 5, 6, 7], 'give');
check('plný deník má sedm světel', full.found.length === 7, String(full.found.length));
check('do plného deníku nic nezbývá', missingInJournal(full) === 0, String(missingInJournal(full)));
check('chybí tři při čtyřech světlech', missingInJournal({ ...full, found: [1, 2, 3, 4] }) === 3);

// ── 5) neplatné hodnoty se zahazují ──────────────────────────────────
const messy = recordJourney([0, 8, -1, 2, 2, Number.NaN], 'keep');
check('neplatná id se nezapisují', messy.found.every((id) => id >= 1 && id <= 7), messy.found.join(','));
check('id 2 zůstalo', messy.found.includes(2), messy.found.join(','));
check('id mimo rozsah nejsou', !messy.found.includes(8) && !messy.found.includes(0));

// ── 6) poškozený záznam ──────────────────────────────────────────────
store.set('nirvana.lumi.v1', 'tohle není json');
check('poškozený deník = prázdný', loadJournal().found.length === 0);

store.set('nirvana.lumi.v1', JSON.stringify({ found: 'ahoj', runs: -5, gifts: { keep: 'x' } }));
const repaired = loadJournal();
check('nesmyslná pole se opraví', repaired.found.length === 0 && repaired.runs === 0 && repaired.gifts.keep === 0, JSON.stringify(repaired));

// ── 7) odemykání třetí cesty ─────────────────────────────────────────
const { LUMI_PATHS, pathData } = await import('../src/core/lumi/world.ts');

check('třetí cesta existuje', Boolean(LUMI_PATHS.light), Object.keys(LUMI_PATHS).join(','));
check('třetí cesta má sedm světel', pathData('light').lights.length === 7, String(pathData('light').lights.length));
check(
  'světla třetí cesty stoupají spirálou',
  pathData('light').lights.every((light, index, all) => index === 0 || light.y > all[index - 1].y),
);
check(
  'všechna světla třetí cesty jsou v mapě',
  pathData('light').lights.every((light) => light.x > 2 && light.x < 98 && light.y > 2 && light.y < 98),
);

store.clear();
const fresh = loadJournal();
check('calm je odemčená hned', isPathUnlocked('calm', fresh));
check('wind je odemčená hned', isPathUnlocked('wind', fresh));
check('light je na startu zamčená', !isPathUnlocked('light', fresh));

const afterCalm = recordJourney([1, 2, 3, 4, 5, 6, 7], 'give', 'calm');
check('po calm je light pořád zamčená', !isPathUnlocked('light', afterCalm), afterCalm.paths.join(','));
const afterWind = recordJourney([1, 2, 3, 4, 5, 6, 7], 'keep', 'wind');
check('deník zná obě cesty', afterWind.paths.includes('calm') && afterWind.paths.includes('wind'), afterWind.paths.join(','));
check('po obou cestách je light odemčená', isPathUnlocked('light', afterWind));

const repeated = recordJourney([1], 'keep', 'calm');
check('cesta se v deníku nezdvojí', repeated.paths.filter((id) => id === 'calm').length === 1, repeated.paths.join(','));

console.log('');
if (failures > 0) {
  console.log(`LUMI JOURNAL FAILED (${failures})`);
  process.exit(1);
}
console.log('LUMI JOURNAL OK');
