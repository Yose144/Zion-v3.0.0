'use client';

import { PRODUCTS } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { priceLabel, useProduct } from '@/lib/use-products';
import { cn } from '@/lib/utils';

/** Cena z hodnoty (košík, souhrn). */
export function Price({ value, className }: { value: number; className?: string }) {
  const { lang } = useLang();
  return <span className={className}>{priceLabel(value, lang)}</span>;
}

/** Cena produktu z živých dat (načte se po hydrataci). */
export function ProductPrice({ externalId, className }: { externalId: string; className?: string }) {
  const { lang } = useLang();
  const product = useProduct(externalId);
  const fallback = PRODUCTS.find((entry) => entry.externalId === externalId);
  const amount = product?.priceCzk ?? fallback?.priceCzk ?? 0;
  const old = product?.oldPriceCzk ?? fallback?.oldPriceCzk;
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className={old ? 'font-semibold text-amber-800' : 'font-semibold text-ink'}>
        {priceLabel(amount, lang)}
      </span>
      {old ? <s className="text-sm text-muted">{priceLabel(old, lang)}</s> : null}
    </span>
  );
}

/** Lokalizovaný text (pro pohodlí v komponentách). */
export function Pick({ text }: { text: Record<'cs' | 'en' | 'de', string> }) {
  const { lang } = useLang();
  return <>{pick(text, lang)}</>;
}

/** Cena jako text pro formuláře/atributy. */
export function usePriceText(): (czk: number) => string {
  const { lang } = useLang();
  return (czk: number) => priceLabel(czk, lang);
}
