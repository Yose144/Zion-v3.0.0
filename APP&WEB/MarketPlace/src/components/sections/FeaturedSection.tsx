'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ItemCard, { type ArtifactCardData } from '@/components/ItemCard';
import { getItems, type ItemsResponse } from '@/lib/market-api';
import { useLangT } from '@/lib/useTranslation';

export default function FeaturedSection() {
  const { t } = useLangT();
  const [featured, setFeatured] = useState<ArtifactCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getItems({ sort: 'recent', page: 1, pageSize: 4 }).then((res: ItemsResponse | null) => {
      if (cancelled) return;
      setFeatured(res?.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="zion-kicker">{t('featured.kicker')}</div>
          <h2 className="text-2xl font-black font-display text-gradient">{t('featured.title')}</h2>
        </div>
        <Link href="/explore" className="text-sm text-rasta-gold hover:underline font-semibold inline-flex items-center gap-1 group">
          {t('featured.viewAll')}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {loading ? (
        <div className="zion-section p-12 text-center">
          <div className="w-8 h-8 border-2 border-rasta-gold/30 border-t-rasta-gold rounded-full animate-spin mx-auto" />
        </div>
      ) : featured.length === 0 ? (
        <div className="zion-section p-8 text-center text-sm text-gray-500">
          {t('explore.emptyTitle')}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
