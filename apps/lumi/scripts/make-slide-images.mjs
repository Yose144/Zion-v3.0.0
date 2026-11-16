#!/usr/bin/env node
/**
 * Jednotné snímky pro homepage slider.
 *
 * Problém, který skript řeší: `kolekce-*-hero.webp` jsou makro-fotky, kde
 * lampion zabírá půlku plátna a v každém snímku stojí jinde — slider pak
 * při rotaci „cikcak“ skáče velikostí i pozicí. Sada `Engine B v2` má ale
 * šest scén ve **stejném** 4:3 záběru (stůl, hrnek, okno, lampion na stejné
 * pozici) — stačí je seříznout na 16:9 a jsou zaměnitelné.
 *
 * Vstup:
 *   - `heros/Lumi/Lumi_Engine_B_KOMPLET_v2/originaly/<slug>.png`  (1448×1086, 4:3)
 *   - `heros/Lumi/LUMI_ZION_B_web_a_kampane/mastery/domu-hero.png` (1672×941)
 *     → ten se nejdřív seřízne na stejný 4:3 záběr jako kolekce, aby lampion
 *       nebyl menší než u ostatních snímků.
 *
 * Výstup (do `public/images/lumi-b/`):
 *   slide-<key>.webp       1440×810
 *   slide-<key>-1280.webp  1280×720
 *   slide-<key>-640.webp    640×360
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
const HOME_MASTER = path.join(ROOT, 'heros/Lumi/LUMI_ZION_B_web_a_kampane/mastery/domu-hero.png');

/** Cílové snímky: klíč → zdroj + volitelný „rodinný“ ořez na 4:3. */
const SLIDES = [
  { key: 'lumi-2', src: HOME_MASTER, familyCrop: true },
  { key: 'prirodni', src: path.join(ENGINE_B, 'prirodni.png') },
  { key: 'svatebni', src: path.join(ENGINE_B, 'svatebni.png') },
  { key: 'kvetinove', src: path.join(ENGINE_B, 'kvetinove.png') },
  { key: 'oceanske', src: path.join(ENGINE_B, 'oceanske.png') },
  { key: 'vesmirne', src: path.join(ENGINE_B, 'vesmirne.png') },
  { key: 'vanocni', src: path.join(ENGINE_B, 'vanocni.png') },
];

const SIZES = [
  { suffix: '', width: 1440, height: 810 },
  { suffix: '-1280', width: 1280, height: 720 },
  { suffix: '-640', width: 640, height: 360 },
];

const checkOnly = process.argv.includes('--check');

/** 4:3 záběr „rodiny“ — stejný výřez, jaký mají kolekce. */
function familyBox(meta) {
  const ratio = 4 / 3;
  let width = meta.width;
  let height = Math.round(width / ratio);
  if (height > meta.height) {
    height = meta.height;
    width = Math.round(height * ratio);
  }
  return {
    left: Math.round((meta.width - width) / 2),
    top: Math.round((meta.height - height) / 2),
    width,
    height,
  };
}

/** 16:9 výřez ze (případně už zúženého) 4:3 záběru, na střed. */
function wideBox(box) {
  const height = Math.round((box.width * 9) / 16);
  return {
    left: box.left,
    top: box.top + Math.round((box.height - height) / 2),
    width: box.width,
    height,
  };
}

async function build() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const slide of SLIDES) {
    const meta = await sharp(slide.src).metadata();
    const base = slide.familyCrop
      ? familyBox({ width: meta.width, height: meta.height })
      : { left: 0, top: 0, width: meta.width, height: meta.height };
    const crop = wideBox(base);

    for (const size of SIZES) {
      const out = path.join(OUT_DIR, `slide-${slide.key}${size.suffix}.webp`);
      if (checkOnly) {
        const info = await stat(out);
        const m = await sharp(out).metadata();
        const ok = m.width === size.width && m.height === size.height;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(ROOT, out)} ${m.width}×${m.height} ${Math.round(info.size / 1024)} kB`);
        continue;
      }
      await sharp(slide.src)
        .extract(crop)
        .resize(size.width, size.height, { fit: 'fill' })
        .webp({ quality: 86, effort: 6 })
        .toFile(out);
      const info = await stat(out);
      console.log(`-> ${path.relative(ROOT, out)} ${size.width}×${size.height} ${Math.round(info.size / 1024)} kB`);
    }
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
