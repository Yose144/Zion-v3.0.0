'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ProductDef } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { useProduct } from '@/lib/use-products';
import { imageFit } from '@/lib/images';
import { ProductPrice } from '@/components/price';

export default function ProductCard({ product, priority = false }: { product: ProductDef; priority?: boolean }) {
  const { lang } = useLang();
  const live = useProduct(product.externalId);
  const inactive = live ? !live.active : false;
  const soldOut = live ? live.active && live.stock <= 0 : false;
  // Čtvercové rendery necháváme celé, široké fotky vyplní rám.
  const fit = imageFit(product.imageWidth, product.imageHeight);

  return (
    <Link
      href={`/kolekce/${product.slug}`}
      className="group card-warm flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-warm"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-parchment-deep">
        <img
          src={product.imageSmall ?? product.image}
          alt={pick(product.name, lang)}
          width={product.imageWidth}
          height={product.imageHeight}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={
            fit === 'contain'
              ? 'h-full w-full object-contain p-3 transition-transform duration-700 group-hover:scale-[1.03]'
              : 'h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]'
          }
        />
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink backdrop-blur">
            {pick(product.badge, lang)}
          </span>
        ) : null}
        {inactive ? (
          <span className="absolute right-3 top-3 rounded-full bg-forest px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-parchment">
            {pick({ cs: 'Připravujeme', en: 'Coming soon', de: 'In Vorbereitung' }, lang)}
          </span>
        ) : soldOut ? (
          <span className="absolute right-3 top-3 rounded-full bg-forest px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-parchment">
            {pick({ cs: 'Vyprodáno', en: 'Sold out', de: 'Ausverkauft' }, lang)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="h-display text-xl font-semibold leading-snug text-ink">{pick(product.name, lang)}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{pick(product.short, lang)}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <ProductPrice externalId={product.externalId} className="text-[0.95rem]" />
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors group-hover:border-ink/50 group-hover:bg-forest group-hover:text-parchment">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
