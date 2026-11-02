// E2E: PRVNÍ SVĚT — online 2v2 ve dvou prohlížečích.
//
// Předpoklady (jako u mercury-duel):
//   - `zion-nirvana-net` běží na :3011 s originem http://127.0.0.1:3010
//   - appka je buildnutá s NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net
//   - `next start -p 3010`
//
// Spustit: node apps/nirvana/e2e/moba-online.mjs

import { launch } from './_browser.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3010';
const OUT = process.env.OUT ?? '.artifacts/render/first-world-20261102';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prohlížeč řeší `_browser.mjs` (Playwright → Puppeteer → systémový Chrome).
const browser = await launch({ headless: true });

async function openPlayer(label) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('401')) errors.push(message.text());
  });
  await page.goto(`${BASE}/earth?mobaDebug=1`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector('.moba-start', { timeout: 30_000 });
  // přepni na online
  await page.click('.moba-mode-btn:nth-child(2)');
  await page.click('.moba-start');
  await page.waitForFunction('typeof window.__mobaDebug === "function"', { timeout: 60_000 });
  return { page, errors, label };
}

const debug = (player) => player.page.evaluate(() => window.__mobaDebug?.() ?? null);
const poll = async (player, predicate, timeoutMs = 30_000) => {
  const started = Date.now();
  for (;;) {
    const state = await debug(player);
    if (state && predicate(state)) return state;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(250);
  }
};

try {
  const a = await openPlayer('A');
  const b = await openPlayer('B');

  // Zápas běží. S **mlhou války** ale hráč nevidí celou mapu — vidí svůj
  // tým (a to, co jeho jednotky vidí), takže test nesmí čekat 6 hrdinů.
  const runningA = await poll(a, (state) => state.phase === 'running' && state.heroes.length >= 1, 45_000);
  check('A: zápas běží', Boolean(runningA), JSON.stringify(await debug(a)));
  const runningB = await poll(b, (state) => state.phase === 'running' && state.heroes.length >= 1, 45_000);
  check('B: zápas běží', Boolean(runningB));

  if (runningA && runningB) {
    check('A: vidí vlastní id', runningA.heroes.some((hero) => hero.id === runningA.you), String(runningA.you));
    check('B: vidí vlastní id', runningB.heroes.some((hero) => hero.id === runningB.you), String(runningB.you));
    const teamA = runningA.heroes.find((hero, index) => hero.id === runningA.you)?.team;
    check(
      'mlha: na startu vidím jen svůj tým',
      runningA.heroes.every((hero) => hero.team === teamA),
      runningA.heroes.map((hero) => `${hero.team}:${hero.id}`).join(' '),
    );
    check(
      'mlha: soupeřova hrdina není ve snapshotu',
      !runningA.heroes.some((hero) => hero.id === runningB.you),
      String(runningB.you),
    );
    check('A i B: tři uzly L5', runningA.nodes.length === 3 && runningB.nodes.length === 3);

    // A pošle pohyb — vlastní posun musí potvrdit server (predikce nestačí).
    const before = runningA.heroes.find((hero) => hero.id === runningA.you);
    // Stránka musí být vpředu — hra správně pouští klávesy při `blur`
    // a pozadí navíc throttluje requestAnimationFrame.
    await a.page.bringToFront();
    await sleep(300);
    await a.page.keyboard.down('KeyD');
    await sleep(900);
    await a.page.keyboard.up('KeyD');
    await sleep(500);
    const movedA = await poll(
      a,
      (state) => {
        const seen = state.heroes.find((hero) => hero.id === before.id);
        return seen && Math.abs(seen.x - before.x) > 0.3;
      },
      8000,
    );
    check('pohyb: server potvrdil posun', Boolean(movedA));
    // Protistrana ho vidět NEMÁ — jsou na opačných koncích mapy.
    const bSeesA = await poll(
      b,
      (state) => state.heroes.some((hero) => hero.id === before.id),
      1500,
    );
    check('mlha: protistrana A nevidí', !bSeesA);

    // kouzlo: A sešle Q, B uvidí projektil nebo změnu stavu
    const snapshotBefore = await debug(a);
    await a.page.bringToFront();
    await sleep(200);
    await a.page.keyboard.press('KeyQ');
    await sleep(900);
    const snapshotAfter = await debug(a);
    const meBefore = snapshotBefore.heroes.find((hero) => hero.id === snapshotBefore.you);
    const meAfter = snapshotAfter.heroes.find((hero) => hero.id === snapshotAfter.you);
    check('kouzlo: A má cooldown', meAfter.cooldowns.Q > 0, JSON.stringify(meAfter.cooldowns));
    check('kouzlo: A spotřeboval manu', meAfter.mana < meBefore.mana, `${meBefore.mana} → ${meAfter.mana}`);

    // minimapa: plátno existuje a má nenulový obsah
    const minimap = await a.page.evaluate(() => {
      const canvas = document.querySelector('.moba-minimap canvas');
      if (!canvas) return null;
      const context = canvas.getContext('2d');
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) painted += 1;
      return { width: canvas.width, height: canvas.height, painted };
    });
    check('minimapa: plátno kreslí', Boolean(minimap && minimap.painted > 500), JSON.stringify(minimap));

    // predikce: vlastní hrdina má predikovanou polohu blízko serveru
    const predicted = (await debug(a))?.predicted;
    // obchod: tři itemy v HUD (startovní zlato 320 < 400 → tlačítka zamčená)
    const shop = await a.page.evaluate(() => {
      const items = [...document.querySelectorAll('.moba-shop-item')];
      return { count: items.length, disabled: items.filter((item) => item.disabled).length, gold: document.querySelector('.moba-shop-gold')?.textContent ?? '' };
    });
    check('obchod: tři itemy v HUD', shop.count === 3, JSON.stringify(shop));
    check('obchod: bez zlata zamčeno', shop.disabled === 3, JSON.stringify(shop));
    check('obchod: zlato vidět', /\d/.test(shop.gold), shop.gold);

    check('predikce: aktivní a u serveru', Boolean(predicted?.active) && Math.hypot(predicted.x - meAfter.x, predicted.z - meAfter.z) < 4, JSON.stringify(predicted));

    check('A: bez chyb v konzoli', a.errors.length === 0, a.errors.slice(0, 2).join(' | '));
    check('B: bez chyb v konzoli', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
    await a.page.screenshot({ path: `${OUT}/online-a.png` });
    await b.page.screenshot({ path: `${OUT}/online-b.png` });
  }
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
