import manifest from './doc-manifest.json';
import { DOC_FILE_TO_ID } from './docs-manifest';
import { MAITREYA_CHAPTERS } from '@/lib/books/maitreya';
import { NIRVANA_CHAPTERS } from '@/lib/books/nirvana';
import { SURTA_CHAPTERS } from '@/lib/books/surta-srdce';
import { KRAL_CHAPTERS } from '@/lib/books/kralovstvi-srdce';
import { korpusChapters } from '@/lib/books/korpus';

/* ═══════════════════════════════════════════════════════════
   ZION Docs Link Engine
   ─────────────────────────────────────────────────────────
   Resolves every link found inside the markdown corpus into a
   URL that actually works on app.zionterranova.com:

     external https        → pass through (target=_blank)
     #anchor               → in-page heading (ids are generated
                             by MarkdownDoc via github slugs);
                             bare corpus anchors map through
                             ANCHOR_ALIASES to real routes
     /docs/<slug>          → alias map → /docs/view/<file>
     /docs/<real-file>     → .md → /docs/view/<file> (pretty),
                             binary → /docs/<file> (raw serve)
     ./x.md / ../x.md      → resolved against sourceFile inside
                             public/docs; in-book chapters map
                             to /<book>/cist#slug; WP-Mainet
                             sibling books map to korpus/<Book>/
     escaped ../ (out of
     public tree)          → internal source → rendered as
                             muted non-link (dead)
   ═══════════════════════════════════════════════════════════ */

const DOC_FILES = new Set<string>(manifest.files as string[]);

/** Lower-case path → real path (corpus mixes case: `TerraNova/` vs `terranova/`). */
const DOC_FILES_LOWER = new Map<string, string>();
for (const f of manifest.files as string[]) DOC_FILES_LOWER.set(f.toLowerCase(), f);

/** Bare filename → path, only when the name is unique across public/docs. */
const FILE_NAME_INDEX = new Map<string, string>();
for (const f of manifest.files as string[]) {
  const name = f.split('/').pop()!;
  if (FILE_NAME_INDEX.has(name)) FILE_NAME_INDEX.set(name, '');
  else FILE_NAME_INDEX.set(name, f);
}
for (const [k, v] of FILE_NAME_INDEX) if (v === '') FILE_NAME_INDEX.delete(k);

/** Manifest hit with case-insensitive fallback; returns real path or null. */
function docFileHit(path: string): string | null {
  if (DOC_FILES.has(path)) return path;
  return DOC_FILES_LOWER.get(path.toLowerCase()) ?? null;
}

/** Corpus links to bare dirs like `../dao/` or `../pool/` → the app route. */
const DIR_ROUTE_MAP: Record<string, string> = {
  dao: '/dao',
  pool: '/pool',
  explorer: '/explorer',
  roadmap: '/roadmap',
  whitepapers: '/whitepapers',
  docs: '/docs',
};

export function docFileExists(path: string): boolean {
  return DOC_FILES.has(path);
}

export interface DocLinkCtx {
  /** Path of the rendered markdown file relative to public/docs (e.g. `books/nirvana/kapitoly/01-Prvni-Paprsek.md`). */
  sourceFile?: string;
  /** In-page heading anchors present in the rendered document. */
  anchors?: Set<string>;
  /** Chapter slugs of the book currently open in a hash-router reader. */
  bookSlugs?: Set<string>;
}

export interface ResolvedLink {
  href: string | null;
  external?: boolean;
  dead?: boolean;
  /** true → scroll to an in-page heading instead of navigation. */
  inPageAnchor?: boolean;
  note?: string;
}

