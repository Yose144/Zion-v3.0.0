'use client';

import { useState, useMemo } from 'react';
import ItemCard, { type ArtifactCardData, type Rarity } from '@/components/ItemCard';

// Mock data — will be replaced with API + on-chain data
const mockItems: ArtifactCardData[] = [
  { id: '1', name: 'Tree of Life Avatar', image: '', collection: 'OASIS Genesis', rarity: 'mythic', price: '2.5', listingType: 'fixed' },
  { id: '2', name: 'Warp Gate Key', image: '', collection: 'OASIS Quest', rarity: 'legendary', price: '0.8', listingType: 'auction', bestBid: '1.2', endsAt: Date.now() + 36e5 * 5 },
  { id: '3', name: 'Galaxy Core Shard', image: '', collection: 'OASIS Genesis', rarity: 'epic', price: '0.35', listingType: 'fixed' },
  { id: '4', name: 'Ship HUD Mk-III', image: '', collection: 'OASIS Ships', rarity: 'rare', price: '0.12', listingType: 'fixed' },
  { id: '5', name: 'Golden Egg #001', image: '', collection: 'Golden Eggs', rarity: 'mythic', price: '5.0', listingType: 'auction', bestBid: '7.5', endsAt: Date.now() + 36e5 * 12 },
  { id: '6', name: 'Stellar Trail Skin', image: '', collection: 'OASIS Cosmetics', rarity: 'uncommon', price: '0.02', listingType: 'fixed' },
  { id: '7', name: 'Sector 7 Deed', image: '', collection: 'OASIS Territory', rarity: 'rare', price: '0.45', listingType: 'fixed' },
  { id: '8', name: 'Void Walker Avatar', image: '', collection: 'OASIS Genesis', rarity: 'unique', listingType: 'none' },
  { id: '9', name: 'Plasma Cannon Mk-II', image: '', collection: 'OASIS Ships', rarity: 'epic', price: '0.28', listingType: 'fixed' },
  { id: '10', name: 'Crystal of Insight', image: '', collection: 'OASIS Quest', rarity: 'rare', price: '0.15', listingType: 'auction', bestBid: '0.18', endsAt: Date.now() + 36e5 * 2 },
  { id: '11', name: 'Iron Shield', image: '', collection: 'OASIS Quest', rarity: 'common', price: '0.005', listingType: 'fixed' },
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
    const priceNum = (i: ArtifactCardData) => parseFloat(i.bestBid || i.price || '0');
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-black">
          <span className="text-gradient">Explore</span> <span className="text-white">Artifacts</span>
        </h1>
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm w-full sm:w-64 focus:border-oasis-cyan/50 focus:outline-none"
        />
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Filters sidebar */}
        <aside className="space-y-5">
          {/* Collection */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Collection</h3>
            <div className="space-y-1">
              {collections.map(c => (
                <button
                  key={c}
                  onClick={() => setCollection(c)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
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
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Rarity</h3>
            <div className="flex flex-wrap gap-2">
              {rarities.map(r => (
                <button
                  key={r}
                  onClick={() => toggleRarity(r)}
                  className={`rarity-badge rarity-${r} cursor-pointer transition-all ${
                    selectedRarities.has(r) ? 'ring-2 ring-white/30' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Listing type */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Listing</h3>
            <div className="space-y-1">
              {(['all', 'fixed', 'auction'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setListingFilter(t)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                    listingFilter === t
                      ? 'bg-oasis-cyan/20 text-white border border-oasis-cyan/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {t === 'all' ? 'All listings' : t === 'fixed' ? 'Buy now' : 'Auctions'}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{filtered.length} items</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-oasis-cyan/50 focus:outline-none"
            >
              {sortOptions.map(o => (
                <option key={o.value} value={o.value} className="bg-zion-card">{o.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              No items match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(item => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
