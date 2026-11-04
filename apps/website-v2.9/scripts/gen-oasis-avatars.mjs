#!/usr/bin/env node
/**
 * Generuje `src/lib/oasis/avatars.ts` pro stránku /l4-oasis/avatars.
 *
 * Zdroje (repo root, o dvě úrovně výš):
 *   - V31/L4/oasis/data/avatars.json        — kanonický roster (200 avatarů)
 *   - docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md — přiřazení avatarů do kruhů
 *     (sekce `## … CIRCLE`, položky `### **NN. Jméno**`; číslo = avatar id)
 *   - docs/docs2.9/ZION_OASIS/SACRED_TRINITY/<id>_*.md — profil per avatar:
 *     `essence`/`quote` → karta; sanitizovaný celý profil →
 *     public/data/oasis/profiles/<id>.md (modal ho tahá lazy fetchí)
 *   - scripts/oasis-essence-i18n.json — cs/en essence na kartách
 *   - scripts/oasis-art-manifest.json — OASIS Avatar Collection (manifest kopie):
 *     poziční mapa manifest[i] ↔ avatars[i] (ověřeno jmény), card = concept webp,
 *     full = finalPortrait webp ?? concept svg (vektor pro velký modal)
 *
 * Kruhy v JSON nejsou — parsují se z md. Pozor na dvě zvláštnosti md:
 *   - `---## 🇯🇵 JAPAN CIRCLE` má hlavičku slepenou s `---` (regex níže to kryje)
 *   - Maya #202 (Bolon Yokte' K'uh) je vložená v Egypt sekci → override MAYA_IDS
 *
 * Usage: node scripts/gen-oasis-avatars.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const AVATARS_JSON = join(REPO_ROOT, 'V31/L4/oasis/data/avatars.json');
const ROSTER_MD = join(REPO_ROOT, 'docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md');
const PROFILES_DIR = join(REPO_ROOT, 'docs/docs2.9/ZION_OASIS/SACRED_TRINITY');
const OUT = join(APP_ROOT, 'src/lib/oasis/avatars.ts');
const PROFILE_OUT_DIR = join(APP_ROOT, 'public/data/oasis/profiles');
const ESSENCE_I18N = join(APP_ROOT, 'scripts/oasis-essence-i18n.json');
const ART_MANIFEST = join(APP_ROOT, 'scripts/oasis-art-manifest.json');
const ART_PUBLIC_DIR = join(APP_ROOT, 'public/oasis-assets');
/** Veřejné cs/en texty avatarů (jeden JSON per kruh) — ručně psané, ne generované. */
const COPY_DIR = join(APP_ROOT, 'scripts/oasis-avatar-copy');

/**
 * Žebřík úrovní vědomí 1–9 (CL). Čtyři jména jsou z kánonu (Heart Opening,
 * Quantum, Intuitive Wisdom, Healing Compassion, Transcendent, ON THE STAR),
 * první tři doplněny tak, aby řada byla souvislá a veřejně srozumitelná.
 */
const CL_LADDER = {
  1: { cs: 'Tělo a dech', en: 'Body & Breath' },
  2: { cs: 'Emoce', en: 'Emotion' },
  3: { cs: 'Mysl', en: 'Mind' },
  4: { cs: 'Otevřené srdce', en: 'Heart Opening' },
  5: { cs: 'Kvantový skok', en: 'Quantum' },
  6: { cs: 'Intuitivní moudrost', en: 'Intuitive Wisdom' },
  7: { cs: 'Léčivý soucit', en: 'Healing Compassion' },
  8: { cs: 'Transcendence', en: 'Transcendent' },
  9: { cs: 'Na hvězdě', en: 'On the Star' },
};

/**
 * Legacy pole z `avatars.json` bývají polepená zbytky generátoru
 * (`· **Quest:** … · **CL:** 4–8 · **NFT:** …`) a uříznutá uprostřed slova.
 * Overlay z `oasis-avatar-copy/` má vždy přednost; tenhle čistič je jen
 * záchranná síť, aby se do veřejné stránky nedostal markdown.
 */
