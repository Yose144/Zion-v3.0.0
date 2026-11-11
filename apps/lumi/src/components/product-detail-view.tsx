'use client';

import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Package, Ruler, Clock3, Flame } from 'lucide-react';
import type { ProductDef } from '@/data/catalog';
import { PRODUCTS } from '@/data/catalog';
import { FAQ_ITEMS } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { useProduct } from '@/lib/use-products';
import ProductGallery from '@/components/product-gallery';
import BuyBox from '@/components/buy-box';
import LumiViewer from '@/components/lumi-viewer';
import FireSafetyBlock from '@/components/fire-safety-block';
import FaqAccordion from '@/components/faq-accordion';
import ProductCard from '@/components/product-card';
import ProductWalls from '@/components/product-walls';
import VariantSwitcher from '@/components/variant-switcher';

export default function ProductDetailView({ product }: { product: ProductDef }) {
  const { lang } = useLang();
  const live = useProduct(product.externalId);
  const related = PRODUCTS.filter((entry) => entry.externalId !== product.externalId).slice(0, 3);

  return (
    <div className="container-lumi py-10 lg:py-14">
      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">
          Lumi
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/kolekce" className="hover:text-ink">
          {pick({ cs: 'Kolekce', en: 'Collection', de: 'Kollektion' }, lang)}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink">{pick(product.name, lang)}</span>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0 space-y-6">
          <ProductGallery images={[product.image, ...product.gallery]} alt={product.name} lang={lang} />
          {product.model3d ? (
            <LumiViewer modelUrl={product.model3d} poster="/images/lumi-b/3d-poster-700.webp" />
          ) : null}
        </div>

        <div className="min-w-0">
          {product.badge ? (
            <span className="tag">{pick(product.badge, lang)}</span>
          ) : null}
          <h1 className="h2 mt-4 text-balance">{pick(product.name, lang)}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">{pick(product.short, lang)}</p>
          {product.disclaimer ? (
            <p className="mt-3 rounded-xl border border-amber-600/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-900">
              {pick(product.disclaimer, lang)}
            </p>
          ) : null}

          <div className="mt-7">
            <VariantSwitcher product={product} />
            <BuyBox product={product} />
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                <Package className="h-4 w-4" /> {pick({ cs: 'V balení', en: 'In the box', de: 'In der Box' }, lang)}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {product.includes.map((item) => (
                  <li key={item.cs} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{pick(item, lang)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                <Ruler className="h-4 w-4" /> {pick({ cs: 'Parametry', en: 'Details', de: 'Details' }, lang)}
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                {product.specs.map((spec) => (
                  <div key={spec.label.cs} className="flex justify-between gap-3 border-b border-line/70 pb-2 last:border-0">
                    <dt className="text-muted">{pick(spec.label, lang)}</dt>
                    <dd className="text-right font-medium text-ink">{pick(spec.value, lang)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-card/50 p-4 text-sm text-ink-soft">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>{pick(product.leadTime, lang)}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link href="/pruvodce" className="btn-ghost border border-line">
              {pick({ cs: 'Jak se skládá', en: 'How to assemble', de: 'Aufbau' }, lang)}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/doprava" className="btn-ghost border border-line">
              {pick({ cs: 'Doprava a vrácení', en: 'Shipping & returns', de: 'Versand & Rückgabe' }, lang)}
            </Link>
            <a href="#bezpecnost" className="btn-ghost border border-line">
              <Flame className="h-3.5 w-3.5" /> {pick({ cs: 'Bezpečnost', en: 'Safety', de: 'Sicherheit' }, lang)}
            </a>
            <Link href="/bezpecnost-produktu" className="btn-ghost border border-line">
              {pick({ cs: 'Informace GPSR', en: 'GPSR information', de: 'GPSR-Informationen' }, lang)}
            </Link>
          </div>
        </div>
      </div>

      <ProductWalls product={product} />

      <div className="mt-16 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <FireSafetyBlock />
          <div>
            <h2 className="h3">{pick({ cs: 'Časté otázky', en: 'Common questions', de: 'Häufige Fragen' }, lang)}</h2>
            <div className="mt-4">
              <FaqAccordion items={FAQ_ITEMS.slice(0, 4)} />
            </div>
          </div>
        </div>
        <aside className="rounded-2xl border border-line bg-card p-6">
          <h2 className="h3">{pick({ cs: 'Vyrábíme na zakázku', en: 'Made to order', de: 'Auf Bestellung' }, lang)}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {pick(
              {
                cs: 'Každý kus řežeme, brousíme a kontrolujeme u nás. Když potřebujete víc kusů na akci nebo logo, napište nám — připravíme nabídku s termínem.',
                en: 'Every piece is cut, sanded and checked by us. If you need more pieces for an event or your logo, write to us — we will prepare a quote with a date.',
                de: 'Jedes Stück wird von uns geschnitten, geschliffen und geprüft. Wenn Sie mehr Stücke für eine Veranstaltung oder Ihr Logo brauchen, schreiben Sie uns — wir erstellen ein Angebot mit Termin.',
              },
              lang,
            )}
          </p>
          <Link href="/firmy" className="btn-primary mt-5 w-full">
            {pick({ cs: 'Nezávazná poptávka', en: 'Send an enquiry', de: 'Unverbindliche Anfrage' }, lang)}
          </Link>
          {live && live.stock > 0 ? (
            <p className="mt-3 text-center text-xs text-muted">
              {pick({ cs: 'Skladem', en: 'In stock', de: 'Auf Lager' }, lang)}: {live.stock}
            </p>
          ) : null}
        </aside>
      </div>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="h3">{pick({ cs: 'Mohlo by se hodit', en: 'You may also like', de: 'Das könnte auch passen' }, lang)}</h2>
          <Link href="/kolekce" className="text-sm link-underline">
            {pick({ cs: 'Celá kolekce', en: 'Full collection', de: 'Ganze Kollektion' }, lang)}
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((entry) => (
            <ProductCard key={entry.externalId} product={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}
