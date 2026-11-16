#!/usr/bin/env node
/**
 * Jednotné snímky pro homepage slider.
 *
 * Problém, který skript řeší: `kolekce-*-hero.webp` jsou makro-fotky — lampion
 * zabírá dvě třetiny plátna a v každém snímku stojí jinde, takže slider při
 * rotaci skáče velikostí i pozicí. Sada `Engine B v2` má šest scén ve **stejném
 * 4:3 záběru** (stůl, hrnek, okno, lampion na stejné pozici), jen s jiným
 * motivem — z nich se dělá 16:9 snímek **bez ořezu na výšku**: celý záběr se
 * nechá být a plátno se rozšíří vlevo o dozvuk tmavé stěny.
 *
 * Důsledek: lampion je na všech šesti snímcích stejně velký (~49 % výšky
 * plátna) a stejně umístěný, text vlevo dole leží na tmavé stěně. Kdyby se
 * záběr jen ořízl na 16:9 (jako dřív), lampion vyroste na ~66 % a je „moc
 * velký“, což je přesně to, co na slideru nechceme.
 *
 * Vstup:
 *   - `heros/Lumi/Lumi_Engine_B_KOMPLET_v2/originaly/<slug>.png` (1448×1086)
 *
 * Výstup (do `public/images/lumi-b/`):
 *   slide-<key>.webp       1440×810
 *   slide-<key>-1280.webp  1280×720
 *   slide-<key>-640.webp    640×360
 *
 * Snímek Lumi 2 (`hero-lumi.webp`) se negeneruje — je to původní široký
 * příběhový obrázek a ve slideru zůstává první.
 *
 * Použití:
 *   node scripts/make-slide-images.mjs
 *   node scripts/make-slide-images.mjs --check   # jen ověří, že výstupy sedí
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sharp = require(path.join(ROOT, 'node_modules/sharp'));

const OUT_DIR = path.join(ROOT, 'apps/lumi/public/images/lumi-b');
const ENGINE_B = path.join(ROOT, 'heros/Lumi/Lumi_Engine_B_KOMPLET_v2/originaly');

/** Kolekce, které mají vlastní snímek (stejný záběr, jiný motiv). */
const SLIDES = ['prirodni', 'svatebni', 'kvetinove', 'oceanske', 'vesmirne', 'vanocni'];

const SIZES = [
  { suffix: '', width: 1440, height: 810 },
  { suffix: '-1280', width: 1280, height: 720 },
  { suffix: '-640', width: 640, height: 360 },
];

const checkOnly = process.argv.includes('--check');

/** 16:9 plátno, do kterého se celý 4:3 záběr vejde bez ořezu a bez zmenšení. */
async function buildCanvas(src) {
  const { width: sw, height: ch } = await sharp(src).metadata();
  const canvasWidth = Math.round((ch * 16) / 9);
  const pad = canvasWidth - sw;

  // Dozvuk levé strany: úzký svislý proužek stěny roztažený do šířky a rozostřený.
  const strip = await sharp(src)
    .extract({ left: 0, top: 0, width: Math.min(140, sw), height: ch })
    .resize(pad, ch, { fit: 'fill' })
    .blur(28)
    .modulate({ brightness: 0.82 })
    .toBuffer();

  return { canvasWidth, pad, strip, height: ch };
}

async function render(src, size) {
  const { canvasWidth, pad, strip, height } = await buildCanvas(src);
  const scene = await sharp(src)
    .resize({ width: canvasWidth - pad, height })
    .toBuffer();

  // Pozor: v sharpu se `resize` aplikuje **před** `composite`, takže se plátno
  // musí sestavit v nativním rozlišení a zmenšit až v druhém průchodu.
  const composed = await sharp({
    create: { width: canvasWidth, height, channels: 3, background: { r: 12, g: 22, b: 28 } },
  })
    .composite([
      { input: strip, left: 0, top: 0 },
      { input: scene, left: pad, top: 0 },
    ])
    .png()
    .toBuffer();

  return sharp(composed)
    .resize(size.width, size.height, { fit: 'fill' })
    .webp({ quality: 86, effort: 6 });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const key of SLIDES) {
    const src = path.join(ENGINE_B, `${key}.png`);
    for (const size of SIZES) {
      const out = path.join(OUT_DIR, `slide-${key}${size.suffix}.webp`);
      if (checkOnly) {
        const info = await stat(out);
        const m = await sharp(out).metadata();
        const ok = m.width === size.width && m.height === size.height;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(ROOT, out)} ${m.width}×${m.height} ${Math.round(info.size / 1024)} kB`);
        continue;
      }
      await (await render(src, size)).toFile(out);
      const info = await stat(out);
      console.log(`-> ${path.relative(ROOT, out)} ${size.width}×${size.height} ${Math.round(info.size / 1024)} kB`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
