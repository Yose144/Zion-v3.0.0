'use client';

import Link from 'next/link';
import type { ProductDef } from '@/data/catalog';
import { variantGroupLabel, variantSiblings } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { useProduct } from '@/lib/use-products';
import { ProductPrice } from '@/components/price';

/**
 * Přepínač motivů na detailu produktu. Kreslí se jen tehdy, když má
 * produkt ve skupině aspoň jednoho sourozence — samostatný produkt se
 * chová jako dřív. Pořadí drží `variantOrder` v katalogu.
 */
export default function VariantSwitcher({ product }: { product: ProductDef }) {
  const { lang } = useLang();
  const members = variantSiblings(product);
  if (members.length < 2) return null;

  const label =
    variantGroupLabel(product.variantGroup) ??
    ({ cs: 'Motiv', en: 'Motif', de: 'Motiv' } as const);

  return (
    <div className="mt-6">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{pick(label, lang)}</p>
      <ul className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={pick(label, lang)}>
        {members.map((member) => (
          <li key={member.externalId} className="shrink-0">
            <VariantChip product={member} current={member.externalId === product.externalId} lang={lang} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariantChip({ product, current, lang }: { product: ProductDef; current: boolean; lang: 'cs' | 'en' | 'de' }) {
  const live = useProduct(product.externalId);
  const soldOut = live ? live.stock <= 0 || !live.active : false;
  const name = product.motifName ? pick(product.motifName, lang) : pick(product.name, lang);

  const body = (
    <>
      <span
        className={
          current
            ? 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink/30 bg-parchment-deep'
            : 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-parchment-deep'
        }
      >
        <img
          src={product.imageSmall ?? product.image}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-left text-[0.82rem] font-semibold text-ink">{name}</span>
        <span className="mt-0.5 block text-left text-[0.7rem] text-muted">
          {soldOut ? (
            pick({ cs: 'Vyprodáno', en: 'Sold out', de: 'Ausverkauft' }, lang)
          ) : (
            <ProductPrice externalId={product.externalId} className="text-[0.7rem] text-muted" />
          )}
        </span>
      </span>
    </>
  );

  const base =
    'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors';

  if (current) {
    return (
      <span aria-current="page" className={`${base} border-ink/25 bg-card`}>
        {body}
      </span>
    );
  }

  return (
    <Link
      href={`/kolekce/${product.slug}`}
      className={`${base} border-line bg-card/40 hover:border-ink/25 hover:bg-card`}
    >
      {body}
    </Link>
  );
}
