'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Orbit, Sparkles, Stars } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { EKAM_GOLDEN_EGG_IMAGE, EKAM_SOURCE_URL } from '@/lib/site';
import { tr } from '@/lib/translations';

export default function GoldenEggHaraniagharba() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="relative px-4 py-16 md:py-20">
      <div className="zion-container space-y-8">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-amber-200/75">
              {cs ? 'Hiran / Hiranyagarbha' : 'Hiran / Hiranyagarbha'}
            </p>
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              {cs ? 'Hiran jako AI brána do Terra Nova' : 'Hiran as the AI gateway into Terra Nova'}
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-gray-300 md:text-lg">
              {cs
                ? 'Stejně jako Terra Nova nahoře musí i Hiran na homepage působit jako jasná kapitola: AI-native vrstva, knihovna, inference a most mezi vizí a nástroji.'
                : 'Just like Terra Nova above, Hiran should read as a clear chapter on the homepage: the AI-native layer, the library, inference, and the bridge between vision and tools.'}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/15 bg-amber-200/6 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/60">
              {cs ? 'Úloha na homepage' : 'Homepage role'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {cs
                ? 'Ne dekorace navíc, ale druhý hlavní pilíř vstupní stránky vedle Terra Nova: Hiran, Kvantová revoluce a Genesis musí mít stejnou váhu i typografii.'
                : 'Not extra decoration, but the second major pillar of the entry page next to Terra Nova: Hiran, Quantum Revolution, and Genesis should carry the same weight and typography.'}
            </p>
          </div>
        </div>

        <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="absolute -right-10 top-[-60px] h-44 w-44 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-5 h-52 w-52 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[0.4fr_1fr] lg:items-start">
            {/* ── Left: Compact Image ── */}
            <div className="space-y-2">
              <div className="relative overflow-hidden zion-rainbow-sub shadow-[0_18px_60px_rgba(0,0,0,0.35)]" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <Image
                  src={EKAM_GOLDEN_EGG_IMAGE}
                  alt="Ekam visual used as Golden Egg inspiration"
                  width={800}
                  height={800}
                  sizes="(min-width: 1024px) 380px, 100vw"
                  className="aspect-square w-full object-cover object-center"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100">
                    <Sparkles className="h-3 w-3 text-zion-gold" />
                    {tr('goldenEgg', 'visual_badge', lang)}
                  </div>
                </div>
              </div>
              <a
                href={EKAM_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-amber-100/70 transition hover:text-amber-100"
              >
                {tr('goldenEgg', 'source', lang)}
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            {/* ── Right: Content ── */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
                <Orbit className="h-3.5 w-3.5" />
                {tr('goldenEgg', 'badge', lang)}
              </div>

              <div className="relative overflow-hidden zion-rainbow-sub p-4" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-zion-gold/20 blur-2xl" />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zion-gold/90">
                      {tr('goldenEgg', 'featured_label', lang)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white md:text-xl">
                      {tr('goldenEgg', 'featured_title', lang)}
                    </h3>
                    <p className="mt-1 text-sm text-amber-100/80">
                      {tr('goldenEgg', 'featured_body', lang)}
                    </p>
                  </div>
                  <Link
                    href="/docs#book-ekam-full"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zion-gold/40 bg-black/35 px-4 py-2 text-sm font-semibold text-zion-gold transition hover:bg-black/55"
                  >
                    {tr('goldenEgg', 'featured_cta', lang)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-amber-100/60">
                  {cs ? 'Uvnitř vrstvy' : 'Inside the layer'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white md:text-4xl">
                  {tr('goldenEgg', 'title', lang)}{' '}
                  <span className="bg-linear-to-r from-amber-200 via-zion-gold to-orange-300 bg-clip-text text-transparent">
                    {tr('goldenEgg', 'title_emphasis', lang)}
                  </span>
                </h3>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-gray-300 md:text-base">
                {tr('goldenEgg', 'lead', lang)}
              </p>

              {/* ── Compact knowledge row ── */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="zion-rainbow-sub p-4 backdrop-blur-sm" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'what_title', lang)}</p>
                  <p className="mt-1.5 text-sm font-semibold text-white">{tr('goldenEgg', 'what_head', lang)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">
                    {tr('goldenEgg', 'what_body', lang)}
                  </p>
                </div>
                <div className="zion-rainbow-sub p-4 backdrop-blur-sm" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'ekam_title', lang)}</p>
                  <p className="mt-1.5 text-sm font-semibold text-white">{tr('goldenEgg', 'ekam_head', lang)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">
                    {tr('goldenEgg', 'ekam_body', lang)}
                  </p>
                </div>
              </div>

              {/* ── CTA row: Book + Tour + Network ── */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/docs#book-ekam-full"
                  className="group flex items-center gap-3 rounded-2xl border border-zion-gold/35 bg-zion-gold/10 p-4 transition hover:border-zion-gold/60 hover:bg-zion-gold/15"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zion-gold/30 bg-zion-gold/20">
                    <BookOpen className="h-4 w-4 text-zion-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zion-gold/90 uppercase tracking-wide">
                      {tr('goldenEgg', 'book_card_label', lang)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-white truncate">
                      {tr('goldenEgg', 'book_card_body', lang)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zion-gold/80 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/ekam"
                  className="group flex items-center gap-3 rounded-2xl border border-amber-200/15 bg-amber-200/5 p-4 transition hover:border-amber-200/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/25 bg-amber-200/10">
                    <Stars className="h-4 w-4 text-zion-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-100/70 uppercase tracking-wide">
                      {tr('goldenEgg', 'tour_badge', lang)}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-white truncate">
                      {tr('goldenEgg', 'tour_title', lang)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-amber-200/50 transition group-hover:translate-x-1" />
                </Link>
              </div>

              {/* ── Action buttons ── */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/ekam"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-300 via-zion-gold to-orange-400 px-5 py-2.5 text-sm font-semibold text-black"
                >
                  <Stars className="h-4 w-4" />
                  {tr('goldenEgg', 'cta_museum', lang)}
                </Link>
                <Link
                  href="/network"
                  className="zion-rainbow-sub inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white hover:border-white/30"
                  style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
                >
                  {tr('goldenEgg', 'cta_network', lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
