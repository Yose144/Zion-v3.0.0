'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { resolveDocHref, resolveDocImage, type DocLinkCtx } from '@/lib/docLinks';

/* ═══════════════════════════════════════════════════════════
   MarkdownDoc — shared corpus renderer

   Every markdown surface (/docs library, /zion-archive/cist,
   /nirvana/cist, /whitepapers, /onboard, /terranova) renders
   through this component so that:

   • relative/links resolve through the doc link engine
     (never a raw 404 — internal-only references render muted)
   • headings carry GitHub-style ids → in-page #anchor links work
   • images resolve against the source file's directory
   ═══════════════════════════════════════════════════════════ */

/* GitHub-compatible heading slugger (keeps diacritics). */
export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
    .replace(/ /g, '-');
}

function stripInlineMd(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

interface HeadingIndex {
  /** heading source line → generated id */
  byLine: Map<number, string>;
  anchors: Set<string>;
}

export function extractHeadingIds(content: string): HeadingIndex {
  const byLine = new Map<number, string>();
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  const lines = content.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const base = githubSlug(stripInlineMd(m[2]));
    if (!base) continue;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;
    byLine.set(i + 1, id);
    anchors.add(id);
  }
  return { byLine, anchors };
}

export interface MarkdownDocProps {
  content: string;
  /** Path of the rendered file relative to public/docs — needed for relative links/images. */
  sourceFile?: string;
  /** Chapter slugs when rendered inside a hash-router book reader. */
  bookSlugs?: Set<string>;
  className?: string;
}

export default function MarkdownDoc({ content, sourceFile, bookSlugs, className }: MarkdownDocProps) {
  const headings = useMemo(() => extractHeadingIds(content), [content]);

  const ctx: DocLinkCtx = useMemo(
    () => ({ sourceFile, anchors: headings.anchors, bookSlugs }),
    [sourceFile, headings, bookSlugs],
  );

  const headingRenderer = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
    const Heading = ({
      node,
      children,
      ...props
    }: React.ComponentPropsWithoutRef<'h1'> & { node?: unknown }) => {
      const line = (node as { position?: { start?: { line?: number } } })?.position?.start?.line;
      const id = typeof line === 'number' ? headings.byLine.get(line) : undefined;
      return (
        <Tag id={id} {...props}>
          {children}
        </Tag>
      );
    };
    Heading.displayName = `Md${Tag.toUpperCase()}`;
    return Heading;
  };

  return (
    <article className={className || 'prose prose-invert prose-lg max-w-none'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: headingRenderer('h1'),
          h2: headingRenderer('h2'),
          h3: headingRenderer('h3'),
          h4: headingRenderer('h4'),
          h5: headingRenderer('h5'),
          h6: headingRenderer('h6'),
          a: ({ node, href, children, ...props }) => {
            const r = resolveDocHref(href, ctx);
            if (r.dead || !r.href) {
              return (
                <code
                  className="text-[0.92em] text-gray-500 bg-white/5 px-1 py-0.5 rounded"
                  title={r.note ?? 'Internal reference — not published'}
                >
                  {children}
                </code>
              );
            }
            if (r.inPageAnchor) {
              const anchor = r.href.slice(1);
              return (
                <a
                  href={r.href}
                  {...props}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(anchor)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {children}
                </a>
              );
            }
            if (r.external) {
              return (
                <a href={r.href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                  <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5 -mt-0.5 opacity-50" />
                </a>
              );
            }
            return (
              <a href={r.href} {...props}>
                {children}
              </a>
            );
          },
          img: ({ node, src, alt, ...props }) => {
            const resolved = resolveDocImage(typeof src === 'string' ? src : undefined, ctx);
            if (!resolved) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolved} alt={alt ?? ''} loading="lazy" {...props} />
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-xl border border-white/10">
              <table className="min-w-full">{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
