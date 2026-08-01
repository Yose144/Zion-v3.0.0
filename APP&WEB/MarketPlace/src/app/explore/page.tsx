'use client';

import { useState, useMemo } from 'react';
import ItemCard, { type ArtifactCardData, type Rarity } from '@/components/ItemCard';

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

const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'];
const collections = ['All', 'OASIS Genesis', 'OASIS Quest', 'OASIS Ships', 'OASIS Territory', 'Golden Eggs', 'OASIS Cosmetics'];
const sortOptions = [
  { value: 'recent', label: 'Recently Listed' },
  { value: 'price-low', label: 'Price: Low → High' },
  { value: 'price-high', label: 'Price: High → Low' },
  { value: 'rarity', label: 'Rarity' },
];

export default function ExplorePage() {
  const [collection, setCollection] = useState('All');
  const [selectedRarities, setSelectedRarities] = useState<Set<Rarity>>(new Set());
  const [listingFilter, setListingFilter] = useState<'all' | 'fixed' | 'auction'>('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = [...mockItems];
    if (collection !== 'All') items = items.filter(i => i.collection === collection);
    if (selectedRarities.size > 0) items = items.filter(i => selectedRarities.has(i.rarity));
    if (listingFilter !== 'all') items = items.filter(i => i.listingType === listingFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.collection.toLowerCase().includes(q));
    }
    const priceNum = (i: ArtifactCardData) => parseFloat((i.bestBid || i.price || '0').replace(/,/g, ''));
    switch (sort) {
      case 'price-low': items.sort((a, b) => priceNum(a) - priceNum(b)); break;
      case 'price-high': items.sort((a, b) => priceNum(b) - priceNum(a)); break;
      case 'rarity': {
        const order: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 };
        items.sort((a, b) => order[b.rarity] - order[a.rarity]); break;
      }
    }
    return items;
  }, [collection, selectedRarities, listingFilter, sort, search]);

  const toggleRarity = (r: Rarity) => {
    const next = new Set(selectedRarities);
    next.has(r) ? next.delete(r) : next.add(r);
    setSelectedRarities(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black font-display mb-1">
            <span className="text-gradient">Explore</span> <span className="text-white">Artifacts</span>
          </h1>
          <p className="text-sm text-gray-500">Discover and trade OASIS universe artifacts</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search items…"
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
          <div className="card p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-purple" />
              Collection
            </h3>
            <div className="space-y-1">
              {collections.map(c => (
                <button
                  key={c}
                  onClick={() => setCollection(c)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    collection === c
                      ? 'bg-oasis-purple/20 text-white border border-oasis-purple/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-gold" />
              Rarity
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
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Listing type */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-cyan" />
              Listing
            </h3>
            <div className="space-y-1">
              {(['all', 'fixed', 'auction'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setListingFilter(t)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-all duration-200 ${
                    listingFilter === t
                      ? 'bg-oasis-cyan/20 text-white border border-oasis-cyan/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {t === 'all' ? '🌐 All listings' : t === 'fixed' ? '⚡ Buy now' : '🔨 Auctions'}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              <span className="text-white font-bold">{filtered.length}</span> items
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-zion w-auto"
            >
              {sortOptions.map(o => (
                <option key={o.value} value={o.value} className="bg-zion-card">{o.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-4 opacity-30">🔍</div>
              <div className="text-gray-500 mb-1">No items match your filters</div>
              <div className="text-xs text-gray-600">Try adjusting your search or filters</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((item, i) => (
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
