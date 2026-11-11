/**
 * ARÉNA — přepočet konce online zápasu na výsledek pro progresi.
 *
 * Proč samostatný test: `match_end` přišel po **třech minutách** hry, takže
 * by se jeho zpracování v E2E ověřovalo jen obchvatem. `mpResultOf` je čistá
 * funkce — z `secondsLeft`, tabulky a fragů udělá skóre, čas a výhru;
 * komponenta ji jen zavolá.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/arena-mp-result.mjs
 */

import { mpResultOf } from '../src/core/arena/mp-result.ts';
import { FRAG_LIMIT, MATCH_SECONDS } from '../src/core/arena/map.ts';
import { xpForRun } from '../src/core/progress/xp.ts';
import { validateRun } from '../src/core/progress/dharma.ts';

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

/* ── skóre a čas ───────────────────────────────────────────────────── */
{
  const result = mpResultOf({ frags: 7, deaths: 3, timeLeft: 120, leaderId: 'me', youId: 'me' });
  check('skóre = fragy×100 − smrti×25', result.score === 7 * 100 - 3 * 25, String(result.score));
  check('čas = MATCH_SECONDS − secondsLeft', result.elapsedSeconds === 60, String(result.elapsedSeconds));
  check('vůdce tabulky = výhra', result.won === true);

  const lost = mpResultOf({ frags: 2, deaths: 9, timeLeft: 0, leaderId: 'bot', youId: 'me' });
  check('jiný vůdce = prohra', lost.won === false);
  check('čas vypršel = celý zápas', lost.elapsedSeconds === MATCH_SECONDS, String(lost.elapsedSeconds));
  check('skóre nikdy není záporné', lost.score === 0, String(lost.score));

  const zero = mpResultOf({ frags: 0, deaths: 0, timeLeft: MATCH_SECONDS, leaderId: null, youId: 'me' });
  check('na startu je čas 1 s (ne 0)', zero.elapsedSeconds === 1, String(zero.elapsedSeconds));
  check('bez id hráče se nevyhrává', zero.won === false);
}

/* ── robustnost vůči divným vstupům ────────────────────────────────── */
{
  const negative = mpResultOf({ frags: -5, deaths: -2, timeLeft: MATCH_SECONDS + 50, leaderId: null, youId: null });
  check('záporné hodnoty se oříznou', negative.frags === 0 && negative.deaths === 0);
  check('čas se nepřekročí zápas', negative.elapsedSeconds <= MATCH_SECONDS, String(negative.elapsedSeconds));
  check('výhra chce hráče i vůdce', negative.won === false);
}

/* ── co z toho vidí progrese ───────────────────────────────────────── */
{
  const win = mpResultOf({ frags: FRAG_LIMIT, deaths: 2, timeLeft: 30, leaderId: 'me', youId: 'me' });
  const metrics = {
    seconds: win.elapsedSeconds,
    completed: win.won,
    objectives: win.frags,
    objectivesTotal: FRAG_LIMIT,
    setbacks: win.deaths,
  };
  const verdict = validateRun({ ...metrics, score: win.score });
  check('výhra na frag limit je pečeť', verdict.grade === 'seal', `${verdict.grade} ${verdict.score}`);
  check('všech pět pilířů prošlo', verdict.passed === 5, String(verdict.passed));

  const loss = mpResultOf({ frags: 1, deaths: 9, timeLeft: 0, leaderId: 'bot', youId: 'me' });
  const lossVerdict = validateRun({
    seconds: loss.elapsedSeconds,
    completed: loss.won,
    objectives: loss.frags,
    objectivesTotal: FRAG_LIMIT,
    setbacks: loss.deaths,
    score: loss.score,
  });
  check('prohra není pečeť', lossVerdict.grade !== 'seal', lossVerdict.grade);
  check('devět smrtí sníží ahimsu', lossVerdict.pillars[0].passed === false);

  check(
    'online zápas dá XP jako sólo',
    xpForRun({ game: 'arena', score: win.score, completed: true, dharmaBonus: verdict.bonus }) > 0,
  );
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
