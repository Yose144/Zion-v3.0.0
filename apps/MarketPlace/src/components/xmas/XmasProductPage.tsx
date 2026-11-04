'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Coins,
  Package,
  Quote,
  ShoppingCart,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import type { XmasProduct } from '@/data/christmasProducts';
import { useLangT } from '@/lib/useTranslation';
import ExperimentalNotice from '@/components/xmas/ExperimentalNotice';

/** Lehký renderer **tučného** inline markdownu v detailních odstavcích. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="text-white font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function XmasProductPage({ product }: { product: XmasProduct }) {
  const { t, lang } = useLangT();
  const pick = <T extends { cs: string; en: string }>(x: T) => (lang === 'cs' ? x.cs : x.en);
  const bonus = product.bonus.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');
  const price = t('common.price', { price: product.priceCzk, symbol: t('common.kcSymbol') });

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-rasta-gold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('xmasPage.back')}
      </Link>

      {/* Hero band */}
      <div className="zion-section overflow-hidden !p-0">
        <div className="relative aspect-[21/9] max-h-[420px]">
          <img
            src={product.image}
            alt={pick(product.imageAlt)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="rarity-badge rarity-legendary inline-flex items-center gap-1.5">
              <Snowflake className="w-3 h-3" /> {t('xmas.badge')}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="zion-kicker inline-flex items-center gap-2">{pick(product.kicker)}</div>
            <h1 className="text-3xl md:text-4xl font-black font-display mt-2">
              <span className="text-gradient-gold">{pick(product.title)}</span>
            </h1>
            <p className="text-sm md:text-base text-gray-300 italic mt-1 max-w-2xl">
              {pick(product.subtitle)}
            </p>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid lg:grid-cols-[1fr_minmax(0,340px)] gap-8">
        {/* Content */}
        <div className="space-y-6 min-w-0">
          <p className="text-base md:text-lg text-gray-200 leading-relaxed">{pick(product.intro)}</p>

          {product.details.map((d, i) => (
            <p key={i} className="text-sm md:text-[15px] text-gray-300 leading-relaxed">
              {renderInline(pick(d))}
            </p>
          ))}

          {/* Features */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
            {product.features.map((f) => (
              <span
                key={f.en}
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full"
              >
                <Sparkles className="w-3.5 h-3.5 text-rasta-gold" /> {pick(f)}
              </span>
            ))}
          </div>

          {/* Quotes (book) */}
          {product.quotes && product.quotes.length > 0 && (
            <div className="pt-4 space-y-4">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <Quote className="w-5 h-5 text-rasta-gold" />
                {t('xmasPage.quotesTitle')}
              </h2>
              {product.quotes.map((q, i) => (
                <figure
                  key={i}
                  className="border-l-2 border-rasta-gold/60 pl-4 py-1 space-y-1.5"
                >
                  <blockquote className="text-sm md:text-[15px] text-gray-200 italic leading-relaxed">
                    {lang === 'cs' ? q.cs : q.en}
                  </blockquote>
                  <figcaption className="text-xs text-gray-500">
                    — {pick(q.source)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          {/* Price box */}
          <div className="zion-section !p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                {t('xmasPage.priceLabel')}
              </div>
              <div className="font-mono text-3xl text-gradient-gold font-bold mt-1">{price}</div>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-rasta-gold/10 border border-rasta-gold/25 text-rasta-gold px-2.5 py-1 rounded-full text-xs font-semibold">
                <Coins className="w-3.5 h-3.5" /> {t('xmas.bonus', { amount: bonus })}
              </div>
            </div>

            {/* In the box */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5" /> {t('xmasPage.inBoxTitle')}
              </div>
              <ul className="space-y-1.5">
                {(lang === 'cs' ? product.inBox.cs : product.inBox.en).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-gray-300">
                    <Check className="w-3.5 h-3.5 text-rasta-green mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            {product.buyable ? (
              <Link
                href="/shop"
                className="zion-button-primary w-full inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" /> {t('xmasPage.buyInShop')}
              </Link>
            ) : (
              <span className="w-full inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-400">
                <ShoppingCart className="w-4 h-4" /> {t('xmasPage.comingSoon')}
              </span>
            )}

            {product.note && (
              <p className="text-[11px] text-gray-500 leading-relaxed">{pick(product.note)}</p>
            )}
          </div>

          <ExperimentalNotice />
        </aside>
      </div>
    </div>
  );
}
