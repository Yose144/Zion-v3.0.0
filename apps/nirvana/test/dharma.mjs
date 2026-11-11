/**
 * DHARMA VALIDATOR — test bez prohlížeče.
 *
 * Předloha je `PoC-lab/poc-verifier` (5 testů nad care proofem); tady se
 * stejná pětice používá na **herní běh**. Test hlídá tři věci, na kterých
 * to stojí:
 *  1. **chybějící údaj není nula** — nezměřený běh nesmí vypadat jako špatný,
 *  2. **pilíře nikdy neodečítají** — jen násobí XP a dávají pečeť,
 *  3. **pečeť chce všech pět** — ne jen vysoké skóre.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/dharma.mjs
 */

import {
  DHARMA_PILLARS,
  EMPTY_DHARMA,
  applyVerdict,
  validateRun,
} from '../src/core/progress/dharma.ts';
import { levelFromXp, xpForLevel, xpForRun, xpProgress } from '../src/core/progress/xp.ts';

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

/* ── pilíře ────────────────────────────────────────────────────────── */
{
  check('pět pilířů', DHARMA_PILLARS.length === 5, String(DHARMA_PILLARS.length));
  check('id jsou unikátní', new Set(DHARMA_PILLARS.map((p) => p.id)).size === 5);
  check('váhy dávají 100', DHARMA_PILLARS.reduce((sum, p) => sum + p.weight, 0) === 100);
  check(
    'každý pilíř má jméno i otázku v cs/en',
    DHARMA_PILLARS.every((p) => p.name.cs && p.name.en && p.question.cs && p.question.en),
  );
  check(
    'pořadí je dané (ahimsa první)',
    DHARMA_PILLARS[0].id === 'ahimsa' && DHARMA_PILLARS[4].id === 'kala',
  );
}

/* ── čistý běh ─────────────────────────────────────────────────────── */
{
  const clean = validateRun({
    seconds: 55,
    completed: true,
    score: 1500,
    objectives: 15,
    objectivesTotal: 15,
  });
  check('čistý běh = pečeť', clean.grade === 'seal', `${clean.grade} ${clean.score}`);
  check('skóre 100', clean.score === 100, String(clean.score));
  check('všech pět prošlo', clean.passed === 5, String(clean.passed));
  check('pečeť násobí XP +50 %', clean.bonus === 0.5, String(clean.bonus));
  check(
    'každý pilíř má hodnotu 1',
    clean.pillars.every((p) => p.value === 1),
    clean.pillars.map((p) => p.value.toFixed(2)).join(','),
  );
  check(
    'pilíře nesou poznámku',
    clean.pillars.every((p) => typeof p.note === 'string' && p.note.length > 0),
  );
  check('výsledek je deterministický', JSON.stringify(validateRun({ seconds: 55, completed: true })) === JSON.stringify(validateRun({ seconds: 55, completed: true })));

  // 12 z 15 světel není „všechno" — smriti to musí poznat
  const almost = validateRun({ seconds: 55, completed: true, objectives: 12, objectivesTotal: 15 });
  check('nedokončený svět sníží smriti', (almost.pillars.find((p) => p.id === 'smriti')?.value ?? 1) < 1);
  check('i tak může být pečeť', almost.grade === 'seal' && almost.score === 96, `${almost.grade} ${almost.score}`);
}

/* ── chybějící údaje nejsou nula ───────────────────────────────────── */
{
  const unknown = validateRun({});
  check('prázdný běh není „thin"', unknown.grade !== 'thin', unknown.grade);
  check('prázdný běh nemá nulový pilíř', unknown.pillars.every((p) => p.value > 0.5), unknown.pillars.map((p) => p.value).join(','));
  check('známá nula je horší než neznámo', validateRun({ score: 0 }).score < unknown.score);
  check('prázdný běh projde jako pass', unknown.grade === 'pass', unknown.grade);
  check('prázdný běh dá +25 %', unknown.bonus === 0.25);
}

/* ── ahimsa ────────────────────────────────────────────────────────── */
{
  const quit = validateRun({ seconds: 30, completed: false, abandoned: true });
  const ahimsa = quit.pillars.find((p) => p.id === 'ahimsa');
  check('opuštěný běh = ahimsa 0', ahimsa?.value === 0, String(ahimsa?.value));
  check('opuštěný běh nepečetí', quit.grade !== 'seal', quit.grade);

  const falls = validateRun({ seconds: 30, setbacks: 3 });
  const ahimsaFalls = falls.pillars.find((p) => p.id === 'ahimsa');
  check('tři pády sníží ahimsu', (ahimsaFalls?.value ?? 1) < 1, String(ahimsaFalls?.value));
  check('tři pády ji nezaberou', ahimsaFalls?.passed === true);

  const many = validateRun({ seconds: 30, setbacks: 8 });
  check(
    'osm pádů ahimsu neprojde',
    many.pillars.find((p) => p.id === 'ahimsa')?.passed === false,
  );
}

