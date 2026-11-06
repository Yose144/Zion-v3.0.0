'use client';

import Link from 'next/link';
import { ArrowRight, Coins, Gift, ShoppingBag, Sparkles } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import {
  CAMPAIGN_ENDS_AT,
  CHRISTMAS_EDITION_PRODUCTS,
  SHOP_NEWS,
  ZION_PER_CZK,
  bonusFor,
  type ShopNewsText,
} from '@/data/shopNews';

/**
 * Novinky pod hero na homepage.
 *
 * Co tu je a proč zrovna tohle:
 *  1. **Market je otevřený** — dřív to říkal varovný pruh „ve výstavbě“.
 *     Otevřený obchod je novinka, ne omluva.
 *  2. **Tři vánoční kusy s cenou a bonusem** — člověk vidí celou edici
 *     na jednom místě, nemusí proklikávat tři stránky.
 *  3. **Kampaň do Vánoc** — sazba a termín z `src/data/shopNews.ts`;
 *     bonusy se počítají z ceny, takže se s kampaní nemůžou rozejít.
 *
 * Sekce se nevykreslí, když je seznam produktů prázdný (kampaň skončila /
 * edice se ruší) — prázdná mřížka pod hero by vypadala jako chyba.
 */
export default function ShopNews() {
  const { lang } = useLangT();
  const pick = (text: ShopNewsText) => (lang === 'cs' ? text.cs : text.en);

  const products = CHRISTMAS_EDITION_PRODUCTS;
  if (products.length === 0) return null;

  const until = new Date(CAMPAIGN_ENDS_AT).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  return (
    <section aria-labelledby="shop-news" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="zion-kicker inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {pick(SHOP_NEWS.kicker)}
          </div>
          <h2 id="shop-news" className="text-xl md:text-2xl font-black font-display mt-2">
            <span className="text-gradient-gold">{pick(SHOP_NEWS.until)}</span>
          </h2>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1 text-sm text-rasta-gold hover:underline"
        >
          {pick(SHOP_NEWS.allProducts)}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* ── Market je otevřený ─────────────────────────────────────── */}
        <article className="flex flex-col rounded-2xl border border-rasta-green/30 bg-rasta-green/[0.06] p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rasta-green/40 bg-rasta-green/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rasta-green">
              <ShoppingBag className="w-3 h-3" /> {lang === 'cs' ? 'Otevřeno' : 'Open'}
            </span>
          </div>
          <h3 className="text-base font-black font-display text-white">{pick(SHOP_NEWS.openTitle)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{pick(SHOP_NEWS.openBody)}</p>
          <Link
            href="/shop"
            className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-rasta-gold hover:underline"
          >
            {pick(SHOP_NEWS.openCta)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </article>

        {/* ── Tři vánoční kusy ───────────────────────────────────────── */}
        <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="flex items-center gap-2 text-base font-black font-display text-white">
            <Gift className="h-4 w-4 text-rasta-gold" />
            {pick(SHOP_NEWS.productsTitle)}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{pick(SHOP_NEWS.productsBody)}</p>
          <ul className="mt-3 divide-y divide-white/5">
            {products.map((product) => (
              <li key={product.externalId} className="py-2">
                {product.buyable ? (
                  <Link href={product.href} className="group flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-200 group-hover:text-rasta-gold">
                        {pick(product.name)}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {product.priceCzk} {lang === 'cs' ? 'Kč' : 'CZK'} · +{bonusFor(product.priceCzk).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')} ZION
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-rasta-gold" />
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-300">{pick(product.name)}</span>
                      <span className="text-[11px] text-gray-500">
                        {product.priceCzk} {lang === 'cs' ? 'Kč' : 'CZK'} · +{bonusFor(product.priceCzk).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')} ZION
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {product.note ? pick(product.note) : lang === 'cs' ? 'Brzy' : 'Soon'}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>

        {/* ── Kampaň do Vánoc ────────────────────────────────────────── */}
        <article className="flex flex-col rounded-2xl border border-rasta-gold/35 bg-rasta-gold/[0.07] p-5">
          <h3 className="flex items-center gap-2 text-base font-black font-display text-white">
            <Coins className="h-4 w-4 text-rasta-gold" />
            {pick(SHOP_NEWS.campaignTitle)}
          </h3>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-display text-gradient-gold">{ZION_PER_CZK}</span>
            <span className="text-sm font-bold text-rasta-gold">{pick(SHOP_NEWS.campaignUnit)}</span>
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-500">{pick(SHOP_NEWS.campaignLead)}</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{pick(SHOP_NEWS.campaignBody)}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <span className="rounded-full border border-rasta-gold/30 bg-rasta-gold/10 px-2.5 py-1 text-[11px] font-bold text-rasta-gold">
              {lang === 'cs' ? `do ${until}` : `until ${until}`}
            </span>
            <Link
              href="/vanoce"
              className="inline-flex items-center gap-1 text-sm font-bold text-rasta-gold hover:underline"
            >
              {pick(SHOP_NEWS.campaignCta)}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
