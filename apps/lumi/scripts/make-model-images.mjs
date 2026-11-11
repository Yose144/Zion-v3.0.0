#!/usr/bin/env node
/**
 * Produktové náhledy motivů: vyrenderovaný PNG → webové WebP varianty.
 *
 * Render dělá `scripts/ops/lumi-render/render.mjs --mode hero` (čtverec
 * 1200 px, teplé tmavé pozadí). Tenhle skript z něj udělá stejné varianty,
 * jaké používá zbytek e-shopu (`-200` náhled, `-700` detail), aby se
 * karty a galerie chovaly jednotně (`src/lib/images.ts`).
 *
 * Použití (z apps/lumi):
 *   node scripts/make-model-images.mjs <zdrojový-adresář> <slug>
 *   node scripts/make-model-images.mjs ../../.artifacts/render/lumi-2/vanoce-hero vanoce
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = path.join(ROOT, 'public', 'images', 'motifs');
const SIZES = [200, 700];

async function main() {
  const [source, slug] = process.argv.slice(2);
  if (!source || !slug) {
    console.error('Použití: node scripts/make-model-images.mjs <adresář s hero.png> <slug>');
    process.exit(1);
  }

  const png = path.resolve(process.cwd(), source, 'hero.png');
  if (!existsSync(png)) {
    console.error(`Chybí ${png} — nejdřív spusť render:\n  node scripts/ops/lumi-render/render.mjs --model public/models/lumi-2-${slug}.glb --out ${source} --mode hero`);
    process.exit(1);
  }

  const outDir = path.join(OUT_ROOT, slug);
  await fs.mkdir(outDir, { recursive: true });

  const written = [];
  for (const width of SIZES) {
    const file = path.join(outDir, `produkt-${width}.webp`);
    await sharp(png)
      .resize({ width, height: width, fit: 'cover' })
      .webp({ quality: 84, effort: 5 })
      .toFile(file);
    written.push(path.relative(ROOT, file));
  }

  const { size } = await fs.stat(path.join(outDir, 'produkt-700.webp'));
  console.log(`✓ ${slug}: ${written.join(', ')} (${(size / 1024).toFixed(0)} kB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
