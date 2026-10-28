'use client';

import Link from 'next/link';
import { BookOpen, Building2, Gem, Lock, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { BOOK_NAV } from '@/lib/books/registry';

const Copy = {
  kicker: { cs: 'Zion Archive · Nirvana Hub', en: 'Zion Archive · Nirvana Hub' },
  title: { cs: 'Zion Archive', en: 'Zion Archive' },
  sub: {
    cs: 'Nirvana Hub — knihovna cesty · všechny knihy na jednom místě',
    en: 'Nirvana Hub — the library of the path · all books in one place',
  },
  badge: { cs: 'Otevírá se brzy', en: 'Opening soon' },
  lede: {
    cs: 'Archiv se připravuje. Přístup do knihovny bude placený přes Archive Pass — s bonusy v OASIS a na marketplace. Veřejná dokumentace zůstává otevřená.',
    en: 'The archive is being prepared. Library access will be paid via an Archive Pass — with bonuses in OASIS and on the marketplace. Public documentation stays open.',
  },
  insideTitle: { cs: 'Co uvnitř', en: 'What is inside' },
  insideBlurb: {
    cs: 'Osmnáct knih v pěti skupinách — jedna knihovna, jeden reader.',
    en: 'Eighteen books in five groups — one library, one reader.',
  },
  accessTitle: { cs: 'Model přístupu', en: 'Access model' },
  passTitle: { cs: 'Archive Pass', en: 'Archive Pass' },
  passBody: {
    cs: 'Placený přístup do celé knihovny — v přípravě na marketplace.',
    en: 'Paid access to the whole library — being prepared on the marketplace.',
  },
  oasisTitle: { cs: 'OASIS bonusy', en: 'OASIS bonuses' },
  oasisBody: {
    cs: 'Držitelé passu dostanou výhody a bonusy v OASIS světě.',
    en: 'Pass holders get perks and bonuses inside the OASIS world.',
  },
  b2bTitle: { cs: 'B2B licence', en: 'B2B licence' },
  b2bBody: {
    cs: 'Institucionální a partnerský přístup k archivu — v jednání.',
    en: 'Institutional and partner access to the archive — in discussion.',
  },
  market: { cs: 'Marketplace', en: 'Marketplace' },
  docs: { cs: 'Veřejná dokumentace', en: 'Public documentation' },
  home: { cs: 'Zpět na homepage', en: 'Back to homepage' },
};

export default function ArchiveLock() {
  const { lang } = useLang();
  const l = lang === 'cs' ? 'cs' : 'en';
  const total = BOOK_NAV.reduce((n, g) => n + g.books.length, 0);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(252,209,22,0.08),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.08),transparent_55%)]" />
      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-24 sm:px-6 md:pt-32">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-zion-gold">{Copy.kicker[l]}</p>
          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zion-gold/30 bg-zion-gold/10">
            <Lock className="h-7 w-7 text-zion-gold" />
          </div>
          <h1 className="text-gradient mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            {Copy.title[l]}
          </h1>
          <p className="mt-3 text-base font-semibold text-gray-300">{Copy.sub[l]}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zion-gold">
            <Sparkles className="h-3.5 w-3.5" />
            {Copy.badge[l]}
          </span>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {Copy.lede[l]}
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: Copy.passTitle[l], body: Copy.passBody[l] },
            { icon: Gem, title: Copy.oasisTitle[l], body: Copy.oasisBody[l] },
            { icon: Building2, title: Copy.b2bTitle[l], body: Copy.b2bBody[l] },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
                {Copy.accessTitle[l]}
              </p>
              <h2 className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
                <Icon className="h-4 w-4 text-zion-gold" />
                {title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="zion-rainbow-card mt-10 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.insideTitle[l]}
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
              {total} {l === 'cs' ? 'knih' : 'books'} · {BOOK_NAV.length} {l === 'cs' ? 'skupin' : 'groups'}
            </span>
            <p className="w-full text-xs text-gray-500">{Copy.insideBlurb[l]}</p>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {BOOK_NAV.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5"
              >
                <span className="text-xs font-semibold text-gray-300">{g.label[l]}</span>
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                  {g.books.length}
                  <Lock className="h-3 w-3" />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-xl border border-zion-gold/40 bg-zion-gold/10 px-5 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/20"
          >
            <Gem className="h-4 w-4" />
            {Copy.market[l]}
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
            {Copy.docs[l]}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-200"
          >
            {Copy.home[l]}
          </Link>
        </div>
      </div>
    </main>
  );
}
