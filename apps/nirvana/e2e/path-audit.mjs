#!/usr/bin/env node
/**
 * CESTA — audit XP a dharma validace v prohlížeči.
 *
 * Ověřuje, že je **napojená**: že ★ v liště otevře panel, že dohraná hra
 * zapíše XP i verdikt, že se verdikt objeví ve výsledku i v panelu a že
 * se to uloží do profilu. Pravidla mají vlastní testy
 * (`test/dharma.mjs`, `test/progress.mjs`).
 *
 * Spuštění:
 *   node apps/nirvana/e2e/path-audit.mjs
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, PHONE } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/path');

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(page, fn, timeout = 20000, label = 'stav', arg) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await page.evaluate(fn, arg);
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const app = await ensureApp({ base: process.env.PATH_URL ?? 'http://127.0.0.1:3010' });
  const BASE = app.base;
  const host = new URL(BASE).hostname;

  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  await grantPass(page, host);

  console.log('\n▸ panel Cesty (čistý profil)');
  await page.goto(`${BASE}/neptune`, { waitUntil: 'networkidle' });
  await waitFor(page, () => Boolean(document.querySelector('.game-hud-chip.is-level')), 30000, 'lišta');
  await page.click('.game-hud-chip.is-level');
  await waitFor(page, () => Boolean(document.querySelector('.path-panel')), 10000, 'panel Cesty');
  const empty = await page.evaluate(() => ({
    pillars: document.querySelectorAll('.path-pillars li').length,
    level: document.querySelector('.path-level-badge strong')?.textContent ?? '',
    clName: document.querySelector('.path-level-badge span')?.textContent ?? '',
    verdict: document.querySelector('.path-verdict')?.textContent ?? '',
    seals: document.querySelector('.path-dharma header span')?.textContent ?? '',
    bar: document.querySelector('.path-bar i')?.getBoundingClientRect().width ?? 0,
    ncl: document.querySelectorAll('.path-ncl-list li').length,
    nclNext: document.querySelector('.path-ncl-list li.is-next strong')?.textContent ?? '',
    goal: document.querySelector('.path-goal')?.textContent ?? '',
    quests: document.querySelectorAll('.path-quests li').length,
    questsLocked: document.querySelectorAll('.path-quests li.is-locked').length,
  }));
  check('panel vypisuje pět pilířů', empty.pillars === 5, String(empty.pillars));
  check('panel ukazuje stupeň vědomí', /^L\d$/.test(empty.level), empty.level);
  check('stupeň má kanonické jméno', /Dormant|Aware|Sentient|Transcendent|Omniscient|Cosmic|Grok/.test(empty.clName), empty.clName);
  check('panel vypisuje dvanáct NCL úloh', empty.ncl === 12, String(empty.ncl));
  check('první NCL úloha je na řadě', /První světlo|First light/.test(empty.nclNext), empty.nclNext);
  check('panel má dnešní dharma cíl', /Dnešní cíl|Today's goal|splněn|done/.test(empty.goal), empty.goal);
  check('panel vypisuje připravené questy', empty.quests === 4 && empty.questsLocked === 4, `${empty.quests}/${empty.questsLocked}`);
  check('nový profil nemá verdikt', /dohraj|finish|žádn/i.test(empty.verdict), empty.verdict);
  check('nový profil nemá pečeti', /0/.test(empty.seals), empty.seals);
  check('bar XP je na místě', empty.bar >= 0, String(empty.bar));
  await page.screenshot({ path: `${SHOTS}/panel-empty.png` });

  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.querySelector('.path-panel'), 8000, 'zavřený panel');

  console.log('\n▸ dohraná hra zapíše XP i dharmu');
  await page.goto(`${BASE}/neptune?neptuneDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => Boolean(document.querySelector('.neptune-panel')), 30000, 'menu Neptunu');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => Boolean(window.__neptuneDebug), 45000, 'debug háček');
  await page.evaluate(() => window.__neptuneDebug.teleport(894, 0));
  await page.keyboard.down('w');
  await waitFor(page, () => Boolean(document.querySelector('.race-verdict')), 25000, 'výsledek');
  await page.keyboard.up('w');
  const result = await page.evaluate(() => ({
    notice: document.querySelector('.arena-notice')?.textContent ?? '',
    profile: JSON.parse(localStorage.getItem('nirvana.park.v1') ?? '{}'),
  }));
  check('výsledek hlásí XP', /XP/.test(result.notice), result.notice);
  check('výsledek hlásí dharmu', /☸/.test(result.notice), result.notice);
  check('výsledek hlásí NCL úlohu', /NCL/.test(result.notice), result.notice);
  check('profil má XP', Number(result.profile.xp) > 0, String(result.profile.xp));
  check('profil má validaci', result.profile.dharma?.validations >= 1, JSON.stringify(result.profile.dharma));
  const xpValue = Number(result.profile.xp);
  const expectedCl = [0, 100, 600, 2000, 6000, 15000, 35000].filter((threshold) => xpValue >= threshold).length - 1;
  check('XP je dost na pořádný kus levelu', Number(result.profile.xp) > 90, String(result.profile.xp));

  console.log('\n▸ panel po hře');
  await page.click('.game-hud-chip.is-level');
  await waitFor(page, () => Boolean(document.querySelector('.path-panel')), 10000, 'panel po hře');
  const after = await page.evaluate(() => ({
    level: document.querySelector('.path-level-badge strong')?.textContent ?? '',
    verdict: document.querySelector('.path-verdict')?.textContent ?? '',
    grade: document.querySelector('.path-verdict')?.className ?? '',
    passed: document.querySelectorAll('.path-pillars li.is-pass').length,
    xp: document.querySelector('.path-level-body p strong')?.textContent ?? '',
    nclDone: document.querySelectorAll('.path-ncl-list li.is-done').length,
  }));
  check('stupeň v panelu sedí na XP', after.level === `L${expectedCl}`, `${after.level} vs L${expectedCl}`);
  check('panel ukazuje XP z profilu', Number(after.xp) === Number(result.profile.xp), `${after.xp} vs ${result.profile.xp}`);
  check('NCL úloha se v panelu zaškrtla', after.nclDone >= 1, String(after.nclDone));
  check('panel ukazuje verdikt', after.verdict.length > 2, after.verdict);
  check('verdikt má stupeň', /is-(seal|pass|partial|thin)/.test(after.grade), after.grade);
  check('prošlé pilíře jsou vidět', after.passed >= 1, String(after.passed));
  await page.screenshot({ path: `${SHOTS}/panel-after.png` });

  console.log('\n▸ dotyk');
  const phone = await browser.newPage(PHONE);
  await phone.context?.().addCookies?.([{ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' }]);
  await phone.setCookie?.({ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' });
  await phone.goto(`${BASE}/pluto`, { waitUntil: 'networkidle' });
  await waitFor(phone, () => Boolean(document.querySelector('.game-hud-chip.is-level')), 30000, 'lišta na telefonu');
  await phone.click('.game-hud-chip.is-level');
  await waitFor(phone, () => Boolean(document.querySelector('.path-panel')), 10000, 'panel na telefonu');
  const touch = await phone.evaluate(() => ({
    width: document.querySelector('.path-panel')?.getBoundingClientRect().width ?? 0,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pillars: document.querySelectorAll('.path-pillars li').length,
  }));
  check('panel se vejde na telefon', touch.width > 0 && touch.width <= 390, String(touch.width));
  check('panel nepřetéká do stran', touch.overflow <= 1, String(touch.overflow));
  check('panel má pět pilířů i na telefonu', touch.pillars === 5, String(touch.pillars));
  await phone.screenshot({ path: `${SHOTS}/panel-phone.png` });

  check('žádná chyba v konzoli', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  await app.stop();

  console.log(`\n${failed === 0 ? 'PASSED' : 'FAILED'}: ${passed}/${passed + failed} kontrol`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
