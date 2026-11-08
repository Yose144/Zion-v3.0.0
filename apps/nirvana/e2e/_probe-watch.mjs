// Sonda: watch režim nemá exit tlačítka (SpectatorBar je jediný chrome)
// a solo stats proudí (throttle 10 Hz neublafoval HUD).
// Spustit: NIRVANA_BASE=http://127.0.0.1:3000 NIRVANA_AUDIT_HEADER=1 node e2e/_probe-watch.mjs
import { launch, PHONE } from './_browser.mjs';

const BASE = process.env.NIRVANA_BASE ?? 'http://127.0.0.1:3010';
const auditHeaders = {};
if (process.env.NIRVANA_AUDIT_HEADER === '1') auditHeaders['x-render-audit'] = '1';

const browser = await launch();
const context = await browser.newContext({
  viewport: PHONE.viewport,
  isMobile: true,
  hasTouch: true,
  extraHTTPHeaders: auditHeaders,
});
let problems = 0;
const fail = (n, m) => {
  problems += 1;
  console.log(`FAIL ${n} — ${m}`);
};
const ok = (n, m = '') => console.log(`ok   ${n}${m ? ` — ${m}` : ''}`);

/** Počty prvků podle selektoru na stránce. */
async function count(page, sel) {
  return page.evaluate((s) => document.querySelectorAll(s).length, sel);
}

// ── 1) watch stránky: žádný herní exit, SpectatorBar ano ────────────
const WATCH = [
  { path: '/venus?watch=race-2', exit: '.game-exit', bar: '.spectator-bar, .race-spectator, [class*="spectator"]' },
  { path: '/mercury?watch=fight-2', exit: '.duel-exit', bar: '[class*="spectator"]' },
  { path: '/mars?watch=arena-2', exit: '.game-exit', bar: '[class*="spectator"]' },
  { path: '/fleet?watch=fleet-1', exit: '.fleet-exit', bar: '[class*="spectator"]' },
  { path: '/earth?watch=moba-2', exit: '.moba-link', bar: '[class*="spectator"]' },
  { path: '/lumi?watch=lumi-2', exit: '.game-exit', bar: '[class*="spectator"]' },
];

for (const spec of WATCH) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 6000));
    const exits = await count(page, spec.exit);
    const bars = await count(page, spec.bar);
    // .moba-link u earth je i "full roster" odkaz — ten smí zůstat, ale ne v playing
    if (spec.path.startsWith('/earth')) {
      // v watch+playing nemá být menu button; roster link je v pick fázi
      const menu = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button.moba-link')];
        return btns.length;
      });
      if (menu > 0) fail('Earth watch', `menu button vidět (${menu})`);
      else ok('Earth watch', 'žádné menu tlačítko');
    } else if (exits > 0) {
      fail(spec.path, `exit prvky: ${exits}`);
    } else {
      ok(spec.path, 'žádný exit');
    }
    if (bars === 0) fail(spec.path, 'SpectatorBar chybí');
    else ok(`${spec.path} bar`, `${bars}×`);
  } catch (e) {
    fail(spec.path, e.message.slice(0, 120));
  } finally {
    await page.close().catch(() => {});
  }
}

// ── 2) /venus solo: stats proudí (throttle) ──────────────────────────
{
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/venus`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 5000));
    const started = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /start|startovní|grid/i.test(b.textContent ?? ''));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!started) fail('/venus solo', 'start tlačítko nenalezeno');
    await new Promise((r) => setTimeout(r, 4000));
    const hud = await page.evaluate(() => document.querySelector('.race-hud')?.textContent ?? '');
    const boards = await count(page, '.race-board li');
    if (!hud.includes('km/h')) fail('/venus solo', `HUD bez rychlosti: "${hud.slice(0, 60)}"`);
    else ok('/venus solo HUD', hud.replace(/\s+/g, ' ').slice(0, 70));
    if (boards === 0) fail('/venus solo', 'tabule prázdná');
    else ok('/venus solo tabule', `${boards} řádků`);
  } catch (e) {
    fail('/venus solo', e.message.slice(0, 120));
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.close();
console.log(problems === 0 ? '\nPASSED' : `\n${problems} problem(ů)`);
process.exit(problems === 0 ? 0 : 1);
