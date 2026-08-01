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
  price?: string;        // wZION
  bestBid?: string;      // wZION
  listingType?: 'fixed' | 'auction' | 'none';
  endsAt?: number;       // auction end timestamp
}

const rarityOrder: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6,
};

const rarityGlow: Record<Rarity, string> = {
  common: '',
  uncommon: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
  rare: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
  epic: 'shadow-[0_0_20px_rgba(147,51,234,0.2)]',
  legendary: 'shadow-[0_0_20px_rgba(255,215,0,0.2)]',
  mythic: 'shadow-[0_0_25px_rgba(244,63,94,0.25)]',
  unique: 'shadow-[0_0_25px_rgba(6,182,212,0.25)]',
};

/* ZION rainbow-card --rc color per rarity (RGB triplet string) */
const rarityRC: Record<Rarity, string> = {
  common: '120, 120, 130',
  uncommon: '16, 185, 129',
  rare: '59, 130, 246',
  epic: '147, 51, 234',
  legendary: '255, 215, 0',
  mythic: '244, 63, 94',
  unique: '6, 182, 212',
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
      <div
        className={`zion-rainbow-card h-full p-4 ${rarityGlow[item.rarity]}`}
        style={{ ['--rc' as string]: rarityRC[item.rarity] }}
      >
        {/* Image */}
        <div className="relative aspect-square rounded-xl overflow-hidden mb-3 artifact-placeholder">
          {imgError || !item.image ? (
            <div className="w-full h-full flex items-center justify-center relative">
              <span className="text-5xl text-gradient font-black font-display relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                Z
              </span>
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
          <div className="absolute top-2 left-2 z-20">
            <span className={`rarity-badge rarity-${item.rarity}`}>
              {item.rarity}
            </span>
          </div>
          {/* Listing type badge */}
          {item.listingType && item.listingType !== 'none' && (
            <div className="absolute top-2 right-2 z-20">
              <span className={`rarity-badge ${
                item.listingType === 'auction'
                  ? 'rarity-unique'
                  : 'rarity-legendary'
              }`}>
                {item.listingType === 'auction' ? '🔨 Auction' : '⚡ Buy'}
              </span>
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-oasis-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col">
          <div className="text-xs text-gray-500 mb-0.5">{item.collection}</div>
          <h3 className="font-bold text-white text-sm leading-tight mb-2 line-clamp-1 group-hover:text-oasis-cyan transition-colors">
            {item.name}
          </h3>

          {/* Price */}
          <div className="mt-auto pt-2 border-t border-white/5">
            {item.price && item.listingType === 'fixed' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Price</span>
                <span className="font-mono text-sm text-gradient-gold font-bold">
                  {item.price} <span className="text-gray-500 text-xs">wZION</span>
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
                    {item.bestBid || item.price || '—'} <span className="text-gray-500 text-xs">wZION</span>
                  </div>
                  {timeLeft(item.endsAt) && (
                    <div className={`text-[10px] ${timeLeft(item.endsAt) === 'Ended' ? 'text-oasis-rose' : 'text-gray-500'}`}>
                      {timeLeft(item.endsAt)}
                    </div>
                  )}
                </div>
              </div>
            )}
            {(!item.listingType || item.listingType === 'none') && (
              <div className="text-xs text-gray-600 text-center py-1">Not listed</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export { rarityOrder };
