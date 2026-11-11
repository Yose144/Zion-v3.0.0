'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PRODUCTS, variantGroupLabel, variantGroupNote, variantMembers } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import ProductCard from '@/components/product-card';

export default function CollectionPage() {
  const { lang } = useLang();
  const lampions = PRODUCTS.filter((product) => product.category === 'lampiony' && !product.variantGroup);
  const extras = PRODUCTS.filter((product) => product.category === 'doplnky');

  // Skupiny motivů bereme z dat, ne z ručního seznamu — produkt, který má
  // `variantGroup`, se v kolekci nikdy neztratí, i když popisek chybí.
  const groups = Array.from(new Set(PRODUCTS.map((product) => product.variantGroup).filter(Boolean) as string[]))
    .map((id) => ({
      id,
      label: variantGroupLabel(id) ?? PRODUCTS.find((product) => product.variantGroup === id)!.name,
      note: variantGroupNote(id),
      members: variantMembers(id),
    }))
    .filter((group) => group.members.length > 0);

  return (
    <div className="container-lumi py-12 lg:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">{pick({ cs: 'Kolekce', en: 'Collection', de: 'Kollektion' }, lang)}</p>
        <h1 className="h1 mt-4 text-balance">
          {pick({ cs: 'Tři velikosti, jedna dílna', en: 'Three sizes, one workshop', de: 'Drei Größen, eine Werkstatt' }, lang)}
        </h1>
        <p className="lead mt-5">
          {pick(
            {
              cs: 'Hlavní lampion pro stůl, menší Mini pro výslužku a stavebnice pro ty, kdo chtějí tvořit. Všechny z 3mm březové překližky, všechny se svíčkou ve sklenici.',
              en: 'The main lantern for the table, a smaller Mini for favours and a kit for those who want to make it themselves. All from 3 mm birch plywood, all with a candle in a glass.',
              de: 'Die Hauptlaterne für den Tisch, eine kleinere Mini für Gastgeschenke und ein Bausatz für alle, die selbst gestalten wollen. Alle aus 3 mm Birkensperrholz, alle mit einer Kerze im Glas.',
            },
            lang,
          )}
        </p>
      </div>

      <section className="mt-12">
        <h2 className="h3">{pick({ cs: 'Lampiony', en: 'Lanterns', de: 'Laternen' }, lang)}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lampions.map((product, index) => (
            <ProductCard key={product.externalId} product={product} priority={index === 0} />
          ))}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="mt-12">
          <h2 className="h3">{pick(group.label, lang)}</h2>
          {group.note ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{pick(group.note, lang)}</p> : null}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((product) => (
              <ProductCard key={product.externalId} product={product} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-14">
        <h2 className="h3">{pick({ cs: 'Doplňky', en: 'Extras', de: 'Extras' }, lang)}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map((product) => (
            <ProductCard key={product.externalId} product={product} />
          ))}
        </div>
      </section>

      <section className="mt-16 overflow-hidden rounded-[2rem] border border-line bg-card">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 sm:p-12">
            <p className="eyebrow">{pick({ cs: 'Více kusů', en: 'More pieces', de: 'Mehr Stücke' }, lang)}</p>
            <h2 className="h2 mt-3">{pick({ cs: 'Svatba, firma nebo hotel?', en: 'A wedding, a company or a hotel?', de: 'Hochzeit, Firma oder Hotel?' }, lang)}</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Od 10 kusů sleva 10 %, od 30 kusů 15 %. Personalizace jmen, data i loga. Vzorek vám pošleme na vyzkoušení.',
                  en: 'From 10 pieces 10% off, from 30 pieces 15%. Personalisation with names, dates and logos. We will send a sample to try.',
                  de: 'Ab 10 Stück 10 %, ab 30 Stück 15 %. Personalisierung mit Namen, Datum und Logo. Wir senden ein Muster zum Ausprobieren.',
                },
                lang,
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/svatby" className="btn-primary">
                {pick({ cs: 'Svatby a eventy', en: 'Weddings & events', de: 'Hochzeiten & Events' }, lang)}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/firmy" className="btn-outline">
                {pick({ cs: 'Pro firmy', en: 'For companies', de: 'Für Unternehmen' }, lang)}
              </Link>
            </div>
          </div>
          <div className="relative min-h-[240px]">
            <img src="/images/lumi-b/firmy-4x3.webp" alt="" width={960} height={720} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </section>
    </div>
  );
}
