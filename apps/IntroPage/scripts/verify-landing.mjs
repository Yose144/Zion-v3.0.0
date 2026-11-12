/*
 * Functional check for the landing page (headless Chrome).
 *
 *   npx tsc --noEmit && npm run build
 *   python3 -m http.server 4321 --directory dist &
 *   node scripts/verify-landing.mjs         # INTRO_URL=… to point elsewhere
 *
 * Needs puppeteer — it is installed in the repo root node_modules, which Node
 * resolves from here. CHROME_PATH overrides the browser binary.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.INTRO_URL || 'http://127.0.0.1:4321';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);

const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e.message)));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.setViewport({ width: 1280, height: 900 });
await p.goto(BASE + '/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));

// structure
const s = await p.evaluate(() => ({
  h1: document.querySelectorAll('h1').length,
  sections: Array.from(document.querySelectorAll('#main > article')).map(a => a.id),
  anchorsOk: Array.from(document.querySelectorAll('#header nav a[href^="#"]')).every(a => document.getElementById(a.getAttribute('href').slice(1))),
  mainVisible: Array.from(document.querySelectorAll('#main > article')).every(a => Number(getComputedStyle(a).opacity) > 0.5),
  imgsNoAlt: Array.from(document.images).filter(i => i.alt === null).length,
  emptyAlt: Array.from(document.images).filter(i => i.alt === '').length,
  scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean).map(u => u.split('/').pop()),
  jquery: !!window.jQuery,
  starfield: !!document.getElementById('zion-starfield'),
  cssLinks: Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href.split('/').pop()),
}));
ok('single h1', s.h1 === 1, `h1=${s.h1}`);
ok('9 sections in order', s.sections.join(',') === 'intro,about,paths,mine,amenti,freeworld,status,support,contact', s.sections.join(','));
ok('every nav anchor resolves', s.anchorsOk);
ok('all sections visible without tabs', s.mainVisible);
ok('no img without alt', s.imgsNoAlt === 0, `empty-alt=${s.emptyAlt}`);
ok('jQuery not loaded', !s.jquery);
ok('starfield present', s.starfield);
ok('main.js loaded', s.scripts.some(x => x.startsWith('main.js')));
ok('no fontawesome css', !s.cssLinks.some(x => x.includes('fontawesome')), s.cssLinks.join(' '));

// language switch
await p.click('.floating-menu-toggle');
await new Promise(r => setTimeout(r, 300));
 await p.click('.floating-menu-lang[data-lang="en"]');
await new Promise(r => setTimeout(r, 600));
const en = await p.evaluate(() => ({
  lang: document.documentElement.lang,
  about: document.querySelector('#about h2').textContent,
  mineBtn: document.querySelector('#mine .button').textContent,
  introBold: !!document.querySelector('#intro p strong'),
  cookie: document.cookie.includes('zion_locale=en'),
}));
ok('EN switch sets lang', en.lang === 'en', en.lang);
ok('EN text applied', /About ZION/.test(en.about), en.about);
ok('EN button text', /Download miner/.test(en.mineBtn), en.mineBtn);
ok('i18n keeps authored <strong>', en.introBold);
ok('lang cookie written', en.cookie);

await p.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));
const persisted = await p.evaluate(() => ({ lang: document.documentElement.lang, about: document.querySelector('#about h2').textContent }));
ok('EN persists after reload', persisted.lang === 'en' && /About/.test(persisted.about), persisted.about);

await p.click('.floating-menu-toggle');
await new Promise(r => setTimeout(r, 300));
 await p.click('.floating-menu-lang[data-lang="cs"]');
await new Promise(r => setTimeout(r, 400));
const back = await p.evaluate(() => ({
  lang: document.documentElement.lang,
  about: document.querySelector('#about h2').textContent,
  bold: !!document.querySelector('#intro p strong'),
}));
ok('CS switch restores authored copy', back.lang === 'cs' && /O ZIONu/.test(back.about) && back.bold, back.about);

// dropdown
await p.evaluate(() => document.querySelector('.floating-menu-panel').setAttribute('aria-hidden', 'true'));
const drop = await p.evaluate(() => {
  const li = document.querySelector('.has-dropdown');
  const parent = li.querySelector('.dropdown-parent');
  parent.click();
  const open = li.classList.contains('open');
  const ul = li.querySelector('.nav-dropdown');
  const visible = getComputedStyle(ul).display !== 'none';
  return { open, visible, expanded: parent.getAttribute('aria-expanded') };
});
ok('dropdown opens on click', drop.open && drop.visible && drop.expanded === 'true');

// reduced motion
const p2 = await b.newPage();
await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p2.setViewport({ width: 1280, height: 900 });
await p2.goto(BASE + '/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));
const rm = await p2.evaluate(() => ({
  gateAnim: getComputedStyle(document.querySelector('#header .gate img')).animationName,
  articleAnim: getComputedStyle(document.querySelector('#main > article')).animationName,
  revealClass: document.documentElement.classList.contains('js-reveal'),
}));
ok('reduced motion disables gate animation', rm.gateAnim === 'none', rm.gateAnim);
ok('reduced motion disables card animation', rm.articleAnim === 'none', rm.articleAnim);
ok('reduced motion skips reveal', !rm.revealClass);

// mobile: play button loads the scene
const m = await b.newPage();
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await m.goto(BASE + '/', { waitUntil: 'networkidle2' });
await m.evaluate(() => document.querySelector('.nirvana-embed-shell')?.scrollIntoView({ block: 'center' }));
await new Promise(r => setTimeout(r, 600));
const beforePlay = await m.evaluate(() => ({ play: !!document.querySelector('.nirvana-embed-play'), canvas: !!document.querySelector('.nirvana-embed-canvas') }));
ok('mobile shows poster + play (no three.js)', beforePlay.play && !beforePlay.canvas);
const btn = await m.$('.nirvana-embed-play');
if (btn) await btn.click();
await new Promise(r => setTimeout(r, 5000));
const afterPlay = await m.evaluate(() => ({
  canvas: !!document.querySelector('.nirvana-embed-canvas canvas'),
  ready: !!document.querySelector('.nirvana-embed-canvas.is-ready'),
  play: !!document.querySelector('.nirvana-embed-play'),
}));
ok('tap loads the live scene', afterPlay.canvas && afterPlay.ready && !afterPlay.play, JSON.stringify(afterPlay));

// no-js fallback
const n = await b.newPage();
await n.setJavaScriptEnabled(false);
await n.setViewport({ width: 1280, height: 900 });
await n.goto(BASE + '/', { waitUntil: 'load' });
const nojs = await n.evaluate(() => ({
  sections: document.querySelectorAll('#main > article').length,
  visible: Array.from(document.querySelectorAll('#main > article')).filter(a => getComputedStyle(a).display !== 'none').length,
  height: document.documentElement.scrollHeight,
}));
ok('content present without JS', nojs.sections === 9 && nojs.visible === 9, JSON.stringify(nojs));

ok('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await b.close();
