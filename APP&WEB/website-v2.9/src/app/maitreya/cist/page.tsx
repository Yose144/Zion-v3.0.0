'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, BookOpen, Egg, List, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const CistCopy = {
  kicker: { cs: 'Kniha Pátá · lite verze', en: 'Book Five · lite version' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: { cs: 'Pán Hiranyagarbhy · Dědic Zionu', en: 'Lord of Hiranyagarbha · Heir of Zion' },
  status: { cs: 'Mockup · první draft', en: 'Mockup · first draft' },
  back: { cs: 'Zpět na stránku', en: 'Back to the page' },
  toc: { cs: 'Obsah', en: 'Contents' },
  loadingBook: { cs: 'Otevírám knihu…', en: 'Opening the book…' },
  notFound: { cs: 'Text se nepodařilo načíst.', en: 'The text could not be loaded.' },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function MaitreyaCistPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = cs ? '/docs/books/maitreya/MAITREYA-LITE.md' : '/docs/en/books/maitreya/MAITREYA-LITE.md';
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        // strip leading "# title" + status blockquote + first hr — page header replaces them
        const parts = text.split(/\n---\n/);
        setContent(parts.length > 1 ? parts.slice(1).join('\n---\n') : text);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setContent(CistCopy.notFound[cs ? 'cs' : 'en']);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cs]);

  const toc = useMemo(() => {
    if (!content) return [];
    return content
      .split('\n')
      .filter((l) => /^#{2,3} /.test(l))
      .map((l) => {
        const level = l.startsWith('###') ? 3 : 2;
        const text = l.replace(/^#{2,3} /, '');
        return { level, text, id: slugify(text) };
      });
  }, [content]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/8 blur-3xl" />
      </div>

      {/* ─── HEADER ─── */}
      <section className="relative z-10 px-4 pt-8 sm:pt-10">
        <div className="zion-container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <Link
              href="/maitreya"
              className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-zion-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              {CistCopy.back[cs ? 'cs' : 'en']}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="zion-kicker border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
                <Egg className="h-3.5 w-3.5" />
                {CistCopy.kicker[cs ? 'cs' : 'en']}
              </span>
              <span className="zion-kicker border-zion-purple/30 bg-zion-purple/10 text-zion-purple">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                {CistCopy.status[cs ? 'cs' : 'en']}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-gradient">{CistCopy.title[cs ? 'cs' : 'en']}</span>
            </h1>
            <p className="text-base font-semibold text-zion-gold/90 sm:text-lg">
              {CistCopy.subtitle[cs ? 'cs' : 'en']}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── READER ─── */}
      <section className="relative z-10 px-4 py-8 sm:py-12">
        <div className="zion-container max-w-4xl">
          {loading ? (
            <div className="space-y-6 py-10">
              <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                <BookOpen className="h-5 w-5 animate-pulse text-zion-gold" />
                {CistCopy.loadingBook[cs ? 'cs' : 'en']}
              </div>
              <div className="h-10 w-2/3 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-px w-full bg-white/5" />
              <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-5 w-5/6 rounded bg-white/5 animate-pulse" />
              <div className="h-5 w-4/6 rounded bg-white/5 animate-pulse" />
              <div className="h-40 w-full rounded-xl bg-white/5 animate-pulse" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid gap-8 lg:grid-cols-[220px_1fr] lg:items-start"
            >
              {/* TOC */}
              {toc.length > 0 && (
                <aside className="lg:sticky lg:top-24 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zion-gold">
                    <List className="h-3.5 w-3.5" />
                    {CistCopy.toc[cs ? 'cs' : 'en']}
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

              {/* article */}
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
        </div>
      </section>
    </main>
  );
}
