'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { STORY } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { imageVariant } from '@/lib/images';
import PageHero from '@/components/page-hero';
import SectionHeading from '@/components/section-heading';
import Reveal from '@/components/reveal';

export default function StoryPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero
        kicker={STORY.kicker}
        title={STORY.title}
        lead={STORY.lead}
        image={STORY.image}
        imageAlt={{ cs: 'Příběh lampionu a dílny', en: 'The story of the lantern and the workshop', de: 'Die Geschichte der Laterne und der Werkstatt' }}
      >
        <Link href="/kolekce" className="btn-primary">
          {pick({ cs: 'Prohlédnout kolekci', en: 'See the collection', de: 'Kollektion ansehen' }, lang)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHero>

      <div className="container-lumi pt-5">
        <p className="text-xs leading-relaxed text-muted">{pick(STORY.note, lang)}</p>
      </div>

      <section className="container-lumi py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="space-y-8">
            {STORY.chapters.map((chapter, index) => (
              <Reveal key={chapter.title.cs} delay={index * 60}>
                <article className="border-l-2 border-amber-600/30 pl-5">
                  <h2 className="h3">{pick(chapter.title, lang)}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(chapter.text, lang)}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="space-y-4">
            <img
              src="/images/lumi-b/brana.webp"
              srcSet={`${imageVariant('/images/lumi-b/brana.webp', 640)} 640w, /images/lumi-b/brana.webp 1672w`}
              sizes="(min-width: 1024px) 600px, 90vw"
              alt={pick({ cs: 'Světlo u brány', en: 'Light at the gate', de: 'Licht am Tor' }, lang)}
              width={1672}
              height={941}
              loading="lazy"
              decoding="async"
              className="w-full rounded-2xl border border-line object-cover"
            />
            <div className="grid grid-cols-2 gap-4">
              <img
                src="/images/lumi-b/3d-konstrukce.webp"
                alt={pick({ cs: 'Ilustrace konstrukce lampionu', en: 'Illustration of the lantern construction', de: 'Illustration der Laternenkonstruktion' }, lang)}
                width={900}
                height={900}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-2xl border border-line object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-parchment-deep/60 py-16">
        <div className="container-lumi">
          <SectionHeading kicker={{ cs: 'Hodnoty', en: 'Values', de: 'Werte' }} title={STORY.valuesTitle} lang={lang} />
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {STORY.values.map((value) => (
              <div key={value.title.cs} className="card-warm p-6">
                <h3 className="text-base font-semibold text-ink">{pick(value.title, lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(value.text, lang)}</p>
              </div>
            ))}
          </div>
          <p className="h-display mx-auto mt-14 max-w-3xl text-center text-xl font-medium leading-snug text-ink sm:text-2xl">
            {pick(STORY.closing, lang)}
          </p>
        </div>
      </section>
    </>
  );
}
