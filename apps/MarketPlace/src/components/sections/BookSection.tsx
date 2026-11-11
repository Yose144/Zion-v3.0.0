'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ShoppingCart, Download, Coins, Sparkles, Check } from 'lucide-react';
import { getShopProducts } from '@/lib/shop-api';
import { useCart } from '@/components/shop/CartContext';
import type { ShopProductData } from '@/types/shop';
import { useLangT } from '@/lib/useTranslation';
import { getXmasProduct, type XmasText } from '@/data/christmasProducts';
import RichText from '@/components/xmas/RichText';
import FactsStrip from '@/components/xmas/FactsStrip';

const BOOK_EXTERNAL_ID = 'book-001';

export default function BookSection() {
  const { t, lang } = useLangT();
  const { add } = useCart();
  const [product, setProduct] = useState<ShopProductData | null>(null);
  const [added, setAdded] = useState(false);
  const xmas = getXmasProduct('kniha-kralovstvi-srdce');
  const pick = (x?: XmasText) => (x ? (lang === 'cs' ? x.cs : x.en) : '');
  const bullets = xmas?.home?.bullets.map((b) => pick(b)).filter(Boolean) ?? [];
  const firstSample = xmas?.samples?.[0];
  const sampleText = firstSample ? pick(firstSample.paragraphs[0]) : '';
  const excerpt = sampleText
    ? `„${sampleText.length > 320 ? `${sampleText.slice(0, 320).replace(/\s+\S*$/, '')}…` : sampleText}“`
    : '';
  const sampleLabel = firstSample ? pick(firstSample.label) : '';

  useEffect(() => {
    let cancelled = false;
    getShopProducts({ category: 'books', page: 1, pageSize: 10 }).then((res) => {
      if (cancelled) return;
      setProduct(res?.data.find((p) => p.externalId === BOOK_EXTERNAL_ID) ?? res?.data[0] ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const handleBuy = () => {
    if (!product || !product.inStock) return;
    if (add(product, 1)) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    }
  };

  return (
    <section>
      <div className="zion-section overflow-hidden !p-0">
        <div className="grid items-start xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          {/* Cover — 16:9 jako hero obrázky, aby se neroztahoval do vysokého pruhu */}
          <div className="relative flex items-start p-3 md:p-4">
            <div className="relative aspect-[16/9] xl:aspect-[4/3] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
              <img
                src={xmas?.hero ?? '/shop/img/books/kralovstvi-srdce-cover.webp'}
                alt="Království srdce — obálka knihy"
                loading="lazy"
                className="h-full w-full object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col justify-center xl:justify-start">
            <div className="zion-kicker inline-flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {t('book.kicker')}
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-display mt-3">
              <span className="text-gradient-gold">{t('book.title')}</span>
            </h2>
            <p className="text-sm text-gray-400 italic mt-1">{t('book.subtitle')}</p>
            <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-xl">
              <RichText text={pick(xmas?.home?.lead) || t('book.description')} />
            </p>

            {bullets.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[13px] text-gray-400">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rasta-gold" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {xmas?.facts && (
              <div className="mt-5">
                <FactsStrip facts={xmas.facts} compact />
              </div>
            )}

            {/* Ukázka z knihy — reálný text, ne anotace */}
            {excerpt && (
              <figure className="mt-5 border-l-2 border-rasta-gold/60 pl-4 space-y-1.5">
                <blockquote className="font-serif text-[15px] leading-relaxed text-gray-300 italic">
                  {excerpt}
                </blockquote>
                <figcaption className="text-[11px] text-gray-500">
                  {sampleLabel} ·{' '}
                  <Link href="/vanoce/kniha-kralovstvi-srdce#ukazky" className="text-rasta-gold hover:underline">
                    {t('xmasPage.readSample')}
                  </Link>
                </figcaption>
              </figure>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-5 text-[11px] text-gray-400">
              <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <BookOpen className="w-3.5 h-3.5" /> {t('book.format')}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <Download className="w-3.5 h-3.5" /> {t('book.delivery')}
              </span>
              {product && product.tokens > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-rasta-gold/10 border border-rasta-gold/25 text-rasta-gold px-2.5 py-1 rounded-full">
                  <Coins className="w-3.5 h-3.5" /> {t('book.tokens', { amount: product.tokens })}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-6">
              {product ? (
                <button
                  onClick={handleBuy}
                  disabled={!product.inStock}
                  className="zion-button-primary inline-flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {added
                    ? t('book.added')
                    : `${t('book.buy')} · ${t('common.price', { price: product.priceCzk, symbol: t('common.kcSymbol') })}`}
                </button>
              ) : (
                <Link href="/shop?category=books" className="zion-button-primary inline-flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> {t('book.buy')}
                </Link>
              )}
              <Link
                href="/vanoce/kniha-kralovstvi-srdce"
                className="text-sm text-rasta-gold hover:underline font-semibold"
              >
                {t('book.details')} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
