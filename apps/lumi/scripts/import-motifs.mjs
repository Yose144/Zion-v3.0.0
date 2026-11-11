#!/usr/bin/env node
/**
 * Import motivů lampionu do webu.
 *
 * Vezme balíček s podklady (šest stěn jako PNG nebo SVG) a vyrobí
 * webové varianty do `public/images/motifs/<slug>/` plus hotový snippet
 * do `src/data/catalog.ts`. Nic nezapisuje do katalogu samo — snippet
 * se vloží ručně, aby se omylem nepřepsaly ceny a sklad.
 *
 * Použití:
 *   node scripts/import-motifs.mjs <slozka-balicku> --slug <slug> [--group <skupina>]
 *   node scripts/import-motifs.mjs heros/Lumi/Lumi_2_Vanoce_FINAL --slug vanoce
 *
 * Složka musí obsahovat `Jednotlive_steny/` (PNG/SVG/WebP). Když tam
 * nejsou, hledá se jakákoli podsložka se šesti soubory. Hotový pruh
 * `Vsech_6_sten.png` se použije, pokud existuje; jinak se složí ze stěn.
 *
 * Formát názvů: `01_Stromecek.png` → pořadí 1, název „Stromecek“.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = path.join(ROOT, 'public', 'images', 'motifs');

const WIDTHS = [
  { suffix: '200', width: 200 },
  { suffix: '400', width: 400 },
  { suffix: '700', width: 700 },
];

const STRIP_WIDTHS = [
  { suffix: '640', width: 640 },
  { suffix: '1280', width: 1280 },
];

/** Barva siluety — inkoust z palety ZION Design Engine B. */
const INK = '#101C2B';

function usage(message) {
  if (message) console.error(`\n✖ ${message}\n`);
  console.error(
    [
      'Použití: node scripts/import-motifs.mjs <slozka-balicku> --slug <slug> [--group <skupina>] [--dry-run]',
      '',
      '  <slozka-balicku>  rozbalený balíček, např. heros/Lumi/Lumi_2_Vanoce_FINAL',
      '  --slug            cílová složka v public/images/motifs/<slug>',
      '  --group           volitelně variantGroup pro snippet v katalogu',
      '  --style fill|line u SVG: vyplněná silueta (výchozí) nebo jen tah',
      '  --dry-run         jen vypíše, co by vzniklo',
      '',
    ].join('\n'),
  );
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const args = { dir: null, slug: null, group: null, style: 'fill', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') args.slug = argv[++index];
    else if (arg === '--group') args.group = argv[++index];
    else if (arg === '--style') args.style = argv[++index] === 'line' ? 'line' : 'fill';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') usage();
    else if (!arg.startsWith('--') && !args.dir) args.dir = arg;
    else usage(`Neznámý argument: ${arg}`);
  }
  if (!args.dir) usage('Chybí složka balíčku.');
  if (!args.slug) usage('Chybí --slug.');
  return args;
}

/** `01_Stromecek.png` → { order: 1, name: 'Stromecek' } */
function parseWallName(file) {
  const base = path.basename(file, path.extname(file));
  const match = base.match(/^(\d+)[-_ ]+(.+)$/);
  if (match) return { order: Number(match[1]), name: match[2].replace(/[_-]+/g, ' ').trim() };
  return { order: Number.MAX_SAFE_INTEGER, name: base.replace(/[_-]+/g, ' ').trim() };
}

/** Diakritika → ASCII slug (bez diakritiky, malá písmena, pomlčky). */
function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findWallFiles(packDir) {
  const preferred = path.join(packDir, 'Jednotlive_steny');
  const candidates = [];

  if (existsSync(preferred)) candidates.push(preferred);
  for (const entry of await readdir(packDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || path.join(packDir, entry.name) === preferred) continue;
    candidates.push(path.join(packDir, entry.name));
  }

  // Balíčky často drží stejnou stěnu jako PNG i SVG. Bereme jednu, a to
  // vektor — z něj jde vyrenderovat i 700px varianta, kdežto z malého PNG ne.
  const extensionRank = { '.svg': 0, '.png': 1, '.webp': 2 };

  for (const dir of candidates) {
    const byWall = new Map();
    for (const name of await readdir(dir)) {
      const extension = path.extname(name).toLowerCase();
      if (!(extension in extensionRank)) continue;
      const file = path.join(dir, name);
      const parsed = parseWallName(file);
      const key = `${parsed.order}:${parsed.name}`;
      const current = byWall.get(key);
      if (!current || extensionRank[extension] < extensionRank[path.extname(current).toLowerCase()]) {
        byWall.set(key, file);
      }
    }
    const files = [...byWall.values()].sort((a, b) => parseWallName(a).order - parseWallName(b).order);
    if (files.length > 0) return { dir, files };
  }

  usage(`Ve ${packDir} není složka se stěnami (PNG/SVG/WebP).`);
  return null;
}

