'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Orbit, Sparkles, Stars } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5 } from '@/lib/i18n-tx';
import { tr } from '@/lib/translations';
import HiranUniverseLazy from './HiranUniverseLazy';
import HiranMiniChat from './HiranMiniChat';

const GoldenEggHaraniagharbaCopy = {
  hiranHiranyagarbha: { cs: `Hiran / Hiranyagarbha`, en: `Hiran / Hiranyagarbha` },
  hiranAsTheAiGatewayIntoTerraNo: { cs: `Hiran jako AI brána do Terra Nova`, en: `Hiran as the AI gateway into Terra Nova` },
};

export default function GoldenEggHaraniagharba() {
  const { lang } = useLang();

  return (
    <section className="relative px-4 py-6">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
          <div className="absolute -right-10 top-[-40px] h-32 w-32 rounded-full bg-zion-gold/15 blur-3xl" />
          <div className="absolute -bottom-16 -left-4 h-40 w-40 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-4 lg:grid-cols-[minmax(300px,5fr)_minmax(0,7fr)]">
            {/* Left: živý 3D vesmír — Hiranyagarbha orb nad lotosem (port
                scény z maintenance stránky kingdom) */}
            <div className="relative h-[320px] self-start overflow-hidden rounded-2xl border border-white/10 bg-[#040308] shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:h-[400px] lg:h-[460px]">
              <HiranUniverseLazy className="absolute inset-0 h-full w-full" />
              <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100">
                <Sparkles className="h-2.5 w-2.5 text-zion-gold" />
                {tr('goldenEgg', 'visual_badge', lang)}
              </div>
            </div>

            {/* Right: content + živý chat */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200">
                      <Orbit className="h-3 w-3" />
                      {tx5(GoldenEggHaraniagharbaCopy.hiranHiranyagarbha, lang)}
                    </div>
                    <h2 className="mt-2 text-xl font-bold leading-tight text-white sm:text-2xl">
                      {tx5(GoldenEggHaraniagharbaCopy.hiranAsTheAiGatewayIntoTerraNo, lang)}
                    </h2>
                    <p className="mt-1 text-sm text-amber-100/80 max-w-2xl line-clamp-3">
                      {tr('goldenEgg', 'featured_body', lang)}
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
                </div>
              </div>

              {/* živé rozhraní Hiran chatu */}
              <div className="min-w-0">
                <HiranMiniChat lang={lang} defaultOpen />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
