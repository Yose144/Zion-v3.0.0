#!/usr/bin/env node
/**
 * check-oasis-i18n.mjs — kontrola dvojjazyčných profilů OASIS avatarů.
 *
 * Co ověřuje (pro všech 200 avatarů z rosteru `V31/L4/oasis/data/avatars.json`):
 *   1. publikovaný CS i EN profil existuje a není prázdný
 *   2. CS vypadá česky (diakritika) a EN neobsahuje české věty
 *   3. CS a EN nejsou identické (neduplikovaný obsah)
 *   4. kanonický soubor pro id odpovídá rosteru (kolize ID 42/43)
 *   5. každý kánon má protějšek v `i18n/` v tom jazyce, který v kánonu chybí
 *
 * Použití:
 *   node apps/website-v2.9/scripts/check-oasis-i18n.mjs            # jen problémy + souhrn
 *   node apps/website-v2.9/scripts/check-oasis-i18n.mjs --verbose  # per-avatar řádky
 *   node apps/website-v2.9/scripts/check-oasis-i18n.mjs --json     # strojový výstup
 *
 * Exit code: 0 = bez problémů, 1 = nalezeny problémy.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const PROFILES_DIR = join(REPO_ROOT, 'docs/docs2.9/ZION_OASIS/SACRED_TRINITY');
const I18N_DIR = join(PROFILES_DIR, 'i18n');
const OUT_DIR = join(APP_ROOT, 'public/data/oasis/profiles');
const ROSTER = join(REPO_ROOT, 'V31/L4/oasis/data/avatars.json');

const argv = new Set(process.argv.slice(2));
const VERBOSE = argv.has('--verbose') || argv.has('-v');
const AS_JSON = argv.has('--json');

/** Diakritika, která v angličtině prakticky nejsou (ne IAST/ʻokina). */
const DIACRITICS = /[áčďéěíňóřšťúůýž]/gi;
/** Česká slova bez diakritiky, která v anglické próze nemají co dělat. */
const CZECH_WORDS = new Set(
  ('je jsou není nebyl nebyla nebylo který která které kterého kterou když také může musí proto podle pouze ' +
    'člověk člověka svět světa život života duch ducha síla každý každá každé všechno všechna všechny protože ' +
    'jestli jeho její jejich nebo mezi před tento tato toto tím této tohoto všech bude být pod kdy už až jen ' +
    'zde tady nyní jako při přes skrze kolem vedle ani ale však ještě již velmi můžeš musíš').split(/\s+/),
);
const ENGLISH_WORDS = new Set(
  ('the and is are was were of to with that this from for it its as by not we you they he she his her their ' +
    'our your in on at or be been has have had will can more when what which who how than then there these ' +
    'those only into over under between before after').split(/\s+/),
);