/**
 * Lidské názvy motivů. Balíčky je drží v `Motivy.json` (`01_Stromecek` →
 * `Stromeček`); když soubor chybí, použije se jméno souboru.
 */
async function readMotifNames(packDir) {
  const manifest = path.join(packDir, 'Motivy.json');
  if (!existsSync(manifest)) return new Map();
  try {
    const data = JSON.parse(await readFile(manifest, 'utf8'));
    return new Map(Object.entries(data).map(([key, value]) => [key, String(value)]));
  } catch (error) {
    console.warn(`⚠ Motivy.json se nepodařilo načíst: ${error.message}`);
    return new Map();
  }
}

function wallDisplayName(file, names) {
  const base = path.basename(file, path.extname(file));
  if (names.has(base)) return names.get(base);
  const parsed = parseWallName(file);
  return parsed.name.replace(/^./, (character) => character.toUpperCase());
}

/**
 * Načte stěnu jako buffer ve vysokém rozlišení.
 *
 * - **SVG** se rasterizuje s hustotou 240 DPI (z 68 × 130 mm vyjde
 *   ~2142 × 4094 px). Výchozí styl `fill` vyplní obrys barvou inkoustu
 *   podle `fill-rule="evenodd"` — vznikne silueta toho, co zůstane ve
 *   dřevě, stejný jazyk jako u hotových PNG. Styl `line` nechá jen tah.
 * - **PNG/WebP** se berou tak, jak jsou.
 */
