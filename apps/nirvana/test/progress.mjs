/**
 * Test společné progrese — žetony, rekordy, výzva a level bez prohlížeče.
 *
 * Ověřuje pravidla, která se v UI snadno „ztratí": že rekord přidá žetony
 * jen jednou, že výzva jde splnit jen jednou denně a že level roste z počtu
 * dohraných her (ne z žetonů, které se utrácejí).
 *
 * Spuštění: cd apps/nirvana && npx tsx test/progress.mjs
 */

const store = new Map();
const posts = [];

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};
globalThis.fetch = async (url, init) => {
  posts.push({ url, body: JSON.parse(init?.body ?? '{}') });
  return { ok: true, json: async () => ({ ok: true }) };
};

const { levelFor, levelProgress, recordRun, runsForLevel } = await import('../src/core/progress/run.ts');
const { dailyChallenge } = await import('../src/core/park/challenge.ts');
const { loadProfile } = await import('../src/core/park/profile.ts');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  OK   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── levelová křivka ───────────────────────────────────────────────────
check('0 her = level 1', levelFor(0) === 1);
check('2 hry = level 2', levelFor(2) === 2);
check('8 her = level 3', levelFor(8) === 3);
check('18 her = level 4', levelFor(18) === 4);
check('level nikdy neklesá', [...Array(200).keys()].every((runs) => levelFor(runs) <= levelFor(runs + 1)));
check('runsForLevel je inverzní', [1, 2, 3, 4, 5].every((level) => levelFor(runsForLevel(level)) === level));
check('level 1 začíná na nule her', runsForLevel(1) === 0);

const progress = levelProgress(3);
check('levelProgress(3) je mezi 2 a 3', progress.level === 2 && progress.ratio > 0 && progress.ratio < 1);

// ── první dohraná hra ────────────────────────────────────────────────
store.clear();
const first = recordRun({ game: 'arena', score: 120, nickname: 'tester' });
check('rekord přidá 3 žetony (1 hra + 2 rekord)', first.tokensGained === 3, `tokens=${first.tokensGained}`);
check('rekord se pozná', first.personalBest === true);
check('profil má 1 dohranou hru', first.profile.runs === 1, `runs=${first.profile.runs}`);
check('rekord se uložil', first.profile.best.arena === 120, `best=${first.profile.best.arena}`);
check('skóre se poslalo na tabuli', posts.length === 1 && posts[0].body.game === 'arena', JSON.stringify(posts[0] ?? {}));

// ── druhá hra se stejným / nižším skóre ──────────────────────────────
const second = recordRun({ game: 'arena', score: 90, nickname: 'tester' });
check('horší hra = 1 žeton', second.tokensGained === 1, `tokens=${second.tokensGained}`);
check('horší hra není rekord', second.personalBest === false);
check('rekord zůstal', second.profile.best.arena === 120, `best=${second.profile.best.arena}`);

// ── nehodnocený běh ──────────────────────────────────────────────────
const casual = recordRun({ game: 'arena', score: 999, nickname: 'tester', ranked: false });
check('nehodnocený běh nic nemění', casual.tokensGained === 0 && casual.profile.runs === second.profile.runs);
check('nehodnocený běh neposílá skóre', posts.every((post) => post.body.score !== 999));

// ── denní výzva ──────────────────────────────────────────────────────
const challenge = dailyChallenge();
const before = loadProfile();
const run = recordRun({ game: challenge.game, score: challenge.target, nickname: 'tester' });
check('splněná výzva dá žetony navíc', run.challengeClaimed === true, `claimed=${run.challengeClaimed}`);
check('výzva zvýší počet vstupenek', run.profile.tickets === before.tickets + 1, `tickets=${run.profile.tickets}`);
const again = recordRun({ game: challenge.game, score: challenge.target, nickname: 'tester' });
check('výzva nejde splnit dvakrát denně', again.challengeClaimed === false);

// ── level up ─────────────────────────────────────────────────────────
store.clear();
store.set('nirvana.park.v1', JSON.stringify({ tokens: 0, best: {}, runs: 1, tickets: 0, day: new Date().toISOString().slice(0, 10) }));
const levelUp = recordRun({ game: 'pong', score: 10, nickname: 'tester' });
check('druhá hra odemkne level 2', levelUp.level === 2 && levelUp.levelUp === true, `level=${levelUp.level}`);

// ── odeslání na tabuli nese přezdívku ─────────────────────────────────
const last = posts[posts.length - 1];
check('tabulе dostane přezdívku', last?.body.name === 'tester', JSON.stringify(last ?? {}));

console.log('');
if (failures > 0) {
  console.log(`PROGRESS FAILED (${failures})`);
  process.exit(1);
}
console.log('PROGRESS OK');
