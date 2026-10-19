#!/usr/bin/env node
/**
 * check-doc-links — audits every markdown link under public/docs against
 * the same rules the runtime resolver (src/lib/docLinks.ts) applies.
 *
 *   node scripts/check-doc-links.mjs           → report (always exit 0)
 *   node scripts/check-doc-links.mjs --strict  → exit 1 on dead links
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { files } = require('../src/lib/doc-manifest.json');
const FILES = new Set(files);
const FILES_LOWER = new Map();
for (const f of files) FILES_LOWER.set(f.toLowerCase(), f);
const fileHit = (p) => (FILES.has(p) ? p : FILES_LOWER.get(p.toLowerCase()) ?? null);
const DIR_ROUTE = new Set(['dao', 'pool', 'explorer', 'roadmap', 'whitepapers', 'docs']);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(root, 'public', 'docs');

/* Mirrors of src/lib/docLinks.ts tables (kept small by design). */
const ALIASES = {
  'whitepaper/zion-oasis': 'whitepaper/ZION_OASIS_2.8.5.md',
  'whitepaper/victory-2025': 'whitepaper/ZION_VICTORY_2025.md',
  'whitepaper/sacred-knowledge': 'whitepaper/SACRED_KNOWLEDGE_2.8.5.md',
  'whitepaper/humanitarian-tithe': 'whitepaper/HUMANITARIAN_TITHE_2.8.5.md',
  'whitepaper/full': 'whitepaper/ZION_Whitepaper_v2.9.5_FULL.md',
  'whitepaper/cosmic-map': 'whitepaper/COSMIC_MAP_2.8.5_PUBLIC_EDITION.md',
  'whitepaper/core': 'whitepaper/CORE_2.8.5.md',
  'whitepaper/roadmap': 'whitepaper/roadmap.md',
  'whitepaper/governance': 'whitepaper/governance.md',
  'whitepaper/security': 'whitepaper/security.md',
  'whitepaper/index': 'whitepaper/index.md',
  roadmap: 'roadmap-lite.md',
  chv3: 'architecture/consensus.md',
};
const ANCHOR_ALIASES = new Set(['whitepaper-full', 'whitepaper-roadmap', 'whitepaper-security', 'whitepaper-governance']);
// chapters are TS modules — extract slugs from source text instead
function bookSlugs(name) {
  const src = readFileSync(join(root, 'src/app', name, 'chapters.ts'), 'utf8');
  return new Set([...src.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]));
}
const BOOKS = { maitreya: bookSlugs('maitreya'), nirvana: bookSlugs('nirvana') };

const APP_ROUTES = new Set(
  `,account,admin,admin/algo-manager,admin/pool-config,admin/revenue-v3,ai-native,api-reference,benchmarks,bridge,cesta,cex,dao,dashboard,dashboard/advanced-pool,dashboard/ch3,dashboard/dao-tree,dashboard/guardian,dashboard/ncl,dashboard/pool-metrics,dashboard/presale,dashboard/private,dashboard/system-metrics,defi,defi/dao,defi/farming,defi/staking,dex,dex/liquidity,dex/portfolio,docs,doge-vs-zion,download,ekam,ekam/deeksha,explorer,explorer/address,explorer/api-docs,explorer/block,explorer/blocks,explorer/bridge,explorer/broadcast,explorer/charts,explorer/consensus,explorer/contracts,explorer/emission,explorer/fee-estimator,explorer/mempool,explorer/miners,explorer/network-stats,explorer/richlist,explorer/search,explorer/status,explorer/supply,explorer/tokens,explorer/transactions,explorer/tx,explorer/txs,explorer/verify-message,g8,genesis,kompas,l3-hiran,l4-oasis,l5-free-world,l6-issobella,login,maitreya,maitreya/cist,miner-stats,mining,mining/guides,mining/node-setup,monitoring,multichain,network,news,news/launch-postponed,news/v3-internal-audit,nirvana,nirvana/cist,node-setup,onboard,philosophy,pool,quantum-revolution,resonance,roadmap,roadmap-295,swap,team,terranova,terranova/amenti,terranova/boa-esperanca,terranova/bodhi-lanka,terranova/dharma-temple,terranova/ekam,terranova/genesis,terranova/geography/africa,terranova/geography/americas,terranova/geography/asia,terranova/geography/europe,terranova/geography/oceania,terranova/golden-republic-bohemia,terranova/kailash,terranova/maria-del-camino,terranova/nova-amerika,terranova/te-piko-ora,terranova/uluru,tree-of-life,wallet,wallet/bridge,wallet/multichain,wallet/staking,warp,whitepapers,wiki,ziondex`
    .split(',')
    .map((s) => s.trim()),
);
const NEXT_REDIRECTS = new Set(['/oasis', '/health', '/pool/stats']);

