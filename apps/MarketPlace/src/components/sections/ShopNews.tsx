'use client';

import Link from 'next/link';
import { ArrowRight, Coins, Gift, ShoppingBag, Sparkles } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import {
  CAMPAIGN_ENDS_AT,
  CHRISTMAS_EDITION_PRODUCTS,
  SHOP_NEWS,
  SHOP_NEWS_IMAGES,
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
 *  2. **Tři vánoční kusy s obrázkem, cenou a bonusem** — dlaždice používají
 *     **stejné obrázky jako karty v e-shopu**, takže novinka slibuje přesně to,
 *     co člověk najde po kliknutí (u lampionu render skutečného modelu Lumi 2).
 *  3. **Kampaň do Vánoc** — sazba a termín z `src/data/shopNews.ts`; bonusy
 *     se počítají z ceny, takže se s kampaní nemůžou rozejít.
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
  const kc = lang === 'cs' ? 'Kč' : 'CZK';
  const number = (value: number) => value.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');

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
        <article className="flex flex-col overflow-hidden rounded-2xl border border-rasta-green/30 bg-rasta-green/[0.06]">
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={SHOP_NEWS_IMAGES.market.src}
              alt={pick(SHOP_NEWS_IMAGES.market.alt)}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-rasta-green/50 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rasta-green backdrop-blur-sm">
              <ShoppingBag className="w-3 h-3" /> {lang === 'cs' ? 'Otevřeno' : 'Open'}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <h3 className="text-base font-black font-display text-white">{pick(SHOP_NEWS.openTitle)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{pick(SHOP_NEWS.openBody)}</p>
            <Link
              href="/shop"
              className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-rasta-gold hover:underline"
            >
              {pick(SHOP_NEWS.openCta)}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </article>

        {/* ── Tři vánoční kusy (dlaždice s obrázkem produktu) ────────── */}
        <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="flex items-center gap-2 text-base font-black font-display text-white">
            <Gift className="h-4 w-4 text-rasta-gold" />
            {pick(SHOP_NEWS.productsTitle)}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{pick(SHOP_NEWS.productsBody)}</p>

          {/* `mobile-keep-cols`: globální mobile-safety pravidlo v globals.css jinak
              srovná každý `grid-cols-3` na jednu kolonu — tady jsou tři malé
              náhledy vedle sebe záměr (a vejdou se i na 390 px). */}
          <div className="mt-3 grid flex-1 grid-cols-3 gap-2 mobile-keep-cols">
            {products.map((product) => {
              const tile = (
                <>
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    <img
                      src={product.image}
                      alt={pick(product.imageAlt)}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {!product.buyable && (
                      <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-center text-[9px] uppercase tracking-wider text-gray-300">
                        {product.note ? pick(product.note) : lang === 'cs' ? 'Brzy' : 'Soon'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold leading-tight text-gray-200 group-hover:text-rasta-gold">
                    {pick(product.name)}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {number(product.priceCzk)} {kc}
                  </div>
                  <div className="text-[10px] font-bold text-rasta-gold">
                    +{number(bonusFor(product.priceCzk))} ZION
                  </div>
                </>
              );

              return product.buyable ? (
                <Link key={product.externalId} href={product.href} className="group flex flex-col">
                  {tile}
                </Link>
              ) : (
                <div key={product.externalId} className="group flex cursor-default flex-col">
                  {tile}
                </div>
              );
            })}
          </div>

          <Link
            href="/vanoce"
            className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-rasta-gold hover:underline"
          >
            {pick(SHOP_NEWS.editionCta)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </article>

        {/* ── Kampaň do Vánoc ────────────────────────────────────────── */}
        <article className="flex flex-col overflow-hidden rounded-2xl border border-rasta-gold/35 bg-rasta-gold/[0.07]">
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={SHOP_NEWS_IMAGES.campaign.src}
              alt={pick(SHOP_NEWS_IMAGES.campaign.alt)}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-rasta-gold/50 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rasta-gold backdrop-blur-sm">
              <Coins className="h-3 w-3" /> {pick(SHOP_NEWS.campaignTitle)}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-display text-gradient-gold">{ZION_PER_CZK}</span>
              <span className="text-sm font-bold text-rasta-gold">{pick(SHOP_NEWS.campaignUnit)}</span>
              <span className="text-xs uppercase tracking-wider text-gray-500">{pick(SHOP_NEWS.campaignLead)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{pick(SHOP_NEWS.campaignBody)}</p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <span className="rounded-full border border-rasta-gold/30 bg-rasta-gold/10 px-2.5 py-1 text-[11px] font-bold text-rasta-gold">
                {lang === 'cs' ? `do ${until}` : `until ${until}`}
              </span>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1 text-sm font-bold text-rasta-gold hover:underline"
              >
                {pick(SHOP_NEWS.shopCta)}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
