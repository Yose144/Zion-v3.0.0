/**
 * CONSCIOUSNESS LEVEL + NCL KURIKULUM + QUESTY — test bez prohlížeče.
 *
 * Hlídá tři věci:
 *  1. **stupně jsou z kódu** — L0 Dormant … L6 Grok a bonus `level × 0,05`
 *     (stejné jako `ConsciousnessLevel` a `ReputationRecord::score`),
 *  2. **NCL úlohy jdou splnit** — každý cíl má dosažitelný práh a skóre
 *     odpovídá formuli `(splněné / všechny) × 100 × (1 + CL × 0,05)`,
 *  3. **questy jsou jen data** — `ready: false`, kroky používají stejný
 *     `NclGoal` jako NCL, takže se při přesunu do OASIS nepřepisují.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/consciousness.mjs
 */

import {
  CL_BONUS_PER_LEVEL,
  CL_LEVELS,
  clBonus,
  clFromXp,
  clLevel,
  clProgress,
} from '../src/core/progress/consciousness.ts';
import {
  NCL_TASKS,
  NCL_TASK_TYPES,
  goalProgress,
  goalTarget,
  nclState,
  newlyCompleted,
} from '../src/core/progress/ncl.ts';
import { QUESTS, preparedQuests } from '../src/core/progress/quests.ts';
import { dailyDharmaGoal, claimDharmaGoal, dailyChallenge } from '../src/core/park/challenge.ts';

let checks = 0;
let failures = 0;

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  OK   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Profil jen jako data — NCL a CL nepotřebují prohlížeč. */
function profile(patch = {}) {
  return {
    tokens: 0,
    best: {},
    runs: 0,
    day: null,
    tickets: 0,
    challengeDay: null,
    rideDay: null,
    xp: 0,
    dharma: { seals: 0, validations: 0, last: null },
    plays: {},
    completions: 0,
    gifts: 0,
    nclDone: [],
    dharmaGoalDay: null,
    ...patch,
  };
}

/* ── CL: kanonická škála ───────────────────────────────────────────── */
{
  check('sedm stupňů', CL_LEVELS.length === 7, String(CL_LEVELS.length));
  check(
    'jména jsou z consciousness.rs',
    CL_LEVELS.map((l) => l.name).join(',') === 'Dormant,Aware,Sentient,Transcendent,Omniscient,Cosmic,Grok',
    CL_LEVELS.map((l) => l.name).join(','),
  );
  check('id jdou 0..6', CL_LEVELS.every((level, index) => level.id === index));
  check('XP prahy rostou', CL_LEVELS.every((level, index) => index === 0 || level.xp > CL_LEVELS[index - 1].xp));
  check('Dormant je na nule', clFromXp(0) === 0);
  check('100 XP = Aware', clFromXp(100) === 1, String(clFromXp(100)));
  check('600 XP = Sentient', clFromXp(600) === 2, String(clFromXp(600)));
  check('2000 XP = Transcendent', clFromXp(2000) === 3);
  check('6000 XP = Omniscient', clFromXp(6000) === 4);
  check('15000 XP = Cosmic', clFromXp(15000) === 5);
  check('35000 XP = Grok', clFromXp(35000) === 6);
  check('nad stropem zůstává Grok', clFromXp(9_999_999) === 6);
  check('level nikdy neklesá', [...Array(40000).keys()].every((xp) => clFromXp(xp) <= clFromXp(xp + 1)));

  check('bonus je level × 0,05', clBonus(0) === 0 && Math.abs(clBonus(4) - 4 * CL_BONUS_PER_LEVEL) < 1e-9);
  check('bonus u Grok je +30 %', Math.abs(clBonus(6) - 0.3) < 1e-9, String(clBonus(6)));
  check('bonus mimo rozsah se ořízne', Math.abs(clBonus(99) - 0.3) < 1e-9 && clBonus(-3) === 0);

  const progress = clProgress(300);
  check('clProgress sedí na stupeň', progress.level === 1 && progress.name === 'Aware');
  check('clProgress má ratio 0..1', progress.ratio > 0 && progress.ratio < 1, String(progress.ratio));
  check('clProgress ukazuje, kolik chybí', progress.remaining === 300, String(progress.remaining));
  check('u Grok je ratio 1', clProgress(40000).ratio === 1 && clProgress(40000).remaining === 0);
  check('clLevel ořeže mimo rozsah', clLevel(99).id === 6 && clLevel(-1).id === 0);
  check('každý stupeň má hráčský výklad', CL_LEVELS.every((level) => level.note.cs && level.note.en));
}