function cleanLegacy(value) {
  if (typeof value !== 'string') return '';
  let s = value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // odřízni meta ocásky typu „lore · Quest: … · CL: 4–8 · NFT: …"
  s = s.split(/\s+·\s+/).filter((part) => !/\b(Quest|CL|NFT|Ray|Ability)\s*:/i.test(part))[0] ?? s;
  s = s.replace(/[\s·–-]+$/, '').replace(/^[\s·–-]+/, '');
  // uříznuté slovo na konci („story summ", „consult, never ") → pryč
  if (/\b[a-z]{1,}$/.test(s) && /[a-z]{2,}\s+[a-z]{1,4}$/.test(s) && s.length > 0) {
    // ponech, jen pokud jde o běžné krátké slovo
    if (!/\b(the|and|for|with|from|into|over|not|all|own|new|one|two|use|can|may|our|its|his|her|are|was)\b$/i.test(s)) {
      s = s.replace(/\s+\S+$/, '');
    }
  }
  return s.trim().replace(/[;,]$/, '');
}

/** Avataři, kteří v md leží v cizí sekci, ale tvoří vlastní kruh. */
const CIRCLE_OVERRIDES = { 202: 'maya' };

/** Pořadí kruhů = pořadí sekcí v AVATAR_ROSTER.md (+ maya na konec). */
const CIRCLES = [
  { key: 'hindu',        emoji: '🕉️', cs: 'Hinduistická božstva',     en: 'Hindu Deities' },
  { key: 'christian',    emoji: '✝️',  cs: 'Křesťanští svatí',        en: 'Christian Saints' },
  { key: 'buddhist',     emoji: '🧘', cs: 'Buddhističtí mistři',      en: 'Buddhist Masters' },
  { key: 'ascended',     emoji: '🌟', cs: 'Ascendovaní mistři',       en: 'Ascended Masters' },
  { key: 'historical',   emoji: '👑', cs: 'Historické legendy',       en: 'Historical Legends' },
  { key: 'matrix',       emoji: '🎬', cs: 'Hrdinové Matrixu',         en: 'Matrix Heroes' },
  { key: 'zion',         emoji: '🌌', cs: 'ZION Originals',           en: 'ZION Originals' },
  { key: 'first-nations',emoji: '🪶', cs: 'Kruh prvních národů',      en: 'First Nations Circle' },
  { key: 'pacific',      emoji: '🌺', cs: 'Pacifický kruh',           en: 'Pacific Circle' },
  { key: 'tibet',        emoji: '🏔️', cs: 'Tibetský kruh',            en: 'Tibet Circle' },
  { key: 'india',        emoji: '🇮🇳', cs: 'Indie — rozšířený kruh',   en: 'India Extended Circle' },
  { key: 'japan',        emoji: '🇯🇵', cs: 'Japonský kruh',            en: 'Japan Circle' },
  { key: 'china',        emoji: '🇨🇳', cs: 'Čínský kruh',              en: 'China Circle' },
  { key: 'indonesia',    emoji: '🇮🇩', cs: 'Indonéský kruh',           en: 'Indonesia Circle' },
  { key: 'australia',    emoji: '🇦🇺', cs: 'Australský kruh',          en: 'Australia Circle' },
  { key: 'aotearoa',     emoji: '🇳🇿', cs: 'Kruh Aotearoa (NZ)',       en: 'Aotearoa (NZ) Circle' },
  { key: 'africa',       emoji: '🌍', cs: 'Africký kruh',             en: 'Africa Circle' },
  { key: 'atlantis',     emoji: '🏛️', cs: 'Kruh Atlantis',            en: 'Atlantis Circle' },
  { key: 'lemuria',      emoji: '🌫️', cs: 'Kruh Lemurie',             en: 'Lemuria Circle' },
  { key: 'cosmic',       emoji: '🌠', cs: 'Kosmický kruh · Vzestup',  en: 'Cosmic / Vzestup Circle' },
  { key: 'norse-celtic', emoji: '⚔️', cs: 'Seversko-keltský kruh',    en: 'Norse–Celtic Circle' },
  { key: 'egypt',        emoji: '🏺', cs: 'Kruh starověkého Egypta',  en: 'Ancient Egypt Circle' },
  { key: 'maya',         emoji: '🌳', cs: 'Kruh Maya',                en: 'Maya Circle' },
];

const SECTION_RULES = [
  [/HINDU/i, 'hindu'], [/CHRISTIAN/i, 'christian'], [/BUDDHIST/i, 'buddhist'],
  [/ASCENDED/i, 'ascended'], [/HISTORICAL/i, 'historical'], [/MATRIX/i, 'matrix'],
  [/ZION ORIGINALS/i, 'zion'], [/FIRST NATIONS/i, 'first-nations'], [/PACIFIC/i, 'pacific'],
  [/TIBET/i, 'tibet'], [/INDIA EXTENDED/i, 'india'], [/JAPAN/i, 'japan'], [/CHINA/i, 'china'],
  [/INDONESIA/i, 'indonesia'], [/AUSTRALIA/i, 'australia'], [/AOTEAROA/i, 'aotearoa'],
  [/AFRICA/i, 'africa'], [/ATLANTIS/i, 'atlantis'], [/LEMURIA/i, 'lemuria'],
  [/COSMIC|VZESTUP/i, 'cosmic'], [/NORSE|CELTIC/i, 'norse-celtic'], [/EGYPT/i, 'egypt'],
];

