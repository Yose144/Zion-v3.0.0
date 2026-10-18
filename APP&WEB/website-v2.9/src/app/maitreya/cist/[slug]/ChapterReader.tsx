'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, BookOpen, List } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { maitreyaChapterBySlug, maitreyaDocPath, MAITREYA_PARTS } from '../../chapters';

const ReaderCopy = {
  toc: { cs: 'Obsah knihy', en: 'Book contents' },
  inChapter: { cs: 'V kapitole', en: 'In this chapter' },
  loadingBook: { cs: 'Otevírám kapitolu…', en: 'Opening the chapter…' },
  notFound: { cs: 'Kapitolu se nepodařilo načíst.', en: 'The chapter could not be loaded.' },
  prev: { cs: 'Předchozí', en: 'Previous' },
  next: { cs: 'Další', en: 'Next' },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ChapterReader({ slug }: { slug: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const l = cs ? 'cs' : 'en';
  const found = maitreyaChapterBySlug(slug);
  const chapter = found!.chapter;
  const { prev, next } = found!;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(maitreyaDocPath(slug, l))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setContent('');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, l]);

  const toc = useMemo(() => {
    if (!content) return [];
    return content
      .split('\n')
      .filter((line) => /^#{2,3} /.test(line))
      .map((line) => {
        const level = line.startsWith('###') ? 3 : 2;
        const text = line.replace(/^#{2,3} /, '');
        return { level, text, id: slugify(text) };
      });
  }, [content]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/8 blur-3xl" />
      </div>

      <section className="relative z-10 px-4 pt-8 sm:pt-10">
        <div className="zion-container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <Link
              href="/maitreya/cist"
              className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-zion-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              {ReaderCopy.toc[l]}
            </Link>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zion-gold/80">
              {MAITREYA_PARTS[chapter.part][l]} · {chapter.num[l]}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <span className="text-gradient">{chapter.title[l]}</span>
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-8 sm:py-10">
        <div className="zion-container max-w-4xl">
          {loading ? (
            <div className="space-y-6 py-10">
              <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                <BookOpen className="h-5 w-5 animate-pulse text-zion-gold" />
                {ReaderCopy.loadingBook[l]}
              </div>
              <div className="h-10 w-2/3 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-px w-full bg-white/5" />
              <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-5 w-5/6 rounded bg-white/5 animate-pulse" />
              <div className="h-40 w-full rounded-xl bg-white/5 animate-pulse" />
            </div>
          ) : !content ? (
            <div className="zion-rainbow-card p-10 text-center text-gray-400">
              {ReaderCopy.notFound[l]}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid gap-8 lg:grid-cols-[220px_1fr] lg:items-start"
            >
              {toc.length > 0 && (
                <aside className="lg:sticky lg:top-24 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zion-gold">
                    <List className="h-3.5 w-3.5" />
                    {ReaderCopy.inChapter[l]}
                  </div>
                  <nav className="space-y-1">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors hover:bg-zion-gold/10 hover:text-zion-gold ${
                          item.level === 2 ? 'font-semibold text-gray-200' : 'pl-5 text-gray-500'
                        }`}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </aside>
              )}

              <div className="zion-rainbow-card p-6 sm:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="zion-docs-prose">
                  <article className="prose prose-invert prose-lg max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children }) => {
                          const text = String(children);
                          return (
                            <h2 id={slugify(text)} className="scroll-mt-24">
                              {children}
                            </h2>
                          );
                        },
                        h3: ({ children }) => {
                          const text = String(children);
                          return (
                            <h3 id={slugify(text)} className="scroll-mt-24">
                              {children}
                            </h3>
                          );
                        },
                        hr: () => (
                          <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-zion-gold/40 to-transparent" />
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="rounded-r-xl border-l-2 border-zion-gold/60 bg-zion-gold/[0.05] px-5 py-1 not-italic">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="my-6 overflow-x-auto rounded-xl border border-white/10">
                            <table className="min-w-full">{children}</table>
                          </div>
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            </motion.div>
          )}

          {/* prev / next */}
          {!loading && content && (
            <nav className="mt-10 grid gap-3 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={`/maitreya/cist/${prev.slug}`}
                  className="group zion-rainbow-sub flex items-center gap-3 p-4"
                  style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
                >
                  <ArrowLeft className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:-translate-x-1 group-hover:text-zion-purple" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                      {ReaderCopy.prev[l]} · {prev.num[l]}
                    </div>
                    <div className="truncate text-sm font-semibold text-gray-200 group-hover:text-white">
                      {prev.title[l]}
                    </div>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {next && (
                <Link
                  href={`/maitreya/cist/${next.slug}`}
                  className="group zion-rainbow-sub flex items-center justify-end gap-3 p-4 text-right"
                  style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                      {ReaderCopy.next[l]} · {next.num[l]}
                    </div>
                    <div className="truncate text-sm font-semibold text-gray-200 group-hover:text-white">
                      {next.title[l]}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-zion-gold" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
