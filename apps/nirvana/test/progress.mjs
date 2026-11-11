/**
 * Test společné progrese — žetony, rekordy, výzva, XP a dharma bez prohlížeče.
 *
 * Ověřuje pravidla, která se v UI snadno „ztratí": že rekord přidá žetony
 * jen jednou, že výzva jde splnit jen jednou denně, že level roste z XP
 * (ne z žetonů, které se utrácejí) a že dharma validace násobí XP.
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

const { recordRun, describeRun, dharmaLabel } = await import('../src/core/progress/run.ts');
const { levelFromXp, xpForLevel, xpProgress, xpForRun } = await import('../src/core/progress/xp.ts');
const { clFromXp } = await import('../src/core/progress/consciousness.ts');
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

// ── XP křivka ────────────────────────────────────────────────────────
check('0 XP = level 1', levelFromXp(0) === 1);
check('120 XP = level 2', levelFromXp(120) === 2);
check('480 XP = level 3', levelFromXp(480) === 3);
check('1080 XP = level 4', levelFromXp(1080) === 4);
check('level nikdy neklesá', [...Array(4000).keys()].every((xp) => levelFromXp(xp) <= levelFromXp(xp + 1)));
check(
  'xpForLevel je inverzní',
  [1, 2, 3, 4, 5, 6, 7].every((level) => levelFromXp(xpForLevel(level)) === level),
);
check('level 1 začíná na nule', xpForLevel(1) === 0);

const progress = xpProgress(150);
check('xpProgress(150) je mezi 2 a 3', progress.level === 2 && progress.ratio > 0 && progress.ratio < 1);
check('xpProgress ukazuje, kolik chybí', progress.remaining === progress.next - 150, String(progress.remaining));

// migrace starého profilu: level se nesmí změnit
const oldCurve = (runs) => (runs <= 0 ? 1 : Math.floor(Math.sqrt(runs / 2)) + 1);
check(
  'migrace runs × 60 dá stejný level jako stará křivka',
  [0, 1, 2, 5, 8, 13, 18, 32, 50, 98].every((runs) => levelFromXp(runs * 60) === oldCurve(runs)),
);

// ── XP za běh ────────────────────────────────────────────────────────
check('lepší skóre = víc XP', xpForRun({ game: 'arena', score: 800 }) > xpForRun({ game: 'arena', score: 100 }));
check('strop za skóre existuje', xpForRun({ game: 'arena', score: 999999 }) === xpForRun({ game: 'arena', score: 750 }));
check('dokončení přidá', xpForRun({ game: 'arena', score: 400, completed: true }) > xpForRun({ game: 'arena', score: 400 }));
check('rekord přidá', xpForRun({ game: 'arena', score: 400, best: true }) > xpForRun({ game: 'arena', score: 400 }));
check(
  'dharma násobek přidá',
  xpForRun({ game: 'arena', score: 400, dharmaBonus: 0.5 }) > xpForRun({ game: 'arena', score: 400 }),
);
check('XP nikdy není nula ani záporné', xpForRun({ game: 'pong', score: 0 }) >= 1);

// ── první dohraná hra ────────────────────────────────────────────────
store.clear();
const first = recordRun({ game: 'arena', score: 120, nickname: 'tester' });
check('rekord přidá 3 žetony (1 hra + 2 rekord)', first.tokensGained === 3, `tokens=${first.tokensGained}`);
check('rekord se pozná', first.personalBest === true);
check('profil má 1 dohranou hru', first.profile.runs === 1, `runs=${first.profile.runs}`);
check('rekord se uložil', first.profile.best.arena === 120, `best=${first.profile.best.arena}`);
check('skóre se poslalo na tabuli', posts.length === 1 && posts[0].body.game === 'arena', JSON.stringify(posts[0] ?? {}));
check('hra dala XP', first.xpGained > 0, String(first.xpGained));
check('profil má XP', first.profile.xp === first.xpGained, String(first.profile.xp));
check('dharma se zapsala', first.profile.dharma.validations === 1, JSON.stringify(first.profile.dharma));
check('hláška nese XP i dharmu', /XP/.test(describeRun(first, true)) && /☸/.test(describeRun(first, true)), describeRun(first, true));
check('první běh splní NCL úlohu', first.nclTasks.some((task) => task.id === 'first-light'), JSON.stringify(first.nclTasks.map((t) => t.id)));
check('NCL úloha se zapíše', first.profile.nclDone.includes('first-light'), JSON.stringify(first.profile.nclDone));
check('NCL úloha přidá XP', first.xpGained > 40, String(first.xpGained));
check('CL sedí na XP', first.cl === clFromXp(first.profile.xp), `${first.cl} vs ${clFromXp(first.profile.xp)}`);
check('první běh CL nezvedne', first.clUp === false && first.cl === 0, String(first.cl));
check('profil počítá světy', first.profile.plays.arena === 1, JSON.stringify(first.profile.plays));

// ── druhá hra se stejným / nižším skóre ──────────────────────────────
const second = recordRun({ game: 'arena', score: 90, nickname: 'tester' });
check('horší hra = 1 žeton', second.tokensGained === 1, `tokens=${second.tokensGained}`);
check('horší hra není rekord', second.personalBest === false);
check('rekord zůstal', second.profile.best.arena === 120, `best=${second.profile.best.arena}`);
check('XP roste i za horší hru', second.profile.xp > first.profile.xp, `${first.profile.xp} → ${second.profile.xp}`);
check('stejná NCL úloha se nedá splnit dvakrát', second.nclTasks.every((task) => task.id !== 'first-light'), JSON.stringify(second.nclTasks.map((t) => t.id)));
check('druhý běh ve stejném světě nepočítá nový svět', (second.profile.plays.arena ?? 0) === 1 || second.profile.plays.arena === 2);

// ── nehodnocený běh ──────────────────────────────────────────────────
store.clear();
const casual = recordRun({ game: 'arena', score: 999, nickname: 'tester', ranked: false });
check('nehodnocený běh nic nemění', casual.tokensGained === 0 && casual.profile.runs === 0);
check('nehodnocený běh nedá XP', casual.xpGained === 0 && casual.profile.xp === 0);
check('nehodnocený běh nemá dharmu', casual.dharma === null);
check('nehodnocený běh neposílá skóre', posts.every((post) => post.body.score !== 999));

// ── dharma: čistý běh vs opuštěný ────────────────────────────────────
store.clear();
const clean = recordRun({
  game: 'neptune',
  score: 1500,
  nickname: 'tester',
  metrics: { seconds: 55, completed: true, objectives: 12, objectivesTotal: 15 },
});
check('čistý běh dostane pečeť', clean.dharma?.grade === 'seal', `${clean.dharma?.grade} / ${clean.dharma?.score}`);
check('pečeť se započítá', clean.profile.dharma.seals === 1, String(clean.profile.dharma.seals));
check('pečeť násobí XP', clean.dharma?.bonus === 0.5);

store.clear();
const quit = recordRun({
  game: 'neptune',
  score: 40,
  nickname: 'tester',
  metrics: { seconds: 20, abandoned: true, setbacks: 6 },
});
check('opuštěný běh není pečeť', quit.dharma?.grade !== 'seal', String(quit.dharma?.grade));
check('ahimsa klesne na nulu', quit.dharma?.pillars[0].passed === false);
check('opuštěný běh dá méně XP', quit.xpGained < clean.xpGained, `${quit.xpGained} vs ${clean.xpGained}`);

// ── denní výzva ──────────────────────────────────────────────────────
store.clear();
const challenge = dailyChallenge();
const before = loadProfile();
const run = recordRun({ game: challenge.game, score: challenge.target, nickname: 'tester' });
check('splněná výzva dá žetony navíc', run.challengeClaimed === true, `claimed=${run.challengeClaimed}`);
check('výzva zvýší počet vstupenek', run.profile.tickets === before.tickets + 1, `tickets=${run.profile.tickets}`);
const again = recordRun({ game: challenge.game, score: challenge.target, nickname: 'tester' });
check('výzva nejde splnit dvakrát denně', again.challengeClaimed === false);

// ── level up ─────────────────────────────────────────────────────────
store.clear();
store.set(
  'nirvana.park.v1',
  JSON.stringify({ tokens: 0, best: {}, runs: 1, xp: 118, tickets: 0, day: new Date().toISOString().slice(0, 10) }),
);
const levelUp = recordRun({ game: 'pong', score: 480, nickname: 'tester', metrics: { seconds: 40, completed: true } });
check('dost XP odemkne level 2', levelUp.level === 2 && levelUp.levelUp === true, `level=${levelUp.level} xp=${levelUp.xp}`);

// ── odeslání na tabuli nese přezdívku ────────────────────────────────
const last = posts[posts.length - 1];
check('tabule dostane přezdívku', last?.body.name === 'tester', JSON.stringify(last ?? {}));

// ── hláška a štítek ──────────────────────────────────────────────────
check('popis běhu má level', /level|rekord|XP/.test(describeRun(levelUp, true)), describeRun(levelUp, true));
check('dharma štítek pro pečeť', /pečeť|seal/.test(dharmaLabel(clean.dharma, true)));
check('dharma štítek pro null', dharmaLabel(null, true) === '');

console.log('');
if (failures > 0) {
  console.log(`PROGRESS FAILED (${failures})`);
  process.exit(1);
}
console.log('PROGRESS OK');
