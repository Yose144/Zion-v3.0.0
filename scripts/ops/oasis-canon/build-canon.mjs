#!/usr/bin/env node
/**
 * OASIS — kanonický vizuální spec postav.
 *
 * Sbírá, co o každé postavě skutečně víme, a překládá to do **vizuálního
 * zadání**: symboly (atributy), barvy, pleť, pokrývku hlavy, doprovod a hotový
 * prompt pro generování portrétu. Nic nevymýšlí — jen čte zdroje:
 *
 *   V31/L4/oasis/data/avatars.json                    role, ability, teaching, questy
 *   apps/website-v2.9/scripts/oasis-essence-i18n.json  esence cs/en (web2.9)
 *   docs/docs2.9/ZION_OASIS/SACRED_TRINITY/<id>_*.md   kulturní kontext
 *   docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md           paprsek, role, quest linie
 *
 * Výstup:
 *   apps/nirvana/src/core/avatars/canon.ts             id → { symbols, skin, palette, … }
 *   apps/website-v2.9/src/lib/oasis/character-sheets.json  plný spec + prompt
 *
 * Použití: node scripts/ops/oasis-canon/build-canon.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const avatarsRaw = readJson('V31/L4/oasis/data/avatars.json');
const avatars = Array.isArray(avatarsRaw) ? avatarsRaw : avatarsRaw.avatars;
const essence = readJson('apps/website-v2.9/scripts/oasis-essence-i18n.json');
const siteAvatars = read('apps/website-v2.9/src/lib/oasis/avatars.ts');
const roster = read('docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md');

// ── SACRED_TRINITY: soubory jsou <id>_<JMÉNO>.md ─────────────────────
const trinityDir = 'docs/docs2.9/ZION_OASIS/SACRED_TRINITY';
const trinity = new Map();
for (const file of readdirSync(join(root, trinityDir))) {
  const match = file.match(/^(\d+)_/);
  if (!match) continue;
  const id = Number(match[1]);
  if (!trinity.has(id)) trinity.set(id, '');
  trinity.set(id, trinity.get(id) + '\n' + readFileSync(join(root, trinityDir, file), 'utf8'));
}

// ── kruh z web2.9 (avatars.ts má `"circle": "..."` na konci záznamu) ─
const circles = new Map();
for (const block of siteAvatars.split('"id": ').slice(1)) {
  const id = Number(block.slice(0, block.indexOf(',')));
  const circle = block.match(/"circle": "([a-z-]+)"/);
  if (Number.isFinite(id) && circle) circles.set(id, circle[1]);
}

// ── ručně ověřené atributy ikon (zbytek dopočítají pravidla) ─────────
// Kánon má vždy přednost: tyhle postavy nesou atribut, který se v textu
// nemusí objevit doslova (Šiva trojzubec, Ganéša sekeru, Wukong hůl…).
const CURATED = {  0: { symbols: ['flute', 'feather', 'chakra', 'lotus'], skin: '#6f9bf0', headwear: 'circlet' },
  1: { symbols: ['bow', 'sword'], skin: '#6f9bf0', headwear: 'circlet' },
  2: { symbols: ['lotus'], headwear: 'veil' },
  3: { symbols: ['staff', 'spear'], companions: ['monkey'] },
  4: { symbols: ['lotus', 'book'], headwear: 'circlet' },
  5: { symbols: ['veena', 'book', 'lotus'], headwear: 'laurel' },
  6: { symbols: ['ankh', 'staff', 'feather'], headwear: 'circlet' },
  19: { symbols: ['staff', 'lantern', 'cross'] },
  20: { symbols: ['lotus'] },
  21: { symbols: ['lotus', 'conch'] },
  22: { symbols: ['vajra', 'bell'] },
  23: { symbols: ['sword'], headwear: 'circlet' },
  26: { symbols: ['staff', 'book'] },
  38: { symbols: ['lantern'], headwear: 'veil' },
  42: { symbols: ['staff', 'conch', 'chakra'] },
  44: { symbols: ['orb'] },
  45: { symbols: ['sword'] },
  63: { symbols: ['orb'] },
  66: { symbols: ['trident'] },
  72: { symbols: ['vajra', 'staff'] },
  73: { symbols: ['veena'] },
  80: { symbols: ['book', 'orb'] },
  82: { symbols: ['trident', 'cobra', 'drum', 'crescent'], skin: '#6f9bf0', headwear: 'circlet' },
  83: { symbols: ['lotus'] },
  84: { symbols: ['axe', 'book', 'orb'], companions: ['elephant'] },
  85: { symbols: ['lotus', 'conch'] },
  86: { symbols: ['trident', 'sword', 'spear'] },
  87: { symbols: ['sword', 'cobra'] },
  88: { symbols: ['spear'] },
  89: { symbols: ['orb'] },
  90: { symbols: ['vajra'] },
  91: { symbols: ['lotus'] },
  92: { symbols: ['mirror', 'orb'] },
  93: { symbols: ['sword'] },
  94: { symbols: ['orb'] },
  99: { symbols: ['veena', 'lotus'] },
  100: { symbols: ['vajra', 'bell', 'book'] },
  101: { symbols: ['book', 'drum'] },
  106: { symbols: ['spear', 'sword'] },
  107: { symbols: ['lantern', 'banner'] },
  108: { symbols: ['spear', 'chakra'] },
  109: { symbols: ['staff'] },
  111: { symbols: ['hammer', 'drum'] },
  117: { symbols: ['spear'] },
};

/**
 * Fyzické znaky, které procedurální model z primitiv neumí (sloní hlava,
 * ptačí tělo, hadí ocas). Nejde o model — jde o **zadání pro finální portrét**,
 * aby ho generátor neudělal jako člověka.
 */
