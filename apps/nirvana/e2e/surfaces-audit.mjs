// Audit povrchů, které mobile-audit.mjs nepokrývá: overflow, JS chyby,
// přítomnost Herního HUD, viditelnost hlavního CTA na telefonu.
// Spustit: NIRVANA_BASE=http://127.0.0.1:3000 node e2e/surfaces-audit.mjs
import { launch, PHONE } from './_browser.mjs';

const BASE = process.env.NIRVANA_BASE ?? 'http://127.0.0.1:3010';
const LANDSCAPE = process.env.MOBILE_LANDSCAPE === '1';
const VIEWPORT = LANDSCAPE ? { width: 844, height: 390 } : PHONE.viewport;

/** path → co má být vidět po načtení (volitelné selectory). */
const PAGES = [
  { path: '/lumi', name: 'LUMI', expect: '.game-hud' },
  { path: '/uranus', name: 'Uran', expect: '.game-hud' },
  { path: '/neptune', name: 'Neptun', expect: '.game-hud' },
  { path: '/pluto', name: 'Pluto', expect: '.game-hud' },
  { path: '/multiplayer', name: 'Multiplayer', expect: '.game-hud' },
  { path: '/hiran', name: 'Hiran', expect: null },
  { path: '/kridla', name: 'Křídla', expect: null },
  { path: '/present/matrix', name: 'Present Matrix', expect: null },
  { path: '/present/issobella', name: 'Present Issobella', expect: null },
  { path: '/', name: 'Vesmír', expect: '.game-hud' },
];

const auditHeaders = {};
if (process.env.NIRVANA_AUDIT_HEADER === '1') auditHeaders['x-render-audit'] = '1';
if (process.env.NIRVANA_PASS_COOKIE) {
  auditHeaders.cookie = `zion_nirvana_pass=${process.env.NIRVANA_PASS_COOKIE}`;
}

const browser = await launch();
let problems = 0;
const fail = (name, msg) => {
  problems += 1;
  console.log(`FAIL ${name} — ${msg}`);
};

// Playwright umí context s extraHTTPHeaders; puppeteer fallback dostane
// hlavičky přes page.setExtraHTTPHeaders (stejné API).
const context = browser.newContext
  ? await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, extraHTTPHeaders: auditHeaders })
  : null;

for (const spec of PAGES) {
  const page = context ? await context.newPage() : await browser.newPage({ viewport: VIEWPORT, isMobile: true, hasTouch: true });
  if (!context && auditHeaders && page.setExtraHTTPHeaders) {
    await page.setExtraHTTPHeaders(auditHeaders).catch(() => {});
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  try {
    await page.goto(`${BASE}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 5000));

    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
    }));
    if (m.scrollW > m.clientW + 1) fail(spec.name, `horizontální přesah ${m.scrollW} > ${m.clientW}`);
    if (m.scrollH > m.clientH + 2000) fail(spec.name, `podezřele vysoký obsah ${m.scrollH}px`);

    const before = problems;
    if (spec.expect) {
      // page.$ funguje v Playwright i Puppeteer (ElementHandle.boundingBox).
      const el = await page.$(spec.expect).catch(() => null);
      const box = el ? await el.boundingBox().catch(() => null) : null;
      if (!box) fail(spec.name, `${spec.expect} chybí`);
      else if (box.x + box.width > m.clientW + 1 || box.x < -1)
        fail(spec.name, `${spec.expect} mimo viewport x=${Math.round(box.x)} w=${Math.round(box.width)}`);
    }

    // viditelné interaktivní prvky v horní polovině (CTA, brány, tlačítka)
    const cta = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a[href], button')].filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 30 && r.height > 20 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight;
      });
      return els.length;
    });
    if (cta === 0) fail(spec.name, 'žádný viditelný odkaz/tlačítko');

    // 401/403 = auth API anonymního uživatele (stejný filtr jako mobile-audit).
    const real = errors.filter((e) => !/401|403|404|favicon|net::|WebSocket|ws:\/\/|Download the React|synchronously unmount/i.test(e));
    if (real.length) fail(spec.name, `JS chyby: ${real.slice(0, 3).join(' | ')}`);
    if (problems === before) console.log(`ok   ${spec.name}  (${spec.path})  cta=${cta}  ${m.scrollW}x${m.clientH}`);
  } catch (e) {
    fail(spec.name, `load selhal: ${e.message.slice(0, 160)}`);
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.close();
console.log(problems === 0 ? '\nPASSED' : `\n${problems} problem(ů)`);
process.exit(problems === 0 ? 0 : 1);
