#!/usr/bin/env node
/**
 * Turnaround sheety stíhaček z marketu.
 *
 * Vezme **herní GLB** (`apps/nirvana/public/models/fleet/*.glb`) a vykreslí čtyři
 * pohledy (příď / tři čtvrtě / bok / záď) do jednoho obrázku — stejná logika
 * jako `oasis-avatar-render`, jen pro lodě.
 *
 * Proč to existuje:
 *  1. **Kontrola orientace.** Konvertor srovnává nos na +Z podle ruční tabulky;
 *     špatné znaménko znamená, že loď letí pozadu. Pozná se to jen pohledem.
 *  2. **Kontrola laku.** Panelové plátování je ve vrcholových barvách, takže
 *     se nedá zkontrolovat v datech — jen na snímku.
 *  3. Podklad pro kartu produktu a pro prezentaci flotily.
 *
 * Použití:
 *   node scripts/ops/fleet-render/render.mjs               # všech 7
 *   node scripts/ops/fleet-render/render.mjs --only xwing
 *   node scripts/ops/fleet-render/render.mjs --out apps/nirvana/public/fleet/sheets
 */

import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
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
const PUBLIC = join(repo, 'apps/nirvana/public');
const MANIFEST = join(repo, 'scripts/ops/starfighter-glb.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const ONLY = value('only', null);
const OUT = resolve(repo, value('out', '.artifacts/render/fleet'));

const MIME = {
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.json': 'application/json',
};

function serve() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const path = normalize(decodeURIComponent(url.pathname));
    const file =
      path === '/' || path === '/index.html'
        ? join(BUILD, 'index.html')
        : path.startsWith('/models/')
          ? join(PUBLIC, path)
          : join(BUILD, path);
    try {
      const body = readFileSync(file);
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
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

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => console.error('pageerror:', error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('console:', message.text());
  });

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const ships = manifest.ships.filter((ship) => !ONLY || ship.id === ONLY);
  if (ships.length === 0) throw new Error(`neznámé id: ${ONLY}`);

  await mkdir(OUT, { recursive: true });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });

  for (const ship of ships) {
    await page.evaluate(
      (url, meta) => {
        window.__ready = false;
        return window.__render(url, meta);
      },
      `/models/fleet/${ship.id}.glb`,
      {
        name: ship.name,
        subtitle: `${ship.panels} destiček · ${ship.triangles} trojúhelníků · ${(ship.bytes / 1048576).toFixed(2)} MB`,
        dims: `šířka ${ship.width.toFixed(2)} · výška ${ship.height.toFixed(2)} · délka ${ship.length.toFixed(2)}`,
        flags: 'panelový lak · DoubleSide · bez textur',
      },
    );

    // render je synchronní uvnitř jednoho tasku, ale WebGL textura se může
    // dokreslovat ještě jeden frame — dva framy počkají a je to jisté
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

    const file = join(OUT, `${ship.id}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1600, height: 900 } });
    console.log(`✓ ${ship.id.padEnd(16)} → ${file.replace(`${repo}/`, '')}`);
  }

  await browser.close();
  server.close();
  await writeFile(
    join(OUT, 'README.txt'),
    'Turnaround sheety stíhaček z marketu. Generuje scripts/ops/fleet-render/render.mjs — slouží ke kontrole orientace a laku, ne jako finální asset.\n',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
