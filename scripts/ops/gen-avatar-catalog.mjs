#!/usr/bin/env node
/**
 * Generuje katalog avatarů pro Nirvanu z kanonických dat OASIS.
 *
 * Zdroj: `V31/L4/oasis/data/avatars.json` (200 záznamů z AVATAR_ROSTER.md).
 * Výstup: `apps/nirvana/src/core/avatars/catalog.ts` — jen to, co klient
 * potřebuje k výběru a kreslení (id, jméno, paprsek, vzácnost, CL, podtitul).
 *
 * Proč kopie a ne API: OASIS backend běží na EDGE2 za tunelem. Výběr avataru
 * nesmí záviset na tom, jestli zrovna tunel žije, a deterministické kreslení
 * potřebuje paprsek/vzácnost i pro hráče, kteří se právě připojili.
 *
 * Použití: node scripts/ops/gen-avatar-catalog.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = join(root, 'V31', 'L4', 'oasis', 'data', 'avatars.json');
const target = join(root, 'apps', 'nirvana', 'src', 'core', 'avatars', 'catalog.ts');

const raw = JSON.parse(readFileSync(source, 'utf8'));
const avatars = Array.isArray(raw) ? raw : raw.avatars;
if (!Array.isArray(avatars) || avatars.length === 0) {
  throw new Error('avatars.json nemá očekávaný tvar');
}

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const rows = avatars
  .map((avatar) => ({
    id: Number(avatar.id),
    name: String(avatar.name ?? '').trim(),
    subtitle: String(avatar.subtitle ?? '').trim(),
    ray: pick(avatar.ray, ['Blue', 'Pink', 'Yellow', 'Violet', 'AllRays', 'White', 'Green', 'RubyGold', 'Obsidian'], 'Blue'),
    rarity: pick(avatar.rarity, ['Rare', 'Epic', 'Legendary', 'OneOfOne'], 'Rare'),
    cl: Math.max(1, Math.min(9, Number(avatar.consciousness_level_required) || 1)),
  }))
  .filter((row) => row.name.length > 0)
  .sort((a, b) => a.id - b.id);

const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const body = rows
  .map(
    (row) =>
      `  { id: ${row.id}, name: '${escape(row.name)}', subtitle: '${escape(row.subtitle)}', ray: '${row.ray}', rarity: '${row.rarity}', cl: ${row.cl} },`,
  )
  .join('\n');

const output = `/**
 * KATALOG AVATARŮ — generované, needituj ručně.
 *
 * Zdroj: \`V31/L4/oasis/data/avatars.json\` (200 záznamů z AVATAR_ROSTER.md).
 * Generátor: \`node scripts/ops/gen-avatar-catalog.mjs\`.
 *
 * Drží se tady jen to, co klient potřebuje k výběru a ke kreslení:
 * id, jméno, podtitul, paprsek, vzácnost a požadovaná úroveň vědomí.
 * Kreslení je odvozené **jen z těchto polí** (viz \`kit.ts\`), takže cizí hráč
 * jde vykreslit i bez toho, aby klient znal celý roster.
 */

export type AvatarRay =
  | 'Blue'
  | 'Pink'
  | 'Yellow'
  | 'Violet'
  | 'AllRays'
  | 'White'
  | 'Green'
  | 'RubyGold'
  | 'Obsidian';

export type AvatarRarity = 'Rare' | 'Epic' | 'Legendary' | 'OneOfOne';

export interface AvatarEntry {
  id: number;
  name: string;
  subtitle: string;
  ray: AvatarRay;
  rarity: AvatarRarity;
  /** Požadovaná úroveň vědomí 1–9. */
  cl: number;
}

export const AVATARS: AvatarEntry[] = [
${body}
];

export const AVATARS_BY_ID = new Map<number, AvatarEntry>(AVATARS.map((avatar) => [avatar.id, avatar]));

/** Barvy paprsků — jedna paleta pro model, odznak i picker. */
export const RAY_COLOR: Record<AvatarRay, string> = {
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

export const RARITY_COLOR: Record<AvatarRarity, string> = {
  Rare: '#7fe3d4',
  Epic: '#c8f56a',
  Legendary: '#ffd166',
  OneOfOne: '#ff9de2',
};

export function avatarById(id: number | null | undefined): AvatarEntry | null {
  if (typeof id !== 'number') return null;
  return AVATARS_BY_ID.get(id) ?? null;
}
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, output, 'utf8');
console.log(`katalog: ${rows.length} avatarů → ${target}`);
