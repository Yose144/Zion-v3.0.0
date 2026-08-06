'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, SearchX, Filter, Zap } from 'lucide-react';
import { getShopProducts, type ShopProductsFilters } from '@/lib/shop-api';
import type { ShopProductData } from '@/types/shop';
import { SHOP_CATEGORY_ORDER } from '@/data/shopProducts';
import ShopProductCard from '@/components/shop/ShopProductCard';
import ShopProductModal from '@/components/shop/ShopProductModal';
import { useLangT } from '@/lib/useTranslation';

const sortOptions = [
  { value: 'recent', key: 'shop.sortRecent' },
  { value: 'price_low', key: 'shop.sortPriceLow' },
  { value: 'price_high', key: 'shop.sortPriceHigh' },
];

export default function ShopPage() {
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState('recent');
  const [products, setProducts] = useState<ShopProductData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShopProductData | null>(null);
  const { t } = useLangT();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const filters: ShopProductsFilters = {
      sort: sort as ShopProductsFilters['sort'],
      page: 1,
      pageSize: 60,
    };
    if (category !== 'all') filters.category = category;

    getShopProducts(filters).then((res) => {
      if (cancelled) return;
      setProducts(res?.data ?? []);
      setTotal(res?.total ?? 0);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [category, sort]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="zion-kicker mb-3 inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> {t('shop.kicker')}
          </div>
          <h1 className="text-3xl font-black font-display mb-1">
            <span className="text-gradient-gold">{t('shop.title1')}</span>{' '}
            <span className="text-white">{t('shop.title2')}</span>
          </h1>
          <p className="text-sm text-gray-500">{t('shop.subtitle')}</p>
        </div>
        <a href="/cart" className="zion-button-secondary self-start">
          <Zap className="w-4 h-4" /> {t('shop.completePurchase')}
        </a>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="zion-section p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-rasta-gold" />
              {t('shop.categoriesTitle')}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setCategory('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  category === 'all'
                    ? 'bg-rasta-gold/20 text-white border border-rasta-gold/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                {t('shop.all')}
              </button>
              {SHOP_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    category === c
                      ? 'bg-rasta-gold/20 text-white border border-rasta-gold/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {t(`shop.${c}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="zion-section p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" /> {t('shop.sortTitle')}
            </h3>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-zion w-full"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-zion-card">{t(o.key)}</option>
              ))}
            </select>
          </div>
        </aside>

        {/* Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t('shop.productsCount', { count: total })}
            </span>
          </div>

          {loading ? (
            <div className="zion-section p-16 text-center">
              <div className="w-10 h-10 border-2 border-rasta-gold/30 border-t-rasta-gold rounded-full animate-spin mx-auto mb-4" />
              <div className="text-gray-500">{t('shop.loading')}</div>
            </div>
          ) : products.length === 0 ? (
            <div className="zion-section p-16 text-center">
              <SearchX className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <div className="text-gray-500 mb-1">{t('shop.empty')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product, i) => (
                <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                  <ShopProductCard product={product} onOpen={setSelected} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ShopProductModal product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
