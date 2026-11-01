// E2E: PRVNÍ SVĚT (MOBA) — hra se opravdu rozjede v prohlížeči.
//
// Ověřuje, že se nastartuje simulace, přijdou minioni, kouzlo trefí soupeře
// a pád Nexy ukončí zápas. Vše přes `?mobaDebug=1` háček, takže test nesahá
// na vnitřnosti Reactu.
//
// Spustit: node apps/nirvana/e2e/first-world.mjs
// Předpoklad: `next start -p 3010` (nebo BASE=…).

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const globalPath =
    process.env.PLAYWRIGHT_MODULE ?? '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright';
  ({ chromium } = require(globalPath));
}

const BASE = process.env.BASE ?? 'http://127.0.0.1:3010';
const OUT = process.env.OUT ?? '.artifacts/render/first-world-20261102';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chromium bereme z puppeteer cache — playwright si tu verzi nestáhl (stejná
// past jako u mercury-duel; EXE jde přepsat přes CHROME_PATH).
const EXE =
  process.env.CHROME_PATH ??
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
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
  check('start: čtrnáct struktur', start?.towers?.length === 14, String(start?.towers?.length));
  check('start: čtyři kouzla', start?.spells?.length === 4 && start.spells[3].slot === 'R');
  await page.screenshot({ path: `${OUT}/start.png` });

  // vlna minionů
  await sleep(8000);
  const withWave = await debug();
  check('vlna: minioni přišli', (withWave?.minions ?? 0) > 0, String(withWave?.minions));

  // kouzlo na soupeře
  const foe = withWave.heroes.find((hero) => hero.team === 'red');
  const before = foe.hp;
  await page.evaluate(({ x, z }) => window.__mobaDebug().cast('Q', x, z), { x: foe.x, z: foe.z });
  await sleep(600);
  const afterCast = await debug();
  const foeAfter = afterCast.heroes.find((hero) => hero.team === 'red');
  check('kouzlo: soupeř ztratil HP', foeAfter.hp < before, `${before} → ${foeAfter.hp}`);
  await page.screenshot({ path: `${OUT}/fight.png` });

  // uzly: teleport na uzel a čekat na převzetí (Kailash -12/-26)
  await page.evaluate(() => {
    window.__mobaDebug().teleport(-12, -26);
  });
  await sleep(3600);
  const captured = await debug();
  check('uzel L5: převzat', captured.nodes.some((node) => node.owner === 'blue'), JSON.stringify(captured.nodes));

  // konec zápasu
  await page.evaluate(() => window.__mobaDebug().damageNexus(3400));
  await sleep(2200);
  const ended = await debug();
  check('konec: Nexa padla', ended.ended === 'blue', String(ended.ended));
  const resultOverlay = await page.$('.moba-result');
  check('konec: overlayer s výsledkem', Boolean(resultOverlay));
  await page.screenshot({ path: `${OUT}/victory.png` });

  check('konzole bez chyb', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