/* ── Slug → file aliases for legacy /docs/<slug> links ─────── */
export const DOC_PATH_ALIASES: Record<string, string> = {
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

/** Bare `#anchor` ids used by the corpus that live on other surfaces. */
const ANCHOR_ALIASES: Record<string, string> = {
  'whitepaper-full': '/docs/view/whitepaper/ZION_Whitepaper_v2.9.5_FULL.md',
  'whitepaper-roadmap': '/docs/view/whitepaper/roadmap.md',
  'whitepaper-security': '/docs/view/whitepaper/security.md',
  'whitepaper-governance': '/docs/view/whitepaper/governance.md',
};

const BOOK_READERS: Record<string, { slugs: Set<string>; reader: string }> = {
  maitreya: { slugs: new Set(MAITREYA_CHAPTERS.map((c) => c.slug)), reader: '/maitreya/cist' },
  nirvana: { slugs: new Set(NIRVANA_CHAPTERS.map((c) => c.slug)), reader: '/maitreya/nirvana/cist' },
  'surta-srdce': { slugs: new Set(SURTA_CHAPTERS.map((c) => c.slug)), reader: '/maitreya/surta-srdce/cist' },
  'kralovstvi-srdce': { slugs: new Set(KRAL_CHAPTERS.map((c) => c.slug)), reader: '/maitreya/kralovstvi-srdce/cist' },
  // korpus books — chapters derived from the doc manifest
  sulzeme: { slugs: new Set(korpusChapters('SulZeme').chapters.map((c) => c.slug)), reader: '/maitreya/sulzeme/cist' },
  lumi: { slugs: new Set(korpusChapters('Lumi').chapters.map((c) => c.slug)), reader: '/maitreya/lumi/cist' },
  miriam: { slugs: new Set(korpusChapters('Miriam').chapters.map((c) => c.slug)), reader: '/maitreya/miriam/cist' },
  bodhigaia: { slugs: new Set(korpusChapters('BodhiGaia').chapters.map((c) => c.slug)), reader: '/maitreya/bodhigaia/cist' },
  mariacaminho: { slugs: new Set(korpusChapters('MariaCaminho').chapters.map((c) => c.slug)), reader: '/maitreya/mariacaminho/cist' },
  ruze: { slugs: new Set(korpusChapters('Ruze').chapters.map((c) => c.slug)), reader: '/maitreya/ruze/cist' },
  naceste: { slugs: new Set(korpusChapters('NaCeste').chapters.map((c) => c.slug)), reader: '/maitreya/naceste/cist' },
  nirvanacloud: { slugs: new Set(korpusChapters('NirvanaCloud').chapters.map((c) => c.slug)), reader: '/maitreya/nirvanacloud/cist' },
  issobella: { slugs: new Set(korpusChapters('Issobella').chapters.map((c) => c.slug)), reader: '/maitreya/issobella/cist' },
  kruhbohyni: { slugs: new Set(korpusChapters('KruhBohyni').chapters.map((c) => c.slug)), reader: '/maitreya/kruhbohyni/cist' },
  miseamenti: { slugs: new Set(korpusChapters('MiseAmenti').chapters.map((c) => c.slug)), reader: '/maitreya/miseamenti/cist' },
};

function isMarkdown(path: string) {
  return /\.(md|markdown)$/i.test(path);
}

function isRenderable(path: string) {
  return /\.(md|markdown|txt)$/i.test(path);
}

/** Normalize `a/./b/../c` → `a/c`; returns null when escaping above root. */
function normalizePath(path: string): string | null {
  const parts = path.split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(p);
    }
  }
  return out.join('/');
}

function dirOf(file: string): string {
  const idx = file.lastIndexOf('/');
  return idx === -1 ? '' : file.slice(0, idx);
}

function fileToRoute(file: string): string {
  return isRenderable(file) ? `/docs/view/${file}` : `/docs/${file}`;
}

/** file → /docs#id when the doc is registered in the library manifest. */
function fileToLibraryRoute(file: string): string | null {
  const id = DOC_FILE_TO_ID[file];
  return id ? `/docs#${id}` : null;
}

/**
 * Resolve a markdown link target into an app URL.
 * Never returns an obviously-broken internal path — unresolvable
 * internal references come back `dead` so the renderer can
 * neutralize them instead of shipping a 404.
 */
