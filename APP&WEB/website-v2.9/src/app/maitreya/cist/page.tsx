'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Egg, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { MAITREYA_CHAPTERS, MAITREYA_PARTS } from '../chapters';

const CistCopy = {
  kicker: { cs: 'Kniha Pátá · celá kniha', en: 'Book Five · the full book' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: { cs: 'Pán Hiranyagarbhy · Dědic Zionu', en: 'Lord of Hiranyagarbha · Heir of Zion' },
  status: { cs: 'První draft · CZ + EN', en: 'First draft · CZ + EN' },
  back: { cs: 'Zpět na stránku', en: 'Back to the page' },
  intro: {
    cs: 'Příběh o tom, jak padají věže Babylonu — a jak láska a pravda rodí Nový svět. Prolog, 17 kapitol a epilog. Každá kapitola končí tabulkou ověřitelných faktů.',
    en: 'The story of how the towers of Babylon fall — and how love and truth give birth to the New World. Prologue, 17 chapters and an epilogue. Every chapter ends with a table of verifiable facts.',
  },
};

export default function MaitreyaCistPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const l = cs ? 'cs' : 'en';

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
              {CistCopy.back[l]}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="zion-kicker border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
                <Egg className="h-3.5 w-3.5" />
                {CistCopy.kicker[l]}
              </span>
              <span className="zion-kicker border-zion-purple/30 bg-zion-purple/10 text-zion-purple">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                {CistCopy.status[l]}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-gradient">{CistCopy.title[l]}</span>
            </h1>
            <p className="text-base font-semibold text-zion-gold/90 sm:text-lg">
              {CistCopy.subtitle[l]}
            </p>
            <p className="max-w-2xl text-sm text-gray-400 sm:text-base">{CistCopy.intro[l]}</p>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-8 pb-20 sm:py-12">
        <div className="zion-container max-w-4xl space-y-10">
          {parts.map((p, pi) => (
            <motion.div
              key={p.part}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: pi * 0.05 }}
            >
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-zion-gold">
                {p.title}
              </h2>
              <div className="space-y-2">
                {p.chapters.map((ch) => (
                  <Link
                    key={ch.slug}
                    href={`/maitreya/cist/${ch.slug}`}
                    className="group zion-rainbow-sub flex items-center gap-4 p-4 transition-colors hover:border-zion-gold/40"
                    style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-zion-gold/70" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                        {ch.num[l]}
                      </div>
                      <div className="truncate text-base font-semibold text-gray-100 group-hover:text-zion-gold">
                        {ch.title[l]}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-zion-gold" />
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
