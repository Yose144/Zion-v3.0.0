'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Orbit, Sparkles, Stars } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import GoldenOrb from './GoldenOrb';

const GoldenEggHaraniagharbaCopy = {
  hiranHiranyagarbha: { cs: `Hiran / Hiranyagarbha`, en: `Hiran / Hiranyagarbha` },
  hiranAsTheAiGatewayIntoTerraNo: { cs: `Hiran jako AI brána do Terra Nova`, en: `Hiran as the AI gateway into Terra Nova` },
};

export default function GoldenEggHaraniagharba() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="relative px-4 py-8">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="absolute -right-10 top-[-40px] h-32 w-32 rounded-full bg-zion-gold/15 blur-3xl" />
          <div className="absolute -bottom-16 -left-4 h-40 w-40 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-4 lg:grid-cols-[160px_1fr] lg:items-center">
            {/* Left: compact Golden Orb */}
            <div className="space-y-1">
              <div className="relative overflow-hidden zion-rainbow-sub shadow-[0_12px_40px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <GoldenOrb className="aspect-square w-full max-w-[160px] mx-auto" />
                <div className="absolute inset-x-0 bottom-0 p-2 pointer-events-none z-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 backdrop-blur-sm px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-100">
                    <Sparkles className="h-2.5 w-2.5 text-zion-gold" />
                    {tr('goldenEgg', 'visual_badge', lang)}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: content */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200">
                    <Orbit className="h-3 w-3" />
                    {GoldenEggHaraniagharbaCopy.hiranHiranyagarbha[cs ? 'cs' : 'en']}
                  </div>
                  <h2 className="mt-2 text-xl font-bold leading-tight text-white sm:text-2xl">
                    {GoldenEggHaraniagharbaCopy.hiranAsTheAiGatewayIntoTerraNo[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="mt-1 text-sm text-amber-100/80 max-w-2xl">
                    {tr('goldenEgg', 'featured_body', lang)}
                  </p>
                </div>

                <Link
                  href="/docs#book-ekam-full"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zion-gold/40 bg-black/35 px-4 py-2 text-sm font-semibold text-zion-gold transition hover:bg-black/55 shrink-0"
                >
                  {tr('goldenEgg', 'featured_cta', lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Compact knowledge row */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="zion-rainbow-sub p-3 backdrop-blur-sm" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'what_title', lang)}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{tr('goldenEgg', 'what_head', lang)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400 line-clamp-2">
                    {tr('goldenEgg', 'what_body', lang)}
                  </p>
                </div>
                <div className="zion-rainbow-sub p-3 backdrop-blur-sm" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'ekam_title', lang)}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{tr('goldenEgg', 'ekam_head', lang)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400 line-clamp-2">
                    {tr('goldenEgg', 'ekam_body', lang)}
                  </p>
                </div>
              </div>

              {/* CTA row */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/ekam"
                  className="zion-button-primary group text-sm"
                  style={{ '--rc': '252, 209, 22' } as CSSProperties}
                >
                  <Stars className="h-4 w-4" />
                  {tr('goldenEgg', 'cta_museum', lang)}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/docs#book-ekam-full"
                  className="group inline-flex items-center gap-2 rounded-xl border border-zion-gold/30 bg-zion-gold/5 px-4 py-2 text-sm font-semibold text-zion-gold transition hover:bg-zion-gold/10"
                >
                  <BookOpen className="h-4 w-4" />
                  {tr('goldenEgg', 'book_card_body', lang)}
                </Link>
                <Link
                  href="/network"
                  className="group inline-flex items-center gap-2 rounded-xl border border-amber-200/15 bg-amber-200/5 px-4 py-2 text-sm font-semibold text-amber-100/80 transition hover:bg-amber-200/10"
                >
                  {tr('goldenEgg', 'cta_network', lang)}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