function slug(text) {
  return text.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
    .replace(/ /g, '-');
}
function stripInline(s) {
  return s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').replace(/<[^>]*>/g, '').trim();
}
function anchorsOf(content) {
  const set = new Set();
  const counts = new Map();
  let fence = false;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const base = slug(stripInline(m[2]));
    if (!base) continue;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    set.add(n === 0 ? base : `${base}-${n}`);
  }
  return set;
}
function norm(path) {
  const out = [];
  for (const p of path.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') { if (!out.length) return null; out.pop(); }
    else out.push(p);
  }
  return out.join('/');
}
function dirOf(f) { const i = f.lastIndexOf('/'); return i === -1 ? '' : f.slice(0, i); }
function suffix(path) {
  const parts = path.split('/').filter((p) => p && p !== '.' && p !== '..');
  for (let i = 1; i < parts.length; i++) {
    const c = parts.slice(i).join('/');
    if (c.includes('/') && fileHit(c)) return c;
  }
  return null;
}
function bookOf(file) {
  const m = file.match(/^(?:cs|en\/)?books\/([^/]+)\/kapitoly\//);
  return m && BOOKS[m[1]] ? m[1] : null;
}

function resolve(href, file, anchors) {
  if (!href) return 'empty';
  if (/^(https?:)?\/\//i.test(href) || /^(mailto:|tel:|ipfs:)/i.test(href)) return 'ok';
  if (href.startsWith('#')) {
    const a = decodeURIComponent(href.slice(1));
    if (!a) return 'dead';
    if (anchors.has(a) || ANCHOR_ALIASES.has(a)) return 'ok';
    return 'anchor';
  }
  if (href.startsWith('/')) {
    const path = decodeURIComponent(href.split('#')[0]);
    if (path === '' ) return 'ok';
    if (path === '/docs' || path.startsWith('/docs/')) {
      const sub = path.slice(5).replace(/^\//, '');
      if (!sub) return 'ok';
      if (sub.startsWith('view/')) return 'ok';
      if (ALIASES[sub] || fileHit(sub)) return 'ok';
      return 'dead';
    }
    if (APP_ROUTES.has(path.slice(1)) || NEXT_REDIRECTS.has(path)) return 'ok';
    if (path.startsWith('/api/') || path.startsWith('/docs/') || path.startsWith('/pool/miner/')) return 'ok';
    // static public assets outside /docs
    try { readFileSync(join(root, 'public', path)); return 'ok'; } catch { return 'route?:' + path; }
  }
  const stem = href.split('/').pop().replace(/\.(md|markdown)$/i, '');
  const book = bookOf(file);
  if (book && BOOKS[book].has(stem)) return 'ok';
  if (book) {
    const up = href.replace(/^\.\//, '');
    const m1 = up.match(/^\.\.\/([^/]+)\/(.+)$/);
    const m2 = up.match(/^\.\.\/\.\.\/(?:docs\/)?([^/]+)\/(.+)$/);
    const t = m2 ? `korpus/${m2[1]}/${m2[2]}` : m1 ? `korpus/${m1[1]}/${m1[2]}` : null;
    if (t) {
      const c = norm(t);
      if (c && (fileHit(c) || suffix(c))) return 'ok';
      return 'dead';
    }
  }
  const resolved = norm(`${dirOf(file)}/${href}`);
  if (resolved && fileHit(resolved)) return 'ok';
  // docs-root-relative convention used by the corpus (ai-native/x.md etc.)
  const rooted = norm(href);
  if (rooted && fileHit(rooted)) return 'ok';
  // unique bare filename anywhere in the tree
  const name = href.split('/').pop();
  if (name && !name.includes('#')) {
    const hits = files.filter((f) => f.endsWith('/' + name) || f === name);
    if (hits.length === 1) return 'ok';
  }
  if (suffix(href)) return 'ok';
  // cross-book chapter link → reader hash (mirrors docLinks.ts)
  for (const slugs of Object.values(BOOKS)) if (slugs.has(stem)) return 'ok';
  const segs = href.split('/').filter((x) => x && x !== '.' && x !== '..');
  const last = segs[segs.length - 1];
  if (last && !last.includes('.') && DIR_ROUTE.has(last)) return 'ok';
  return 'dead';
}

const results = { ok: 0, anchor: 0, 'route?': 0, routes: new Set(), dead: [] };
for (const f of files.filter((x) => /\.md$/i.test(x))) {
  const content = readFileSync(join(docsRoot, f), 'utf8');
  const anchors = anchorsOf(content);
  for (const m of content.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const r = resolve(m[1], f, anchors);
    if (r === 'ok' || r === 'anchor') results[r]++;
    else if (r.startsWith('route?:')) { results['route?']++; results.routes.add(r.slice(7)); }
    else results.dead.push({ file: f, link: m[1] });
  }
}

const byFile = {};
for (const d of results.dead) (byFile[d.file] ??= []).push(d.link);

console.log(`\nZION docs link audit — ${files.length} files scanned`);
console.log(`  resolved: ${results.ok}   in-page anchors (unverified external): ${results.anchor}   app-route guesses: ${results['route?']}`);
console.log(`  dead links: ${results.dead.length}\n`);
if (results.routes.size) {
  console.log('  unverified absolute routes:');
  [...results.routes].sort().forEach((r) => console.log(`      ${r}`));
  console.log('');
}
for (const [f, ls] of Object.entries(byFile).sort()) {
  console.log(`  ${f}`);
  [...new Set(ls)].forEach((l) => console.log(`      → ${l}`));
}
if (process.argv.includes('--strict') && results.dead.length) process.exit(1);