// ── 1) kruhy z markdownu ──────────────────────────────────────────────
const md = readFileSync(ROSTER_MD, 'utf8');
const idToCircle = new Map();
let current = null;
for (const rawLine of md.split('\n')) {
  const line = rawLine.replace(/^-{2,}\s*/, '');
  const h = line.match(/^##\s+(.+)$/);
  if (h) {
    const title = h[1];
    current = null;
    for (const [re, key] of SECTION_RULES) {
      if (re.test(title)) { current = key; break; }
    }
    continue;
  }
  const entry = line.match(/^###\s+\*\*(\d+)\.\s+/);
  if (entry && current) idToCircle.set(Number(entry[1]), current);
}

// ── 2) profily SACRED_TRINITY/<id>_*.md ───────────────────────────────
/** index id → absolutní cesta profilu */
const profileFiles = new Map();
if (existsSync(PROFILES_DIR)) {
  for (const f of readdirSync(PROFILES_DIR)) {
    const m = f.match(/^(\d+)_.+\.md$/);
    if (m) profileFiles.set(Number(m[1]), join(PROFILES_DIR, f));
  }
}

const mdInline = (s) =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Vytáhne první odstavec textu za `## …ESENCE…` hlavičkou (do další ## nebo konce). */
function extractSection(md, re) {
  const lines = md.split('\n');
  let on = false;
  const buf = [];
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (on) break;
      if (re.test(line)) { on = true; continue; }
    } else if (on) buf.push(line);
  }
  return buf.join('\n').trim();
}

/** První blockquote v dokumentu (očištěný). */
function extractQuote(md) {
  for (const line of md.split('\n')) {
    const m = line.match(/^>\s*(.+)$/);
    if (m) {
      const t = mdInline(m[1]).replace(/^[„"“']+|[„"“']+$/g, '').trim();
      if (t.length > 20 && !/^(předchozí|další|related|next|previous)/i.test(t)) return t;
    }
  }
  return '';
}

/** Esence = odstavec z ESENCE sekce; fallback = první delší odstavec dokumentu. */
function extractEssence(md) {
  const sec = extractSection(md, /ESENCE|Essence|ESSENCE/i);
  const pick = (txt) => {
    const para = txt.split(/\n\s*\n/).map((p) => mdInline(p)).find((p) => p.length > 40);
    return (para ?? '').slice(0, 600);
  };
  if (sec) { const e = pick(sec); if (e) return e; }
  // fallback: první odstavec po H1, který není tagline/blockquote/hr/heading
  const body = md.split('\n').filter((l) => !/^#{1,6}\s|^---|^>\s|^\*.*\*$/.test(l.trim())).join('\n');
  return pick(body);
}

/**
 * Sanitizovaný celý profil pro veřejný modal:
 *  - bez H1 (jméno renderuje modal), bez ```json atributových bloků
 *  - bez prev/next navigační patičky, relativní .md odkazy → tučný text
 */
function sanitizeProfile(md) {
  const lines = md.split('\n');
  const out = [];
  let inJsonFence = false;
  let firstH1Dropped = false;
  for (const line of lines) {
    if (/^\s*```json/.test(line)) { inJsonFence = true; continue; }
    if (inJsonFence) { if (/^\s*```/.test(line)) inJsonFence = false; continue; }
    if (!firstH1Dropped && /^#\s/.test(line)) { firstH1Dropped = true; continue; }
    if (/^\s*\*\*(Předchozí|Další|Previous|Next)\s*:/.test(line)) continue;
    out.push(line.replace(/\[([^\]]+)\]\((?:\.\.\/)*[^)]*\.md[^)]*\)/g, '**$1**')
               .replace(/\[([^\]]+)\]\([^)]*\.md[^)]*\)/g, '**$1**'));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── 3) essence překlady (cs/en) ───────────────────────────────────────
const essenceI18n = existsSync(ESSENCE_I18N)
  ? JSON.parse(readFileSync(ESSENCE_I18N, 'utf8'))
  : {};

