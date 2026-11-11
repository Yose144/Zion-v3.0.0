'use client';

import { useEffect, useState } from 'react';
import { PRODUCTS } from '@/data/catalog';
import type { Lang } from '@/lib/i18n';

export interface ProductView {
  externalId: string;
  slug: string;
  priceCzk: number;
  oldPriceCzk?: number;
  stock: number;
  active: boolean;
  sortOrder: number;
}

let cache: ProductView[] | null = null;
let inflight: Promise<ProductView[]> | null = null;

async function loadProducts(): Promise<ProductView[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/products', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const data = Array.isArray(json?.data) ? (json.data as ProductView[]) : [];
        if (data.length > 0) cache = data;
        inflight = null;
        return data;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
  }
  return inflight;
}

function fallbackViews(): ProductView[] {
  return PRODUCTS.map((product) => ({
    externalId: product.externalId,
    slug: product.slug,
    priceCzk: product.priceCzk,
    oldPriceCzk: product.oldPriceCzk,
    stock: product.stock,
    active: product.active,
    sortOrder: product.sortOrder,
  }));
}

/** Prodejní data z DB; do načtení (nebo při výpadku) katalogové ceny. */
export function useProducts(): ProductView[] {
  const [views, setViews] = useState<ProductView[]>(() => cache ?? fallbackViews());

  useEffect(() => {
    let cancelled = false;
    loadProducts().then((data) => {
      if (!cancelled && data.length > 0) setViews(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return views;
}

export function useProduct(externalId: string): ProductView | undefined {
  const views = useProducts();
  return (
    views.find((view) => view.externalId === externalId) ??
    fallbackViews().find((view) => view.externalId === externalId)
  );
}

export function priceLabel(czk: number, lang: Lang): string {
  const locale = lang === 'cs' ? 'cs-CZ' : lang === 'de' ? 'de-DE' : 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(czk);
}
