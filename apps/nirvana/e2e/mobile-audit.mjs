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
/** Na šířku je málo výšky — ovládání se zmenšuje, chce to vlastní běh. */
const LANDSCAPE = process.env.MOBILE_LANDSCAPE === '1';
const VIEWPORT = LANDSCAPE ? { width: 844, height: 390 } : { width: 390, height: 844 };
/**
 * Prohlížeč: `CHROME_PATH` → puppeteer cache → systémový Chrome.
 * Cache se občas uklidí (stalo se 2026-11-02, audit spadl na chybějící
 * binárce), takže poslední instance musí být něco, co na stroji opravdu je.
 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

const { existsSync } = await import('node:fs');
const EXE = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!EXE) {
  console.error('mobile-audit: žádný prohlížeč — nastav CHROME_PATH');
  process.exit(2);
}

/** Co od každé stránky čekáme po vstupu do hry. */
const PAGES = [
  {
    path: '/mars',
    name: 'Mars aréna',
    start: /Vstoupit do arény|Enter the arena/i,
    control: '.arena-touch',
    minControls: 3,
    /* citlivost pohledu musí jít změnit — na tabletu je výchozí pomalá */
    slider: 'input[type="range"]',
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
    /* klepnutí do země + kouzlo musí opravdu seslat (spadne mana) */
    cast: { bar: '.moba-bar.is-mana span', button: '.moba-touch-btn.is-spell' },
  },
  {
    path: '/saturn',
    name: 'Saturn tanky',
    start: /Tanky/i,
    control: '.tanks-touch',
    minControls: 5,
  },
  { path: '/avatars', name: 'Avatar', start: null, control: null, minControls: 0 },
];

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

const context = await browser.newContext({
  viewport: VIEWPORT,
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

    // ── 2) nastavení citlivosti (jen aréna) ─────────────────────────
    if (spec.slider) {
      const slider = page.locator(spec.slider).first();
      const visible = await slider.isVisible().catch(() => false);
      if (!visible) fail(spec.name, 'chybí ovladač citlivosti pohledu');
      else {
        // změna musí přežít (localStorage), jinak si hráč nic nenastaví
        await slider.fill('2.5').catch(() => {});
        const stored = await page.evaluate(() => window.localStorage.getItem('nirvana.arena.look'));
        if (stored !== '2.5') fail(spec.name, `citlivost se neuložila (${stored})`);
        await slider.fill('1').catch(() => {});
      }
    }

    // ── 3) vstup do hry a dotykové ovládání ─────────────────────────
    let controls = 0;
    if (spec.start) {
      const button = page.getByRole('button', { name: spec.start }).first();
      await button.click({ timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(3500);

      if (spec.control) {
        const visible = await page.locator(spec.control).isVisible().catch(() => false);
        controls = await page
          .locator(`${spec.control} button, ${spec.control} .arena-touch-stick, ${spec.control} .moba-touch-stick`)
          .count()
          .catch(() => 0);
        if (!visible) fail(spec.name, `dotykové ovládání ${spec.control} není vidět`);
        if (controls < spec.minControls) {
          fail(spec.name, `málo ovládacích prvků (${controls} < ${spec.minControls})`);
        }
      }

      // kouzlo přes dotyk musí doletět až do simulace
      if (spec.cast) {
        const readMana = async () => {
          const text = await page.locator(spec.cast.bar).first().innerText().catch(() => '0 / 0');
          return Number(text.split('/')[0].trim()) || 0;
        };
        // joystick musí poslat pohyb (klávesa W) — jinak hrdina stojí
        await page.evaluate(() => {
          window.__mobaKeys = [];
          window.addEventListener('keydown', (e) => window.__mobaKeys.push(e.code));
        });
        const stick = await page.locator('.moba-touch-stick').boundingBox();
        if (stick) {
          await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
          await page.mouse.down();
          await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 30);
          await page.waitForTimeout(150);
          await page.mouse.up();
          const keys = await page.evaluate(() => window.__mobaKeys ?? []);
          if (!keys.includes('KeyW')) fail(spec.name, `joystick neposlal pohyb (${keys.join(',')})`);
        } else {
          fail(spec.name, 'joystick nemá rozměry');
        }

        const before = await readMana();
        // klepnutí do scény = zamíření (a útok), pak kouzlo na to místo
        await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
        await page.waitForTimeout(250);
        await page.locator(spec.cast.button).first().click({ force: true }).catch(() => {});
        /**
         * Mana ve fontáně **regeneruje 12 %/s**, takže se nesmí čekat na
         * „jedno čtení po X ms": HUD posílá telemetrii 5×/s a při pomalém
         * snímku (swiftshader) se snížení stihne dorovnat. Hledá se proto
         * **propad** mezi vzorky: 40 ms interval, strop 1 s. Regenerace je
         * ~2 many za vzorek, kouzlo stojí 26 — propad > 8 je jednoznačný.
         */
        let after = before;
        let lowest = before;
        for (let i = 0; i < 25; i += 1) {
          after = await readMana();
          if (after < lowest) lowest = after;
          if (lowest < before - 8) break;
          await page.waitForTimeout(40);
        }
        if (!(lowest < before - 8)) fail(spec.name, `kouzlo nesnížilo manu (${before} → ${after})`);
        else console.log(`      kouzlo: mana ${before} → ${lowest} (dotyk prošel do simulace)`);
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
      path: `.artifacts/render/mobile-20261102/${spec.name.replace(/\s+/g, '-').toLowerCase()}${LANDSCAPE ? '-landscape' : ''}.png`,
    });
  } catch (error) {
    fail(spec.name, error.message.split('\n')[0]);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nmobile-audit${LANDSCAPE ? ' (na šířku)' : ''}: ${problems === 0 ? 'PASSED' : `${problems} problémů`}`);
process.exit(problems === 0 ? 0 : 1);
