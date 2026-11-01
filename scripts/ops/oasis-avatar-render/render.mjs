#!/usr/bin/env node
/**
 * OASIS — render portrétů avatarů na GPU.
 *
 * Vezme **herní model** (`apps/nirvana/src/core/avatars/AvatarModel.tsx`) a
 * vykreslí pro každou postavu portrétní kartu do
 * `apps/website-v2.9/public/oasis-assets/game-portraits/`.
 *
 * Proč GPU: 200 karet × WebGL scéna se na CPU (swiftshader) táhne desítky
 * minut. Chromium s ANGLE/Metal zvládne jednu kartu za ~0,2 s.
 *
 * Použití:
 *   node scripts/ops/oasis-avatar-render/render.mjs                # všech 200
 *   node scripts/ops/oasis-avatar-render/render.mjs --ids 0,4,19   # jen kontrolní
 *   node scripts/ops/oasis-avatar-render/render.mjs --limit 20 --force
 *
 * Výstup je **reverse-manifest** hotový pro finální vlnu: až 👤 dodá skutečné
 * portréty, mění se jen cesta v `manifest.json` (viz README ve stejné složce).
 */

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const OUT_DIR = join(repo, 'apps/website-v2.9/public/oasis-assets/game-portraits');
const SHEET_DIR = join(repo, 'apps/website-v2.9/public/oasis-assets/character-sheets');
const BUILD_DIR = join(here, '.build');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const WIDTH = Number(value('width', 448));
const HEIGHT = Number(value('height', 560));
const LIMIT = Number(value('limit', 0));
const FORCE = flag('force');
/** Turnaroundy (front / 3-4 / bok / záda) pro produkční character sheet. */
const SHEETS = flag('sheets');
const SHEET_WIDTH = 1600;
const SHEET_HEIGHT = 900;
const IDS = value('ids', null)
  ?.split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => Number.isFinite(id));

/** Katalog je jediný zdroj id → jméno (generováno z rosteru, 200 záznamů). */
async function loadCatalog() {
  const source = await readFile(join(repo, 'apps/nirvana/src/core/avatars/catalog.ts'), 'utf8');
  const entries = [];
  for (const line of source.split('\n')) {
    const match = line.match(
      /id: (\d+), name: '(.*?)', subtitle: '(.*?)', ray: '(\w+)', rarity: '(\w+)', cl: (\d+)/,
    );
    if (match) {
      entries.push({
        id: Number(match[1]),
        name: match[2],
        subtitle: match[3],
        ray: match[4],
        rarity: match[5],
        cl: Number(match[6]),
      });
    }
  }
  if (entries.length === 0) throw new Error('katalog se nepodařilo načíst');
  return entries;
}

function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const RAY_HEX = {
  Blue: '#4a7bff',
  Pink: '#ff6ec7',
  Yellow: '#ffd166',
  Violet: '#9333ea',
  Green: '#10b981',
  White: '#e8eef7',
  RubyGold: '#e8b23a',
  Obsidian: '#3b2a45',
  AllRays: '#7fe3d4',
};

/** Pozadí karty — tmavá vinětace s paprskem postavy, ať je rámeček čitelný. */
function backdrop(hex) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${hex}" stop-opacity="0.42"/>
      <stop offset="46%" stop-color="${hex}" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#07040d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#140d22"/>
      <stop offset="62%" stop-color="#0b0714"/>
      <stop offset="100%" stop-color="#050309"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#v)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
</svg>`);
}

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));

/** Pozadí sheetu (bez popisků) — popisky jdou jako druhá vrstva nad render. */
function sheetBackground() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#100a1c"/>
      <stop offset="55%" stop-color="#0a0714"/>
      <stop offset="100%" stop-color="#050309"/>
    </linearGradient>
  </defs>
  <rect width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}" fill="url(#bg)"/>
</svg>`);
}

