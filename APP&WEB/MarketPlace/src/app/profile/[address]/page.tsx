'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import ItemCard, { type ArtifactCardData } from '@/components/ItemCard';

const mockOwned: ArtifactCardData[] = [
  { id: '101', name: 'Tree of Life Avatar', image: '', collection: 'OASIS Genesis', rarity: 'mythic', price: '2.5', listingType: 'fixed' },
  { id: '102', name: 'Ship HUD Mk-III', image: '', collection: 'OASIS Ships', rarity: 'rare', listingType: 'none' },
  { id: '103', name: 'Crystal of Insight', image: '', collection: 'OASIS Quest', rarity: 'rare', price: '0.15', listingType: 'auction', bestBid: '0.18', endsAt: Date.now() + 36e5 * 2 },
];

const mockActivity = [
  { type: 'Sale', item: 'Warp Gate Key', price: '0.9 ETH', time: '1h ago' },
  { type: 'Purchase', item: 'Golden Egg #001', price: '5.0 ETH', time: '3d ago' },
  { type: 'Listed', item: 'Tree of Life Avatar', price: '2.5 ETH', time: '5d ago' },
  { type: 'Minted', item: 'Ship HUD Mk-III', price: '—', time: '1w ago' },
];

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const { address: connected } = useAccount();
  const [tab, setTab] = useState<'owned' | 'listed' | 'activity'>('owned');

  const addr = params.address || connected || '0x0000…0000';
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const isMe = connected?.toLowerCase() === addr.toLowerCase();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-panel">
        <div className="glass-panel-inner flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center text-3xl font-black text-oasis-black">
            {addr.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white mb-1 font-mono">{short}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <a
                href={`https://basescan.org/address/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-oasis-cyan"
              >
                View on Basescan ↗
              </a>
              {isMe && <span className="rarity-badge rarity-unique">You</span>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-black text-oasis-cyan">47</div>
              <div className="text-xs text-gray-500">Owned</div>
            </div>
            <div>
              <div className="text-xl font-black text-gradient-gold">12</div>
              <div className="text-xs text-gray-500">Listed</div>
            </div>
            <div>
              <div className="text-xl font-black text-oasis-emerald">8.4 ETH</div>
              <div className="text-xs text-gray-500">Volume</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {(['owned', 'listed', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 ${
              tab === t
                ? 'text-white border-oasis-cyan'
                : 'text-gray-500 border-transparent hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'owned' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {mockOwned.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {tab === 'listed' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {mockOwned.filter(i => i.listingType !== 'none').map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-5">
          <div className="space-y-2">
            {mockActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`status-dot ${
                    a.type === 'Sale' ? 'status-active' :
                    a.type === 'Purchase' ? 'status-active' :
                    a.type === 'Listed' ? 'status-pending' : 'status-inactive'
                  }`} />
                  <span className="text-sm text-white font-semibold">{a.type}</span>
                  <span className="text-sm text-gray-400">{a.item}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gradient-gold font-mono">{a.price}</span>
                  <span className="text-xs text-gray-600">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