const ANATOMY = {
  3: 'vanara — monkey-faced humanoid with a long tail',
  82: 'third eye on the forehead, matted hair, ash-covered skin',
  84: 'elephant head with one broken tusk, four arms, pot belly',
  87: 'dark blue-black skin, wild hair, protruding tongue, many arms',
  109: 'monkey-faced stone-born king with golden circlet',
  113: 'regal queen of the southern sea, serpent motifs, green-gold regalia',
  117: 'eagle-headed bird-man with golden wings',
  118: 'winged warrior with mace, able to fly',
  44: 'cosmic golden egg / womb — abstract, not a human figure',
};

// ── pravidla: slovo v kánonu → atribut / barva / pleť ────────────────
const SYMBOL_RULES = [
  ['flute', ['flute', 'bansuri', 'flétn']],
  ['trident', ['trident', 'trisul', 'trišul']],
  ['chakra', ['chakra', 'sudarshana', 'diskus']],
  ['vajra', ['vajra', 'diamond scepter', 'thunderbolt']],
  ['conch', ['conch', 'shankha', 'šankha']],
  ['lotus', ['lotus', 'padma', 'lotos']],
  ['sword', ['sword', 'katana', 'blade', 'meč']],
  ['bow', ['bow', 'arrow', 'luk', 'šíp']],
  ['spear', ['spear', 'lance', 'kopí']],
  ['staff', ['staff', 'scepter', 'rod of', 'hůl']],
  ['book', ['book', 'scripture', 'sutra', 'scroll', 'kniha', 'svitek']],
  ['veena', ['veena', 'lute', 'harp', 'lyre', 'vina']],
  ['drum', ['drum', 'mridangam', 'buben']],
  ['bell', ['bell', 'zvon']],
  ['lantern', ['lantern', 'lucerna']],
  ['cross', ['cross', 'crucifix', 'kříž']],
  ['crescent', ['crescent', 'půlměsíc']],
  ['ankh', ['ankh']],
  ['feather', ['peacock feather', 'feather', 'pero']],
  ['mirror', ['mirror', 'zrcadlo']],
  ['hammer', ['hammer', 'kladivo']],
  ['axe', ['axe', 'sekera']],
  ['cobra', ['cobra', 'naga', 'had']],
];

const COLOR_RULES = [
  ['#f2c14e', ['gold', 'golden', 'zlat']],
  ['#5b8fe8', ['blue', 'modr']],
  ['#e86fa8', ['pink', 'rose', 'růžov']],
  ['#63c48a', ['green', 'emerald', 'zelen']],
  ['#e8664a', ['red', 'crimson', 'saffron', 'červen']],
  ['#f2ead8', ['white', 'ivory', 'silver', 'bíl']],
  ['#8a5cff', ['violet', 'purple', 'fialov']],
  ['#2a2233', ['black', 'obsidian', 'dark', 'čern']],
];