// ── 3a) veřejné cs/en texty avatarů (ručně psané) ─────────────────────
// Jeden JSON per kruh v scripts/oasis-avatar-copy/; klíč = id avatara.
// Co v overlayi chybí, spadne na očištěný legacy řetězec (jen EN) — do
// veřejné stránky se tak nikdy nedostane markdown ani prázdný blok.
const copyById = new Map();
if (existsSync(COPY_DIR)) {
  for (const file of readdirSync(COPY_DIR).filter((n) => n.endsWith('.json')).sort()) {
    const part = JSON.parse(readFileSync(join(COPY_DIR, file), 'utf8'));
    for (const [rawId, entry] of Object.entries(part)) {
      const id = Number(rawId);
      if (!Number.isInteger(id)) {
        console.warn(`[gen-oasis-avatars] VAROVÁNÍ: ${file} má nečíselný klíč '${rawId}'`);
        continue;
      }
      copyById.set(id, { ...(copyById.get(id) ?? {}), ...entry });
    }
  }
  console.log(`[gen-oasis-avatars] copy overlay: ${copyById.size} avatarů`);
}

// ── 3b) art manifest (OASIS_Avatar_Collection) ────────────────────────
// Poziční mapa manifest[i] ↔ avatars[i]; jméno se ověřuje normalizovaně.
const normName = (s) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const artManifest = existsSync(ART_MANIFEST)
  ? JSON.parse(readFileSync(ART_MANIFEST, 'utf8'))
  : [];
/** webp concept cesta → svg vektorová cesta (existuje-li soubor). */
function conceptSvgPath(webpPath) {
  const svg = webpPath
    .replace('/concept_portraits/', '/concept_svg/')
    .replace(/\.webp$/, '.svg');
  return existsSync(join(ART_PUBLIC_DIR, svg.replace('/oasis-assets/', ''))) ? svg : '';
}
function artFor(index, name) {
  const m = artManifest[index];
  if (!m || normName(m.name) !== normName(name)) {
    if (m) console.warn(`[gen-oasis-avatars] VAROVÁNÍ: art manifest[${index}] '${m.name}' ≠ '${name}' — přeskočeno`);
    return { card: '', full: '', final: false };
  }
  const card = m.art ?? '';
  const full = m.finalPortrait ?? conceptSvgPath(card) ?? card;
  return { card, full: full || card, final: Boolean(m.finalPortrait) };
}

// ── 4) roster JSON ────────────────────────────────────────────────────
const avatars = JSON.parse(readFileSync(AVATARS_JSON, 'utf8')).avatars;

mkdirSync(PROFILE_OUT_DIR, { recursive: true });
let profilesWritten = 0;

const unmapped = [];
const rows = avatars.map((a, i) => {
  let circle = CIRCLE_OVERRIDES[a.id] ?? idToCircle.get(a.id) ?? null;
  if (!circle) { unmapped.push(a.id); circle = 'other'; }
  const pf = profileFiles.get(a.id);
  let essence = '', quote = '';
  if (pf) {
    const raw = readFileSync(pf, 'utf8');
    essence = extractEssence(raw);
    quote = extractQuote(raw);
    writeFileSync(join(PROFILE_OUT_DIR, `${a.id}.md`), sanitizeProfile(raw) + '\n');
    profilesWritten++;
  }
  const c = copyById.get(a.id) ?? {};
  /** cs/en hodnota: overlay → (fallback) očištěný legacy text. */
  const loc = (field, fallback) => {
    const o = c[field];
    if (o && (o.cs || o.en)) return { cs: o.cs ?? '', en: o.en ?? '' };
    return { cs: '', en: cleanLegacy(fallback) };
  };
  const cl = a.consciousness_level_required ?? 1;
  const clName = c.clName
    ? { cs: c.clName.cs ?? '', en: c.clName.en ?? '' }
    : CL_LADDER[cl] ?? { cs: '', en: cleanLegacy(a.consciousness_level_name) };

  return {
    id: a.id,
    name: a.name,
    subtitle: loc('subtitle', a.subtitle),
    ray: a.ray ?? 'Blue',
    rarity: a.rarity ?? 'Rare',
    cl,
    clName,
    role: loc('role', a.role),
    location: loc('location', a.location),
    questLine: loc('questLine', (a.quest_line ?? '').replace(/^"|"$/g, '')),
    teaching: loc('teaching', (a.teaching ?? '').replace(/^"|"$/g, '')),
    ability: loc('ability', a.ability),
    key: cleanLegacy(a.key),
    // Overlay má přednost; legacy questy jsou jen anglicky (cs zůstane prázdné).
    quests: (Array.isArray(c.quests) && c.quests.length
      ? c.quests.map((q) => ({
          title: { cs: q.title?.cs ?? '', en: q.title?.en ?? '' },
          description: { cs: q.description?.cs ?? '', en: q.description?.en ?? '' },
        }))
      : Array.isArray(a.quests)
        ? a.quests.map((q) => ({
            title: { cs: '', en: mdInline(q.title ?? '') },
            description: { cs: '', en: mdInline(q.description ?? '') },
          }))
        : []
    ).filter((q) => q.title.cs || q.title.en),
    essence: c.essence
      ? { cs: c.essence.cs ?? '', en: c.essence.en ?? '' }
      : { cs: essenceI18n[a.id]?.cs ?? essence, en: essenceI18n[a.id]?.en ?? essence },
    quote: c.quote ? { cs: c.quote.cs ?? '', en: c.quote.en ?? '' } : { cs: '', en: cleanLegacy(quote) },
    hasProfile: Boolean(pf),
    art: artFor(i, a.name),
    circle,
  };
});
if (unmapped.length) {
  console.warn(`[gen-oasis-avatars] VAROVÁNÍ: ${unmapped.length} avatarů bez kruhu (id: ${unmapped.join(', ')}) → 'other'`);
}

