#!/usr/bin/env node
/**
 * Sloučí doplňkové balíčky portrétů do hlavního archivu OASIS avatárů.
 *
 * Balíček = podsložka archivu odpovídající `ZION_OASIS_DOPLNENI_*` s vlastním
 * `SOUPIS_A_MAPOVANI_NA_WEB.csv` (schema: archive_id, roster_id, name, file,
 * status, sha256, width, height, id_source) a složkou `01_PORTRETY/`.
 *
 * Co udělá (idempotentně):
 *   1. zkopíruje PNG do `<archiv>/01_PORTRETY/` (a ověří sha256),
 *   2. v hlavním `SOUPIS_A_MAPOVANI_NA_WEB.csv` přepne řádek daného
 *      **archivního čísla** (`id`) na `SAMOSTATNY_RENDER` + cestu + hash,
 *   3. totéž v `MANIFEST.json`,
 *   4. doplní nové řádky do `SHA256SUMS.txt` (staré výřezy/koncepty zůstávají),
 *   5. v `INDEX.html` nahradí dlaždici „Chybí samostatný portrét" obrázkem
 *      a aktualizuje úvodní odstavec.
 *
 * Pozor: `roster_id` v balíčku je ID avatara v kanonu (`avatars.json`), ne
 * pořadí na webu — používá se jen pro kontrolu, že jméno sedí na stejné ID.
 *
 * Usage:
 *   node scripts/ops/oasis-archive-merge-supplement.mjs [--dry-run] [--archive PATH]
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const archArg = args.indexOf('--archive');
const ARCHIVE = resolve(
  REPO_ROOT,
  archArg >= 0 ? args[archArg + 1] : 'heros/ZION_OASIS_AVATARI_KOMPLET',
);

const MAIN_CSV = join(ARCHIVE, 'SOUPIS_A_MAPOVANI_NA_WEB.csv');
const MAIN_MANIFEST = join(ARCHIVE, 'MANIFEST.json');
const SUMS = join(ARCHIVE, 'SHA256SUMS.txt');
const INDEX = join(ARCHIVE, 'INDEX.html');
const PORTRAITS_DIR = join(ARCHIVE, '01_PORTRETY');

if (!existsSync(MAIN_CSV)) {
  console.error(`[merge-supplement] chybí archiv: ${ARCHIVE}`);
  process.exit(1);
}

/* ── CSV helpers (stejná logika jako v import-oasis-final-portraits.mjs) ── */
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
  return {
    header,
    rows: rows
      .filter((r) => r.some((c) => c.trim() !== ''))
      .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

const esc = (value) => {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (header, rows) =>
  `\uFEFF${header.join(',')}\n${rows.map((r) => header.map((h) => esc(r[h])).join(',')).join('\n')}\n`;

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/* ── 1) najdi balíčky ───────────────────────────────────────────────── */
const packages = readdirSync(ARCHIVE, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^ZION_OASIS_DOPLNENI_/i.test(e.name))
  .map((e) => join(ARCHIVE, e.name));

if (!packages.length) {
  console.error('[merge-supplement] žádné balíčky ZION_OASIS_DOPLNENI_* nenalezeny');
  process.exit(1);
}

const main = parseCsv(readFileSync(MAIN_CSV, 'utf8'));
const manifest = JSON.parse(readFileSync(MAIN_MANIFEST, 'utf8'));
const byArchiveId = new Map(main.rows.map((r) => [r.id, r]));
const manifestById = new Map(manifest.map((r) => [String(r.id), r]));

const newSumLines = [];
const indexFixes = new Map(); // archiveId → nový název souboru
let merged = 0;

for (const pkg of packages) {
  const pkgName = basename(pkg);
  const csvPath = join(pkg, 'SOUPIS_A_MAPOVANI_NA_WEB.csv');
  if (!existsSync(csvPath)) {
    console.warn(`[merge-supplement] ${pkgName}: chybí SOUPIS_A_MAPOVANI_NA_WEB.csv — přeskakuji`);
    continue;
  }
  const pkgCsv = parseCsv(readFileSync(csvPath, 'utf8'));

  for (const row of pkgCsv.rows) {
    const archiveId = row.archive_id;
    const target = byArchiveId.get(archiveId);
    if (!target) {
      console.error(`[merge-supplement] ${pkgName}: archivní číslo ${archiveId} není v hlavním soupisu`);
      process.exit(1);
    }
    const src = join(pkg, row.file);
    if (!existsSync(src)) {
      console.error(`[merge-supplement] ${pkgName}: chybí soubor ${row.file}`);
      process.exit(1);
    }
    const hash = sha256(src);
    if (row.sha256 && row.sha256 !== hash) {
      console.error(`[merge-supplement] ${row.file}: sha256 nesouhlasí (balíček ${row.sha256}, soubor ${hash})`);
      process.exit(1);
    }

    const file = `01_PORTRETY/${basename(row.file)}`;
    const dest = join(ARCHIVE, file);
    if (!DRY && !existsSync(dest)) copyFileSync(src, dest);
    newSumLines.push(`${hash}  ${file}`);
    indexFixes.set(archiveId, basename(row.file));

    const note = `Doplněno 2026-11-07 (${pkgName}) — samostatný render 1254×1254, AI ilustrace; atributy a pořadí beze změny.`;
    for (const record of [target, manifestById.get(archiveId)]) {
      if (!record) continue;
      record.status = 'SAMOSTATNY_RENDER';
      record.file = file;
      record.source = `${pkgName}/${row.file}`;
      record.sha256 = hash;
      record.notes = note;
    }
    merged += 1;
  }
}

console.log(
  `[merge-supplement] ${packages.length} balíčků, ${merged} portrétů` +
    (DRY ? ' (dry-run)' : ''),
);

/* ── 2) SHA256SUMS — nahraď staré řádky stejné cesty, zbytek doplň ────── */
const sumLines = readFileSync(SUMS, 'utf8').split('\n');
const replacedPaths = new Set(newSumLines.map((l) => l.split('  ')[1]));
const kept = sumLines.filter((line) => {
  const path = line.split('  ')[1];
  return line.trim() && !replacedPaths.has(path);
});
const nextSums = [...kept, ...newSumLines].sort((a, b) => a.split('  ')[1].localeCompare(b.split('  ')[1]));

/* ── 3) INDEX.html — dlaždice „chybí" → obrázek + úvod ───────────────── */
let index = readFileSync(INDEX, 'utf8');
let fixedTiles = 0;
index = index.replace(
  /<article><div class="missing">Chybí samostatný portrét<\/div><h2>(\d{3}) · (.*?)<\/h2>(<p>.*?<\/p>)<small>.*?<\/small><\/article>/g,
  (whole, id, name, meta) => {
    const file = indexFixes.get(id);
    if (!file) return whole;
    fixedTiles += 1;
    return `<article><img loading="lazy" src="01_PORTRETY/${file}"><h2>${id} · ${name}</h2>${meta}<small>SAMOSTATNY_RENDER</small></article>`;
  },
);
index = index.replace(
  /<p>191 samostatných portrétů\/kandidátů\..*?<\/p>/,
  `<p>202 samostatných portrétů (200 produkční řady 001–200 + 2 přidané postavy). Balíček ` +
    `<code>ZION_OASIS_DOPLNENI_11</code> doplnil 11 chybějících renderů (011–020, 052); ` +
    `historické výřezy a koncepty zůstávají v 03/04 jen jako archiv. Názvy a výrobní číslování ` +
    `zachovány, aktuální webové pořadí uvedeno zvlášť.</p>`,
);

/* ── 4) zápis ───────────────────────────────────────────────────────── */
if (DRY) {
  console.log(`[merge-supplement] dry-run: ${merged} portrétů, ${fixedTiles} dlaždic v INDEX.html`);
} else {
  writeFileSync(MAIN_CSV, writeCsv(main.header, main.rows));
  writeFileSync(MAIN_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(SUMS, `${nextSums.join('\n')}\n`);
  writeFileSync(INDEX, index);
  console.log(
    `[merge-supplement] zapsáno: ${merged} portrétů, ${fixedTiles} dlaždic v INDEX.html, ` +
      `${newSumLines.length} nových řádků v SHA256SUMS.txt`,
  );
}