/* ── NCL úlohy ─────────────────────────────────────────────────────── */
{
  check('dvanáct úloh', NCL_TASKS.length === 12, String(NCL_TASKS.length));
  check('id jsou unikátní', new Set(NCL_TASKS.map((task) => task.id)).size === NCL_TASKS.length);
  check(
    'typy jsou z NclTaskType',
    NCL_TASKS.every((task) => NCL_TASK_TYPES.includes(task.type)),
    NCL_TASKS.map((task) => task.type).join(','),
  );
  check('každá úloha má text cs/en', NCL_TASKS.every((task) => task.title.cs && task.title.en && task.detail.cs && task.detail.en));
  check('každá úloha dá XP', NCL_TASKS.every((task) => task.xp >= 40));
  check('prahy jsou kladné', NCL_TASKS.every((task) => goalTarget(task.goal) > 0));

  const empty = profile();
  check('prázdný profil nesplní nic', nclState(empty).done.length === 0);
  check('první úloha je „první světlo"', nclState(empty).next?.id === 'first-light');
  check('prázdný profil má skóre 0', nclState(empty).score === 0, String(nclState(empty).score));

  // jeden běh v jednom světě
  const one = profile({ runs: 1, plays: { arena: 1 }, xp: 60 });
  const oneState = nclState(one);
  check('jeden běh splní první úlohu', oneState.done.includes('first-light'));
  check('druhá úloha čeká na druhý svět', oneState.next?.id === 'two-worlds', String(oneState.next?.id));
  check('skóre roste se splněnou úlohou', oneState.score > 0, String(oneState.score));
  check('nedokončená úloha má postup', oneState.tasks.find((t) => t.task.id === 'two-worlds')?.progress === 0.5);

  const two = profile({ runs: 2, plays: { arena: 1, pluto: 1 }, xp: 200 });
  check('dva světy splní druhou úlohu', nclState(two).done.includes('two-worlds'));
  check('CL zvedne skóre NCL', nclState(profile({ xp: 600, runs: 1, plays: { arena: 1 } })).score >= nclState(profile({ runs: 1, plays: { arena: 1 } })).score);
  // runs + completions + gifts = tři úlohy ze dvanácti (CL 0 → bez bonusu)
  const three = nclState(
    profile({ runs: 12, plays: { arena: 1 }, completions: 1, gifts: 1, xp: 0, dharma: { seals: 0, validations: 0, last: null } }),
  );
  check('splní se právě tři úlohy', three.done.length === 3, three.done.join(','));
  check('skóre odpovídá formuli', three.score === Math.round((3 / NCL_TASKS.length) * 100), String(three.score));
  check('skóre je 0..100 i s Grok', nclState(profile({ runs: 1, plays: { arena: 1 }, xp: 40000 })).score <= 100);

  const all = profile({
    runs: 99,
    plays: { pong: 1, breakout: 1, snake: 1, tetris: 1, asteroids: 1, tower: 1, gallery: 1, arena: 1, race: 1, fight: 1, moba: 1, lumi: 1 },
    completions: 5,
    gifts: 2,
    xp: 40000,
    dharma: { seals: 3, validations: 9, last: null },
    best: { lumi: 1200, neptune: 1400, pluto: 1200 },
  });
  const allState = nclState(all);
  check('dá se splnit všechno najednou', allState.done.length === NCL_TASKS.length, `${allState.done.length}/${NCL_TASKS.length}`);
  check('vše splněno = skóre 100 (clamp)', allState.score === 100, String(allState.score));
  check('žádná úloha nezbývá', allState.next === null && allState.remaining === 0);

  const withDone = profile({ runs: 1, plays: { arena: 1 }, nclDone: ['first-light'] });
  check('hotová úloha se nehlásí znovu', newlyCompleted(withDone).length === 0, JSON.stringify(newlyCompleted(withDone).map((t) => t.id)));
  const fresh = newlyCompleted(profile({ runs: 1, plays: { arena: 1 } }));
  check('nová úloha se hlásí', fresh.length === 1 && fresh[0].id === 'first-light');
  check('goalProgress umí každý druh',
    goalProgress({ kind: 'runs', count: 1 }, one) === 1 &&
      goalProgress({ kind: 'seals', count: 1 }, one) === 0 &&
      goalProgress({ kind: 'best', game: 'arena', score: 100 }, profile({ best: { arena: 120 } })) === 120);
}

