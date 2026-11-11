'use client';

import Link from 'next/link';
import { ArrowRight, Download } from 'lucide-react';
import { GUIDE } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import FireSafetyBlock from '@/components/fire-safety-block';

export default function GuidePage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero
        kicker={GUIDE.kicker}
        title={GUIDE.title}
        lead={GUIDE.lead}
        compact
      >
        <a href={GUIDE.downloadHref} className="btn-primary" download>
          <Download className="h-4 w-4" /> {pick(GUIDE.download, lang)}
        </a>
        <Link href="/kolekce/lumi-2" className="btn-outline">
          {pick({ cs: 'Koupit Lumi 2', en: 'Buy Lumi 2', de: 'Lumi 2 kaufen' }, lang)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHero>

      <section className="container-lumi py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="space-y-6">
            <img
              src={GUIDE.image}
              alt={pick({ cs: 'Ilustrace sestavení lampionu Lumi', en: 'Illustration of the Lumi lantern assembly', de: 'Illustration des Lumi-Laternenaufbaus' }, lang)}
              width={900}
              height={900}
              loading="lazy"
              decoding="async"
              className="w-full rounded-2xl border border-line bg-white object-contain p-3"
            />
            <p className="text-xs leading-relaxed text-muted">{pick(GUIDE.note, lang)}</p>
            <div className="rounded-2xl border border-line bg-card p-6 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Tip: první dvě stěny jsou nejtěžší. Když je spojíte nasucho, zbytek jde rychle. Lepidlo nanášejte jen do drážek a hned vytékající přebytek setřete.',
                  en: 'Tip: the first two walls are the hardest. Once you dry-fit them, the rest goes quickly. Apply glue only into the grooves and wipe away any squeeze-out immediately.',
                  de: 'Tipp: Die ersten zwei Wände sind am schwierigsten. Wenn sie trocken passen, geht der Rest schnell. Leim nur in die Nuten geben und herausquellenden Leim sofort abwischen.',
                },
                lang,
              )}
            </div>
          </div>

          <ol className="space-y-6">
            {GUIDE.steps.map((step, index) => (
              <li key={step.title.cs} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">{pick(step.title, lang)}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pick(step.text, lang)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-lumi pb-20">
        <FireSafetyBlock />
      </section>
    </>
  );
}