const SKIN_RULES = [
  ['#6f9bf0', ['blue skin', 'blue-skinned', 'blue bodied', 'neela', 'shyam']],
  ['#e8c56a', ['golden skin', 'gold skin', 'radiant golden']],
  ['#8c6244', ['dark skin', 'dark-skinned', 'black skin']],
  ['#f0d7b8', ['pale skin', 'white skin', 'silver skin']],
];

const HEADWEAR_RULES = [
  ['turban', ['turban', 'dastar', 'pagri']],
  ['laurel', ['laurel', 'olive wreath', 'vavřín']],
  ['mitre', ['mitre', 'bishop', 'tiára']],
  ['feathers', ['feather headdress', 'war bonnet', 'pernat']],
  ['circlet', ['circlet', 'diadem', 'čelenka']],
];

const COMPANION_RULES = [
  ['peacock', ['peacock']],
  ['cobra', ['cobra', 'naga']],
  ['tiger', ['tiger']],
  ['lion', ['lion']],
  ['elephant', ['elephant', 'ganesha']],
  ['horse', ['horse', 'steed']],
  ['deer', ['deer']],
  ['wolf', ['wolf']],
  ['raven', ['raven', 'crow']],
  ['eagle', ['eagle']],
  ['owl', ['owl']],
  ['cow', ['cow', 'calf']],
  ['bull', ['bull', 'nandi']],
  ['swan', ['swan', 'hamsa']],
  ['dragon', ['dragon']],
];

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const firstSentence = (text) => clean(text).split(/(?<=[.!?])\s/)[0] ?? '';

const RAY_HEX = {
  Blue: '#4a7bff',
  Pink: '#ff6ec7',
  Yellow: '#ffd166',
  Violet: '#9333ea',
  Green: '#10b981',
  White: '#e8eef7',
  RubyGold: '#e8b23a',
  Obsidian: '#3b2a45',
  AllRays: '#7fe3d4',
};

function sectionOfRoster(name) {
  const index = roster.indexOf(name);
  if (index < 0) return '';
  return roster.slice(index, index + 900);
}

