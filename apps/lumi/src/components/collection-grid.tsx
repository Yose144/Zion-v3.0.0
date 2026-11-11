'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COLLECTIONS, collectionImage } from '@/data/kolekce';
import { SITE } from '@/data/site';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import Reveal from '@/components/reveal';
import SectionHeading from '@/components/section-heading';

/**
 * Šest motivových kolekcí (Engine B, sada v2).
 *
 * Karty mají připravený poměr 4:3 — `object-cover` na 960×720 nic neořezává.
 * Obrázky jsou marketingové ilustrace; odkazy míří na reálné produkty
 * v katalogu, takže žádná karta neslibuje neexistující zboží.
 */
export default function CollectionGrid() {
  const { lang } = useLang();

  return (
    <section className="border-y border-line bg-parchment-deep/60 py-16 lg:py-24">
      <div className="container-lumi">
        <SectionHeading kicker={SITE.collections.kicker} title={SITE.collections.title} lead={SITE.collections.lead} lang={lang} />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((collection, index) => (
            <Reveal key={collection.slug} delay={index * 70}>
              <Link
                href={`/kolekce/${collection.productSlug}`}
                className="group block overflow-hidden rounded-2xl border border-line bg-card transition-shadow hover:shadow-warm"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={collectionImage(collection.slug).imageSmall}
                    srcSet={`${collectionImage(collection.slug).imageSmall} 640w, ${collectionImage(collection.slug).image} 960w`}
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 90vw"
                    alt={pick(collection.alt, lang)}
                    width={960}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5">
                  <h3 className="h-display text-lg font-semibold text-ink">{pick(collection.name, lang)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pick(collection.note, lang)}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-800">
                    {pick(SITE.collections.cta, lang)}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">{pick(SITE.collections.note, lang)}</p>
      </div>
    </section>
  );
}
