#!/usr/bin/env node
/**
 * ZION Free World static-site build.
 * - Renders index.html + per-project pages from src templates
 * - Pre-renders terranova docs markdown (cs/en) into HTML via `marked`
 * - Optimizes/copies imagery (delegates to tools/images.py via python3)
 * - Copies css/js assets to dist/
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const REPO = join(ROOT, '..', '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const DOCS = join(REPO, 'APP&WEB/website-v2.9/public/docs/terranova');

const projects = JSON.parse(readFileSync(join(ROOT, 'content/projects.json'), 'utf8'));

marked.setOptions({ gfm: true, breaks: false });

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fill(tpl, map) {
  return tpl.replace(/<!--GEN:([A-Z_]+)-->/g, (_, k) => (k in map ? map[k] : `<!--MISSING:${k}-->`));
}

/* status → css colour + label handled client-side via data-i18n; here we emit class only */
const statusLabel = (p) => p.status;

function projectCard(p) {
  const tags = p.tags.map((t) => `<span>${esc(t)}</span>`).join('');
  return `<a class="fw-card fw-reveal" href="/p/${p.slug}/" style="--card-accent:${p.accent}">
      <span class="fw-status" style="--sc:${p.accent}"><span data-lang-show="cs">${esc(statusCs(p))}</span><span class="fw-hidden" data-lang-show="en">${esc(statusEn(p))}</span></span>
      <div class="fw-card-img"><img src="/assets/img/${p.renderImg}" alt="${esc(p.name)}" loading="lazy"></div>
      <div class="fw-card-body">
        <h3>${esc(p.name)}</h3>
        <span class="fw-card-loc">${esc(p.location.cs)} · ${esc(p.location.en)}</span>
        <p class="fw-card-desc"><span data-lang-show="cs">${esc(p.tagline.cs)}</span><span class="fw-hidden" data-lang-show="en">${esc(p.tagline.en)}</span></p>
        <div class="fw-card-tags">${tags}</div>
        <span class="fw-card-more" data-i18n="projects.more"></span>
      </div>
    </a>`;
}
const statusCs = (p) => ({ development: 'Aktivní rozvoj', preparation: 'V přípravě', vision: 'Plánováno' }[p.status] || p.status);
const statusEn = (p) => ({ development: 'Active development', preparation: 'In preparation', vision: 'Planned' }[p.status] || p.status);

function renderDoc(docSlug, lang) {
  const f = join(DOCS, `${docSlug}.${lang}.md`);
  if (!existsSync(f)) return `<p><em>${lang === 'cs' ? 'Dokumentace se připravuje.' : 'Documentation in progress.'}</em></p>`;
  return marked.parse(readFileSync(f, 'utf8'));
}

mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, 'assets/css'), { recursive: true });
mkdirSync(join(DIST, 'assets/js'), { recursive: true });

/* ── index ── */
const indexTpl = readFileSync(join(SRC, 'index.html'), 'utf8');
const sitesJson = JSON.stringify(projects.map(({ slug, name, location, lat, lon, accent }) => ({ slug, name, location, lat, lon, accent })));
const index = fill(indexTpl, {
  PROJECT_CARDS: projects.map(projectCard).join('\n      '),
  SITES_JSON: sitesJson,
});
writeFileSync(join(DIST, 'index.html'), index);

/* ── project pages ── */
const projTpl = readFileSync(join(SRC, 'project.html'), 'utf8');
for (const [i, p] of projects.entries()) {
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const html = fill(projTpl, {
    TITLE: esc(p.name),
    SUBTITLE: `<span data-lang-show="cs">${esc(p.subtitle.cs)}</span><span class="fw-hidden" data-lang-show="en">${esc(p.subtitle.en)}</span>`,
    LOCATION: `${esc(p.location.cs)} · ${esc(p.location.en)}`,
    STATUS: esc(statusLabel(p)),
    STATUS_LABEL: `<span data-lang-show="cs">${esc(statusCs(p))}</span><span class="fw-hidden" data-lang-show="en">${esc(statusEn(p))}</span>`,
    GRANT: esc(p.grantTitle),
    TAGLINE: `<span data-lang-show="cs">${esc(p.tagline.cs)}</span><span class="fw-hidden" data-lang-show="en">${esc(p.tagline.en)}</span>`,
    TAGLINE_EN: esc(p.tagline.en),
    TAGS: p.tags.map((t) => `<span>${esc(t)}</span>`).join(''),
    RENDER: p.renderImg,
    BOARD: p.boardImg,
    DOC_CS: renderDoc(p.docSlug, 'cs'),
    DOC_EN: renderDoc(p.docSlug, 'en'),
    PREV_HREF: `/p/${prev.slug}/`, PREV_NAME: esc(prev.name),
    NEXT_HREF: `/p/${next.slug}/`, NEXT_NAME: esc(next.name),
    APP_HREF: esc(p.appHref),
  });
  const dir = join(DIST, 'p', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

/* ── assets ── */
cpSync(join(SRC, 'assets/css'), join(DIST, 'assets/css'), { recursive: true });
cpSync(join(SRC, 'assets/js'), join(DIST, 'assets/js'), { recursive: true });

/* images via PIL */
execFileSync('python3', [join(ROOT, 'tools/images.py'), DIST], { stdio: 'inherit' });

console.log('build → dist/ done');