/** Hledá slovo s hranicí (kvůli „cross“ uvnitř „across“, „axe“ v „taxes“…). */
function hasWord(haystack, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zá-ž0-9])${escaped}([^a-zá-ž0-9]|$)`, 'i').test(haystack);
}

const hits = (haystack, needles) => needles.some((needle) => hasWord(haystack, needle));

const entries = [];

for (const avatar of avatars) {
  const id = Number(avatar.id);
  const name = clean(avatar.name);
  const trinityText = (trinity.get(id) ?? '').toLowerCase();
  const essenceEn = clean(essence[String(id)]?.en ?? '');
  const essenceCs = clean(essence[String(id)]?.cs ?? '');
  const rosterText = sectionOfRoster(name).toLowerCase();
  const haystack = [
    name,
    avatar.subtitle,
    avatar.role,
    avatar.location,
    avatar.ability,
    avatar.teaching,
    avatar.quest_line,
    essenceEn,
    essenceCs,
    trinityText,
    rosterText,
  ]
    .join(' \n ')
    .toLowerCase();

  const symbols = SYMBOL_RULES.filter(([, needles]) => hits(haystack, needles)).map(([symbol]) => symbol);
  const detectedColors = COLOR_RULES.filter(([, needles]) => hits(haystack, needles)).map(([hex]) => hex);
  const skin = SKIN_RULES.find(([, needles]) => hits(haystack, needles))?.[0] ?? null;
  const headwear = HEADWEAR_RULES.find(([, needles]) => hits(haystack, needles))?.[0] ?? null;
  const companions = COMPANION_RULES.filter(([, needles]) => hits(haystack, needles)).map(([animal]) => animal);

  // kánon má přednost před pravidly
  const curated = CURATED[id] ?? {};
  const finalSymbols = curated.symbols ?? symbols;
  const finalSkin = curated.skin ?? skin;
  const finalHeadwear = curated.headwear ?? headwear;
  const finalCompanions = curated.companions ?? companions;
  // paleta: paprsek (kanonická barva) → pleť → max 2 barvy z textu
  const palette = [...new Set([RAY_HEX[avatar.ray], finalSkin, ...detectedColors].filter(Boolean))].slice(0, 4);

  // kulturní kotva pro prompt — z kruhu (web2.9) nebo z místa
  const circle = circles.get(id) ?? 'other';
  const culture =
    {
      hindu: 'Indian (Hindu) iconography',
      christian: 'Christian / Byzantine iconography',
      buddhist: 'Buddhist Himalayan iconography',
      ascended: 'Theosophical ascended-master portraiture',
      historical: 'historical chronicle portraiture',
      matrix: 'cyberpunk sci-fi (original characters only)',
      zion: 'ZION original sci-fi fantasy',
      'first-nations': 'First Nations regalia (respectful, consult-led)',
      pacific: 'Pacific Islander (Polynesian) motifs',
      tibet: 'Tibetan thangka tradition',
      india: 'Indian classical tradition',
      japan: 'Japanese classical / Shinto-Buddhist',
      china: 'Chinese classical / Daoist',
      indonesia: 'Indonesian (Balinese/Javanese) tradition',
      australia: 'Aboriginal Australian motifs (consult-led)',
      aotearoa: 'Māori motifs (consult-led)',
      africa: 'African diasporic traditions',
      atlantis: 'mythic Atlantean (literary, not ethnic)',
      lemuria: 'synthetic Lemurian pedagogy (no race hierarchy)',
      cosmic: 'cosmic consciousness metaphor (non-medical)',
      'norse-celtic': 'Norse / Celtic sources (no extremist symbols)',
      egypt: 'Pharaonic Egyptian archetypes',
      maya: 'Maya cyclical cosmology',
      other: 'world mythology',
    }[circle] ?? 'world mythology';

  const colorNames = {
    '#4a7bff': 'ray blue',
    '#ff6ec7': 'ray pink',
    '#ffd166': 'ray gold',
    '#9333ea': 'ray violet',
    '#10b981': 'ray green',
    '#e8eef7': 'ray white',
    '#e8b23a': 'ray ruby-gold',
    '#3b2a45': 'ray obsidian',
    '#7fe3d4': 'all-rays teal',
    '#f2c14e': 'gold',
    '#5b8fe8': 'blue',
    '#e86fa8': 'pink',
    '#63c48a': 'emerald green',
    '#e8664a': 'crimson / saffron',
    '#f2ead8': 'ivory white',
    '#8a5cff': 'violet',
    '#2a2233': 'obsidian black',
  };

  // Fyzické znaky, které model z primitiv neumí — patří do promptu, ne do geometrie.
  const anatomy = ANATOMY[id] ? `\nAnatomy: ${ANATOMY[id]}.` : '';

  const prompt = [
    `${name} — ${clean(avatar.subtitle)}.`,
    essenceEn ? firstSentence(essenceEn) : '',
    '',
    `Production character turnaround sheet: front, three-quarter, side and back views aligned on a shared ground line, consistent proportions and materials, neutral studio background, full body, no text.`,
    '',
    `Style: stylized AAA game character concept art, painterly semi-realism, ${culture}.`,
    `Costume & props: ${finalSymbols.length ? finalSymbols.join(', ') : 'plain ceremonial dress'}${
      finalCompanions.length ? `; companion motifs: ${finalCompanions.join(', ')}` : ''
    }.${anatomy}`,
    palette.length ? `Palette: ${palette.map((hex) => `${colorNames[hex] ?? 'canonical'} ${hex}`).join(', ')}.` : '',
    finalSkin ? 'Canonical skin tone per tradition (see palette).' : '',
    '',
    `Art direction: mythic wonder, elegant sci-fi fantasy, ornate but tasteful sacred geometry, atmospheric volumetric light, single readable silhouette, refined material detail (silk, gold, stone, light).`,
    `Character ID OASIS-${String(id).padStart(3, '0')} · ray ${avatar.ray} · rarity ${avatar.rarity} · CL ${avatar.consciousness_level_required}.`,
    '',
    `Negative: no text, no logo, no watermark, no signature, no existing actor or celebrity likeness, no gore, no nudity, no exaggerated cosplay, no cultural caricature.`,
  ]
    .filter(Boolean)
    .join('\n');

  entries.push({
    id,
    name,
    subtitle: clean(avatar.subtitle),
    circle,
    ray: avatar.ray,
    rarity: avatar.rarity,
    cl: Number(avatar.consciousness_level_required) || 1,
    role: clean(avatar.role),
    location: clean(avatar.location),
    symbols: finalSymbols,
    palette,
    skin: finalSkin,
    headwear: finalHeadwear,
    companions: finalCompanions,
    culture,
    prompt,
    sources: {
      trinity: trinity.has(id),
      essence: Boolean(essence[String(id)]),
      roster: rosterText.length > 0,
      curated: Boolean(CURATED[id]),
    },
  });
}

entries.sort((a, b) => a.id - b.id);

// ── výstup 1: TS mapa pro hru (jen to, co jde nakreslit) ─────────────
const MODEL_SYMBOLS = new Set([
  'flute',
  'trident',
  'chakra',
  'vajra',
  'conch',
  'lotus',
  'sword',
  'bow',
  'spear',
  'staff',
  'book',
  'veena',
  'drum',
  'bell',
  'lantern',
  'cross',
  'crescent',
  'ankh',
  'feather',
  'mirror',
  'hammer',
  'axe',
]);

const ts = `/**
 * KANONICKÝ VZHLED — generované, needituj ručně.
 *
 * Generátor: \`node scripts/ops/oasis-canon/build-canon.mjs\`
 * Zdroje: V31/L4/oasis/data/avatars.json, web2.9 esence, SACRED_TRINITY,
 * AVATAR_ROSTER.md. Pro každou postavu drží jen to, co jde opravdu nakreslit:
 * atributy (symboly), kanonickou barvu, pleť a pokrývku hlavy.
 *
 * Když v kánonu atribut chybí, kreslení se rozhodne deterministicky z id
 * (viz \`kit.ts\`) — kánon má vždy přednost, ale nikdy neblokuje.
 */