/* ── questy (připravené pro OASIS) ─────────────────────────────────── */
{
  check('čtyři připravené questy', QUESTS.length === 4, String(QUESTS.length));
  check('všechny jsou „připraveno"', preparedQuests().length === QUESTS.length);
  check('id jsou unikátní', new Set(QUESTS.map((q) => q.id)).size === QUESTS.length);
  check('každý quest má CL 0..6', QUESTS.every((q) => q.cl >= 0 && q.cl <= 6));
  check('každý quest má aspoň jeden krok', QUESTS.every((q) => q.steps.length > 0));
  check(
    'kroky používají NclGoal',
    QUESTS.every((q) => q.steps.every((step) => typeof step.goal.kind === 'string' && goalTarget(step.goal) > 0)),
  );
  check('odměny jsou kladné', QUESTS.every((q) => q.reward.xp > 0 && q.reward.tokens > 0));
  check('texty jsou cs/en', QUESTS.every((q) => q.title.cs && q.title.en && q.note.cs && q.note.en));
  check('questy jdou seřadit podle CL', QUESTS.every((q, i) => i === 0 || q.cl >= QUESTS[i - 1].cl));
}

/* ── denní dharma cíl ──────────────────────────────────────────────── */
{
  const date = new Date('2026-11-11T12:00:00Z');
  const same = dailyDharmaGoal(date);
  check('cíl je deterministický', JSON.stringify(same) === JSON.stringify(dailyDharmaGoal(date)));
  check('cíl má hru a odměnu', Boolean(same.game) && same.reward > 0);
  // přes rok se hra dharma cíle nikdy nesmí shodovat s denní výzvou
  let collisions = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = new Date(date.getTime() + i * 86_400_000);
    if (dailyChallenge(day).game === dailyDharmaGoal(day).game) collisions += 1;
  }
  check('dharma cíl nikdy nepadne na hru výzvy', collisions === 0, `${collisions} kolizí/365`);
  check('den v klíči', same.day === '2026-11-11', same.day);

  const empty = profile();
  const wrongGame = claimDharmaGoal(empty, same.game === 'pluto' ? 'arena' : 'pluto', 'seal', date);
  check('jiná hra cíl nesplní', wrongGame.claimed === false);

  const notSeal = claimDharmaGoal(empty, same.game, 'pass', date);
  check('bez pečeti se cíl nesplní', notSeal.claimed === false);

  const claimed = claimDharmaGoal(empty, same.game, 'seal', date);
  check('pečeť ve správné hře cíl splní', claimed.claimed === true);
  check('cíl přidá žetony', claimed.profile.tokens === same.reward, String(claimed.profile.tokens));
  check('cíl zapíše den', claimed.profile.dharmaGoalDay === same.day);

  const twice = claimDharmaGoal(claimed.profile, same.game, 'seal', date);
  check('cíl nejde splnit dvakrát denně', twice.claimed === false);
  check('druhé splnění nic nepřidá', twice.profile.tokens === claimed.profile.tokens);
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
