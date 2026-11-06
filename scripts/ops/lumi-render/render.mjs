#!/usr/bin/env node
/**
 * Kontrolní sheet lampionu Lumi 2.
 *
 * Vezme GLB (výchozí zdroj `heros/shop/Lumi/Lumi_2.glb`, nebo optimalizovanou
 * kopii z marketu) a vykreslí čtyři pohledy do jednoho obrázku — stejná
 * myšlenka jako `fleet-render`, jen pro dřevo.
 *
 * Proč to existuje:
 *  1. **Kontrola tvaru a orientace.** Lampion stojí na dně (Y-up, metry);
 *     špatně otočený model by v marketu ležel na boku.
 *  2. **Kontrola materiálů.** Tři materiály (`Překližka` / `Řez` / `Gravír`)
 *     nesou opálenou hranu laseru — v datech to nepoznáte, jen na snímku.
 *  3. **Kontrola optimalizace.** Po `gltf-transform` se sheet vyrenderuje
 *     znovu; když je model po kvantizaci rozpadlý, je to vidět.
 *
 * Použití:
 *   node scripts/ops/lumi-render/render.mjs
 *   node scripts/ops/lumi-render/render.mjs --model apps/MarketPlace/public/models/lumi-2.glb --out .artifacts/render/lumi-2/optimized
 *
 * `ZION_GPU=metal` (macOS) / `swiftshader` (Linux bez GPU) — stejně jako flotila.
 */

import { mkdir, writeFile, copyFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launch } from '../../../apps/nirvana/e2e/_browser.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const BUILD = join(here, '.build');

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const MODEL = resolve(repo, value('model', 'heros/shop/Lumi/Lumi_2.glb'));
const OUT = resolve(repo, value('out', '.artifacts/render/lumi-2'));
const LABEL = value('label', 'Lumi 2 — Království srdce');
const MODE = value('mode', 'sheet');

const MIME = {
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

/** Model servírujeme z jednoho stabilního prefixu, ať je cesta odkudkoli. */
const ROUTE = '/model.glb';

function serve() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const path = normalize(decodeURIComponent(url.pathname));
    const file =
      path === '/' || path === '/index.html'
        ? join(BUILD, 'index.html')
        : path === ROUTE
          ? MODEL
          : join(BUILD, path);
    try {
      const body = readFileSync(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'access-control-allow-origin': '*',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
  });
}

async function bundle() {
  const { build } = require('esbuild');
  await mkdir(BUILD, { recursive: true });
  await build({
    entryPoints: [join(here, 'entry.ts')],
    outfile: join(BUILD, 'render.js'),
    bundle: true,
    format: 'iife',
    target: ['chrome110'],
    loader: { '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  await copyFile(join(here, 'index.html'), join(BUILD, 'index.html'));
}

async function main() {
  await bundle();
  const { server, port } = await serve();
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';

  const bytes = (await stat(MODEL)).size;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => console.error('pageerror:', error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('console:', message.text());
  });

  await mkdir(OUT, { recursive: true });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });

  await page.evaluate(
    (url, meta) => {
      window.__ready = false;
      return window.__render(url, meta);
    },
    ROUTE,
    {
      name: LABEL,
      subtitle: MODEL.replace(`${repo}/`, ''),
      dims: `140 × 126 × 121 mm · ${(bytes / 1048576).toFixed(2)} MB`,
      materials: 'Překližka · Řez · Gravír (bez textur)',
      flags: 'Y-up · metry · DoubleSide',
      mode: MODE,
    },
  );
  // render je synchronní uvnitř jednoho tasku, ale WebGL textura se může
  // dokreslovat ještě jeden frame
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

  const file = join(OUT, MODE === 'hero' ? 'hero.png' : 'sheet.png');
  if (MODE === 'hero') {
    // záběr pro kartu produktu — bez titulku a popisků
    await page.evaluate(() => {
      for (const element of document.querySelectorAll(
        '#masthead, #title, #subtitle, #meta, #footer, #labels',
      )) {
        element.style.display = 'none';
      }
    });
  }
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1600, height: 900 } });
  console.log(`✓ ${MODEL.replace(`${repo}/`, '')} → ${file.replace(`${repo}/`, '')}`);

  await browser.close();
  server.close();
  await writeFile(
    join(OUT, 'README.txt'),
    'Kontrolní sheet lampionu Lumi 2. Generuje scripts/ops/lumi-render/render.mjs — slouží ke kontrole tvaru, orientace a materiálů, ne jako finální asset.\n',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
