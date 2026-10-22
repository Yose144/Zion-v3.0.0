import { redirect } from 'next/navigation';
import manifest from '@/lib/doc-manifest.json';
import { DOC_PATH_ALIASES } from '@/lib/docLinks';
import { DOC_IDS, DOC_HASH_ALIASES } from '@/lib/docs-manifest';

/* ═══════════════════════════════════════════════════════════
   /docs/<…> alias layer

   Reached only for paths that do NOT match a real file inside
   public/docs (existing files are served directly by Next).
   Resolves friendly slugs used by the corpus — e.g.
   /docs/whitepaper/zion-oasis → /docs/view/whitepaper/ZION_OASIS_2.8.5.md
   ═══════════════════════════════════════════════════════════ */

const FILES = new Set<string>(manifest.files as string[]);

export const dynamicParams = true;

export function generateStaticParams() {
  return Object.keys(DOC_PATH_ALIASES).map((a) => ({ slug: a.split('/') }));
}

function resolveTarget(slug: string[]): string {
  const path = decodeURIComponent(slug.join('/'));
  const alias = DOC_PATH_ALIASES[path];
  if (alias) return `/docs/view/${alias}`;

  // /docs/<doc-id> → /docs#<doc-id>
  if (slug.length === 1) {
    const id = DOC_IDS.has(path) ? path : DOC_HASH_ALIASES[path];
    if (id) return `/docs#${id}`;
  }

  // Conventional entry points: <dir>/index.md, <dir>/README.md, <slug>.md
  for (const candidate of [`${path}/index.md`, `${path}/README.md`, `${path}.md`]) {
    if (FILES.has(candidate)) return `/docs/view/${candidate}`;
  }

  return '/docs';
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  redirect(resolveTarget(slug));
}
