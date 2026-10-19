'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Flower, Heart, Leaf, Sparkles, Sun, Users } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const Copy = {
  kicker: { cs: 'Jedna rodina pod Stromem života', en: 'One family under the Tree of Life' },
  title: { cs: 'Vítej v Oasis', en: 'Welcome to Oasis' },
  tagline: {
    cs: 'One World · One Family · Infinite Possibilities',
    en: 'One World · One Family · Infinite Possibilities',
  },
  body: {
    cs: 'Svět, kde se setkávají všechny cesty — Maitreya, Krišna s flétnou, tesař i děti nové země. Láska, mír, poznání, svoboda, hojnost — společně.',
    en: 'A world where every path meets — Maitreya, Krishna with his flute, the carpenter and the children of the new earth. Love, peace, knowledge, freedom, abundance — together.',
  },
  values: {
    cs: ['Láska', 'Mír', 'Poznání', 'Svoboda', 'Hojnost', 'Společně'],
    en: ['Love', 'Peace', 'Knowledge', 'Freedom', 'Abundance', 'Together'],
  },
  cta: { cs: 'Vstoupit do Oasis', en: 'Enter Oasis' },
  imgAlt: {
    cs: 'Oasis — jedna rodina pod Stromem života',
    en: 'Oasis — one family under the Tree of Life',
  },
};

export default function WelcomeOasisSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="px-4 pb-8 sm:pb-10" aria-labelledby="welcome-oasis-title">
      <div className="zion-container">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="zion-rainbow-card relative overflow-hidden"
          style={{ '--rc': '251, 191, 36' } as CSSProperties}
        >
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-zion-gold/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
            {/* artwork */}
            <Link
              href="/l4-oasis"
              className="group/img relative block aspect-[3/2] overflow-hidden rounded-xl border border-white/10 lg:aspect-auto lg:h-full lg:min-h-[280px]"
            >
              <img
                src="/images/maitreya/hero.webp"
                srcSet="/images/maitreya/hero-m.webp 960w, /images/maitreya/hero.webp 1536w"
                sizes="(max-width: 1024px) calc(100vw - 3rem), 700px"
                alt={Copy.imgAlt[cs ? 'cs' : 'en']}
                loading="lazy"
                decoding="async"
                width={1536}
                height={1024}
                className="absolute inset-0 h-full w-full object-cover object-[50%_30%] transition-transform duration-700 group-hover/img:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100 backdrop-blur-sm">
                <Sun className="h-3 w-3 text-zion-gold" />
                OASIS
              </div>
            </Link>

            {/* text */}
            <div className="flex flex-col justify-center gap-3.5">
              <p className="zion-kicker w-fit text-[11px]">
                <Flower className="h-3.5 w-3.5" />
                {Copy.kicker[cs ? 'cs' : 'en']}
              </p>
              <h2 id="welcome-oasis-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {Copy.title[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zion-gold">
                {Copy.tagline[cs ? 'cs' : 'en']}
              </p>
              <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
                {Copy.body[cs ? 'cs' : 'en']}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {Copy.values[cs ? 'cs' : 'en'].map((v, i) => (
                  <li
                    key={v}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75"
                  >
                    {i % 3 === 0 ? <Heart className="h-3 w-3 text-rose-300" /> : i % 3 === 1 ? <Leaf className="h-3 w-3 text-emerald-300" /> : <Users className="h-3 w-3 text-cyan-300" />}
                    {v}
                  </li>
                ))}
              </ul>
              <div className="pt-1">
                <Link
                  href="/l4-oasis"
                  className="zion-button-primary inline-flex items-center gap-2 text-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  {Copy.cta[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
