#!/usr/bin/env node
/**
 * Doplní `image_url` do kanonického rosteru `V31/L4/oasis/data/avatars.json`.
 *
 * Portrét se vybírá v tomto pořadí:
 *   1. finální portrét      `public/oasis-assets/final_portraits/<id>-<slug>.webp`
 *   2. herní 3D náhled      `public/oasis-assets/game-portraits/<id>-<slug>.webp`
 *      (pro 11 postav bez samostatného renderu — 011–020 a 052)
 *
 * URL je **absolutní** na veřejný web, protože roster čtou i jiné povrchy:
 * OASIS klient (oasis.zionterranova.com) a Marketplace
 * (market.zionterranova.com) — relativní cesta by se na nich resolvovala
 * proti jejich vlastní doméně a vrátila 404.
 *
 * Usage:
 *   node scripts/ops/oasis-avatar-images.mjs [--dry-run]
 *   OASIS_AVATAR_BASE=https://app.zionterranova.com node …
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AVATARS_JSON = join(REPO_ROOT, 'V31', 'L4', 'oasis', 'data', 'avatars.json');
const PUBLIC_DIR = join(REPO_ROOT, 'apps', 'website-v2.9', 'public');
const FINAL_DIR = join(PUBLIC_DIR, 'oasis-assets', 'final_portraits');
const GAME_PORTRAITS = join(
  REPO_ROOT, 'apps', 'website-v2.9', 'src', 'lib', 'oasis', 'game-portraits.json',
);
const BASE = (process.env.OASIS_AVATAR_BASE ?? 'https://app.zionterranova.com').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');

/** Mapa avatarId → veřejná cesta z adresáře `<id3>-<slug>.webp`. */
function indexDir(dir) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.webp')) continue;
    const m = file.match(/^(\d{3})-/);
    if (!m) continue;
    map.set(Number(m[1]), `/oasis-assets/${dir.split('/').slice(-1)[0]}/${file}`);
  }
  return map;
}

const finals = indexDir(FINAL_DIR);
const gamePortraits = JSON.parse(readFileSync(GAME_PORTRAITS, 'utf8'));

const data = JSON.parse(readFileSync(AVATARS_JSON, 'utf8'));
let fromFinal = 0;
let fromGame = 0;
const missing = [];

data.avatars = data.avatars.map((avatar) => {
  const final = finals.get(avatar.id);
  const game = gamePortraits[String(avatar.id)];
  const path = final ?? game ?? '';
  if (final) fromFinal += 1;
  else if (game) fromGame += 1;
  else missing.push(avatar.id);

  const { image_url: _drop, ...rest } = avatar;
  const out = {};
  for (const [key, value] of Object.entries(rest)) {
    out[key] = value;
    if (key === 'rarity') out.image_url = path ? `${BASE}${path}` : '';
  }
  if (!('image_url' in out)) out.image_url = path ? `${BASE}${path}` : '';
  return out;
});

console.log(
  `[oasis-avatar-images] ${data.avatars.length} avatarů — ${fromFinal} finálních portrétů, ` +
    `${fromGame} herních 3D náhledů, ${missing.length} bez obrázku` +
    (missing.length ? ` (${missing.join(', ')})` : ''),
);

if (DRY) {
  console.log('[oasis-avatar-images] --dry-run: nic se nezapsalo');
} else {
  writeFileSync(AVATARS_JSON, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`[oasis-avatar-images] zapsáno ${AVATARS_JSON}`);
}
