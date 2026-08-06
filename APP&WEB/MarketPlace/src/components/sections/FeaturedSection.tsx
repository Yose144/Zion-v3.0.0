'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ItemCard, { type ArtifactCardData } from '@/components/ItemCard';
import { useLangT } from '@/lib/useTranslation';

const featured: ArtifactCardData[] = [
  { id: '1', name: 'Tree of Life Avatar', image: '', collection: 'OASIS Genesis', rarity: 'mythic', price: '2,500', listingType: 'fixed' },
  { id: '2', name: 'Warp Gate Key', image: '', collection: 'OASIS Quest', rarity: 'legendary', price: '800', listingType: 'fixed' },
  { id: '3', name: 'Galaxy Core Shard', image: '', collection: 'OASIS Genesis', rarity: 'epic', price: '350', listingType: 'fixed' },
  { id: '4', name: 'Ship HUD Mk-III', image: '', collection: 'OASIS Ships', rarity: 'rare', price: '120', listingType: 'fixed' },
];

export default function FeaturedSection() {
  const { t } = useLangT();
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {featured.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
