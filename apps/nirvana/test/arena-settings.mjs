/**
 * Test nastavení arény (2026-11-11) — bez prohlížeče.
 *
 * Dva reálné bugy, které to hlídá:
 *  1. **Obtížnost se nesmí cachovat v modulu.** Menu a stránka hry jsou
 *     v jiných chunkech a Next je umí vyhodnotit jako dvě modulové
 *     instance; cache v jedné pak druhá nevidí (menu nastavilo nightmare,
 *     hra nastoupila s normal).
 *  2. **Citlivost pohledu se musí propagovat událostí.** Změna v menu
 *     musí dorazit do `ArenaTouch`, i když je to jiná instance modulu.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/arena-settings.mjs
 */

// Minimální `window` ještě před importem modulu — settings.ts je klientský.
const store = new Map();
const listeners = new Map();
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  },
  addEventListener: (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  dispatchEvent: (event) => {
    for (const fn of listeners.get(event.type) ?? []) fn(event);
    return true;
  },
};

const {
  BOT_SKILL_ORDER,
  getBotSkill,
  setBotSkill,
  getLookSensitivity,
  setLookSensitivity,
  LOOK_DEFAULT,
  LOOK_MIN,
  LOOK_MAX,
} = await import('../src/core/arena/settings.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) obtížnost ─────────────────────────────────────────────────────
check('výchozí obtížnost je normal', getBotSkill() === 'normal', getBotSkill());
check('čtyři obtížnosti v pořadí', BOT_SKILL_ORDER.join(',') === 'easy,normal,hard,nightmare');
check('setBotSkill uloží nightmare', setBotSkill('nightmare') === 'nightmare');
check('getBotSkill ho hned vidí', getBotSkill() === 'nightmare', getBotSkill());
check('hodnota je v localStorage', store.get('nirvana.arena.skill') === 'nightmare', store.get('nirvana.arena.skill'));

// Klíčový test proti cache: změna mimo setter musí být vidět.
store.set('nirvana.arena.skill', 'easy');
check('getBotSkill čte vždy z úložiště (žádná cache)', getBotSkill() === 'easy', getBotSkill());
store.set('nirvana.arena.skill', 'nesmysl');
check('neznámá hodnota spadne na normal', getBotSkill() === 'normal', getBotSkill());

// ── 2) citlivost pohledu ────────────────────────────────────────────
check('výchozí citlivost', getLookSensitivity() === LOOK_DEFAULT, String(getLookSensitivity()));
check('setLookSensitivity vrátí hodnotu', setLookSensitivity(1.7) === 1.7);
check('getLookSensitivity ji vidí', getLookSensitivity() === 1.7, String(getLookSensitivity()));
check('clamp pod minimum', setLookSensitivity(0) === LOOK_MIN, String(setLookSensitivity(0)));
check('clamp nad maximum', setLookSensitivity(99) === LOOK_MAX, String(setLookSensitivity(99)));
check('hodnota je v localStorage', store.get('nirvana.arena.look') === String(LOOK_MAX), store.get('nirvana.arena.look'));

// Událost musí aktualizovat cache i v „druhé instanci" (tady simulujeme
// posluchače zaregistrované ensureListenerem).
const before = getLookSensitivity();
window.dispatchEvent(new CustomEvent('nirvana:arena-look', { detail: 0.9 }));
check(
  'událost propíše citlivost do druhé instance',
  getLookSensitivity() === 0.9 && before !== 0.9,
  `${before} → ${getLookSensitivity()}`,
);

console.log('');
if (failures > 0) {
  console.log(`ARENA SETTINGS FAILED (${failures})`);
  process.exit(1);
}
console.log('ARENA SETTINGS OK');
