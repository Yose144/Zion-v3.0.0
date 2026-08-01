'use client';

import Link from 'next/link';
import { useState } from 'react';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'unique';

export interface ArtifactCardData {
  id: string;
  name: string;
  image: string;
  collection: string;
  rarity: Rarity;
  price?: string;        // ETH
  bestBid?: string;      // ETH
  listingType?: 'fixed' | 'auction' | 'none';
  endsAt?: number;       // auction end timestamp
}

const rarityOrder: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6,
};

function timeLeft(ts?: number): string | null {
  if (!ts) return null;
  const ms = ts - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function ItemCard({ item }: { item: ArtifactCardData }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link href={`/item/${item.id}`} className="block group">
      <div className="glass-panel h-full">
        <div className="glass-panel-inner flex flex-col h-full">
          {/* Image */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-zion-card mb-3">
            {imgError ? (
              <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-oasis-purple/20 to-oasis-cyan/20">
                <span className="text-gradient font-black">Z</span>
              </div>
            ) : (
              <img
                src={item.image}
                alt={item.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            {/* Rarity badge */}
            <div className="absolute top-2 left-2">
              <span className={`rarity-badge rarity-${item.rarity}`}>
                {item.rarity}
              </span>
            </div>
            {/* Listing type badge */}
            {item.listingType && item.listingType !== 'none' && (
              <div className="absolute top-2 right-2">
                <span className={`rarity-badge ${
                  item.listingType === 'auction'
                    ? 'rarity-unique'
                    : 'rarity-legendary'
                }`}>
                  {item.listingType === 'auction' ? 'Auction' : 'Buy'}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col">
            <div className="text-xs text-gray-500 mb-0.5">{item.collection}</div>
            <h3 className="font-bold text-white text-sm leading-tight mb-2 line-clamp-1">
              {item.name}
            </h3>

            {/* Price */}
            <div className="mt-auto pt-2 border-t border-white/5">
              {item.price && item.listingType === 'fixed' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Price</span>
                  <span className="font-mono text-sm text-gradient-gold font-bold">
                    {item.price} ETH
                  </span>
                </div>
              )}
              {item.listingType === 'auction' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {item.bestBid ? 'Top bid' : 'Starting'}
                  </span>
                  <div className="text-right">
                    <div className="font-mono text-sm text-oasis-cyan font-bold">
                      {item.bestBid || item.price || '—'} ETH
                    </div>
                    {timeLeft(item.endsAt) && (
                      <div className="text-[10px] text-gray-500">{timeLeft(item.endsAt)}</div>
                    )}
                  </div>
                </div>
              )}
              {(!item.listingType || item.listingType === 'none') && (
                <div className="text-xs text-gray-600 text-center">Not listed</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export { rarityOrder };
