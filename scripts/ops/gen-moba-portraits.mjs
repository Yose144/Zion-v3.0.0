#!/usr/bin/env node
/**
 * Portréty hrdinů pro MOBA — z webových karet do `apps/nirvana/public`.
 *
 * Web už má 200 portrétů vyrenderovaných ze **stejného** avatar modelu
 * (`scripts/ops/oasis-avatar-render/render.mjs`), takže nemá smysl generovat
 * druhou sadu. Skript je jen zkopíruje pod jménem `<id>.webp` (aby se dalo
 * mapovat z `heroId`) a zapíše seznam dostupných id do TS souboru.
 *
 * Spuštění: node scripts/ops/gen-moba-portraits.mjs
 */

import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'apps/website-v2.9/public/oasis-assets/game-portraits';
const DEST = 'apps/nirvana/public/portraits';
const MANIFEST = 'apps/nirvana/src/core/moba/portraits.generated.ts';

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((file) => file.endsWith('.webp'));
const ids = [];

for (const file of files) {
  const match = /^(\d{3})-.*\.webp$/.exec(file);
  if (!match) continue;
  const id = Number(match[1]);
  if (!Number.isFinite(id)) continue;
  copyFileSync(join(SRC, file), join(DEST, `${id}.webp`));
  ids.push(id);
}

ids.sort((a, b) => a - b);

writeFileSync(
  MANIFEST,
  `// GENEROVANÉ — needituj ručně. Zdroj: scripts/ops/gen-moba-portraits.mjs\n` +
    `// Portréty žijí v apps/nirvana/public/portraits/<id>.webp\n` +
    `export const PORTRAIT_IDS: readonly number[] = [${ids.join(', ')}];\n`,
);

console.log(`portréty: ${ids.length} souborů (${ids[0]}–${ids[ids.length - 1]}) → ${DEST}`);
