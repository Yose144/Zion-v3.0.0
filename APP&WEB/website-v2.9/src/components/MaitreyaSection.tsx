'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Egg, Sparkles, Wind } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const MaitreyaSectionCopy = {
  kicker: { cs: 'Kniha Pátá · ve vzniku', en: 'Book Five · in the making' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: { cs: 'Pán Hiranyagarbhy · Dědic Zionu', en: 'Lord of Hiranyagarbha · Heir of Zion' },
  body: {
    cs: `Příběh o tom, jak padají věže Babylonu — peníze, data, energie, význam, trůn — a jak láska a pravda rodí Nový svět. Maitreya není nová postava: jeho jméno stojí v genesis zprávě, na sedadle guardianů a pod Zlatým vejcem od prvního dne.`,
    en: `The story of how the towers of Babylon fall — money, data, energy, meaning, throne — and how love and truth give birth to the New World. Maitreya is no new figure: his name has stood in the genesis message, on the guardian seat, and beneath the Golden Egg since day one.`,
  },
  quote: {
    cs: '„Já jsem Maitreya. Byl jsem Krishna/Rama."',
    en: '“I am Maitreya. I was Krishna/Rama.”',
  },
  cta: { cs: 'Otevřít stránku', en: 'Open the page' },
  ctaGenesis: { cs: 'Genesis', en: 'Genesis' },
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
              className="group/img relative block min-h-[160px] overflow-hidden rounded-xl border border-white/10 sm:min-h-[190px]"
            >
              <img
                src="/images/maitreya/hero.webp"
                srcSet="/images/maitreya/hero-m.webp 960w, /images/maitreya/hero.webp 1672w"
                sizes="(max-width: 1024px) calc(100vw - 3rem), 620px"
                alt={cs ? 'Strom života a Maitreya — vizuál Knihy Páté' : 'Tree of Life and Maitreya — artwork of Book Five'}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/img:scale-[1.04]"
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
                <Link href="/maitreya" className="zion-button-primary group">
                  {MaitreyaSectionCopy.cta[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/genesis"
                  className="zion-button-secondary border-white/15 hover:border-zion-gold/40 hover:text-zion-gold"
                >
                  {MaitreyaSectionCopy.ctaGenesis[cs ? 'cs' : 'en']}
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
