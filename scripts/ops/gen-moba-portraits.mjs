#!/usr/bin/env node
/**
 * Portréty avatarů pro Nirvanu — z oficiálního finálního artu do `apps/nirvana/public`.
 *
 * Web má 202 finálních portrétů (`apps/website-v2.9/public/oasis-assets/final_portraits/
 * <avatarId>-<slug>.webp`, dávka 2026-11). Skript z nich udělá **malou lokální sadu**
 * `<id>.webp` (256×256, webp q80 ≈ 22 kB), aby HUD v MOBA a výběr avatara nemusely
 * tahat 114kB originály z jiné domény — a aby portréty zůstaly dostupné i když web
 * zrovna neodpovídá.
 *
 * Stará sada se renderovala z procedurálního 3D modelu (`game-portraits`); od 2026-11-07
 * se bere oficiální 2D art, takže hrdina v HUD vypadá jako jeho karta v OASIS.
 *
 * Spuštění: node scripts/ops/gen-moba-portraits.mjs
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'apps/website-v2.9/public/oasis-assets/final_portraits';
const DEST = 'apps/nirvana/public/portraits';
const MANIFEST = 'apps/nirvana/src/core/moba/portraits.generated.ts';
const SIZE = 256;
const QUALITY = 80;

if (!existsSync(SRC)) {
  console.error(`[gen-nirvana-portraits] chybí zdroj: ${SRC}`);
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((file) => file.endsWith('.webp'));
const ids = [];
let bytes = 0;

for (const file of files) {
  const match = /^(\d{3})-[a-z0-9-]+\.webp$/i.exec(file);
  if (!match) continue;
  const id = Number(match[1]);
  if (!Number.isFinite(id)) continue;

  const buf = await sharp(join(SRC, file))
    .resize(SIZE, SIZE, { fit: 'cover' })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  writeFileSync(join(DEST, `${id}.webp`), buf);
  bytes += buf.length;
  ids.push(id);
}

// ukliď soubory, které už nemají zdroj (stará id / ruční pokusy)
const keep = new Set(ids.map((id) => `${id}.webp`));
for (const file of readdirSync(DEST)) {
  if (file.endsWith('.webp') && !keep.has(file)) rmSync(join(DEST, file));
}

ids.sort((a, b) => a - b);

writeFileSync(
  MANIFEST,
  `// GENEROVANÉ — needituj ručně. Zdroj: scripts/ops/gen-moba-portraits.mjs\n` +
    `// Portréty žijí v apps/nirvana/public/portraits/<id>.webp (256×256, z finálního OASIS artu)\n` +
    `export const PORTRAIT_IDS: readonly number[] = [${ids.join(', ')}];\n`,
);

console.log(
  `[gen-nirvana-portraits] ${ids.length} portrétů (${ids[0]}–${ids[ids.length - 1]}) ` +
    `→ ${DEST}, ${(bytes / 1024 / 1024).toFixed(1)} MB (≈ ${(bytes / ids.length / 1024).toFixed(0)} kB/ks)`,
);
