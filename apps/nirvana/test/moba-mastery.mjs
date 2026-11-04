/**
 * Test mistrovství hrdiny a bounty za sérii — bez prohlížeče.
 *
 * Dvě nové vrstvy MOBY:
 *  1. **mistrovství** (dlouhodobé, kosmetické) — XP ze zápasu, tituly,
 *     hrdina dne; nikdy neposiluje hru,
 *  2. **bounty** — odměna za zabití roste sérií oběti, takže „nakrmený"
 *     hrdina je cenný cíl a soupeř má cestu zpět.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/moba-mastery.mjs
 */

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

const {
  EMPTY_MASTERY,
  HERO_OF_DAY_BONUS,
  MASTERY_TITLES,
  heroOfDay,
  loadMastery,
  matchXp,
  masteryFor,
  masteryLevel,
  recordMastery,
  xpToNext,
} = await import('../src/core/moba/mastery.ts');
const { bountyFor, HERO_BOUNTY, BOUNTY_PER_STREAK, BOUNTY_MAX_STREAK, createMoba, mobaSnapshot } = await import(
  '../src/core/moba/sim.ts'
);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) úrovně a tituly ───────────────────────────────────────────────
check('0 XP = level 1', masteryLevel(0).level === 1);
check('level 1 má titul', masteryLevel(0).title.cs.length > 0, masteryLevel(0).title.cs);
check('XP na další roste', xpToNext(1) < xpToNext(2) && xpToNext(2) < xpToNext(3));
check(
  'úroveň nikdy neklesá',
  [...Array(60).keys()].every((step) => masteryLevel(step * 100).level <= masteryLevel((step + 1) * 100).level),
);
check('strop je 9 a víc ne', masteryLevel(1e9).level === 9, String(masteryLevel(1e9).level));
check('titulů je devět', MASTERY_TITLES.length === 9, String(MASTERY_TITLES.length));
check('přesně na hranici se level zvedne', masteryLevel(xpToNext(1)).level === 2, String(masteryLevel(xpToNext(1)).level));
check('těsně pod hranicí zůstane', masteryLevel(xpToNext(1) - 1).level === 1);

// ── 2) XP ze zápasu ──────────────────────────────────────────────────
const base = { won: false, kills: 0, deaths: 0, damage: 0, mvp: false, versusBots: false };
const win = matchXp({ ...base, won: true });
const lose = matchXp(base);
check('výhra dá víc než prohra', win > lose, `${win} vs ${lose}`);
const kills = matchXp({ ...base, kills: 5 });
check('zabití přidají XP', kills > lose, `${kills} vs ${lose}`);
const dmg = matchXp({ ...base, damage: 2000 });
check('poškození přidá XP', dmg > lose, `${dmg} vs ${lose}`);
const mvp = matchXp({ ...base, mvp: true });
check('MVP přidá XP', mvp > lose, `${mvp} vs ${lose}`);

const bots = matchXp({ ...base, won: true, versusBots: true });
check('sólo proti botům je za polovinu', bots === Math.round(win * 0.5), `${bots} vs ${win}`);
const bonus = matchXp({ ...base, won: true, bonus: HERO_OF_DAY_BONUS });
check('hrdina dne přidá 50 %', bonus === Math.round(win * 1.5), `${bonus} vs ${win}`);
check('XP má spodní hranici', matchXp({ ...base, versusBots: true }) >= 5);

// ── 3) zápis a persistence ───────────────────────────────────────────
store.clear();
const gain = recordMastery(0, { ...base, won: true, kills: 4, damage: 3200, mvp: true });
check('zápis vrátí XP', gain.xp > 0, String(gain.xp));
check('zápis uloží do profilu', masteryFor(0).matches === 1, JSON.stringify(masteryFor(0)));
check('prohra se počítá zvlášť', (() => {
  recordMastery(0, { ...base, won: false });
  return masteryFor(0).wins === 1 && masteryFor(0).matches === 2;
})(), JSON.stringify(masteryFor(0)));

const fresh = masteryFor(999);
check('neznámá postava má prázdný záznam', fresh.matches === 0 && fresh.xp === 0, JSON.stringify(fresh));
check('EMPTY_MASTERY je konstanta', EMPTY_MASTERY.xp === 0);

// level up
store.clear();
const first = recordMastery(7, { ...base, won: true, kills: 5, damage: 3000, mvp: true });
check('první zápas nezvedne level (málo XP)', first.after.level === 1, String(first.after.level));
let levelUps = 0;
for (let i = 0; i < 12; i += 1) {
  const step = recordMastery(7, { ...base, won: true, kills: 5, damage: 3000, mvp: true });
  if (step.leveledUp) levelUps += 1;
}
check('po sérii zápasů level roste', levelUps > 0, `levelUp=${levelUps}`);
check('záznam drží počet zápasů', masteryFor(7).matches === 13, String(masteryFor(7).matches));

// poškozený záznam nesmí shodit hru
store.set('nirvana.mastery.v1', 'tohle není json');
check('poškozený profil = prázdno', Object.keys(loadMastery()).length === 0);

// ── 4) hrdina dne ────────────────────────────────────────────────────
const pool = [0, 1, 2, 3, 82, 85];
const day = new Date(2026, 10, 4);
check('hrdina dne je z poolu', pool.includes(heroOfDay(pool, day) ?? -1), String(heroOfDay(pool, day)));
check('stejný den = stejná postava', heroOfDay(pool, day) === heroOfDay(pool, new Date(2026, 10, 4, 21, 30)));
check('jiný den se může změnit', (() => {
  const values = new Set();
  for (let d = 1; d <= 12; d += 1) values.add(heroOfDay(pool, new Date(2026, 10, d)));
  return values.size > 1;
})());
check('prázdný pool = null', heroOfDay([], day) === null);

// ── 5) bounty za sérii ───────────────────────────────────────────────
check('bounty bez série = základ', bountyFor(0) === HERO_BOUNTY, String(bountyFor(0)));
check('bounty roste se sérií', bountyFor(1) === HERO_BOUNTY + BOUNTY_PER_STREAK, String(bountyFor(1)));
check('bounty má strop', bountyFor(99) === HERO_BOUNTY + BOUNTY_MAX_STREAK * BOUNTY_PER_STREAK, String(bountyFor(99)));
check('záporná série = základ', bountyFor(-3) === HERO_BOUNTY);

// ── 6) sim: hrdina startuje bez série a snapshot ji nese ─────────────
const state = createMoba(0, 82, 0);
check('hrdinové startují se sérií 0', state.heroes.every((hero) => hero.streak === 0));
const snapshot = mobaSnapshot(state);
check('snapshot nese streak', snapshot.heroes.every((hero) => typeof hero.streak === 'number'));
check('snapshot má streak 0 na startu', snapshot.heroes.every((hero) => hero.streak === 0));

console.log('');
if (failures > 0) {
  console.log(`MOBA MASTERY FAILED (${failures})`);
  process.exit(1);
}
console.log('MOBA MASTERY OK');
