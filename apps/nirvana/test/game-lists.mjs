/**
 * SEZNAMY HER — hlídá, že se nerozejdou.
 *
 * Tohle je nejčastější chyba v Nirvaně: nová hra se přidá na čtyři místa
 * a na páté se zapomene. Reálně se to stalo u Neptunu, Pluta a Flotily
 * (`app/park/page.tsx` měl vlastní kopii názvů, takže se jejich skóre
 * na pouti vůbec neukázalo) a dřív u Merkura (`fight` chyběl na tabuli).
 *
 * Test nic nevykresluje — jen porovnává seznamy, které musí být stejné.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/game-lists.mjs
 */

import { GAME_ORDER, GAME_TITLES } from '../src/core/progress/boards.ts';
import { CHALLENGE_GAMES, CHALLENGE_TARGETS, dailyChallenge, dailyDharmaGoal } from '../src/core/park/challenge.ts';
import { GAME_XP } from '../src/core/progress/xp.ts';
import { emptyScores } from '../src/core/park/scores.ts';
import { NCL_TASKS } from '../src/core/progress/ncl.ts';
import { CL_LEVELS } from '../src/core/progress/consciousness.ts';
import { GAME_LINKS } from '../src/core/games/links.ts';
import { SURFACES } from '../src/core/games/surfaces.ts';

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

const order = new Set(GAME_ORDER);
const titles = new Set(Object.keys(GAME_TITLES));
const xp = new Set(Object.keys(GAME_XP));
const scores = new Set(Object.keys(emptyScores()));
const challenge = new Set(CHALLENGE_GAMES);
const targets = new Set(Object.keys(CHALLENGE_TARGETS));

/* ── všechny seznamy mají stejné hry ───────────────────────────────── */
{
  check('GAME_ORDER není prázdný', GAME_ORDER.length > 0, String(GAME_ORDER.length));
  check('pořadí nemá duplicity', order.size === GAME_ORDER.length, `${order.size}/${GAME_ORDER.length}`);

  for (const [name, set] of [
    ['GAME_TITLES', titles],
    ['GAME_XP', xp],
    ['emptyScores', scores],
    ['CHALLENGE_GAMES', challenge],
    ['CHALLENGE_TARGETS', targets],
  ]) {
    const missing = [...order].filter((game) => !set.has(game));
    const extra = [...set].filter((game) => !order.has(game));
    check(`${name} má všechny hry`, missing.length === 0, `chybí: ${missing.join(', ')}`);
    check(`${name} nemá hru navíc`, extra.length === 0, `navíc: ${extra.join(', ')}`);
  }
}

/* ── každý záznam musí mít smysl ───────────────────────────────────── */
{
  check(
    'každá hra má název cs+en',
    GAME_ORDER.every((game) => GAME_TITLES[game]?.cs && GAME_TITLES[game]?.en),
  );
  check(
    'každá hra má ikonu',
    GAME_ORDER.every((game) => Boolean(GAME_TITLES[game]?.glyph)),
  );
  check(
    'každá hra dá XP',
    GAME_ORDER.every((game) => (GAME_XP[game] ?? 0) > 0),
    GAME_ORDER.filter((game) => !(GAME_XP[game] > 0)).join(', '),
  );
  check(
    'každá hra má cíl denní výzvy',
    GAME_ORDER.every((game) => (CHALLENGE_TARGETS[game] ?? 0) > 0),
    GAME_ORDER.filter((game) => !(CHALLENGE_TARGETS[game] > 0)).join(', '),
  );
  check(
    'žádná hra nemá cíl výš než strop API (100 000)',
    GAME_ORDER.every((game) => CHALLENGE_TARGETS[game] <= 100_000),
  );
}

/* ── chrome (lišta, povrchy) ───────────────────────────────────────── */
{
  check('GAME_LINKS má unikátní id', new Set(GAME_LINKS.map((link) => link.id)).size === GAME_LINKS.length);
  check(
    'každý odkaz v liště má cestu a text',
    GAME_LINKS.every((link) => link.href.startsWith('/') && link.title.cs && link.title.en),
  );
  check(
    'každá cesta v liště je v SURFACES',
    GAME_LINKS.every((link) => SURFACES.includes(link.href)),
    GAME_LINKS.filter((link) => !SURFACES.includes(link.href)).map((link) => link.href).join(', '),
  );
  check('SURFACES má unikátní cesty', new Set(SURFACES).size === SURFACES.length);
  check('domovská cesta je v SURFACES', SURFACES.includes('/'));
}

/* ── NCL úlohy odkazují na existující hry ──────────────────────────── */
{
  const goals = NCL_TASKS.filter((task) => task.goal.kind === 'best');
  check('NCL „best" cíle míří na existující hru', goals.every((task) => order.has(task.goal.game)));
  check(
    'NCL „best" cíle nejdou nad reálný strop hry',
    goals.every((task) => task.goal.score <= 100_000),
  );
  check(
    'NCL prahy „worlds" jsou dosažitelné',
    NCL_TASKS.filter((task) => task.goal.kind === 'worlds').every((task) => task.goal.count <= GAME_ORDER.length),
    NCL_TASKS.filter((task) => task.goal.kind === 'worlds').map((t) => t.goal.count).join(','),
  );
  check('CL stupňů je sedm', CL_LEVELS.length === 7);
}

/* ── denní losy ────────────────────────────────────────────────────── */
{
  const today = new Date('2026-11-12T12:00:00Z');
  check('denní výzva vybere hru ze seznamu', challenge.has(dailyChallenge(today).game));
  check('dharma cíl vybere hru ze seznamu', challenge.has(dailyDharmaGoal(today).game));
}

console.log(`\n${failures === 0 ? 'PASSED' : 'FAILED'}: ${checks - failures}/${checks} kontrol`);
if (failures > 0) process.exit(1);