/** Popisky nad renderem (transparentní podklad). */
function sheetLabels(entry, palette) {
  const swatches = palette
    .slice(0, 5)
    .map(
      (hex, index) =>
        `<circle cx="${64 + index * 34}" cy="${SHEET_HEIGHT - 54}" r="11" fill="${hex}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>`,
    )
    .join('');
  const labels = ['FRONT', 'THREE-QUARTER', 'SIDE', 'BACK']
    .map(
      (label, index) =>
        `<text x="${(SHEET_WIDTH / 8) * (index * 2 + 1)}" y="${SHEET_HEIGHT - 92}" fill="#9aa2b6" font-size="15" font-family="Helvetica, Arial, sans-serif" letter-spacing="3" text-anchor="middle">${label}</text>`,
    )
    .join('');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}">
  <rect x="0" y="0" width="${SHEET_WIDTH}" height="118" fill="#070410" fill-opacity="0.72"/>
  <text x="48" y="58" fill="#ffffff" font-size="30" font-family="Helvetica, Arial, sans-serif" font-weight="600">${escapeXml(entry.name)}</text>
  <text x="48" y="88" fill="#c9b06a" font-size="17" font-family="Helvetica, Arial, sans-serif">${escapeXml(entry.subtitle)}</text>
  <text x="${SHEET_WIDTH - 48}" y="58" fill="#8b93a7" font-size="15" font-family="Helvetica, Arial, sans-serif" text-anchor="end" letter-spacing="2">OASIS-${String(entry.id).padStart(3, '0')}</text>
  <text x="${SHEET_WIDTH - 48}" y="86" fill="#8b93a7" font-size="14" font-family="Helvetica, Arial, sans-serif" text-anchor="end">${escapeXml(entry.ray)} · ${escapeXml(entry.rarity)} · CL ${entry.cl}</text>
  <rect x="0" y="${SHEET_HEIGHT - 118}" width="${SHEET_WIDTH}" height="118" fill="#070410" fill-opacity="0.82"/>
  <line x1="48" y1="${SHEET_HEIGHT - 118}" x2="${SHEET_WIDTH - 48}" y2="${SHEET_HEIGHT - 118}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>
  ${labels}
  ${swatches}
  <text x="${SHEET_WIDTH - 48}" y="${SHEET_HEIGHT - 50}" fill="#5f6678" font-size="13" font-family="Helvetica, Arial, sans-serif" text-anchor="end">ZION OASIS · procedurální model · kanonické atributy</text>