// ── 5) emit TS ────────────────────────────────────────────────────────
const circleKeys = [...CIRCLES.map((c) => `'${c.key}'`), `'other'`].join(' | ');
const out = `/* eslint-disable */
// GENEROVÁNO — scripts/gen-oasis-avatars.mjs, needituj ručně.
// Zdroj: V31/L4/oasis/data/avatars.json (${avatars.length} záznamů)
// Kruhy: docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md (sekce = kruhy, id 202 → maya)

export type OasisAvatarRay = 'Blue' | 'Pink' | 'Yellow' | 'Violet' | 'AllRays' | 'White' | 'Green' | 'RubyGold' | 'Obsidian';
export type OasisAvatarRarity = 'Rare' | 'Epic' | 'Legendary' | 'OneOfOne';
export type OasisAvatarCircle = ${circleKeys};

export interface OasisAvatar {
  id: number;
  name: string;
  /** Veřejný podtitul (např. „Dharma King"). */
  subtitle: LocalizedText;
  ray: OasisAvatarRay;
  rarity: OasisAvatarRarity;
  /** Požadovaná úroveň vědomí 1–9. */
  cl: number;
  clName: LocalizedText;
  role: LocalizedText;
  location: LocalizedText;
  questLine: LocalizedText;
  teaching: LocalizedText;
  ability: LocalizedText;
  key: string;
  /** Quest linie — rozepsané questy (prázdné = linie zatím bez questů). */
  quests: { title: LocalizedText; description: LocalizedText }[];
  /** Krátký popis ze SACRED_TRINITY profilu (ESENCE / první odstavec), cs+en ze scripts/oasis-essence-i18n.json. */
  essence: { cs: string; en: string };
  /** Epigraf — cs/en z scripts/oasis-avatar-copy/, fallback = blockquote z profilu. */
  quote: LocalizedText;
  /** Existuje profil /data/oasis/profiles/<id>.md pro modal. */
  hasProfile: boolean;
  /** OASIS Avatar Collection: card = concept webp (karta), full = finální webp / vektor svg (modal). */
  art: { card: string; full: string; final: boolean };
  circle: OasisAvatarCircle;
}

/** Dvojjazyčný text; prázdné pole 'cs' znamená „použij 'en'". */
export interface LocalizedText {
  cs: string;
  en: string;
}

export interface OasisAvatarCircleMeta {
  key: OasisAvatarCircle;
  emoji: string;
  cs: string;
  en: string;
}

export const AVATAR_CIRCLES: OasisAvatarCircleMeta[] = ${JSON.stringify(CIRCLES, null, 2)};

export const OASIS_AVATARS: OasisAvatar[] = ${JSON.stringify(rows, null, 2)};
`;

writeFileSync(OUT, out);
console.log(`[gen-oasis-avatars] ${rows.length} avatarů → ${OUT.replace(APP_ROOT + '/', '')}`);
console.log(`[gen-oasis-avatars] ${profilesWritten} profilů → public/data/oasis/profiles/<id>.md`);
const counts = new Map();
for (const r of rows) counts.set(r.circle, (counts.get(r.circle) ?? 0) + 1);
console.log('[gen-oasis-avatars] kruhy:', [...counts.entries()].map(([k, n]) => `${k}:${n}`).join(' '));
