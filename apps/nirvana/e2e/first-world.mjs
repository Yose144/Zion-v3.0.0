// E2E: PRVNÍ SVĚT (MOBA) — hra se opravdu rozjede v prohlížeči.
//
// Ověřuje, že se nastartuje simulace, přijdou minioni, kouzlo trefí soupeře
// a pád Nexy ukončí zápas. Vše přes `?mobaDebug=1` háček, takže test nesahá
// na vnitřnosti Reactu.
//
// Spustit: node apps/nirvana/e2e/first-world.mjs
// Předpoklad: `next start -p 3010` (nebo BASE=…).

import { launch } from './_browser.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3010';
const OUT = process.env.OUT ?? '.artifacts/render/first-world-20261102';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prohlížeč řeší `_browser.mjs` (CHROME_PATH → puppeteer cache → systémový).
// Dřív tu byla hardcoded cesta z macOS, takže test jinde nesel.
const browser = await launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  // `401` z `/api/auth/me` je pre-existing (host bez ZIS session) — není to chyba hry
  if (message.type() === 'error' && !message.text().includes('401')) errors.push(message.text());
});

try {
  await page.goto(`${BASE}/earth?mobaDebug=1`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForSelector('.moba-start', { timeout: 30_000 });

  const starters = await page.$$eval('.moba-pick-card', (cards) => cards.length);
  check('pick: dvanáct hrdinů', starters >= 12, String(starters));

  await page.click('.moba-start');
  await page.waitForFunction('typeof window.__mobaDebug === "function"', { timeout: 60_000 });

  const debug = () => page.evaluate(() => window.__mobaDebug?.() ?? null);

  const start = await debug();
  check('start: dva hrdinové', start?.heroes?.length === 2, JSON.stringify(start?.heroes?.length));
  check('start: tři uzly L5', start?.nodes?.length === 3, String(start?.nodes?.length));
  check('start: 26 struktur (věže + inhibitory + Nexy)', start?.towers?.length === 26, String(start?.towers?.length));
  check('start: čtyři kouzla', start?.spells?.length === 4 && start.spells[3].slot === 'R');
  check('objektivy: dvě runy na startu', start?.runes === 2, String(start?.runes));
  check('objektivy: boss je na mapě', start?.boss?.alive === true, JSON.stringify(start?.boss));
  await page.screenshot({ path: `${OUT}/start.png` });

  // obchod (F2): inventář a panel se opravdu vykreslí — počítají se reálné
  // selektory, ne „nějaká tlačítka" (jinak projde i prázdný panel).
  const invSlots = await page.$$('.moba-inv-slot');
  check('obchod: šest slotů inventáře', invSlots.length === 6, String(invSlots.length));
  await page.click('.moba-shop-toggle');

  // scoreboard (F6) — Tab nebo tlačítko; musí mít dvě tabulky (modrá/červená)
  await page.click('.moba-scoreboard-toggle');
  await page.waitForSelector('.moba-scoreboard', { timeout: 5000 }).catch(() => {});
  const teamBoards = await page.$$('.moba-board');
  check('scoreboard: dvě tabulky týmů', teamBoards.length === 2, String(teamBoards.length));
  await page.click('.moba-scoreboard-toggle');
  await page.waitForSelector('.moba-shop-panel', { timeout: 5000 }).catch(() => {});
  const shopItems = await page.$$('.moba-shop-item');
  check('obchod: devatenáct itemů v panelu', shopItems.length === 19, String(shopItems.length));
  await page.click('.moba-shop-toggle');

  // Čekej na **podmínku**, ne na pevný čas: simulace běží po krocích a na
  // pomalém GPU (swiftshader) se posune pomaleji než skutečné hodiny.
  // Pevné `sleep` dělalo test zelený na Macu a červený jinde.
  // Polling z Node (ne `page.waitForFunction(fn, args, opts)`), protože
  // Playwright a Puppeteer mají jiné pořadí argumentů — tohle je přenosné.
  const waitFor = async (predicate, timeout = 45_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await predicate()) return true;
      await sleep(250);
    }
    return false;
  };

  // vlna minionů
  const waveArrived = await waitFor(async () => ((await debug())?.minions ?? 0) > 0);
  const withWave = await debug();
  check('vlna: minioni přišli', waveArrived, String(withWave?.minions));

  // kouzlo na soupeře — nejdřív se k němu musíme dostat na dostřel (Q = 12 m)
  // Teleport i seslání v **jednom** evaluate: soupeř je bot a mezi dvěma
  // dotazy na stránku se pohne, takže bychom mířili tam, kde už není.
  const before = withWave.heroes.find((hero) => hero.team === 'red').hp;
  await page.evaluate(() => {
    const debugNow = window.__mobaDebug();
    const foe = debugNow.heroes.find((hero) => hero.team === 'red');
    if (!foe) return;
    window.__mobaDebug().teleport(foe.x - 6, foe.z);
    window.__mobaDebug().cast('Q', foe.x, foe.z);
  });
  const foeHurt = await waitFor(async () => {
    const now = (await debug())?.heroes?.find((hero) => hero.team === 'red');
    return (now?.hp ?? before) < before;
  }, 15_000);
  const afterCast = await debug();
  const foeAfter = afterCast.heroes.find((hero) => hero.team === 'red');
  check('kouzlo: soupeř ztratil HP', foeHurt, `${before} → ${foeAfter.hp}`);
  await page.screenshot({ path: `${OUT}/fight.png` });

  // uzly: teleport na uzel a čekat na převzetí (Kailash -12/-26)
  await page.evaluate(() => {
    window.__mobaDebug().teleport(-12, -26);
  });
  const captured = await waitFor(async () =>
    ((await debug())?.nodes ?? []).some((node) => node.owner === 'blue'),
  );
  check('uzel L5: převzat', captured, JSON.stringify((await debug()).nodes));

  // konec zápasu — Nexa má 4000 HP, takže ho sundej celou
  await page.evaluate(() => window.__mobaDebug().damageNexus(4000));
  const ended = await waitFor(async () => (await debug())?.ended === 'blue', 20_000);
  check('konec: Nexa padla', ended, String((await debug()).ended));
  // Overlay je React state — po `ended` se může objevit až o snímek později
  // (a s tabulkami F6 je render o pár ms delší). Čekej na selektor, ne na jeden dotaz.
  const resultOverlay = await waitFor(async () => Boolean(await page.$('.moba-result')), 8000);
  check('konec: overlayer s výsledkem', resultOverlay);
  await page.screenshot({ path: `${OUT}/victory.png` });

  check('konzole bez chyb', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
