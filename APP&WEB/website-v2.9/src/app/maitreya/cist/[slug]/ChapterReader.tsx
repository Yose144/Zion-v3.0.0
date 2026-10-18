'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import DocMarkdownArticle from '@/components/docs/DocMarkdownArticle';
import { MAITREYA_CHAPTERS, MAITREYA_PARTS, maitreyaChapterBySlug, maitreyaDocPath } from '../../chapters';

const ReaderCopy = {
  toc: { cs: 'Obsah knihy', en: 'Book contents' },
  loadingBook: { cs: 'Otevírám kapitolu…', en: 'Opening the chapter…' },
  notFound: { cs: 'Kapitolu se nepodařilo načíst.', en: 'The chapter could not be loaded.' },
  prev: { cs: 'Předchozí', en: 'Previous' },
  next: { cs: 'Další', en: 'Next' },
};

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
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
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

  const parts: { part: number; title: string; chapters: typeof MAITREYA_CHAPTERS }[] = [];
  for (const ch of MAITREYA_CHAPTERS) {
    let bucket = parts.find((p) => p.part === ch.part);
    if (!bucket) {
      bucket = { part: ch.part, title: MAITREYA_PARTS[ch.part][l], chapters: [] };
      parts.push(bucket);
    }
    bucket.chapters.push(ch);
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/8 blur-3xl" />
      </div>

      <section className="relative z-10 px-4 py-8 sm:py-10">
        <div className="zion-container max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
            {/* ── book nav (docs-style sidebar) ── */}
            <aside className="zion-rainbow-card p-4 lg:sticky lg:top-24" style={{ '--rc': '168, 85, 247' } as React.CSSProperties}>
              <Link
                href="/maitreya/cist"
                className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-zion-gold"
              >
                <ArrowLeft className="h-4 w-4" />
                {ReaderCopy.toc[l]}
              </Link>
              <nav className="space-y-4">
                {parts.map((p) => (
                  <div key={p.part}>
                    <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-zion-gold/80">
                      {p.title}
                    </div>
                    <div className="space-y-0.5">
                      {p.chapters.map((ch) => {
                        const active = ch.slug === slug;
                        return (
                          <Link
                            key={ch.slug}
                            href={`/maitreya/cist/${ch.slug}`}
                            className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                              active
                                ? 'bg-zion-gold/10 font-semibold text-zion-gold'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                          >
                            {ch.title[l]}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            {/* ── article ── */}
            <div className="min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 space-y-2"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zion-gold/80">
                  {MAITREYA_PARTS[chapter.part][l]} · {chapter.num[l]}
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  <span className="text-gradient">{chapter.title[l]}</span>
                </h1>
              </motion.div>

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
                  className="zion-rainbow-card p-6 sm:p-10"
                  style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
                >
                  <div className="zion-docs-prose">
                    <DocMarkdownArticle content={content} />
                  </div>
                </motion.div>
              )}

              {/* prev / next */}
              {!loading && content && (
                <nav className="mt-8 grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
      </section>
    </main>
  );
}