/* ── satya a kala (čas) ────────────────────────────────────────────── */
{
  const instant = validateRun({ seconds: 2, completed: true, score: 10 });
  check('dvě vteřiny = satya 0', instant.pillars.find((p) => p.id === 'satya')?.value === 0);
  check('dvě vteřiny = kala 0', instant.pillars.find((p) => p.id === 'kala')?.value === 0);
  check('dvě vteřiny nejsou pečeť', instant.grade !== 'seal', instant.grade);

  const short = validateRun({ seconds: 6 });
  check('šest vteřin je půlka satyi', (short.pillars.find((p) => p.id === 'satya')?.value ?? 0) > 0.4);

  const normal = validateRun({ seconds: 60 });
  check('minuta = satya i kala 1', normal.pillars.find((p) => p.id === 'satya')?.value === 1 && normal.pillars.find((p) => p.id === 'kala')?.value === 1);

  const marathon = validateRun({ seconds: 4000 });
  check('příliš dlouhý běh sníží kalu', (marathon.pillars.find((p) => p.id === 'kala')?.value ?? 1) < 1);
  check('příliš dlouhý běh nesníží satyu', marathon.pillars.find((p) => p.id === 'satya')?.value === 1);
}

/* ── hita a smriti (objektivy) ─────────────────────────────────────── */
{
  const half = validateRun({ seconds: 60, objectives: 5, objectivesTotal: 10 });
  check('půl objektivů = hita 0.5', Math.abs((half.pillars.find((p) => p.id === 'hita')?.value ?? 0) - 0.5) < 1e-9);
  check('půl objektivů projde', half.pillars.find((p) => p.id === 'hita')?.passed === true);

  const none = validateRun({ seconds: 60, objectives: 0, objectivesTotal: 10, score: 0 });
  check('nula objektivů a nula skóre = hita neprojde', none.pillars.find((p) => p.id === 'hita')?.passed === false);

  const given = validateRun({ seconds: 60, objectives: 1, objectivesTotal: 10, given: 1 });
  check('dar druhým zvedne smriti na 1', given.pillars.find((p) => p.id === 'smriti')?.value === 1);

  const more = validateRun({ seconds: 60, objectives: 9, objectivesTotal: 10 });
  check('víc objektivů nikdy nesníží skóre', more.score > half.score, `${half.score} → ${more.score}`);

  const complete = validateRun({ seconds: 60, completed: true, objectives: 0, objectivesTotal: 10 });
  check('dokončení samo stačí na hitu', complete.pillars.find((p) => p.id === 'hita')?.value === 1);
}

/* ── stupně a bonus ────────────────────────────────────────────────── */
{
  const partial = validateRun({ seconds: 6, objectives: 2, objectivesTotal: 10, score: 10 });
  check('slabý běh není pečeť', partial.grade !== 'seal');
  check('bonus odpovídá stupni', [0, 0.1, 0.25, 0.5].includes(partial.bonus), String(partial.bonus));
  check('skóre je 0..100', partial.score >= 0 && partial.score <= 100, String(partial.score));
  check(
    'pečeť jen při všech pilířích',
    validateRun({ seconds: 60, completed: true }).passed === 5 &&
      validateRun({ seconds: 2, completed: true }).passed < 5,
  );
}

/* ── stav pečetí ───────────────────────────────────────────────────── */
{
  const seal = validateRun({ seconds: 60, completed: true });
  const pass = validateRun({});
  let state = { ...EMPTY_DHARMA };
  state = applyVerdict(state, seal);
  check('pečeť se započítá', state.seals === 1 && state.validations === 1);
  state = applyVerdict(state, pass);
  check('nopečeť pečeti nepřidá', state.seals === 1 && state.validations === 2);
  check('poslední verdikt se uloží', state.last?.grade === pass.grade, String(state.last?.grade));
  check('poslední verdikt nese pilíře', state.last?.pillars.length === 5, String(state.last?.pillars.length));
  check('stav je serializovatelný', JSON.parse(JSON.stringify(state)).seals === 1);
}

/* ── XP křivka (sdílená s progresí) ────────────────────────────────── */
{
  check('level 1 na nule', levelFromXp(0) === 1);
  check('level roste', [0, 120, 480, 1080, 1920].every((xp, index) => levelFromXp(xp) === index + 1));
  check('xpProgress sedí na level', xpProgress(480).level === 3 && xpProgress(480).ratio === 0);
  check(
    'xpForLevel je inverzní',
    [1, 2, 3, 4, 5, 6].every((level) => levelFromXp(xpForLevel(level)) === level),
  );
  check(
    'dharma násobek zvyšuje XP',
    xpForRun({ game: 'pluto', score: 600, dharmaBonus: 0.5 }) >
      xpForRun({ game: 'pluto', score: 600, dharmaBonus: 0 }),
  );
  check('XP nikdy není nula', xpForRun({ game: 'pluto', score: 0 }) >= 1);
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
