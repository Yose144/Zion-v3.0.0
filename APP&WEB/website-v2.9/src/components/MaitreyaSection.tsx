'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Egg, Gamepad2, Sparkles, Sun, Wind } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const MaitreyaSectionCopy = {
  kicker: { cs: 'Kniha Pátá · kompletní · CZ + EN', en: 'Book Five · complete · CZ + EN' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: { cs: 'Pán Hiranyagarbhy · Dědic Zionu', en: 'Lord of Hiranyagarbha · Heir of Zion' },
  body: {
    cs: 'Maitreya, Nirvana a šest hlavních knih na jedné mapě. Začni číst, projdi související příběhy nebo otevři plán v3.3 — ten je vývojovým cílem, ne hotovým vydáním.',
    en: 'Maitreya, Nirvana and the six main books on one map. Start reading, explore the related stories or open the v3.3 plan — a development goal, not a completed release.',
  },
  quote: {
    cs: '„Já jsem Maitreya, zrodil jsem se z Hiranyagarbhy. Byl jsem pasáček krav s flétnou, i princ ve vyhnanství, a také tesař, který postavil loď, které říkal království srdce."',
    en: '“I am Maitreya, born of Hiranyagarbha. I was a cowherd boy with a flute, and a prince in exile, and also a carpenter who built a boat he called the kingdom of the heart.”',
  },
  nirvanaBadge: { cs: 'Kniha Západu — Nirvana', en: 'Book of the West — Nirvana' },
  ctaHub: { cs: 'Knihovna & cesta', en: 'Library & the path' },
  cta: { cs: 'Číst knihu', en: 'Read the book' },
  ctaPlan: { cs: 'Plán 3.3', en: 'The 3.3 plan' },
  ctaGame: { cs: 'Hrát OASIS', en: 'Play OASIS' },
};

export default function MaitreyaSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="px-4 pb-8 pt-1 sm:pb-10">
      <div className="zion-container">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="zion-rainbow-card relative overflow-hidden"
          style={{ '--rc': '168, 85, 247' } as CSSProperties}
        >
          {/* ambient glows */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-zion-purple/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-zion-gold/10 blur-3xl" />

          <div className="relative grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch">
            {/* artwork panel */}
            <Link
              href="/maitreya"
              className="group/img relative block aspect-[16/9] overflow-hidden rounded-xl border border-white/10 lg:aspect-auto lg:h-full"
            >
              <img
                src="/images/maitreya/hero.webp"
                srcSet="/images/maitreya/hero-m.webp 960w, /images/maitreya/hero.webp 1536w"
                sizes="(max-width: 1024px) calc(100vw - 3rem), 620px"
                alt={cs ? 'Oasis — jedna rodina pod Stromem života, vizuál Knihy Páté' : 'Oasis — one family under the Tree of Life, artwork of Book Five'}
                loading="lazy"
                decoding="async"
                width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/img:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-zion-gold" />
                {cs ? 'Nový příběh' : 'New story'}
              </div>
            </Link>

            {/* copy */}
            <div className="flex flex-col justify-center gap-3 p-4 sm:p-5 lg:py-6 lg:pr-6 lg:pl-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="zion-kicker border-zion-purple/30 bg-zion-purple/10 text-zion-purple">
                  <Egg className="h-3.5 w-3.5" />
                  {MaitreyaSectionCopy.kicker[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-kicker border-zion-cyan/25 bg-zion-cyan/10 text-zion-cyan">
                  <Wind className="h-3.5 w-3.5" />
                  {cs ? 'Element vzduchu' : 'The element of air'}
                </span>
                <Link
                  href="/nirvana/cist"
                  className="zion-kicker border-amber-400/25 bg-amber-400/10 text-amber-300 transition-colors hover:border-amber-400/50"
                >
                  <Sun className="h-3.5 w-3.5" />
                  {MaitreyaSectionCopy.nirvanaBadge[cs ? 'cs' : 'en']}
                </Link>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  <span className="text-gradient">{MaitreyaSectionCopy.title[cs ? 'cs' : 'en']}</span>
                </h2>
                <p className="mt-1.5 text-sm font-semibold text-zion-gold/90 sm:text-base">
                  {MaitreyaSectionCopy.subtitle[cs ? 'cs' : 'en']}
                </p>
              </div>

              <p className="max-w-xl text-xs leading-relaxed text-gray-300 sm:text-sm">
                {MaitreyaSectionCopy.body[cs ? 'cs' : 'en']}
              </p>

              <p className="text-xs italic text-zion-purple/90 sm:text-sm">
                {MaitreyaSectionCopy.quote[cs ? 'cs' : 'en']}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <Link href="/maitreya#cesta" prefetch={false} className="zion-button-primary group">
                  {MaitreyaSectionCopy.ctaHub[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/maitreya/cist"
                  prefetch={false}
                  className="zion-button-secondary border-white/15 hover:border-zion-purple/40 hover:text-zion-purple"
                >
                  {MaitreyaSectionCopy.cta[cs ? 'cs' : 'en']}
                </Link>
                <Link
                  href="/maitreya#plan-v33"
                  prefetch={false}
                  className="zion-button-secondary border-white/15 hover:border-zion-gold/40 hover:text-zion-gold"
                >
                  {MaitreyaSectionCopy.ctaPlan[cs ? 'cs' : 'en']}
                </Link>
                <a
                  href="https://oasis.zionterranova.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary border-white/15 hover:border-zion-cyan/50 hover:text-zion-cyan"
                >
                  <Gamepad2 className="h-4 w-4" />
                  {MaitreyaSectionCopy.ctaGame[cs ? 'cs' : 'en']}
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
