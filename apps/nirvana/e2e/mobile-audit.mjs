// Mobilní audit herních povrchů: 390×844, dotykový kontext, reálný vstup do hry.
// Kontroluje: horizontální přesah, dotykové ovládání po startu hry,
// překryv navigační lišty s obsahem, JS chyby.
// Spustit: node apps/nirvana/e2e/mobile-audit.mjs
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE ??
    '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright'));
}

const BASE = process.env.NIRVANA_BASE ?? 'http://127.0.0.1:3010';
const EXE =
  process.env.CHROME_PATH ??
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell';

/** Co od každé stránky čekáme po vstupu do hry. */
const PAGES = [
  {
    path: '/mars',
    name: 'Mars aréna',
    start: /Vstoupit do arény|Enter the arena/i,
    control: '.arena-touch',
    minControls: 3,
  },
  {
    path: '/venus',
    name: 'Venuše',
    start: /Vstoupit na start|Na start|Start/i,
    control: '.touch-pad',
    minControls: 4,
  },
  {
    path: '/mercury',
    name: 'Merkur',
    start: /Cvičit proti botovi|Practice vs bot/i,
    control: '.duel-touch',
    minControls: 4,
  },
  { path: '/park', name: 'Pouť', start: /Pong/i, control: '.park-touch', minControls: 5 },
  {
    path: '/earth',
    name: 'Země (MOBA)',
    start: /Vstoupit na Zemi|Enter Earth/i,
    control: '.moba-touch',
    minControls: 6,
  },
  { path: '/avatars', name: 'Avatar', start: null, control: null, minControls: 0 },
];

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

let problems = 0;
const fail = (name, message) => {
  problems += 1;
  console.log(`FAIL ${name} — ${message}`);
};

for (const spec of PAGES) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/401|404|favicon|net::ERR/.test(m.text())) errors.push(m.text());
  });

  try {
    await page.goto(`${BASE}${spec.path}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(3000);

    // ── 1) přesah dokumentu ─────────────────────────────────────────
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 2) fail(spec.name, `horizontální přesah ${overflow}px`);

    // ── 2) vstup do hry a dotykové ovládání ─────────────────────────
    let controls = 0;
    if (spec.start) {
      const button = page.getByRole('button', { name: spec.start }).first();
      await button.click({ timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(3500);

      if (spec.control) {
        const visible = await page.locator(spec.control).isVisible().catch(() => false);
        controls = await page
          .locator(`${spec.control} button, ${spec.control} .arena-touch-stick`)
          .count()
          .catch(() => 0);
        if (!visible) fail(spec.name, `dotykové ovládání ${spec.control} není vidět`);
        if (controls < spec.minControls) {
          fail(spec.name, `málo ovládacích prvků (${controls} < ${spec.minControls})`);
        }
      }

      // během hry na mobilu nemá navigace překážet
      const hudHidden = await page.evaluate(() => {
        const hud = document.querySelector('.game-hud');
        if (!hud) return true;
        return getComputedStyle(hud).display === 'none';
      });
      if (!hudHidden) fail(spec.name, 'navigační lišta zůstala vidět během hry');
    }

    // ── 3) překryv lišty s obsahem (mimo hru) ───────────────────────
    if (!spec.start) {
      const overlap = await page.evaluate(() => {
        const hud = document.querySelector('.game-hud');
        const panel = document.querySelector('.park-panel');
        if (!hud || !panel) return 0;
        const h = hud.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        return Math.max(0, Math.round(h.top - p.bottom));
      });
      if (overlap < 0) fail(spec.name, `lišta překrývá panel o ${-overlap}px`);
    }

    if (errors.length) fail(spec.name, `JS chyby: ${errors.slice(0, 2).join(' | ')}`);

    console.log(
      `OK   ${spec.name.padEnd(12)} overflow=${overflow}px ovládání=${controls} chyby=${errors.length}`,
    );
    await page.screenshot({
      path: `.artifacts/render/mobile-20261102/${spec.name.replace(/\s+/g, '-').toLowerCase()}.png`,
    });
  } catch (error) {
    fail(spec.name, error.message.split('\n')[0]);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nmobile-audit: ${problems === 0 ? 'PASSED' : `${problems} problémů`}`);
process.exit(problems === 0 ? 0 : 1);
