#!/usr/bin/env node
/**
 * Generuje seznam avatarů, které mají herní 3D model (GLB), pro web2.9.
 *
 * Zdroj pravdy jsou soubory v gitu: `apps/nirvana/public/models/avatars/<id>.glb`.
 * Výstup: `apps/website-v2.9/src/lib/oasis/avatar-models.json` = `{ "ids": [...] }`.
 *
 * Proč: web (/l4-oasis/avatars) kreslí 3D náhled jen pro ID, která jsou v tomhle
 * seznamu (`MODEL_IDS` ve stránce). Když se doplní dávka modelů a seznam zůstane
 * starý, nové avatary 3D náhled tiše nemají — přesně to se stalo u dávek 04–06.
 * GLB soubory do buildu kopíruje `apps/website-v2.9/deploy/deploy-web2.9.sh`.
 *
 * Použití: node scripts/ops/gen-avatar-models.mjs
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const modelsDir = join(root, 'apps', 'nirvana', 'public', 'models', 'avatars');
const target = join(root, 'apps', 'website-v2.9', 'src', 'lib', 'oasis', 'avatar-models.json');

if (!existsSync(modelsDir)) {
  // Build bez stromu Nirvany (např. artefakt) — existující seznam necháváme být.
  console.warn(`[avatar-models] chybí ${modelsDir} — ponechávám stávající seznam`);
  process.exit(0);
}

const ids = readdirSync(modelsDir)
  .map((name) => /^(\d+)\.glb$/.exec(name))
  .filter(Boolean)
  .map((match) => Number(match[1]))
  .sort((a, b) => a - b);

if (ids.length === 0) {
  console.warn('[avatar-models] v models/avatars nejsou žádné <id>.glb — ponechávám seznam');
  process.exit(0);
}

const previous = existsSync(target)
  ? JSON.parse(readFileSync(target, 'utf8')).ids ?? []
  : [];

writeFileSync(target, `${JSON.stringify({ ids }, null, 1)}\n`);
console.log(`[avatar-models] ${ids.length} modelů (dřív ${previous.length}) → ${target.replace(root + '/', '')}`);
