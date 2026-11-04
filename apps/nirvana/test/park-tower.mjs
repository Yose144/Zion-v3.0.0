/**
 * Test hry Věž (šestá skříň pouti) — bez prohlížeče.
 *
 * Hra kreslí do canvasu, takže stav není vidět jinak než z kódu; test proto
 * ovládá hru jako hráč a kontroluje skóre, zúžení a konec:
 *  1. přesné položení = +35 (10 za kvádr + 25 perfect),
 *  2. nepřesné položení zúží kvádr a nedá bonus,
 *  3. úplně mimo = konec hry,
 *  4. když hráč nic nedělá, kvádr položí čas (jinak by šlo čekat navěky).
 *
 * Spuštění: cd apps/nirvana && npx tsx test/park-tower.mjs
 */

const { createTower } = await import('../src/core/park/games/tower.ts');

/** Falešný 2D kontext: metody nic nedělají, jen se počítají. */
function fakeCtx() {
  const calls = { fillRect: 0, fillText: 0 };
  const target = {
    fillRect: () => {
      calls.fillRect += 1;
    },
    fillText: () => {
      calls.fillText += 1;
    },
  };
  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return () => undefined;
    },
    set() {
      return true;
    },
  });
  return { ctx: proxy, calls };
}

function fakeCanvas() {
  const { ctx, calls } = fakeCtx();
  return {
    canvas: {
      width: 0,
      height: 0,
      getContext: () => ctx,
    },
    calls,
  };
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const STEP = 1 / 60;

/** Rozjede hru a vrátí ovládací rozhraní + zachycené události. */
function run() {
  const { canvas, calls } = fakeCanvas();
  let score = 0;
  let ended = null;
  const handle = createTower(canvas, {
    onScore: (value) => {
      score = value;
    },
    onEnd: (value) => {
      ended = value;
    },
  });
  return {
    handle,
    calls,
    get score() {
      return score;
    },
    get ended() {
      return ended;
    },
    frames(n) {
      for (let i = 0; i < n; i += 1) handle.frame(STEP);
    },
  };
}

// ── 1) přesné položení ────────────────────────────────────────────────
{
  const game = run();
  game.handle.pointer(0.5); // střed = přesně nad spodním kvádrem
  game.frames(2);
  game.handle.tap?.();
  check('přesné položení dá 35 bodů', game.score === 35, `score=${game.score}`);
  check('po položení hra běží dál', game.ended === null);
  check('hýbe se to (kreslí se každý snímek)', game.calls.fillText > 0 && game.calls.fillRect > 10);

  // druhé přesné položení → combo 2, skóre 35 + 35
  game.frames(2);
  game.handle.tap?.();
  check('druhé přesné položení přičte dalších 35', game.score === 70, `score=${game.score}`);
}

// ── 2) nepřesné položení zúží kvádr ───────────────────────────────────
{
  const game = run();
  game.handle.pointer(0.5);
  game.frames(2);
  game.handle.tap?.();
  const afterPerfect = game.score;

  // posun mimo střed o ~35 px → overlap, ale ne perfect
  game.handle.pointer(0.5 + 35 / 512);
  game.frames(40); // ukazatel dojede na cíl
  game.handle.tap?.();
  check('nepřesné položení dá jen 10 bodů', game.score === afterPerfect + 10, `score=${game.score}`);
  check('nepřesné položení hru neukončí', game.ended === null);
}

// ── 3) úplně mimo ────────────────────────────────────────────────────
{
  const game = run();
  game.handle.pointer(0.5);
  game.frames(2);
  game.handle.tap?.();
  const scoreBefore = game.score;

  game.handle.pointer(0.97); // úplně vpravo
  game.frames(60);
  game.handle.tap?.();
  check('mimo kvádr hra skončí', game.ended !== null, `ended=${game.ended}`);
  check('skóre zůstane na hodnotě před pádem', game.ended === scoreBefore, `${game.ended} vs ${scoreBefore}`);
}

// ── 4) čas položí kvádr sám ──────────────────────────────────────────
{
  const game = run();
  game.handle.pointer(0.5);
  // bez tapu: po ~3,4 s musí hra položit sama (a protože je přesně, přičte)
  game.frames(240);
  check('po vypršení času se kvádr položí sám', game.score >= 35, `score=${game.score}`);
}

// ── 5) klávesnice ────────────────────────────────────────────────────
{
  const game = run();
  game.handle.pointer(null); // bez ukazatele → kvádr se posouvá sám
  game.frames(10);
  game.handle.key('Space', true);
  game.handle.key('Space', false);
  check('mezerník položí kvádr', game.score > 0, `score=${game.score}`);
}

// ── 6) stop() opravdu zastaví ────────────────────────────────────────
{
  const game = run();
  game.handle.stop();
  game.frames(120);
  check('po stop() se nic neděje', game.ended === null && game.score === 0);
}

console.log('');
if (failures > 0) {
  console.log(`TOWER FAILED (${failures})`);
  process.exit(1);
}
console.log('TOWER OK');
