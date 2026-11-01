'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCircle, Rocket, Swords, Map, Egg, Sparkles, type LucideIcon } from 'lucide-react';
import { type ArtifactCardData } from '@/components/ItemCard';
import { useLangT } from '@/lib/useTranslation';

// slug = real Artifact.category value so /explore?category=<slug> filters
// against actual DB rows (counts also come from /api/stats).
const categories: {
  nameKey: string;
  descKey: string;
  slug: string;
  icon: LucideIcon;
  rarity: ArtifactCardData['rarity'];
}[] = [
  { nameKey: 'categories.avatars', descKey: 'categories.avatarsDesc', slug: 'avatar', icon: UserCircle, rarity: 'unique' },
  { nameKey: 'categories.ships', descKey: 'categories.shipsDesc', slug: 'ship', icon: Rocket, rarity: 'legendary' },
  { nameKey: 'categories.questItems', descKey: 'categories.questItemsDesc', slug: 'quest_item', icon: Swords, rarity: 'epic' },
  { nameKey: 'categories.territory', descKey: 'categories.territoryDesc', slug: 'territory', icon: Map, rarity: 'rare' },
  { nameKey: 'categories.goldenEggs', descKey: 'categories.goldenEggsDesc', slug: 'golden_egg', icon: Egg, rarity: 'mythic' },
  { nameKey: 'categories.cosmetics', descKey: 'categories.cosmeticsDesc', slug: 'badge', icon: Sparkles, rarity: 'uncommon' },
];

const rarityColor: Record<ArtifactCardData['rarity'], string> = {
  common: '163, 163, 177',
  uncommon: '7, 137, 48',
  rare: '252, 209, 22',
  epic: '228, 30, 43',
  legendary: '252, 209, 22',
  mythic: '228, 30, 43',
  unique: '7, 137, 48',
};

export default function CategoriesSection() {
  const { t } = useLangT();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.categories) setCounts(data.categories); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">{t('categories.kicker')}</div>
        <h2 className="text-2xl font-black font-display text-gradient">{t('categories.title')}</h2>
        <div className="section-line flex-1" />
      </div>
      <div className="grid grid-cols-2 mobile-keep-cols sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.nameKey}
              href={`/explore?category=${cat.slug}`}
              className="zion-rainbow-sub group p-5 text-center"
              style={{ '--rc': rarityColor[cat.rarity] } as React.CSSProperties}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-6 h-6" style={{ color: `rgb(${rarityColor[cat.rarity]})` }} />
              </div>
              <div className="font-bold text-sm text-white mb-1">{t(cat.nameKey)}</div>
              <div className="text-[11px] text-gray-400 mb-3 leading-tight">{t(cat.descKey)}</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`rarity-badge rarity-${cat.rarity}`}>{t(`rarity.${cat.rarity}`)}</span>
                <span className="text-[10px] text-gray-500 font-mono">{counts[cat.slug] ?? '—'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
