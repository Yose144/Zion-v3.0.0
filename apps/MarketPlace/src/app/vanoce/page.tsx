'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Coins, Snowflake } from 'lucide-react';
import { christmasProducts } from '@/data/christmasProducts';
import { useLangT } from '@/lib/useTranslation';

/**
 * Rozcestník vánoční edice (/vanoce).
 *
 * Detaily jsou samostatné stránky /vanoce/<slug>; bez téhle stránky vracel
 * holý /vanoce 404, i když na něj vedla část odkazů a je to přirozená URL
 * pro "co letos k Vánocům máte".
 */
export default function VanoceIndexPage() {
  const { t, lang } = useLangT();
  const pick = <T extends { cs: string; en: string }>(x: T) => (lang === 'cs' ? x.cs : x.en);

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-rasta-gold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('xmasPage.back')}
      </Link>

      <div className="zion-section text-center">
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-rasta-gold">
          <Snowflake className="w-4 h-4" />
          {lang === 'cs' ? 'Vánoční edice 2026 / 2027' : 'Christmas Edition 2026 / 2027'}
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-black text-gradient">
          {lang === 'cs' ? 'Dary z Království srdce' : 'Gifts from the Kingdom of Hearts'}
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-gray-300">
          {lang === 'cs'
            ? 'Tři dary, které drží pohromadě: vstup do světa, celá kniha a světlo na stůl. Každý nese ZION bonus.'
            : 'Three gifts that belong together: a way into the world, the whole book, and a light for the table. Each carries a ZION bonus.'}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {christmasProducts.map((product) => (
          <Link
            key={product.slug}
            href={`/vanoce/${product.slug}`}
            className="zion-rainbow-sub group overflow-hidden !p-0 flex flex-col"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={product.image}
                alt={pick(product.imageAlt)}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
              />
              {!product.buyable && (
                <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-wider text-rasta-gold">
                  {lang === 'cs' ? 'Připravujeme' : 'Coming soon'}
                </span>
              )}
            </div>

            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-rasta-gold">
                {pick(product.kicker)}
              </div>
              <h2 className="text-xl font-bold text-white">{pick(product.title)}</h2>
              <p className="text-sm text-gray-300 flex-1">{pick(product.subtitle)}</p>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-lg font-black text-white">
                  {t('common.price', { price: product.priceCzk, symbol: t('common.kcSymbol') })}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-rasta-gold">
                  <Coins className="w-3.5 h-3.5" />
                  {product.bonus.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')} ZION
                </span>
              </div>

              <span className="inline-flex items-center gap-1 text-sm text-rasta-gold">
                {lang === 'cs' ? 'Zobrazit detail' : 'View details'}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="zion-section text-center text-sm text-gray-400">
        {lang === 'cs'
          ? 'Všechny tři dary najdete i v běžném e-shopu — vánoční edice je jen jejich slavnostní vydání.'
          : 'All three are also in the regular shop — the Christmas edition is their festive release.'}{' '}
        <Link href="/shop" className="text-rasta-gold hover:underline">
          {lang === 'cs' ? 'Přejít do e-shopu' : 'Go to the shop'}
        </Link>
      </div>
    </div>
  );
}