async function loadWall(file, style) {
  if (!/\.svg$/i.test(file)) return sharp(file).png().toBuffer();

  let source = await readFile(file, 'utf8');
  if (style === 'line') {
    source = source.replace(/stroke\s*=\s*["']#?ff0000["']/gi, `stroke="${INK}"`);
  } else {
    source = source
      .replace(/fill\s*=\s*["']none["']/gi, `fill="${INK}"`)
      .replace(/stroke\s*=\s*["'][^"']*["']/gi, 'stroke="none"')
      .replace(/<g\s+id=["']CUT["']/i, '<g id="CUT" fill-rule="evenodd"');
  }

  return sharp(Buffer.from(source), { density: 240 }).png().toBuffer();
}

async function writeWall(buffer, outDir, order, slug, dryRun) {
  const written = [];
  for (const { suffix, width } of WIDTHS) {
    const target = path.join(outDir, `${String(order).padStart(2, '0')}-${slug}-${suffix}.webp`);
    if (!dryRun) {
      await sharp(buffer)
        .resize({ width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(target);
    }
    written.push(path.relative(ROOT, target));
  }
  return written;
}

/** Pruh šesti stěn. Když balíček nemá hotový, složí se ze stěn. */
async function writeStrip(packDir, buffers, outDir, dryRun) {
  const existing = path.join(packDir, 'Vsech_6_sten.png');
  let stripBuffer;
  let source;

  if (existsSync(existing)) {
    stripBuffer = await sharp(existing).png().toBuffer();
    source = 'Vsech_6_sten.png';
  } else {
    const metas = await Promise.all(buffers.map((buffer) => sharp(buffer).metadata()));
    const height = Math.max(...metas.map((meta) => meta.height ?? 0));
    const gap = Math.round(height * 0.04);
    const width = metas.reduce((sum, meta) => sum + (meta.width ?? 0), 0) + gap * (buffers.length - 1);
    const composites = [];
    let left = 0;
    for (let index = 0; index < buffers.length; index += 1) {
      const meta = metas[index];
      composites.push({
        input: buffers[index],
        left,
        top: Math.round((height - (meta.height ?? 0)) / 2),
      });
      left += (meta.width ?? 0) + gap;
    }
    stripBuffer = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    })
      .composite(composites)
      .png()
      .toBuffer();
    source = 'složeno ze stěn';
  }

  const written = [];
  for (const { suffix, width } of STRIP_WIDTHS) {
    const target = path.join(outDir, `strip-${suffix}.webp`);
    if (!dryRun) {
      await sharp(stripBuffer)
        .resize({ width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(target);
    }
    written.push(path.relative(ROOT, target));
  }
  return { written, source };
}

function snippet({ slug, group, walls }) {
  const lines = [];
  lines.push('      variantGroup: ' + JSON.stringify(group ?? slug) + ',');
  lines.push('      walls: [');
  for (const wall of walls) {
    lines.push('        {');
    lines.push(`          image: '/images/motifs/${slug}/${wall.file}',`);
    lines.push('          label: {');
    lines.push(`            cs: '${wall.name}',`);
    lines.push(`            en: '${wall.name}', // TODO přeložit`);
    lines.push(`            de: '${wall.name}', // TODO přeložit`);
    lines.push('          },');
    lines.push('        },');
  }
  lines.push('      ],');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packDir = path.resolve(process.cwd(), args.dir);

  if (!existsSync(packDir)) usage(`Složka neexistuje: ${packDir}`);

  const { dir, files } = await findWallFiles(packDir);
  const names = await readMotifNames(packDir);
  console.log(`\nBalíček: ${path.relative(process.cwd(), packDir)}`);
  console.log(`Stěny:   ${files.length} v ${path.relative(process.cwd(), dir)}`);
  if (files.length !== 6) {
    console.warn(`⚠ Očekává se 6 stěn, nalezeno ${files.length}. Pokračuji, ale zkontroluj to.`);
  }

  const outDir = path.join(OUT_ROOT, args.slug);
  if (!args.dryRun) await mkdir(outDir, { recursive: true });

  const buffers = [];
  const walls = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const parsed = parseWallName(file);
    const order = Number.isFinite(parsed.order) && parsed.order !== Number.MAX_SAFE_INTEGER ? parsed.order : index + 1;
    const wallSlug = slugify(parsed.name) || `stena-${order}`;
    const displayName = wallDisplayName(file, names);
    const buffer = await loadWall(file, args.style);
    buffers.push(buffer);
    const written = await writeWall(buffer, outDir, order, wallSlug, args.dryRun);
    walls.push({ file: `${String(order).padStart(2, '0')}-${wallSlug}-700.webp`, name: displayName, files: written });
    console.log(`  ${String(order).padStart(2, '0')} ${displayName} → ${written.length} variant`);
  }

  const strip = await writeStrip(packDir, buffers, outDir, args.dryRun);
  console.log(`  pruh (${strip.source}) → ${strip.written.map((file) => path.basename(file)).join(', ')}`);

  let bytes = 0;
  if (!args.dryRun) {
    for (const wall of walls) {
      for (const file of wall.files) bytes += (await stat(path.join(ROOT, file))).size;
    }
    for (const file of strip.written) bytes += (await stat(path.join(ROOT, file))).size;
  }

  console.log(
    `\n${args.dryRun ? 'DRY RUN — ' : ''}Hotovo: ${walls.length} stěn, ${strip.written.length} pruhy` +
      (bytes ? `, ${(bytes / 1024 / 1024).toFixed(2)} MB` : ''),
  );
  console.log(`Cíl: ${path.relative(ROOT, outDir)}\n`);

  console.log('── Snippet do `src/data/catalog.ts` (uvnitř produktu) ──\n');
  console.log(snippet({ slug: args.slug, group: args.group, walls }));
  console.log(
    '\n── Připomínky ──\n' +
      '  1. Doplň `variantOrder`, `motifName` a záznam do `VARIANT_GROUPS`.\n' +
      '  2. Přelož `label.en` a `label.de` (skript je nechává v češtině).\n' +
      '  3. Po přidání produktu spusť `POST /api/seed` — doplní jen chybějící řádky.\n' +
      '  4. Cenu a sklad nastav v `/admin`, ne v katalogu.\n',
  );

  if (!args.dryRun) {
    await writeFile(
      path.join(outDir, 'motivy.json'),
      `${JSON.stringify({ slug: args.slug, walls: walls.map(({ file, name }) => ({ file, name })) }, null, 2)}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