</svg>`);
}

async function bundle() {
  const { build } = require('esbuild');
  await mkdir(BUILD_DIR, { recursive: true });
  await build({
    entryPoints: [join(here, 'entry.tsx')],
    outfile: join(BUILD_DIR, 'render.js'),
    bundle: true,
    format: 'iife',
    target: ['chrome110'],
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  await writeFile(join(BUILD_DIR, 'index.html'), await readFile(join(here, 'index.html'), 'utf8'));
}

async function writeManifest(catalog) {
  const entries = [];
  for (const entry of catalog) {
    const file = join(OUT_DIR, `${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`);
    if (!existsSync(file)) continue;
    const info = await stat(file);
    entries.push({
      id: entry.id,
      name: entry.name,
      file: `/oasis-assets/game-portraits/${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`,
      bytes: info.size,
    });
  }
  const manifest = {
    note: 'Herní 3D náhledy avatarů (procedurální model z apps/nirvana). Finální portréty se doplní jako samostatná vrstva.',
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  // Statický import pro Next (public/ není importovatelný) — id → cesta.
  const map = Object.fromEntries(entries.map((entry) => [String(entry.id), entry.file]));
  await writeFile(
    join(repo, 'apps/website-v2.9/src/lib/oasis/game-portraits.json'),
    JSON.stringify(map, null, 2) + '\n',
  );
  console.log(`manifest: ${entries.length} karet`);
}

/** Manifest turnaroundů — id → cesta k character sheetu. */
async function writeSheetManifest(catalog) {
  const entries = [];
  for (const entry of catalog) {
    const file = join(SHEET_DIR, `${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`);
    if (!existsSync(file)) continue;
    const info = await stat(file);
    entries.push({
      id: entry.id,
      name: entry.name,
      file: `/oasis-assets/character-sheets/${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`,
      bytes: info.size,
    });
  }
  const manifest = {
    note:
      'Turnaround sheet (front / three-quarter / side / back) pro modeláře i pro generování finálních portrétů.',
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  await writeFile(join(SHEET_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const map = Object.fromEntries(entries.map((entry) => [String(entry.id), entry.file]));
  await writeFile(
    join(repo, 'apps/website-v2.9/src/lib/oasis/character-sheet-images.json'),
    JSON.stringify(map, null, 2) + '\n',
  );
  console.log(`manifest sheetů: ${entries.length}`);
}

async function main() {  const catalog = await loadCatalog();
  let targets = catalog;
  if (IDS) targets = targets.filter((entry) => IDS.includes(entry.id));
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);
  if (targets.length === 0) throw new Error('žádný avatar k rendrování (zkontroluj --ids)');

  await mkdir(OUT_DIR, { recursive: true });

  const pending = [];
  for (const entry of targets) {
    const file = join(OUT_DIR, `${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`);
    if (!FORCE && existsSync(file)) {
      const info = await stat(file);
      if (info.size > 2000) continue;
    }
    pending.push({ ...entry, file });
  }

  console.log(
    `katalog ${catalog.length} · k rendrování ${pending.length} (přeskočeno ${targets.length - pending.length})`,
  );
  if (pending.length === 0) {
    await writeManifest(catalog);
    return;
  }

  await bundle();

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=metal',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--mute-audio',
    ],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 },
  });

  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.error('pageerror:', error.message));
    await page.goto(`file://${join(BUILD_DIR, 'index.html')}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', { timeout: 30_000 });

    const gpu = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return 'no-webgl';
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    console.log(`WebGL backend: ${gpu}`);

    const sharp = require('sharp');
    const started = Date.now();
    let index = 0;

    for (const entry of pending) {
      index += 1;
      await page.evaluate((id) => window.__render(id), entry.id);
      const canvas = await page.$('canvas');
      if (!canvas) throw new Error('plátno zmizelo');
      const shot = await canvas.screenshot({ omitBackground: true, type: 'png' });

      await sharp(backdrop(RAY_HEX[entry.ray] ?? RAY_HEX.White))
        .composite([
          {
            input: await sharp(shot).resize(WIDTH, HEIGHT, { fit: 'contain', position: 'center' }).png().toBuffer(),
            blend: 'over',
          },
        ])
        .webp({ quality: 82, effort: 5 })
        .toFile(entry.file);

      if (index % 10 === 0 || index === pending.length) {
        const perItem = (Date.now() - started) / index;
        console.log(
          `  ${index}/${pending.length} · ${entry.id} ${entry.name} · ${Math.round(perItem)} ms/karta`,
        );
      }
    }
    console.log(`hotovo za ${((Date.now() - started) / 1000).toFixed(1)} s`);

    // ── turnaroundy (produkční character sheet) ──────────────────────
    if (SHEETS) {
      await page.setViewport({ width: SHEET_WIDTH, height: SHEET_HEIGHT, deviceScaleFactor: 1 });
      await mkdir(SHEET_DIR, { recursive: true });
      const sheetTargets = targets;
      const sheetStarted = Date.now();
      let sheetIndex = 0;
      for (const entry of sheetTargets) {
        sheetIndex += 1;
        await page.evaluate((id) => window.__renderSheet(id), entry.id);
        const look = await page.evaluate((id) => window.__look(id), entry.id);
        const canvas = await page.$('canvas');
        if (!canvas) throw new Error('plátno zmizelo (sheet)');
        const shot = await canvas.screenshot({ omitBackground: true, type: 'png' });
        const palette = [look?.palette?.trim, look?.palette?.robe, look?.palette?.glow, look?.palette?.skin].filter(Boolean);
        const file = join(SHEET_DIR, `${String(entry.id).padStart(3, '0')}-${slug(entry.name)}.webp`);
        await sharp(sheetBackground())
          .composite([
            {
              input: await sharp(shot).resize(SHEET_WIDTH, SHEET_HEIGHT, { fit: 'fill' }).png().toBuffer(),
              top: 0,
              left: 0,
            },
            { input: sheetLabels(entry, palette), top: 0, left: 0 },
          ])
          .webp({ quality: 80, effort: 5 })
          .toFile(file);

        if (sheetIndex % 10 === 0 || sheetIndex === sheetTargets.length) {
          const perItem = (Date.now() - sheetStarted) / sheetIndex;
          console.log(`  sheet ${sheetIndex}/${sheetTargets.length} · ${Math.round(perItem)} ms/sheet`);
        }
      }
      console.log(`turnaroundy hotové za ${((Date.now() - sheetStarted) / 1000).toFixed(1)} s`);
    }
  } finally {
    await browser.close();
  }
  await writeManifest(catalog);
  if (SHEETS) await writeSheetManifest(catalog);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