const words = (line) =>
  (line.match(/[A-Za-zÁ-žʻ'’-]+/g) ?? []).map((w) => w.toLowerCase().replace(/[.,;:!?()„“"«»]/g, ''));

/** Řádek, který je z větší části český (a má diakritiku) — tedy nepřeložený. */
function looksCzech(line) {
  const w = words(line);
  if (w.length < 4) return false;
  const cz = w.filter((x) => CZECH_WORDS.has(x)).length;
  const en = w.filter((x) => ENGLISH_WORDS.has(x)).length;
  return cz >= 2 && cz > en && DIACRITICS.test(line);
}

const norm = (s) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const read = (p) => readFileSync(p, 'utf8');
const count = (re, s) => (s.match(re) ?? []).length;
const pad2 = (n) => String(n).padStart(2, '0');

// ── načtení ───────────────────────────────────────────────────────────
if (!existsSync(ROSTER)) {
  console.error(`CHYBA: chybí roster ${ROSTER}`);
  process.exit(2);
}
const avatars = JSON.parse(read(ROSTER)).avatars;

const canonFiles = new Map(); // id → [soubory]
if (existsSync(PROFILES_DIR)) {
  for (const f of readdirSync(PROFILES_DIR)) {
    const m = f.match(/^(\d+)_.+\.md$/);
    if (!m) continue;
    const id = Number(m[1]);
    canonFiles.set(id, [...(canonFiles.get(id) ?? []), f]);
  }
}

const problems = [];
const report = [];

for (const a of avatars) {
  const id = a.id;
  const rows = [];

  // 4) kanonický soubor podle rosteru
  const cands = canonFiles.get(id) ?? [];
  let canon = cands[0];
  if (cands.length > 1) {
    const target = norm(a.name);
    const named = cands.find((f) => norm(f.replace(/^\d+_/, '').replace(/\.md$/, '')) === target);
    if (!named) {
      problems.push(`id ${id}: ${cands.length} kánonů a žádný neodpovídá '${a.name}' (${cands.join(', ')})`);
    }
    canon = named ?? cands[cands.length - 1];
  }
  if (!canon) problems.push(`id ${id}: chybí kánon v ${PROFILES_DIR}`);

  // 1) publikované profily
  const csPath = join(OUT_DIR, `${id}.cs.md`);
  const enPath = join(OUT_DIR, `${id}.en.md`);
  const hasCs = existsSync(csPath);
  const hasEn = existsSync(enPath);
  if (!hasCs) problems.push(`id ${id}: chybí ${id}.cs.md`);
  if (!hasEn) problems.push(`id ${id}: chybí ${id}.en.md`);

  if (hasCs && hasEn) {
    const cs = read(csPath);
    const en = read(enPath);
    if (cs.trim().length < 200) problems.push(`id ${id}: cs profil je krátký (${cs.length} znaků)`);
    if (en.trim().length < 200) problems.push(`id ${id}: en profil je krátký (${en.length} znaků)`);
    if (cs.trim() === en.trim()) problems.push(`id ${id}: cs a en profil jsou identické`);

    // 2) EN bez českých vět
    const czLines = en
      .split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => looksCzech(l))
      .map(([n, l]) => `${n}: ${l.trim().slice(0, 90)}`);
    if (czLines.length) {
      problems.push(`id ${id}: en profil má ${czLines.length} českých řádků → ${czLines.slice(0, 3).join(' | ')}`);
    }

    // 3) CS musí být česky. Kanonický styl některých profilů je „česká kostra +
    //    anglické termíny" (např. „matriarch deity peaches lore; v OASIS reprezentuje…"),
    //    takže se nevyžaduje hustá diakritika — jen aby tam česká složka byla.
    const minDiacritics = Math.max(4, Math.floor(cs.length / 200));
    if (cs.length > 300 && count(DIACRITICS, cs) < minDiacritics) {
      problems.push(
        `id ${id}: cs profil nevypadá česky (${count(DIACRITICS, cs)} diakritik, minimum ${minDiacritics})`,
      );
    }

    rows.push(`cs=${cs.length} en=${en.length}`);
  }

  // 5) kánon musí mít protějšek v i18n + parita struktury s kánonem
  if (canon) {
    const c = read(join(PROFILES_DIR, canon));
    const diac = count(DIACRITICS, c);
    const enW = count(/\b(the|and|is|of|to|with|that|this|from|for)\b/gi, c);
    const lang = diac > enW * 3 ? 'cs' : enW > diac * 3 ? 'en' : enW > diac ? 'en' : 'cs';
    const other = lang === 'cs' ? 'en' : 'cs';
    const otherPath = join(I18N_DIR, `${pad2(id)}.${other}.md`);
    rows.push(`kánon=${lang}`);
    if (!existsSync(otherPath)) {
      problems.push(`id ${id}: chybí překlad ${pad2(id)}.${other}.md (kánon je ${lang})`);
    } else {
      const tr = read(otherPath);
      const heads = (t) => count(/^#{1,6}\s/gm, t);
      const blocks = (t) => (t.match(/```\w*\n[\s\S]*?```/g) ?? []).length;
      const links = (t) => (t.match(/\]\(([^)]+)\)/g) ?? []).map((s) => s.slice(2, -1)).sort();
      if (heads(c) !== heads(tr)) {
        problems.push(`id ${id}: ${pad2(id)}.${other}.md má ${heads(tr)} nadpisů, kánon ${heads(c)}`);
      }
      if (blocks(c) !== blocks(tr)) {
        problems.push(`id ${id}: ${pad2(id)}.${other}.md má ${blocks(tr)} code bloků, kánon ${blocks(c)}`);
      }
      const lc = links(c);
      const lt = links(tr);
      if (lc.join('|') !== lt.join('|')) {
        const missing = lc.filter((x) => !lt.includes(x)).slice(0, 4);
        problems.push(`id ${id}: ${pad2(id)}.${other}.md nemá stejné odkazy jako kánon (chybí: ${missing.join(', ') || '—'})`);
      }
      const ratio = tr.length / Math.max(c.length, 1);
      if (ratio < 0.85) {
        problems.push(`id ${id}: ${pad2(id)}.${other}.md je zkrácený (${tr.length}/${c.length} = ${(ratio * 100).toFixed(0)} %)`);
      }
      rows.push(`překlad=${other}:${ratio.toFixed(2)}`);
    }
  }

  report.push({ id, name: a.name, details: rows.join(' ') });
}

// ── výstup ────────────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(JSON.stringify({ avatars: avatars.length, problems, report }, null, 2));
} else {
  if (VERBOSE) for (const r of report) console.log(`  ${pad2(r.id)}  ${r.name.padEnd(28)} ${r.details}`);
  if (problems.length) {
    console.error(`\nNALEZENO ${problems.length} PROBLÉMŮ:`);
    for (const p of problems) console.error(`  - ${p}`);
  }
  const outCount = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.md')).length : 0;
  console.log(
    `\n${problems.length ? '✗' : '✓'} avatarů: ${avatars.length} | profilů v public/data: ${outCount} ` +
      `(očekáváno ${avatars.length * 2}) | problémů: ${problems.length}`,
  );
}
process.exit(problems.length ? 1 : 0);
