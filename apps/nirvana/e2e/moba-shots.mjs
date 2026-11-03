#!/usr/bin/env node
/**
 * Grafický audit scény „První svět" — screenshoty a fps na **skutečné GPU**.
 *
 * Swiftshader (výchozí v E2E) scénu vykreslí, ale fps je bezcenné a velké
 * screenshoty padají na timeout. Tenhle skript pouští prohlížeč s ANGLE/Metal
 * (`ZION_GPU=metal`) a uloží několik pohledů + změří fps a draw calls.
 *
 * Spuštění:
 *   ZION_GPU=metal BASE=https://nirvana.zionterranova.com node apps/nirvana/e2e/moba-shots.mjs
 *
 * Výstup: `.artifacts/render/moba-metal-<timestamp>/` (PNG) + souhrn v konzoli.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './_browser.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3010';
const OUT = process.env.OUT ?? `.artifacts/render/moba-metal-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mkdirSync(OUT, { recursive: true });

const browser = await launch({
  headless: process.env.ZION_GPU === 'metal' ? 'new' : true,
  args: process.env.ZION_GPU === 'metal' ? undefined : undefined,
  defaultViewport: null,
});

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('401')) errors.push(message.text());
});

await page.goto(`${BASE}/earth?mobaDebug=1`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForSelector('.moba-start', { timeout: 60_000 });
await page.click('.moba-start');
await sleep(4000);

const shot = async (name, { hideHud = false } = {}) => {
  if (hideHud) {
    await page.evaluate(() => {
      document.querySelectorAll('.moba-hud-top, .moba-hud-bottom, .moba-nodes, .moba-banner, .game-hud, .chat-dock, .moba-minimap')
        .forEach((node) => {
          node.style.visibility = 'hidden';
        });
    });
  }
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  if (hideHud) {
    await page.evaluate(() => {
      document.querySelectorAll('.moba-hud-top, .moba-hud-bottom, .moba-nodes, .moba-banner, .game-hud, .chat-dock, .moba-minimap')
        .forEach((node) => {
          node.style.visibility = '';
        });
    });
  }
  console.log(`  snímek: ${join(OUT, `${name}.png`)}`);
};

// 1) základna
await shot('01-base');
await shot('01-base-clean', { hideHud: true });

// 2) prostředek mapy (rychlý teleport na uzel L5)
await page.evaluate(() => window.__mobaDebug().teleport(-12, -26));
await sleep(1200);
await shot('02-node');

// 3) řeka / boss
await page.evaluate(() => window.__mobaDebug().teleport(0, -26));
await sleep(1200);
await shot('03-river');

// 4) souboj: nech přijít vlnu a sešli kouzlo
await page.evaluate(() => {
  const debug = window.__mobaDebug();
  debug.teleport(6, 0);
});
await sleep(5000);
await page.evaluate(() => {
  const debug = window.__mobaDebug();
  const foe = debug.heroes.find((hero) => hero.team === 'red' && hero.alive) ??
    (debug.teleport(0, 0), null);
  if (foe) debug.cast('Q', foe.x, foe.z);
});
await sleep(1200);
await shot('04-lane');
await shot('04-lane-clean', { hideHud: true });

// 5) fps a draw calls
const perf = await page.evaluate(async () => {
  const frames = [];
  await new Promise((resolve) => {
    let last = performance.now();
    let count = 0;
    const tick = (now) => {
      frames.push(now - last);
      last = now;
      count += 1;
      if (count < 120) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const usable = frames.slice(5);
  const avg = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  const debug = window.__mobaDebug();
  return { fps: Math.round(1000 / avg), ms: Math.round(avg * 10) / 10, renderer: debug.renderer ?? null };
});

console.log(`\n  GPU: ${process.env.ZION_GPU ?? 'swiftshader'}`);
console.log(`  fps: ${perf.fps} (${perf.ms} ms/frame)`);
if (perf.renderer) {
  console.log(
    `  draw calls: ${perf.renderer.calls} · triangles: ${perf.renderer.triangles} · ` +
      `geometries: ${perf.renderer.geometries} · textures: ${perf.renderer.textures}`,
  );
}
console.log(`  chyby v konzoli: ${errors.length}${errors.length ? ` → ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(`  výstup: ${OUT}\n`);

await browser.close();
process.exit(errors.length === 0 ? 0 : 1);
