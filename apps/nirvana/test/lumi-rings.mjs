/**
 * Test prstenců světla (2026-11-10) — bez prohlížeče i bez WebGL.
 *
 * Pravidla, která musí držet:
 *  1. **Průlet se pozná i mezi snímky** (úsečka, ne bod) — jinak by na 20 fps
 *     hráč proletěl prstencem a nic by se nestalo.
 *  2. **Střed = perfektní** a dá víc bodů i energie.
 *  3. **Řetěz** roste, dokud průlety nejsou dál než `COMBO_WINDOW`; pak začne
 *     znovu od jedné. Nikdy nepřeleze `COMBO_MAX`.
 *  4. **Prstenec nejde proletět dvakrát** a finální prstence (`afterAll`)
 *     čekají na všech sedm světel.
 *  5. **Data cest dávají smysl:** prstence jsou v mapě, ne ve svatyni,
 *     nepřekrývají se a každá cesta má finále.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/lumi-rings.mjs
 */

const {
  ALL_RINGS_BONUS,
  COMBO_MAX,
  COMBO_WINDOW,
  PERFECT_RATIO,
  RING_BONUS,
  RING_ENERGY,
  RING_PERFECT_BONUS,
  RING_PERFECT_ENERGY,
  activeRings,
  advanceRings,
  comboAt,
  comboMultiplier,
  createRingRun,
  ringActive,
  ringProgress,
} = await import('../src/core/lumi/rings.ts');
const { LUMI_PATHS, LUMI_WIDTH, LUMI_HEIGHT, pathData } = await import('../src/core/lumi/world.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/** Krok z bodu do bodu — stejné měřítko, jaké používá scéna. */
const step = (run, from, to, now, rings, collected = 0, total = 7) =>
  advanceRings(run, from, to, now, rings, collected, total);

const RING = (id, x, y, r = 4, afterAll = false) => ({ id, x, y, z: 0, r, ...(afterAll ? { afterAll: true } : {}) });

// ── 1) start ─────────────────────────────────────────────────────────
{
  const run = createRingRun();
  check('start: nic proletěno', run.passed.length === 0);
  check('start: řetěz nula', run.combo === 0 && comboAt(run, 0) === 0);
  check('start: skóre nula', run.score === 0 && run.allDone === false);
  check('start: žádný poslední prstenec', run.lastRing === null);
}

// ── 2) průlet úsečkou ────────────────────────────────────────────────
{
  const run = createRingRun();
  const rings = [RING(1, 50, 50, 4)];
  const miss = step(run, { x: 10, y: 70 }, { x: 90, y: 70 }, 1, rings);
  check('mimo prstenec nic', miss === null && run.passed.length === 0, JSON.stringify(miss));

  // úsečka vede 3 jednotky od středu (r = 4): proletí, ale ne středem
  const hit = step(run, { x: 10, y: 53 }, { x: 90, y: 53 }, 2, rings);
  check('úsečka skrz prstenec proletí', Boolean(hit) && hit.id === 1, JSON.stringify(hit));
  check('průlet se zapíše', run.passed.length === 1 && run.passed[0] === 1);
  check('první průlet není perfektní', hit?.perfect === false);
  check('body prvního průletu', hit?.points === RING_BONUS, String(hit?.points));
  check('energie za průlet', hit?.energy === RING_ENERGY, String(hit?.energy));

  const again = step(run, { x: 10, y: 53 }, { x: 90, y: 53 }, 3, rings);
  check('prstenec nejde proletět dvakrát', again === null && run.passed.length === 1, JSON.stringify(again));
}

// ── 3) střed = perfektní ─────────────────────────────────────────────
{
  const run = createRingRun();
  const rings = [RING(1, 50, 50, 4)];
  // úsečka přesně středem
  const perfect = step(run, { x: 40, y: 50 }, { x: 60, y: 50 }, 1, rings);
  check('střed je perfektní', perfect?.perfect === true, JSON.stringify(perfect));
  check('perfektní dá víc bodů', perfect?.points === RING_PERFECT_BONUS, String(perfect?.points));
  check('perfektní dá víc energie', perfect?.energy === RING_PERFECT_ENERGY, String(perfect?.energy));
  check('perfektní se počítá', run.perfect === 1, String(run.perfect));

  const off = createRingRun();
  // okraj otvoru: 3,5 jednotky od středu (mimo 45 % poloměru)
  const edge = step(off, { x: 40, y: 53.5 }, { x: 60, y: 53.5 }, 1, rings);
  check('okraj otvoru není perfektní', edge?.perfect === false, JSON.stringify(edge));
  check('hranice perfekta sedí', 3.5 > 4 * PERFECT_RATIO && 3.5 < 4);
}

// ── 4) řetěz ─────────────────────────────────────────────────────────
{
  const run = createRingRun();
  const rings = [RING(1, 20, 50), RING(2, 40, 50), RING(3, 60, 50), RING(4, 80, 50)];
  // všechny tři průlety jsou 3 jednotky od středu = nejsou perfektní
  const a = step(run, { x: 19, y: 53 }, { x: 21, y: 53 }, 0, rings);
  const b = step(run, { x: 39, y: 53 }, { x: 41, y: 53 }, 2, rings);
  const c = step(run, { x: 59, y: 53 }, { x: 61, y: 53 }, 4, rings);
  check('řetěz roste s průlety', a?.combo === 1 && b?.combo === 2 && c?.combo === 3, [a?.combo, b?.combo, c?.combo].join(','));
  check('body rostou s řetězem', a?.points === 40 && b?.points === 50 && c?.points === 60, [a?.points, b?.points, c?.points].join(','));
  check('nejlepší řetěz se drží', run.bestCombo === 3, String(run.bestCombo));
  check('comboAt ukazuje živý řetěz', comboAt(run, 5) === 3, String(comboAt(run, 5)));
  check('comboAt po okně zhasne', comboAt(run, 4 + COMBO_WINDOW + 0.01) === 0, String(comboAt(run, 4 + COMBO_WINDOW + 0.01)));

  // pauza delší než okno → řetěz začne znovu od jedné
  const d = step(run, { x: 79, y: 53 }, { x: 81, y: 53 }, 4 + COMBO_WINDOW + 1, rings);
  check('po pauze řetěz začíná znovu', d?.combo === 1, String(d?.combo));
  check('body po pauze jsou základ', d?.points === 40, String(d?.points));

  // strop
  const capped = createRingRun();
  const many = Array.from({ length: 8 }, (_, index) => RING(index + 1, 10 + index * 10, 30));
  for (let index = 0; index < many.length; index += 1) {
    const ring = many[index];
    step(capped, { x: ring.x - 1, y: 33 }, { x: ring.x + 1, y: 33 }, index * 0.5, many);
  }
  check('řetěz má strop', capped.combo === COMBO_MAX, String(capped.combo));
  check('násobek má strop ×2', comboMultiplier(99) === 2, String(comboMultiplier(99)));
  check('násobek prvního je ×1', comboMultiplier(1) === 1, String(comboMultiplier(1)));
}

// ── 5) finální prstence ──────────────────────────────────────────────
{
  const rings = [RING(1, 30, 30), RING(2, 70, 70, 4, true)];
  check('finální prstenec je před světly neaktivní', ringActive(rings[1], 3, 7) === false);
  check('finální prstenec je po světlech aktivní', ringActive(rings[1], 7, 7) === true);
  check('aktivní seznam před světly finále neobsahuje', activeRings(rings, 6, 7).length === 1);
  check('aktivní seznam po světlech finále obsahuje', activeRings(rings, 7, 7).length === 2);

  const run = createRingRun();
  const blocked = step(run, { x: 60, y: 70 }, { x: 80, y: 70 }, 1, rings, 6, 7);
  check('finále nejde proletět dřív', blocked === null && run.passed.length === 0, JSON.stringify(blocked));
  const opened = step(run, { x: 60, y: 70 }, { x: 80, y: 70 }, 2, rings, 7, 7);
  check('finále jde proletět po světlech', opened?.id === 2, JSON.stringify(opened));

  const progress = ringProgress(run, rings, 7, 7);
  check('postup prstenců sedí', progress.passed === 1 && progress.total === 2 && progress.active === 2, JSON.stringify(progress));
}

// ── 6) bonus za všechny prstence ─────────────────────────────────────
{
  const run = createRingRun();
  const rings = [RING(1, 20, 20), RING(2, 50, 20)];
  step(run, { x: 19, y: 23 }, { x: 21, y: 23 }, 0, rings);
  check('po prvním prstenci bonus není', run.allDone === false);
  step(run, { x: 49, y: 23 }, { x: 51, y: 23 }, 1, rings);
  check('po všech prstencích je bonus', run.allDone === true);
  check('bonus se připočte jednou', run.score === 40 + 50 + ALL_RINGS_BONUS, String(run.score));

  // druhý pokus o bonus nic nepřidá
  const before = run.score;
  step(run, { x: 49, y: 23 }, { x: 51, y: 23 }, 2, rings);
  check('bonus se nedá získat dvakrát', run.score === before, `${before} → ${run.score}`);
}

// ── 7) teleport a rozbitý čas ────────────────────────────────────────
{
  const run = createRingRun();
  const rings = [RING(1, 60, 60, 4)];
  const teleport = step(run, { x: 60, y: 60 }, { x: 60, y: 60 }, 5, rings);
  check('teleport do středu = perfektní', teleport?.perfect === true, JSON.stringify(teleport));

  const broken = createRingRun();
  const nan = step(broken, { x: 10, y: 10 }, { x: 70, y: 70 }, Number.NaN, [RING(2, 60, 60, 4)]);
  check('NaN čas nic nerozbije', nan === null && broken.passed.length === 0, JSON.stringify(nan));
}

// ── 8) data cest ─────────────────────────────────────────────────────
{
  for (const [id, path] of Object.entries(LUMI_PATHS)) {
    const rings = path.rings;
    const finals = rings.filter((ring) => ring.afterAll);
    check(`cesta ${id}: má aspoň šest prstenců`, rings.length >= 6, String(rings.length));
    check(`cesta ${id}: má finále`, finals.length >= 1, String(finals.length));
    check(
      `cesta ${id}: prstence jsou v mapě`,
      rings.every((ring) => ring.x > 2 && ring.x < LUMI_WIDTH - 2 && ring.y > 2 && ring.y < LUMI_HEIGHT - 2),
      JSON.stringify(rings.map((ring) => [ring.x, ring.y])),
    );
    check(
      `cesta ${id}: prstence nejsou ve svatyni`,
      rings.every((ring) => Math.hypot(ring.x - path.shrine.x, ring.y - path.shrine.y) > path.shrine.r + 0.5),
      JSON.stringify(rings.map((ring) => [ring.id, Math.round(Math.hypot(ring.x - path.shrine.x, ring.y - path.shrine.y))])),
    );
    check(
      `cesta ${id}: prstence se nepřekrývají`,
      rings.every((ring, index) =>
        rings.slice(index + 1).every((other) => Math.hypot(ring.x - other.x, ring.y - other.y) > ring.r + other.r),
      ),
    );
    check(
      `cesta ${id}: prstence neleží na světlech`,
      rings.every((ring) => path.lights.every((light) => Math.hypot(ring.x - light.x, ring.y - light.y) > ring.r)),
    );
    check(`cesta ${id}: id jsou unikátní`, new Set(rings.map((ring) => ring.id)).size === rings.length);
  }
}

// ── 9) dnešní obloha a cesty ─────────────────────────────────────────
{
  const today = pathData('calm');
  check('dnešní cesta má prstence', today.rings.length === LUMI_PATHS.calm.rings.length);
  const later = pathData('calm', new Date('2030-01-01T00:00:00Z'));
  check(
    'denní posun světel prstence nemění',
    later.rings.length === today.rings.length &&
      later.rings.every((ring, index) => ring.x === today.rings[index].x && ring.y === today.rings[index].y),
    JSON.stringify(later.rings.map((ring) => [ring.x, ring.y])),
  );
}

console.log('');
if (failures > 0) {
  console.log(`LUMI RINGS FAILED (${failures})`);
  process.exit(1);
}
console.log('LUMI RINGS OK');
