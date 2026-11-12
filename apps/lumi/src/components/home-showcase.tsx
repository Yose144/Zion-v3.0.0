'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Box, Check } from 'lucide-react';
import { COLLECTIONS, collectionImage } from '@/data/kolekce';
import { SITE } from '@/data/site';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import LumiViewer from '@/components/lumi-viewer';

/**
 * Homepage „Naše eso“: 3D model se načte sám (poster je vidět hned, model
 * dotáhne `LumiViewer` po idle) a pod ním jde přepnout motiv — všech šest
 * sad je postavených ze stejné výrobní geometrie, takže se mění jen výřezy.
 *
 * Remount přes `key` je záměr: po přepnutí motivu se vytvoří nový GLB, starý
 * renderer se uklidí (dispose v `LumiViewer`) a poster drží místo, aby obsah
 * neposkočil.
 */
export default function HomeShowcase() {
  const { lang } = useLang();
  const [slug, setSlug] = useState(COLLECTIONS[0].slug);
  const collection = COLLECTIONS.find((entry) => entry.slug === slug) ?? COLLECTIONS[0];
  const modelSlug = collection.productSlug.replace(/^lumi-2-/, '');
  const model = `/models/lumi-2-${modelSlug}.glb`;
  const name = pick(collection.name, lang);

  const facts = [
    { cs: '6 vyřezávaných stěn', en: '6 cut walls', de: '6 geschnittene Wände' },
    { cs: '140 × 126 × 121 mm', en: '140 × 126 × 121 mm', de: '140 × 126 × 121 mm' },
    { cs: '3mm březová překližka', en: '3 mm birch plywood', de: '3 mm Birkensperrholz' },
    { cs: 'Sestavení za 30 minut', en: 'Assembled in 30 minutes', de: 'In 30 Minuten aufgebaut' },
  ];

  return (
    <section id="nahled-3d" className="scroll-mt-24 bg-forest py-16 text-parchment lg:py-24">
      <div className="container-lumi grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="eyebrow text-amber-300">
            <Box className="h-3.5 w-3.5" /> {pick(SITE.viewer.kicker, lang)}
          </p>
          <h2 className="h2 mt-3 text-balance text-parchment">{pick(SITE.viewer.title, lang)}</h2>
          <p className="mt-4 text-base leading-relaxed text-parchment/75">{pick(SITE.viewer.text, lang)}</p>

          <ul className="mt-6 grid gap-2 text-sm text-parchment/80 sm:grid-cols-2">
            {facts.map((fact) => (
              <li key={fact.cs} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{pick(fact, lang)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/kolekce/${collection.productSlug}`} className="btn-amber">
              {pick(SITE.hero.ctaPrimary, lang)}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pruvodce"
              className="btn-outline border-parchment/30 text-parchment hover:border-parchment/60 hover:bg-parchment/10"
            >
              {pick({ cs: 'Jak se skládá', en: 'How to assemble', de: 'Aufbau' }, lang)}
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          <LumiViewer
            key={collection.slug}
            modelUrl={model}
            poster={collectionImage(collection.slug).image}
            tone="dark"
            autoLoad
          />

          <div className="mt-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-parchment/50">
              {pick(SITE.viewer.motifsLabel, lang)}
            </p>
            <ul className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
              {COLLECTIONS.map((entry) => {
                const active = entry.slug === collection.slug;
                const label = pick(entry.name, lang);
                return (
                  <li key={entry.slug} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSlug(entry.slug)}
                      aria-pressed={active}
                      aria-label={label}
                      title={label}
                      className={
                        active
                          ? 'flex w-[4.6rem] flex-col items-center gap-1 rounded-xl border border-amber-300/70 bg-parchment/10 p-1.5 text-amber-200'
                          : 'flex w-[4.6rem] flex-col items-center gap-1 rounded-xl border border-parchment/15 p-1.5 text-parchment/70 transition-colors hover:border-parchment/40 hover:bg-parchment/5'
                      }
                    >
                      <img
                        src={collectionImage(entry.slug).productThumb}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-14 rounded-lg object-contain"
                      />
                      <span className="truncate text-[11px] font-semibold">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-parchment/55">
              {pick(SITE.viewer.selectedNote, lang).replace('{name}', name)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
