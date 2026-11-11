// E2E: Merkur duel ve dvou headless prohlížečích proti lokální zion-nirvana-net.
// Předpoklady: služba na :3011 (s NIRVANA_NET_ALLOWED_ORIGINS zahrnující :3010)
// a appko `next start -p 3010` builduté s NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net.
//
// Spustit:  node apps/nirvana/e2e/mercury-duel.mjs
import { resolveExecutable } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // lokální node_modules mohou být zrovna pryč (npm paralelní session) → globální playwright
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const globalPath =
    process.env.PLAYWRIGHT_MODULE ??
    '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright';
  ({ chromium } = require(globalPath));
}

const BASE = process.env.MERCURY_BASE ?? 'http://127.0.0.1:3010';
// Spustitelný prohlížeč řeší sdílený resolver — natvrdo macOS cesta
// se na stroji bez puppeteer cache rozbije.
const EXE = resolveExecutable();

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debug = (page) => page.evaluate(() => (window).__duelDebug?.() ?? null);
const poll = async (page, predicate, timeoutMs = 20_000) => {
  const started = Date.now();
  for (;;) {
    const state = await debug(page);
    if (state && predicate(state)) return state;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(200);
  }
};

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

const errors = [];
function watch(page, tag) {
  page.on('pageerror', (error) => errors.push(`${tag} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // pre-existing šum, který nehru nijak narušit (chyba načtení 401/404 je benigní)
    if (/401|404|favicon|net::ERR/.test(text)) return;
    errors.push(`${tag} console: ${text}`);
  });
}

// ZAP brána (proxy.ts) + `ensureApp` postará o `next start` a oracle stub.
const app = await ensureApp({ base: BASE });
const host = new URL(app.base).hostname;

async function openDuel(page) {
  await grantPass(page, host);
  await page.goto(`${BASE}/mercury?duelDebug=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Online duel/i }).click();
  // první paint WebGL na swiftshaderu = ~1 min (R3F mount až po GL init); na reálném GPU vteřiny
  const state = await poll(page, (s) => s.hud.state !== null || s.hud.connected, 120_000);
  return state;
}

try {
  console.log('\n== sólový trénink ==');
  const solo = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(solo, 'solo');
  await grantPass(solo, host);
  await solo.goto(`${BASE}/mercury`, { waitUntil: 'networkidle' });
  await solo.getByRole('button', { name: /Champion|Mistr/i }).click();
  check(
    'obtížnost soupeře jde vybrat',
    (await solo.getByRole('button', { name: /Champion|Mistr/i }).getAttribute('aria-pressed')) === 'true',
  );
  await solo.locator('.arena-actions button').first().click();
  await solo.locator('.duel-top').waitFor({ timeout: 5000 });
  check('trénink zobrazí soubojové HUD', await solo.locator('.duel-top').count() === 1);
  await solo.locator('.duel-exit').click();
  await solo.locator('.arena-panel').waitFor({ timeout: 3000 });
  check('Menu bezpečně ukončí trénink', await solo.locator('.arena-panel').count() === 1);
  await solo.close();

  console.log('\n== online duel ==');
  const a = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const b = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(a, 'A');
  watch(b, 'B');

  const stateA = await openDuel(a);
  check('A připojena do duelu', Boolean(stateA?.hud?.state), JSON.stringify(stateA?.hud ?? null).slice(0, 120));

  const stateB = await openDuel(b);
  check('B připojena do duelu', Boolean(stateB?.hud?.state), JSON.stringify(stateB?.hud ?? null).slice(0, 120));

  // A teď musí ve snapshotu vidět člověka, ne meta-bota
  const humanOnA = await poll(a, (s) => !s.foe.id.startsWith('bot-'), 12_000);
  const humanOnB = await poll(b, (s) => !s.foe.id.startsWith('bot-'), 12_000);
  check(
    'oba vidí živého soupeře (ne meta-bota)',
    Boolean(humanOnA && humanOnB),
    `Afoe=${humanOnA?.foe.id ?? '—'} Bfoe=${humanOnB?.foe.id ?? '—'}`,
  );

  // A doběhne na B a mlátí pěstí — pohyb i poškození počítá SERVER
  const before = await debug(a);
  await a.keyboard.down('d');
  const moved = await poll(a, (s) => Math.abs(s.self.x - before.self.x) > 2, 12_000);
  check('pohyb A se projevil v snapshotu serveru', Boolean(moved), `x ${before.self.x}→${moved?.self.x}`);
  await a.keyboard.up('d');

  // honení: A musí být v dosahu (2,15 m), jinak pěst zasáhne vzduch —
  // podobně jako test v fight.mjs, ale přes reálné klávesy prohlížeče
  // Zdraví B před prvním úderem — ragdoll balance se může měnit, takže
  // test nesmí tvrdit „< 100“, ale „kleslo proti startu“.
  const bStart = await poll(b, (s) => s.hud && s.hud.selfHp > 0, 10_000);
  const bHp0 = bStart?.hud?.selfHp ?? 150;
  let hurtOnA = null;
  for (let index = 0; index < 130 && !hurtOnA; index++) {
    const s = await debug(a);
    if (s) {
      const gap = s.foe.x - s.self.x;
      // ragdoll pěst dosáhne ~1,3 m mezi středy těl, ne 2,15 m jako dřív
      if (Math.abs(gap) > 1.2 && !s.foe.ko) {
        await a.keyboard.down(gap > 0 ? 'd' : 'a');
        await a.keyboard.up(gap > 0 ? 'a' : 'd');
        await a.keyboard.up('j');
      } else {
        await a.keyboard.up('d');
        await a.keyboard.up('a');
        await a.keyboard.down('j');
      }
      if (s.hud.foeIsBot === false && s.hud.foeHp < 150) hurtOnA = s;
    }
    await sleep(120);
  }
  check('pěst A ubírá B HP (pohled A)', Boolean(hurtOnA), `foeHp=${hurtOnA?.hud?.foeHp ?? '—'}`);
  const hurtOnB = await poll(b, (s) => s.hud.selfHp < bHp0, 15_000);
  check('zásah vidí i B (server je autorita)', Boolean(hurtOnB), JSON.stringify(hurtOnB?.self?.hp ?? null));
  await a.keyboard.up('j');

  await sleep(1200);
  await a.screenshot({ path: '.artifacts/render/mercury-20261101/duel-live.png' }).catch(() => {});

  check('bez JS chyb ve dvou klientech', errors.length === 0, errors.join(' | '));

  // odpojení B → A musí dostat meta-bota, duel nesmí zamrznout.
  // Pozor: server drží odpojenému hráči sedlo RESUME_GRACE_MS (45 s,
  // reconnect grace) — bot nastoupí až po jeho vypršení, ne hned.
  await b.close();
  const botBack = await poll(a, (s) => s.foe.id.startsWith('bot-'), 55_000);
  check('po odpojení soupeře doplní server bota', Boolean(botBack), botBack?.foe.id);
} catch (error) {
  check('E2E nespadlo', false, String(error));
  console.log(errors.join('\n'));
} finally {
  await browser.close();
  app.stop();
}

console.log(`\nmercury-e2e: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
