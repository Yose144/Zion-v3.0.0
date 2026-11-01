#!/usr/bin/env node
/**
 * OASIS render audit — měří herní plátno v prohlížeči.
 *
 * OASIS je statický export (`apps/OasisWeb`, output: 'export'), takže se měří proti
 * běžícímu dev serveru nebo proti `serve dist`. Skript je záměrně malý a bez závislostí
 * kromě Playwrightu, který už v repu je (`apps/website-v2.9/node_modules/playwright`).
 *
 * Co dělá:
 *   1. otevře `/?sceneAudit=1&skipIntro=1` (audit háček + přeskočení Babylon intra a rite modalu)
 *   2. zavře známé modály (avatar, path, onboarding), pokud se objeví
 *   3. počká na `window.__oasisAudit` a odečte fps, draw calls, trojúhelníky, textury, světla
 *   4. udělá screenshot a zapíše `results.json`
 *
 * Použití:
 *   node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --output .artifacts/oasis/galaxy
 *   node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --dsf 2 --output .artifacts/oasis/retina
 *   node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --route /ships --output .artifacts/oasis/ships
 *
 * Poznámky pro GPU stroj:
 *   · `--dsf 2` simuluje Retina (audit jinak vidí dpr 1, protože headless má devicePixelRatio 1).
 *   · `--gpu` přepíná ANGLE backend: `metal` (macOS), `vulkan` (NVIDIA), `gl-egl` (AMD/Linux).
 *   · `ZION_PLAYWRIGHT` lze nastavit na jinou cestu k modulu playwright.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright už v repu je (web e2e), takže se nenainstalovává nic dalšího.
// Na jiném stroji jde cesta přepsat přes ZION_PLAYWRIGHT.
const defaultPlaywright = new URL('../../apps/website-v2.9/node_modules/playwright/index.mjs', import.meta.url).href;
const { chromium } = await import(process.env.ZION_PLAYWRIGHT ?? defaultPlaywright);

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);

const url = args.get('--url') ?? 'http://127.0.0.1:3070';
const route = args.get('--route') ?? '/';
const output = resolve(args.get('--output') ?? '.artifacts/oasis/latest');
const dsf = Number(args.get('--dsf') ?? 1);
const gpu = args.get('--gpu') ?? 'metal';
const timeout = Number(args.get('--timeout') ?? 90000);

const gpuArgs = {
  metal: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
  vulkan: ['--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan'],
  'gl-egl': ['--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl'],
  sw: ['--enable-unsafe-swiftshader'],
}[gpu];

const query = `${route}${route.includes('?') ? '&' : '?'}sceneAudit=1&skipIntro=1`;

mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.ZION_CHROME_CHANNEL ?? 'chrome',
  headless: true,
  args: ['--no-sandbox', ...gpuArgs],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error.message).slice(0, 200)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/webpack-hmr|Failed to load resource/.test(message.text())) {
    errors.push(message.text().slice(0, 200));
  }
});

const row = { route, dsf, gpu, errors, status: 'fail' };
try {
  const response = await page.goto(`${url}${query}`, { waitUntil: 'domcontentloaded', timeout });
  row.http = response?.status() ?? null;
  await page.waitForSelector('canvas', { timeout });

  // Známé modály, které blokují scénu (avatar, path, onboarding).
  for (const name of [/Stay as you are/i, /Warrior/i, /Continue/i, /Skip/i]) {
    const button = page.getByRole('button', { name });
    if (await button.count()) {
      await button.first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }

  await page.waitForFunction('window.__oasisAudit && window.__oasisAudit.frames > 30', { timeout });

  row.audit = await page.evaluate(() => window.__oasisAudit);
  row.fps_measured = Math.round(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = (t) => {
            frames += 1;
            if (t - start < 4000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / (t - start));
          };
          requestAnimationFrame(tick);
        }),
    ),
  );

  await page.screenshot({ path: resolve(output, 'shot.png') });
  row.status = errors.length ? 'warn' : 'pass';
} catch (error) {
  row.failure = String(error.message).slice(0, 300);
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
}

writeFileSync(resolve(output, 'results.json'), `${JSON.stringify(row, null, 2)}\n`);
console.log(JSON.stringify(row));
process.exit(row.status === 'fail' ? 1 : 0);