export function resolveDocHref(rawHref: string | undefined, ctx: DocLinkCtx = {}): ResolvedLink {
  const href = (rawHref ?? '').trim();
  if (!href) return { href: null, dead: true };

  // External / protocol links
  if (/^(https?:)?\/\//i.test(href) || /^(mailto:|tel:|ipfs:)/i.test(href)) {
    return { href, external: true };
  }

  // Pure in-page anchor
  if (href.startsWith('#')) {
    const anchor = decodeURIComponent(href.slice(1));
    if (!anchor) return { href: null, dead: true };
    if (ctx.anchors?.has(anchor)) return { href, inPageAnchor: true };
    if (ANCHOR_ALIASES[anchor]) return { href: ANCHOR_ALIASES[anchor] };
    // Unknown anchor — keep it; worst case it is a no-op scroll.
    return { href };
  }

  // Absolute site links
  if (href.startsWith('/')) {
    const [path] = splitHash(href);

    if (path === '/docs' || path.startsWith('/docs/')) {
      const sub = path.slice('/docs'.length).replace(/^\//, '');
      if (!sub) return { href }; // '/docs' or '/docs#id'
      if (sub.startsWith('view/')) return { href };
      const alias = DOC_PATH_ALIASES[sub] ?? DOC_PATH_ALIASES[decodeURIComponent(sub)];
      const target = alias ?? docFileHit(sub);
      if (target) {
        const lib = fileToLibraryRoute(target);
        return { href: lib ?? fileToRoute(target) };
      }
      // /docs/<missing> → the alias page handles it too; route via view
      // so the user lands on a helpful not-found screen.
      return { href: `/docs/view/${sub}` };
    }
    return { href };
  }

  // Relative links — need the source file location
  const source = ctx.sourceFile;
  if (!source) return { href, dead: true };
  const srcDir = dirOf(source);
  const book = bookContext(source);

  // In-book chapter link (./02-Hora-Ararat.md → #02-Hora-Ararat or /docs#book-*)
  const stem = stemOf(href);
  if (book && stem && book.slugs.has(stem)) {
    if (ctx.bookSlugs?.has(stem)) return { href: `#${stem}` };
    const libId = DOC_FILE_TO_ID[`books/${book.name}/kapitoly/${stem}.md`];
    if (libId) return { href: `/docs#${libId}` };
    return { href: `${book.reader}#${stem}` };
  }

  // Corpus sibling-book links from a kapitoly file:
  //   ../<Book>/<file> → korpus/<Book>/<file>
  //   ../../<Dir>/<file> → korpus/<Dir>/<file>   (docs-root corpus level)
  if (book) {
    const up = href.replace(/^\.\//, '');
    const m1 = up.match(/^\.\.\/([^/]+)\/(.+)$/); // ../X/…
    const m2 = up.match(/^\.\.\/\.\.\/(?:docs\/)?([^/]+)\/(.+)$/); // ../../X/… or ../../docs/X/…
    const corpusTarget = m2 ? `korpus/${m2[1]}/${m2[2]}` : m1 ? `korpus/${m1[1]}/${m1[2]}` : null;
    if (corpusTarget) {
      const clean = normalizePath(corpusTarget);
      const hit = clean ? docFileHit(clean) : null;
      if (hit) return { href: fileToRoute(hit) };
      // cross-book chapter link (../nirvana/kapitoly/NN-x.md → reader hash)
      if (stem) {
        for (const [bname, bdef] of Object.entries(BOOK_READERS)) {
          if (bname !== book.name && bdef.slugs.has(stem)) {
            const libId = DOC_FILE_TO_ID[`books/${bname}/kapitoly/${stem}.md`];
            return { href: libId ? `/docs#${libId}` : `${bdef.reader}#${stem}` };
          }
        }
      }
      if (clean) {
        const suffix = suffixMatch(clean);
        if (suffix) return { href: fileToRoute(suffix) };
      }
      return { href: null, dead: true, note: 'internal corpus reference' };
    }
  }

  // Plain relative resolution against the source file's directory
  const resolved = normalizePath(`${srcDir}/${href}`);
  const resolvedHit = resolved ? docFileHit(resolved) : null;
  if (resolvedHit) {
    const lib = isMarkdown(resolvedHit) ? fileToLibraryRoute(resolvedHit) : null;
    return { href: lib ?? fileToRoute(resolvedHit) };
  }

  // Corpus docs-root-relative convention (ai-native/x.md from ai-native/README.md)
  const rooted = normalizePath(href);
  const rootedHit = rooted ? docFileHit(rooted) : null;
  if (rootedHit) {
    const lib = isMarkdown(rootedHit) ? fileToLibraryRoute(rootedHit) : null;
    return { href: lib ?? fileToRoute(rootedHit) };
  }

  // Unique bare filename anywhere in the public tree (tokenomics.md, INDEX.md…)
  const baseName = href.split('/').pop();
  if (baseName && !baseName.includes('#')) {
    const hit = FILE_NAME_INDEX.get(baseName);
    if (hit) {
      const lib = isMarkdown(hit) ? fileToLibraryRoute(hit) : null;
      return { href: lib ?? fileToRoute(hit) };
    }
  }

  // Last resort: longest suffix that exists in the manifest
  const suffix = suffixMatch(href);
  if (suffix) {
    const lib = isMarkdown(suffix) ? fileToLibraryRoute(suffix) : null;
    return { href: lib ?? fileToRoute(suffix) };
  }

  // Cross-book chapter link from any corpus file (../nirvana/kapitoly/NN-x.md → reader)
  const linkStem = stem ?? stemOf(href);
  if (linkStem) {
    for (const [bname, bdef] of Object.entries(BOOK_READERS)) {
      if (bdef.slugs.has(linkStem)) {
        if (ctx.bookSlugs?.has(linkStem)) return { href: `#${linkStem}` };
        const libId = DOC_FILE_TO_ID[`books/${bname}/kapitoly/${linkStem}.md`];
        return { href: libId ? `/docs#${libId}` : `${bdef.reader}#${linkStem}` };
      }
    }
  }

  // Bare directory links (../dao/, ../pool/) → the matching app route
  const segs = href.split('/').filter((s) => s && s !== '.' && s !== '..');
  const lastSeg = segs[segs.length - 1];
  if (lastSeg && !lastSeg.includes('.') && DIR_ROUTE_MAP[lastSeg]) {
    return { href: DIR_ROUTE_MAP[lastSeg] };
  }

  return { href: null, dead: true, note: 'internal reference' };
}

/** Resolve an image src the same way as links. */
export function resolveDocImage(src: string | undefined, ctx: DocLinkCtx = {}): string | null {
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) return src;
  if (!ctx.sourceFile) return null;
  const book = bookContext(ctx.sourceFile);
  if (book) {
    const up = src.replace(/^\.\//, '');
    const m1 = up.match(/^\.\.\/([^/]+)\/(.+)$/);
    const m2 = up.match(/^\.\.\/\.\.\/(?:docs\/)?([^/]+)\/(.+)$/);
    const corpusTarget = m2 ? `korpus/${m2[1]}/${m2[2]}` : m1 ? `korpus/${m1[1]}/${m1[2]}` : null;
    if (corpusTarget) {
      const clean = normalizePath(corpusTarget);
      const ihit = clean ? docFileHit(clean) : null;
      if (ihit) return `/docs/${ihit}`;
      return null;
    }
  }
  const resolved = normalizePath(`${dirOf(ctx.sourceFile)}/${src}`);
  const rhit = resolved ? docFileHit(resolved) : null;
  if (rhit) return `/docs/${rhit}`;
  const rooted = normalizePath(src);
  const roothit = rooted ? docFileHit(rooted) : null;
  if (roothit) return `/docs/${roothit}`;
  const suffix = suffixMatch(src);
  if (suffix) return `/docs/${suffix}`;
  const nameHit = src.split('/').pop();
  const byName = nameHit ? FILE_NAME_INDEX.get(nameHit) : undefined;
  return byName ? `/docs/${byName}` : null;
}

/* ── internals ──────────────────────────────────────────────── */

function splitHash(href: string): [string, string | null] {
  const i = href.indexOf('#');
  return i === -1 ? [href, null] : [href.slice(0, i), href.slice(i + 1)];
}

function stemOf(href: string): string | null {
  const base = href.split('/').pop() ?? '';
  const m = base.match(/^(.+)\.(md|markdown)$/i);
  return m ? m[1] : null;
}

interface BookCtx {
  name: string;
  slugs: Set<string>;
  reader: string;
}

function bookContext(sourceFile: string): BookCtx | null {
  const m = sourceFile.match(/^(?:cs|en\/)?books\/([^/]+)\/kapitoly\//);
  if (!m) return null;
  const def = BOOK_READERS[m[1]];
  return def ? { name: m[1], slugs: def.slugs, reader: def.reader } : null;
}

/** Try progressively shorter suffixes until one exists in the manifest. */
function suffixMatch(path: string): string | null {
  const parts = path.split('/').filter((p) => p && p !== '.' && p !== '..');
  for (let i = 1; i < parts.length - 0; i++) {
    const candidate = parts.slice(i).join('/');
    const ch = docFileHit(candidate);
    if (candidate.includes('/') && ch) return ch;
  }
  return null;
}
