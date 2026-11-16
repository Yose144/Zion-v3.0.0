#!/usr/bin/env node
/**
 * Generuje seznamy avatarů, které mají herní 3D model (GLB).
 *
 * Zdroj pravdy jsou soubory v gitu: `apps/nirvana/public/models/avatars/<id>.glb`.
 * Výstupy (dva, oba odvozené z disku — nikdy ručně):
 *   - `apps/nirvana/src/core/avatars/models.ts`          (mapa id → cesta, hra)
 *   - `apps/website-v2.9/src/lib/oasis/avatar-models.json` (id[], 3D náhled na webu)
 *
 * Proč: web kreslí 3D náhled jen pro ID v JSON seznamu (`MODEL_IDS`) a hra
 * vybírá GLB podle `AVATAR_MODELS`. Když se doplní dávka modelů a seznam
 * zůstane starý, nové avatary náhled tiše nemají — přesně to se stalo u dávek
 * 04–06. GLB soubory do buildů kopírují deploy skripty.
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

// --- mapa pro hru (Nirvana): hlavičku souboru zachováme, tělo generujeme ---
const mapFile = join(root, 'apps', 'nirvana', 'src', 'core', 'avatars', 'models.ts');
if (existsSync(mapFile)) {
  const current = readFileSync(mapFile, 'utf8');
  const marker = 'export const AVATAR_MODELS';
  const headerEnd = current.indexOf(marker);
  if (headerEnd < 0) throw new Error('models.ts nemá AVATAR_MODELS');

  // Hlavička: vezmi řádky před markerem, vyhoď starý "Generováno" řádek
  // a přebytečné prázdné komentářové řádky na konci, pak doplň nový.
  const headerLines = current
    .slice(0, headerEnd)
    .split('\n')
    .filter((line) => !line.includes('Generováno z dávek'));
  // Vyhoď uzavření starého komentáře a prázdné komentářové řádky na konci.
  while (
    headerLines.length &&
    /^\s*(\*|\/\*\*|\*\/)?\s*$/.test(headerLines[headerLines.length - 1])
  ) {
    headerLines.pop();
  }
  const header = `${headerLines.join('\n')}\n *\n * Generováno z dávek 01–08 (${ids.length} modelů, TripoSR MC 320 + textura 2048, rig)\n */\n`;

  const runs = [];
  let start = ids[0];
  let prev = ids[0];
  for (const id of ids.slice(1)) {
    if (id === prev + 1) {
      prev = id;
      continue;
    }
    runs.push([start, prev]);
    start = prev = id;
  }
  runs.push([start, prev]);
  const pad = (n) => String(n).padStart(2, '0');
  const desc = runs.map(([a, b]) => (a === b ? pad(a) : `${pad(a)}–${pad(b)}`)).join(', ');

  const body = `${header}export const AVATAR_MODELS: Record<number, string> = {\n${ids
    .map((id) => `  ${id}: '/models/avatars/${id}.glb',`)
    .join('\n')}\n};\n`;
  const tail = current.slice(current.indexOf('};') + 2);
  writeFileSync(mapFile, body + tail);
  console.log(`[avatar-models] models.ts: ${ids.length} modelů (${desc})`);
}