export interface AvatarCanon {
  /** Atributy, které postava drží (flétna, trojzubec, lotos…). */
  symbols: string[];
  /** Kanonická barva (první = hlavní akcent), nebo prázdné. */
  palette: string[];
  /** Pleť, když ji tradice určuje (Krišna je modrý). */
  skin: string | null;
  headwear: string | null;
}

export const AVATAR_CANON: Record<number, AvatarCanon> = {
${entries
  .filter((entry) => entry.symbols.length || entry.palette.length || entry.skin || entry.headwear)
  .map((entry) => {
    const symbols = entry.symbols.filter((symbol) => MODEL_SYMBOLS.has(symbol));
    return `  ${entry.id}: { symbols: ${JSON.stringify(symbols)}, palette: ${JSON.stringify(entry.palette.slice(0, 2))}, skin: ${entry.skin ? `'${entry.skin}'` : 'null'}, headwear: ${entry.headwear ? `'${entry.headwear}'` : 'null'} },`;
  })
  .join('\n')}
};
`;

writeFileSync(join(root, 'apps/nirvana/src/core/avatars/canon.ts'), ts);

// ── výstup 2: character sheets (web + prompt pack) ───────────────────
const sheets = {
  generatedAt: new Date().toISOString(),
  note:
    'Kanonický vizuální spec + hotový prompt pro generování finálních portrétů. ' +
    'Zdroj: SACRED_TRINITY, avatars.json, web2.9 esence, AVATAR_ROSTER.md.',
  count: entries.length,
  artDirection: {
    format: '1:1 master 2048×2048, WebP 1024 a 512, bez textu, 8% bezpečný okraj',
    views: ['front', 'three-quarter', 'side', 'back'],
    mood: 'mytologický úžas, elegantní sci-fi fantasy, ne horor ani cosplay',
    constraints: [
      'jeden avatar / jedno plátno',
      'žádná podoba existujících herců',
      'žádné texty, loga, vodoznaky',
      'kulturní citlivost u tradic, které si to vyžádají (konzultace)',
    ],
  },
  entries,
};
// Jen do public/ — stránka si spec tahá lazy až při otevření detailu,
// takže 200 promptů (330 kB) nezatěžuje bundle ani repo zdrojáků.
writeFileSync(
  join(root, 'apps/website-v2.9/public/oasis-assets/character-sheets/specs.json'),
  JSON.stringify(sheets, null, 1) + '\n',
);

const withSymbols = entries.filter((entry) => entry.symbols.length).length;
const withPalette = entries.filter((entry) => entry.palette.length).length;
const withTrinity = entries.filter((entry) => entry.sources.trinity).length;
console.log(
  `kanon: ${entries.length} postav · atributy ${withSymbols} · paleta ${withPalette} · SACRED_TRINITY ${withTrinity}`,
);
