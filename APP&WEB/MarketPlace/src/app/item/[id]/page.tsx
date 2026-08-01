'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from 'wagmi';

const mockItem = {
  id: '1',
  name: 'Tree of Life Avatar',
  collection: 'OASIS Genesis',
  rarity: 'mythic' as const,
  description: 'A sacred avatar born from the Tree of Life in the OASIS Genesis event. Grants the bearer enhanced wisdom stats and unique visual aura in-game.',
  image: '',
  price: '2.5',
  listingType: 'fixed' as 'fixed' | 'auction' | 'none',
  tokenId: '42',
  supply: '100',
  owner: '0x1234…abcd',
  properties: [
    { trait: 'Origin', value: 'Genesis Event' },
    { trait: 'Class', value: 'Avatar' },
    { trait: 'Wisdom Boost', value: '+25%' },
    { trait: 'Aura', value: 'Emerald Glow' },
    { trait: 'Tradeable', value: 'Yes' },
  ],
  history: [
    { event: 'Listed', price: '2.5 ETH', from: '0x1234…abcd', time: '2h ago' },
    { event: 'Minted', price: '—', from: 'OASIS Quest', time: '5d ago' },
  ],
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const [bidAmount, setBidAmount] = useState('');
  const [imgError, setImgError] = useState(false);
  const item = mockItem; // TODO: fetch by params.id

  const isOwner = isConnected && address?.toLowerCase() === item.owner.toLowerCase();

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="glass-panel">
          <div className="glass-panel-inner">
            <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-oasis-purple/20 via-oasis-cyan/10 to-oasis-gold/10 flex items-center justify-center">
              {imgError ? (
                <span className="text-9xl text-gradient font-black">Z</span>
              ) : (
                <img
                  src={item.image}
                  alt={item.name}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <div className="text-sm text-gray-500 mb-1">{item.collection}</div>
            <h1 className="text-3xl font-black text-white mb-2">{item.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
              <span className="text-xs text-gray-500 font-mono">
                Token #{item.tokenId} · Supply {item.supply}
              </span>
            </div>
          </div>

          {/* Price card */}
          <div className="card p-5">
            {item.listingType === 'fixed' && (
              <>
                <div className="text-xs text-gray-500 mb-1">Current Price</div>
                <div className="text-3xl font-black text-gradient-gold mb-4">
                  {item.price} ETH
                </div>
                <button
                  disabled={!isConnected || isOwner}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {!isConnected ? 'Connect wallet to buy' : isOwner ? 'You own this item' : 'Buy Now'}
                </button>
              </>
            )}
            {item.listingType === 'auction' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Top Bid</span>
                  <span className="text-xs text-oasis-gold">5h 23m left</span>
                </div>
                <div className="text-3xl font-black text-oasis-cyan mb-4">
                  {item.price} ETH
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Bid amount (ETH)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-oasis-cyan/50 focus:outline-none"
                  />
                  <button
                    disabled={!isConnected || !bidAmount}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Place Bid
                  </button>
                </div>
              </>
            )}
            {item.listingType === 'none' && (
              <div className="text-center py-4 text-gray-500">
                Not currently listed for sale
              </div>
            )}
          </div>

          {/* Description */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
          </div>

          {/* Properties */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Properties</h3>
            <div className="grid grid-cols-2 gap-2">
              {item.properties.map(p => (
                <div key={p.trait} className="rounded-lg bg-white/5 border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 uppercase">{p.trait}</div>
                  <div className="text-sm text-oasis-cyan font-semibold">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Activity</h3>
        <div className="space-y-2">
          {item.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`status-dot ${
                  h.event === 'Listed' ? 'status-active' :
                  h.event === 'Minted' ? 'status-pending' : 'status-inactive'
                }`} />
                <span className="text-sm text-white font-semibold">{h.event}</span>
                <span className="text-xs text-gray-500 font-mono">{h.from}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gradient-gold font-mono">{h.price}</span>
                <span className="text-xs text-gray-600">{h.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
