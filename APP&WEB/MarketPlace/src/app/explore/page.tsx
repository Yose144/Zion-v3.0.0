'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Globe, Zap, Gavel, SearchX } from 'lucide-react';
import ItemCard, { type ArtifactCardData, type Rarity } from '@/components/ItemCard';
import { getItems, type ItemsFilters, type ItemsResponse } from '@/lib/market-api';
import { useLangT } from '@/lib/useTranslation';

const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'];
const collections = ['All', 'OASIS Genesis', 'OASIS Quest', 'OASIS Ships', 'OASIS Territory', 'Golden Eggs', 'OASIS Cosmetics'];

function getCollectionLabelKey(c: string) {
  switch (c) {
    case 'All': return 'explore.all';
    case 'OASIS Genesis': return 'collections.oasisGenesis';
    case 'OASIS Quest': return 'collections.oasisQuest';
    case 'OASIS Ships': return 'collections.oasisShips';
    case 'OASIS Territory': return 'collections.oasisTerritory';
    case 'Golden Eggs': return 'collections.goldenEggs';
    case 'OASIS Cosmetics': return 'collections.oasisCosmetics';
    default: return c;
  }
}

// Fallback mock data for dev without a populated DB
const mockItems: ArtifactCardData[] = [
  { id: '1', name: 'Tree of Life Avatar', image: '', collection: 'OASIS Genesis', rarity: 'mythic', price: '2,500', listingType: 'fixed' },
  { id: '2', name: 'Warp Gate Key', image: '', collection: 'OASIS Quest', rarity: 'legendary', price: '800', listingType: 'auction', bestBid: '1,200', endsAt: Date.now() + 36e5 * 5 },
  { id: '3', name: 'Galaxy Core Shard', image: '', collection: 'OASIS Genesis', rarity: 'epic', price: '350', listingType: 'fixed' },
  { id: '4', name: 'Ship HUD Mk-III', image: '', collection: 'OASIS Ships', rarity: 'rare', price: '120', listingType: 'fixed' },
  { id: '5', name: 'Golden Egg #001', image: '', collection: 'Golden Eggs', rarity: 'mythic', price: '5,000', listingType: 'auction', bestBid: '7,500', endsAt: Date.now() + 36e5 * 12 },
  { id: '6', name: 'Stellar Trail Skin', image: '', collection: 'OASIS Cosmetics', rarity: 'uncommon', price: '20', listingType: 'fixed' },
  { id: '7', name: 'Sector 7 Deed', image: '', collection: 'OASIS Territory', rarity: 'rare', price: '450', listingType: 'fixed' },
  { id: '8', name: 'Void Walker Avatar', image: '', collection: 'OASIS Genesis', rarity: 'unique', listingType: 'none' },
  { id: '9', name: 'Plasma Cannon Mk-II', image: '', collection: 'OASIS Ships', rarity: 'epic', price: '280', listingType: 'fixed' },
  { id: '10', name: 'Crystal of Insight', image: '', collection: 'OASIS Quest', rarity: 'rare', price: '150', listingType: 'auction', bestBid: '180', endsAt: Date.now() + 36e5 * 2 },
  { id: '11', name: 'Iron Shield', image: '', collection: 'OASIS Quest', rarity: 'common', price: '5', listingType: 'fixed' },
  { id: '12', name: 'Genesis Crown', image: '', collection: 'OASIS Genesis', rarity: 'mythic', listingType: 'none' },
];

const sortOptions = [
  { value: 'recent', key: 'explore.sortRecent' },
  { value: 'price_low', key: 'explore.sortPriceLow' },
  { value: 'price_high', key: 'explore.sortPriceHigh' },
  { value: 'rarity', key: 'explore.sortRarity' },
];

