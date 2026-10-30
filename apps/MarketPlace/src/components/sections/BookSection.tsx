'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ShoppingCart, Download, Coins, Sparkles } from 'lucide-react';
import { getShopProducts } from '@/lib/shop-api';
import { useCart } from '@/components/shop/CartContext';
import type { ShopProductData } from '@/types/shop';
import { useLangT } from '@/lib/useTranslation';

const BOOK_EXTERNAL_ID = 'book-001';

export default function BookSection() {
  const { t } = useLangT();
  const { add } = useCart();
  const [product, setProduct] = useState<ShopProductData | null>(null);
  const [added, setAdded] = useState(false);

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
        <div className="grid md:grid-cols-[minmax(0,340px)_1fr]">
          {/* Cover */}
          <div className="relative aspect-square md:aspect-auto md:min-h-[380px]">
            <img
              src="/shop/img/books/kralovstvi-srdce-cover.webp"
              alt="Království srdce — obálka knihy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/25" />
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <div className="zion-kicker inline-flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {t('book.kicker')}
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-display mt-3">
              <span className="text-gradient-gold">{t('book.title')}</span>
            </h2>
            <p className="text-sm text-gray-400 italic mt-1">{t('book.subtitle')}</p>
            <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-xl">
              {t('book.description')}
            </p>

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
                href="/shop?category=books"
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
