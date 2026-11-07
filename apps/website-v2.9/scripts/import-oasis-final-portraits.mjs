#!/usr/bin/env node
/**
 * Import finálních portrétů OASIS avatárů z archivního balíčku
 * `heros/ZION_OASIS_AVATARI_KOMPLET/` do webu.
 *
 * Co dělá:
 *   1. Přečte `SOUPIS_A_MAPOVANI_NA_WEB.csv` (autoritativní mapování) a spáruje
 *      každý portrét s avatarem v `V31/L4/oasis/data/avatars.json` **podle jména**
 *      (produkční čísla 001–200 se na webovém rosteru posouvají, pořadí souborů
 *      ani `web_id` se použít nedají).
 *   2. Převede portrét na 640×640 webp (q80) do
 *      `public/oasis-assets/final_portraits/<avatarId>-<slug>.webp`.
 *      Slug se bere z `game-portraits.json`, aby finální art seděl na stejné
 *      jméno souboru jako herní náhled; fallback = slug z archivu.
 *   3. Aktualizuje `scripts/oasis-art-manifest.json` (`finalPortrait`) a doplní
 *      chybějící záznamy pro nové postavy (#203 Anagha, #204 Chaitanya).
 *   4. Smaže osiřelé soubory ve `final_portraits/` (stará produkční číslování).
 *
 * Portréty jsou kandidáti schválení 👤 — skript nic nepublikuje, jen připraví
 * assety a data pro `gen-oasis-avatars.mjs`.
 *
 * Usage:
 *   node scripts/import-oasis-final-portraits.mjs            # import
 *   node scripts/import-oasis-final-portraits.mjs --dry-run  # jen plán
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const ARCHIVE = join(REPO_ROOT, 'heros', 'ZION_OASIS_AVATARI_KOMPLET');
const CSV = join(ARCHIVE, 'SOUPIS_A_MAPOVANI_NA_WEB.csv');
const AVATARS_JSON = join(REPO_ROOT, 'V31', 'L4', 'oasis', 'data', 'avatars.json');
const ART_MANIFEST = join(APP_ROOT, 'scripts', 'oasis-art-manifest.json');
const GAME_PORTRAITS = join(APP_ROOT, 'src', 'lib', 'oasis', 'game-portraits.json');
const OUT_DIR = join(APP_ROOT, 'public', 'oasis-assets', 'final_portraits');
const PUBLIC_PREFIX = '/oasis-assets/final_portraits';

const SIZE = 640;
const QUALITY = 80;
const DRY = process.argv.includes('--dry-run');

/** Normalizace pro párování jmen (diakritika, apostrofy, interpunkce). */
const normName = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Slug z cesty portrétu: `001-krishna-maitreya.webp` → `krishna-maitreya`. */
const slugOf = (file) =>
  basename(file)
    .replace(/\.(webp|png)$/i, '')
    .replace(/^(ADD-\d+|\d{3})-/, '');

const id3 = (n) => String(n).padStart(3, '0');

/** Minimální CSV parser (soubor má prázdné sloupce a uvozovky v `notes`). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift().map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

if (!existsSync(CSV)) {
  console.error(`[import-portraits] chybí archiv: ${CSV}`);
  process.exit(1);
}

const avatars = JSON.parse(readFileSync(AVATARS_JSON, 'utf8')).avatars;
const byName = new Map(avatars.map((a) => [normName(a.name), a]));
if (byName.size !== avatars.length) {
  console.error('[import-portraits] avatars.json má duplicitní normalizovaná jména');
  process.exit(1);
}

const gamePortraits = JSON.parse(readFileSync(GAME_PORTRAITS, 'utf8'));
const gameSlug = (id) => {
  const p = gamePortraits[String(id)];
  return p ? slugOf(p) : '';
};

const rows = parseCsv(readFileSync(CSV, 'utf8'));
const plan = [];
const skipped = [];

for (const row of rows) {
  if (!row.file) {
    skipped.push(row);
    continue;
  }
  const avatar = byName.get(normName(row.web_name));
  if (!avatar) {
    console.error(`[import-portraits] „${row.web_name}" (${row.id}) nemá avatara v rosteru`);
    process.exit(1);
  }
  const src = join(ARCHIVE, row.file);
  if (!existsSync(src)) {
    console.error(`[import-portraits] chybí soubor ${row.file}`);
    process.exit(1);
  }
  const slug = gameSlug(avatar.id) || slugOf(row.file);
  const file = `${id3(avatar.id)}-${slug}.webp`;
  plan.push({
    avatarId: avatar.id,
    name: avatar.name,
    productionId: row.id,
    status: row.status,
    notes: row.notes,
    src,
    file,
    url: `${PUBLIC_PREFIX}/${file}`,
  });
}

const ids = new Set(plan.map((p) => p.avatarId));
const files = new Set(plan.map((p) => p.file));
if (ids.size !== plan.length || files.size !== plan.length) {
  console.error('[import-portraits] kolize id nebo názvů souborů');
  process.exit(1);
}

console.log(
  `[import-portraits] ${plan.length} portrétů, ${skipped.length} bez samostatného renderu ` +
    `(${skipped.map((r) => r.web_name).join(', ')})`,
);

// ── 1) konverze ──────────────────────────────────────────────────────
if (!DRY) mkdirSync(OUT_DIR, { recursive: true });

let done = 0;
let bytes = 0;
for (const item of plan) {
  const dest = join(OUT_DIR, item.file);
  if (!DRY) {
    const buf = await sharp(item.src)
      .resize(SIZE, SIZE, { fit: 'cover' })
      .webp({ quality: QUALITY, effort: 5 })
      .toBuffer();
    writeFileSync(dest, buf);
    bytes += buf.length;
  }
  done += 1;
  if (done % 25 === 0) console.log(`[import-portraits] ${done}/${plan.length}`);
}
if (!DRY) {
  console.log(
    `[import-portraits] zapsáno ${done} souborů, ${(bytes / 1024 / 1024).toFixed(1)} MB ` +
      `(≈ ${(bytes / done / 1024).toFixed(0)} kB/ks)`,
  );
  // osiřelé soubory (staré produkční číslování) — jen .webp, které plán nezná
  for (const f of readdirSync(OUT_DIR)) {
    if (!f.endsWith('.webp')) continue;
    if (!files.has(f)) {
      rmSync(join(OUT_DIR, f));
      console.log(`[import-portraits] smazán osiřelý ${f}`);
    }
  }
}

// ── 2) art manifest ──────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(ART_MANIFEST, 'utf8'));
const byPlanId = new Map(plan.map((p) => [p.avatarId, p]));

// Manifest je pozičně svázaný s polem `avatars` a jméno se ověřuje → doplníme
// chybějící záznamy na konec, aby indexy 200/201 sedly na #203/#204.
for (const avatar of avatars.slice(manifest.length)) {
  const entry = byPlanId.get(avatar.id);
  manifest.push({
    id: `OASIS-${id3(avatar.id + 1)}`,
    name: avatar.name,
    circle: '',
    art: '',
    finalPortrait: null,
  });
  console.log(`[import-portraits] manifest += ${avatar.id} ${avatar.name}`);
}

for (const entry of manifest) {
  const avatar = byName.get(normName(entry.name));
  const item = avatar ? byPlanId.get(avatar.id) : undefined;
  entry.finalPortrait = item ? item.url : null;
}

if (!DRY) {
  writeFileSync(ART_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[import-portraits] manifest: ${manifest.length} záznamů, ${plan.length} finálních`);
}

if (DRY) console.log('[import-portraits] --dry-run: nic se nezapsalo');