export default function ExplorePage() {
  const [collection, setCollection] = useState('All');
  const [selectedRarities, setSelectedRarities] = useState<Set<Rarity>>(new Set());
  const [listingFilter, setListingFilter] = useState<'all' | 'fixed' | 'auction'>('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ArtifactCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLangT();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const filters: ItemsFilters = {
      sort: sort as ItemsFilters['sort'],
      page: 1,
      pageSize: 60,
    };

    if (collection !== 'All') filters.category = collection.toLowerCase().replace(/\s+/g, '_');
    if (selectedRarities.size === 1) filters.rarity = Array.from(selectedRarities)[0];

    getItems(filters).then((res: ItemsResponse | null) => {
      if (cancelled) return;
      const base = res?.data ?? mockItems;
      let data = [...base];
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((i) => i.name.toLowerCase().includes(q) || (i.collection ?? '').toLowerCase().includes(q));
      }
      if (listingFilter !== 'all') {
        data = data.filter((i) => (i.listingType ?? 'none') === listingFilter);
      }
      if (selectedRarities.size > 0) {
        data = data.filter((i) => selectedRarities.has(i.rarity));
      }
      // Client-side collection filter for fallback mock data
      if (collection !== 'All') {
        data = data.filter((i) => i.collection === collection);
      }
      setItems(data);
      setTotal(res?.total ?? base.length);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [collection, selectedRarities, listingFilter, sort, search]);

  const toggleRarity = (r: Rarity) => {
    const next = new Set(selectedRarities);
    next.has(r) ? next.delete(r) : next.add(r);
    setSelectedRarities(next);
  };

  const listingOptions: { value: 'all' | 'fixed' | 'auction'; icon: ReactNode; label: string }[] = [
    { value: 'all', icon: <Globe className="w-4 h-4" />, label: t('explore.listingAll') },
    { value: 'fixed', icon: <Zap className="w-4 h-4" />, label: t('explore.listingFixed') },
    { value: 'auction', icon: <Gavel className="w-4 h-4" />, label: t('explore.listingAuction') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="zion-kicker mb-3">{t('explore.kicker')}</div>
          {(() => {
            const [first, ...rest] = t('explore.title').split(' ');
            return (
              <h1 className="text-3xl font-black font-display mb-1">
                <span className="text-gradient">{first}</span> <span className="text-white">{rest.join(' ')}</span>
              </h1>
            );
          })()}
          <p className="text-sm text-gray-500">{t('explore.description')}</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder={t('explore.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-zion pl-10 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Filters sidebar */}
        <aside className="space-y-4">
          {/* Collection */}
          <div className="zion-section p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-rasta-red" />
              {t('explore.collectionTitle')}
            </h3>
            <div className="space-y-1">
              {collections.map(c => (
                <button
                  key={c}
                  onClick={() => setCollection(c)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    collection === c
                      ? 'bg-rasta-red/20 text-white border border-rasta-red/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {t(getCollectionLabelKey(c))}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div className="zion-section p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-rasta-gold" />
              {t('explore.rarityTitle')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {rarities.map(r => (
                <button
                  key={r}
                  onClick={() => toggleRarity(r)}
                  className={`rarity-badge rarity-${r} cursor-pointer transition-all duration-200 ${
                    selectedRarities.has(r) ? 'ring-2 ring-white/30 scale-105' : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  {t(`rarity.${r}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Listing type */}
          <div className="zion-section p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-rasta-green" />
              {t('explore.listingTitle')}
            </h3>
            <div className="space-y-1">
              {listingOptions.map(o => (
                <button
                  key={o.value}
                  onClick={() => setListingFilter(o.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-all duration-200 ${
                    listingFilter === o.value
                      ? 'bg-rasta-green/20 text-white border border-rasta-green/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {o.icon}
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t('explore.itemsCount', { count: total })}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-zion w-auto"
            >
              {sortOptions.map(o => (
                <option key={o.value} value={o.value} className="bg-zion-card">{t(o.key)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="zion-section p-16 text-center">
              <div className="w-10 h-10 border-2 border-rasta-gold/30 border-t-rasta-gold rounded-full animate-spin mx-auto mb-4" />
              <div className="text-gray-500">{t('explore.loading')}</div>
            </div>
          ) : items.length === 0 ? (
            <div className="zion-section p-16 text-center">
              <SearchX className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <div className="text-gray-500 mb-1">{t('explore.emptyTitle')}</div>
              <div className="text-xs text-gray-600">{t('explore.emptySubtitle')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item, i) => (
                <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
